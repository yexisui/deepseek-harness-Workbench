import { createReadStream, openAsBlob } from 'node:fs'
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { JevService } from '../../../dsh-jev-mode/src/host/service.ts'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { latest, type Role, type State } from '../core/model.ts'
import { MEETING_CAPABILITY_ID } from '../core/default-roles.ts'
import { InputError } from '../core/validation.ts'

export type MeetingSegment = { id: string; start: number; end: number; speaker: string; text: string }
export type MeetingItem = { text: string; sourceIds: string[] }
export type MeetingAction = MeetingItem & { owner: string; deadline: string }
export type MeetingMinutes = { title: string; overview: string; decisions: MeetingItem[]; actions: MeetingAction[]; unknown: MeetingItem[] }
type MeetingRole = { version: number; name: string; duties: string; requirements: string; format: string }
export type MeetingJob = {
  id: string; fileName: string; extension: string; size: number; createdAt: string; updatedAt: string
  mode: 'quick' | 'guided'; audience: string; focus: string; summaryModel: string
  role?: MeetingRole
  status: 'uploading' | 'transcribing' | 'transcribed' | 'generating' | 'ready' | 'error'
  error?: string; segments: MeetingSegment[]; minutes?: MeetingMinutes
}

const MAX_MB = 100
const ALLOWED = new Set(['.mp3', '.m4a', '.wav', '.aac', '.flac', '.ogg', '.opus', '.webm', '.mp4'])
const ID = /^[a-f0-9-]{36}$/i
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const string = (value: unknown, max = 200) => typeof value === 'string' ? value.trim().slice(0, max) : ''
const errorText = (error: unknown) => error instanceof Error ? error.message : String(error)

export type MeetingAsrConfig = { endpoint: string; model: string; apiKey: string; format: 'json' | 'verbose_json'; maxMb: number }

export function config(override?: Partial<MeetingAsrConfig>) {
  const endpoint = (override?.endpoint ?? process.env.MEETING_ASR_URL ?? '').trim()
  const model = (override?.model ?? process.env.MEETING_ASR_MODEL ?? '').trim()
  const apiKey = (override?.apiKey ?? process.env.MEETING_ASR_API_KEY ?? '').trim()
  const format = (override?.format ?? process.env.MEETING_ASR_RESPONSE_FORMAT ?? 'verbose_json').trim()
  const limit = Number(override?.maxMb ?? process.env.MEETING_ASR_MAX_MB ?? 25)
  const maxBytes = Math.min(MAX_MB, Math.max(1, Number.isFinite(limit) ? limit : 25)) * 1024 * 1024
  if (endpoint) {
    let url: URL
    try { url = new URL(endpoint) } catch { throw new Error('MEETING_ASR_URL 不是有效地址') }
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw new Error('语音识别接口须使用 HTTPS；本机服务可使用 HTTP')
    if (url.username || url.password || url.hash) throw new Error('语音识别接口地址不能包含凭据或片段')
  }
  if (!['json', 'verbose_json'].includes(format)) throw new Error('MEETING_ASR_RESPONSE_FORMAT 仅支持 json 或 verbose_json')
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_MB) throw new Error('录音大小限制应为 1–100 MB')
  return { endpoint, model, apiKey, format, maxBytes }
}

function parseSegments(data: any): MeetingSegment[] {
  const rows = Array.isArray(data?.segments) ? data.segments : Array.isArray(data?.transcripts) ? data.transcripts.flatMap((part: any) => Array.isArray(part?.sentences) ? part.sentences : []) : []
  const segments = rows.map((row: any, index: number) => ({
    id: `s${index + 1}`,
    start: Math.max(0, Number(row.begin_time ?? Number(row.start) * 1000) || 0),
    end: Math.max(0, Number(row.end_time ?? Number(row.end) * 1000) || 0),
    speaker: string(row.speaker, 100) || (row.speaker_id === undefined || row.speaker_id === null ? '发言人' : `发言人 ${Number(row.speaker_id) + 1}`),
    text: string(row.text, 5000),
  })).filter((row: MeetingSegment) => row.text)
  return segments.length ? segments : string(data?.text, 100_000) ? [{ id: 's1', start: 0, end: 0, speaker: '发言人', text: string(data.text, 100_000) }] : []
}

function parseMinutes(raw: string, segments: MeetingSegment[]): MeetingMinutes {
  const first = raw.indexOf('{'), last = raw.lastIndexOf('}')
  if (first < 0 || last < first) throw new Error('纪要模型没有返回可解析的结构')
  const value = JSON.parse(raw.slice(first, last + 1)) as any
  const valid = new Set(segments.map(row => row.id))
  const item = (row: any): MeetingItem => ({ text: string(typeof row === 'string' ? row : row?.text, 2000), sourceIds: Array.isArray(row?.sourceIds) ? row.sourceIds.filter((id: unknown): id is string => typeof id === 'string' && valid.has(id)).slice(0, 4) : [] })
  const list = (rows: any) => Array.isArray(rows) ? rows.map(item).filter((row: MeetingItem) => row.text).slice(0, 30) : []
  return {
    title: string(value.title, 120) || '会议纪要', overview: string(value.overview, 6000), decisions: list(value.decisions),
    actions: Array.isArray(value.actions) ? value.actions.map((row: any) => ({ ...item(row), owner: string(row?.owner, 100), deadline: string(row?.deadline, 100) })).filter((row: MeetingAction) => row.text).slice(0, 30) : [],
    unknown: list(value.unknown),
  }
}

export class MeetingService {
  private running = new Set<string>()
  private deleted = new Set<string>()
  private controllers = new Map<string, AbortController>()
  constructor(private readonly root: string, private readonly workbenchText: (prompt: string, modelRoute: string, signal?: AbortSignal) => Promise<string>, private readonly currentRole?: () => Role | undefined, private readonly currentState?: () => State, private readonly asrSettings?: () => Partial<MeetingAsrConfig> | undefined, private readonly jev?: JevService) {}
  private config() { return config(this.asrSettings?.()) }
  private capabilityError(): string | undefined {
    if (!this.currentState) return
    const cap = this.currentState().capabilities.find(item => item.id === MEETING_CAPABILITY_ID)
    if (!cap || cap.removedAt) return '会议录音转写能力已移除，请在能力中心恢复'
    if (this.currentState?.().componentRestrictions?.['meeting-asr']?.enabled === false) return '录音转写组件已全局停用'
    if (!cap.enabled) return '会议录音转写能力已停用，请在能力中心启用'
    if (!latest(cap.versions)?.components.some(part => part.componentId === 'meeting-asr' && part.actions.includes('transcribe'))) return '会议录音转写能力未发布可用的转写动作'
  }
  private role(version?: unknown, createdAt?: string): MeetingRole | undefined {
    const unavailable = this.capabilityError()
    if (unavailable) throw new InputError(unavailable, 409)
    if (!this.currentRole) return undefined
    const role = this.currentRole()
    if (!role?.enabled) throw new InputError('会议纪要助手已停用，请在岗位助手中启用后重试', 409)
    const binding = latest(role.versions)?.capabilities.find(item => item.capabilityId === MEETING_CAPABILITY_ID)
    if (this.currentState && (!binding?.enabled || (binding.actions && !binding.actions.includes('transcribe')))) throw new InputError('会议纪要助手未启用录音转写能力，请在岗位中检查关联', 409)
    if (createdAt && (this.currentState?.().componentRestrictions?.['meeting-asr']?.revokedAt ?? -1) >= Date.parse(createdAt)) throw new InputError('此会议任务的组件授权已撤销，请新建任务继续使用', 409)
    const published = version === undefined ? latest(role.versions) : role.versions.find(item => item.version === version)
    if (!published) throw new InputError('会议纪要岗位版本不存在，请重新选择岗位', 409)
    return { version: published.version, name: published.name, duties: published.duties, requirements: published.requirements, format: published.format }
  }
  async init() {
    await mkdir(this.root, { recursive: true })
    for (const file of await readdir(this.root)) {
      if (!ID.test(file.replace(/\.json$/, '')) || !file.endsWith('.json')) continue
      try {
        const job = await this.get(file.slice(0, -5))
        if (!['uploading', 'transcribing', 'generating'].includes(job.status)) continue
        job.status = 'error'
        job.error = job.size ? '处理被工作台重启中断，请点击重试' : '上传被工作台重启中断，请重新选择录音'
        await this.save(job)
        await rm(`${this.audio(job)}.upload`, { force: true })
      } catch { /* Leave unrelated or damaged files untouched. */ }
    }
  }
  availability() {
    try {
      const value = this.config(), unavailable = this.capabilityError(), role = this.currentRole?.()
      const binding = latest(role?.versions ?? [])?.capabilities.find(item => item.capabilityId === MEETING_CAPABILITY_ID)
      const roleUnavailable = this.currentState && role && (!role.enabled ? '会议纪要助手已停用，请在岗位助手中启用' : !binding?.enabled || (binding.actions && !binding.actions.includes('transcribe')) ? '会议纪要助手未启用录音转写能力' : '')
      const state = unavailable || roleUnavailable ? 'disabled' : !value.endpoint || !value.model ? 'unconfigured' : 'ready'
      return { ready: state === 'ready', state, provider: '自定义语音识别接口', endpointHost: value.endpoint ? new URL(value.endpoint).origin : '', endpoint: value.endpoint, asrModel: value.model, format: value.format, maxMb: value.maxBytes / 1024 / 1024, hasKey: Boolean(value.apiKey), maxBytes: value.maxBytes, message: unavailable || roleUnavailable || (state === 'ready' ? '语音识别接口已配置，尚需实际调用验证' : '请在默认配置中填写语音识别接口与模型') }
    }
    catch (error) { return { ready: false, provider: '自定义语音识别接口', maxBytes: 25 * 1024 * 1024, message: errorText(error) } }
  }
  private path(id: string) { if (!ID.test(id)) throw new InputError('无效任务标识'); return join(this.root, `${id}.json`) }
  private audio(job: MeetingJob) { return join(this.root, `${job.id}${job.extension}`) }
  async get(id: string): Promise<MeetingJob> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try { const job = JSON.parse(await readFile(this.path(id), 'utf8')) as MeetingJob; job.summaryModel ??= ''; return job }
      catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new InputError('会议任务不存在', 404); if (!(error instanceof SyntaxError) || attempt === 2) throw error; await sleep(10) }
    }
    throw new Error('会议状态暂不可读')
  }
  private async save(job: MeetingJob) {
    if (this.deleted.has(job.id)) return
    job.updatedAt = new Date().toISOString()
    await writeFile(this.path(job.id), JSON.stringify(job))
  }
  async remove(id: string) {
    const job = await this.get(id)
    this.deleted.add(id)
    await rm(this.audio(job), { force: true })
    await rm(this.path(id), { force: true })
  }
  async create(input: unknown) {
    if (!this.availability().ready) throw new InputError(this.availability().message, 503)
    const data = input && typeof input === 'object' ? input as Record<string, unknown> : {}
    const role = this.role(data.roleVersion)
    const fileName = string(data.fileName, 200).replace(/[\\/]/g, '_')
    const extension = /\.[a-z0-9]+$/i.exec(fileName)?.[0].toLowerCase() ?? ''
    if (!ALLOWED.has(extension)) throw new InputError('不支持此录音格式；请使用 MP3、M4A、WAV 等常见格式')
    const now = new Date().toISOString()
    const job: MeetingJob = { id: randomUUID(), fileName, extension, size: 0, createdAt: now, updatedAt: now, mode: data.mode === 'guided' ? 'guided' : 'quick', audience: string(data.audience, 100), focus: string(data.focus, 100), summaryModel: string(data.summaryModel, 200), role, status: 'uploading', segments: [] }
    await this.save(job)
    return job
  }
  async upload(id: string, req: IncomingMessage) {
    const job = await this.get(id)
    this.role(job.role?.version, job.createdAt)
    if (job.status !== 'uploading') throw new InputError('此任务无法重复上传', 409)
    const path = this.audio(job), temp = `${path}.upload`
    const handle = await import('node:fs').then(fs => fs.createWriteStream(temp, { flags: 'wx' }))
    let bytes = 0
    try {
      for await (const chunk of req) {
        const buffer = Buffer.from(chunk)
        bytes += buffer.length
        if (bytes > this.config().maxBytes) throw new InputError('录音文件超过当前上传限制', 413)
        if (!handle.write(buffer)) await new Promise<void>(resolve => handle.once('drain', resolve))
      }
      if (!req.complete) throw new InputError('录音上传中断，请重新选择文件')
      if (!bytes) throw new InputError('录音文件为空')
      if (this.deleted.has(id)) throw new InputError('此会议已删除', 410)
      await new Promise<void>((resolve, reject) => handle.end((error?: Error | null) => error ? reject(error) : resolve()))
      await rename(temp, path)
      job.size = bytes; job.status = 'transcribing'; delete job.error
      await this.save(job)
      void this.transcribe(job.id)
      return job
    } catch (error) { handle.destroy(); await rm(temp, { force: true }); job.status = 'error'; job.error = errorText(error); await this.save(job); throw error }
  }
  async retry(id: string) {
    const job = await this.get(id)
    this.role(job.role?.version, job.createdAt)
    if (job.status !== 'error') throw new InputError('只有失败的任务可以重试', 409)
    if (!job.size) throw new InputError('请重新选择录音上传', 409)
    job.status = job.segments.length ? 'transcribed' : 'transcribing'; delete job.error; await this.save(job)
    if (!job.segments.length) void this.transcribe(id)
    return job
  }
  private async transcribe(id: string) {
    if (this.running.has(id)) return
    this.running.add(id)
    const controller = new AbortController(); this.controllers.set(id, controller)
    try {
      const job = await this.get(id), { endpoint, apiKey, model, format } = this.config()
      if (!endpoint || !model) throw new Error('请先配置语音识别接口和模型')
      const form = new FormData()
      form.set('model', model)
      form.set('response_format', format)
      form.set('file', await openAsBlob(this.audio(job)), job.fileName)
      const sent = await fetch(endpoint, { method: 'POST', headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {}, body: form, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20 * 60_000)]) })
      const response = await sent.text()
      if (!sent.ok) throw new Error(`语音识别失败（${sent.status}）：${response.slice(0, 300)}`)
      let transcript: any
      try { transcript = JSON.parse(response) } catch { throw new Error('语音识别接口没有返回有效 JSON') }
      const segments = parseSegments(transcript)
      if (!segments.length) throw new Error('未识别到可用语音，请检查录音内容')
      const latest = await this.get(id)
      controller.signal.throwIfAborted(); this.role(latest.role?.version, latest.createdAt)
      latest.segments = segments; latest.status = 'transcribed'; await this.save(latest)
      if (latest.mode === 'quick') await this.generate(id)
    } catch (error) { if (!this.deleted.has(id)) { const job = await this.get(id); job.status = 'error'; job.error = errorText(error); await this.save(job) } }
    finally { this.running.delete(id); this.controllers.delete(id) }
  }
  private ask(prompt: string, modelRoute: string, signal?: AbortSignal) { return this.workbenchText(prompt, modelRoute, signal) }
  private transcriptText(rows: MeetingSegment[]) { return rows.map(row => `[${row.id} ${Math.floor(row.start / 60000).toString().padStart(2, '0')}:${Math.floor(row.start % 60000 / 1000).toString().padStart(2, '0')} ${row.speaker}] ${row.text}`).join('\n') }
  async generate(id: string, edited?: MeetingSegment[], instruction?: string, summaryModel?: string) {
    const job = await this.get(id)
    this.role(job.role?.version, job.createdAt)
    if (!['transcribed', 'ready', 'error'].includes(job.status) || !job.segments.length) throw new InputError('请先完成录音转写', 409)
    if (edited) {
      if (edited.length !== job.segments.length || edited.some((row, index) => row.id !== job.segments[index].id)) throw new InputError('转写片段与原录音不一致')
      job.segments = edited.map((row, index) => ({ ...job.segments[index], text: string(row.text, 5000), speaker: string(row.speaker, 100) || '发言人' }))
    }
    if (summaryModel !== undefined) job.summaryModel = string(summaryModel, 200)
    job.status = 'generating'; delete job.error; await this.save(job)
    void this.finishGenerate(job, instruction)
    return job
  }
  private async finishGenerate(job: MeetingJob, instruction?: string) {
    const controller = new AbortController(); this.controllers.set(job.id, controller)
    const jev=this.jev?.begin('meeting:'+job.id)
    try {
      const text = this.transcriptText(job.segments)
      await jev?.check('begin',{transcript:text,instruction,audience:job.audience,focus:job.focus},controller.signal)
      const chunks = text.match(/[\s\S]{1,16000}/g) ?? []
      let source = text
      if (chunks.length > 1) {
        const summaries: string[] = []
        for (let i = 0; i < chunks.length; i++) summaries.push(await this.ask(`以下是会议转写第 ${i + 1}/${chunks.length} 段。请保留事实、发言人、任务、时间和 [s编号] 引用，压缩为不超过 3000 字的中文摘要；只返回 JSON：{"summary":"..."}\n${chunks[i]}`, job.summaryModel, controller.signal))
        source = summaries.join('\n')
      }
      const previous = job.minutes ? `\n现有纪要：${JSON.stringify(job.minutes)}` : ''
      const roleGuidance = job.role ? `岗位：${job.role.name}。职责：${job.role.duties}。工作要求：${job.role.requirements}。输出偏好：${job.role.format}。\n` : ''
      const prompt = `${roleGuidance}用途：${job.audience || '通用会议纪要'}；重点：${job.focus || '结论与待办'}。${instruction ? `用户修改要求：${string(instruction, 1000)}。` : ''}\n请输出 JSON 对象，字段 title、overview、decisions（{text,sourceIds}数组）、actions（{text,owner,deadline,sourceIds}数组）、unknown（{text,sourceIds}数组）。sourceIds 只能取转写中的 s编号。没有依据的事项不要编造；缺少负责人或期限留空并放入待确认。${previous}\n转写内容：\n${source}`
      const minutes = parseMinutes(await this.ask(prompt+(jev?.guidance()??''), job.summaryModel, controller.signal), job.segments)
      const reviewed=await jev?.check('review',{transcript:text,minutes},controller.signal)
      if(reviewed?.decision==='clarify')throw new InputError('JEV 纪要复核需要确认，未覆盖已有纪要：'+reviewed.summary,409)
      controller.signal.throwIfAborted(); this.role(job.role?.version, job.createdAt)
      job.minutes = minutes; job.status = 'ready'; await this.save(job)
    } catch (error) { job.status = 'error'; job.error = controller.signal.aborted ? '组件已停用，本次处理已停止；历史结果保留' : errorText(error); await this.save(job) } finally { if (this.controllers.get(job.id) === controller) this.controllers.delete(job.id) }
  }
  async componentActivities() { return Promise.all([...this.controllers.keys()].map(async id => { const job = await this.get(id); return { id, name: job.fileName, kind: 'meeting', status: job.status, componentIds: ['meeting-asr'] } })) }
  async stopComponents(ids: string[]) { if (ids.includes('meeting-asr')) this.controllers.forEach(controller => controller.abort()) }
  async serveAudio(id: string, req: IncomingMessage, res: ServerResponse) {
    const job = await this.get(id), path = this.audio(job), size = (await stat(path)).size
    const match = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range ?? '')
    const start = match ? Number(match[1]) : 0, end = match?.[2] ? Math.min(Number(match[2]), size - 1) : size - 1
    if (start >= size || end < start) { res.writeHead(416, { 'content-range': `bytes */${size}` }); res.end(); return }
    const mime: Record<string, string> = { '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.wav': 'audio/wav', '.aac': 'audio/aac', '.flac': 'audio/flac', '.ogg': 'audio/ogg', '.opus': 'audio/ogg', '.webm': 'audio/webm', '.mp4': 'video/mp4' }
    res.writeHead(match ? 206 : 200, { 'content-type': mime[job.extension] ?? 'application/octet-stream', 'content-length': end - start + 1, 'accept-ranges': 'bytes', 'cache-control': 'private, no-store', ...(match ? { 'content-range': `bytes ${start}-${end}/${size}` } : {}) })
    createReadStream(path, { start, end }).pipe(res)
  }
}
