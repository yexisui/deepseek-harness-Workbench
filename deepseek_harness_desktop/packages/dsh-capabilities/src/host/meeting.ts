import { hasTiming, parseSegments, sourceKey, type TranscriptSegment } from '../core/meeting-timing.ts'
import { createReadStream, openAsBlob } from 'node:fs'
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { JevService } from '../../../dsh-jev-mode/src/host/service.ts'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { latest, type Role, type State } from '../core/model.ts'
import { allowedActions, wasRevoked } from '../core/policy.ts'
import { MEETING_CAPABILITY_ID, MEETING_ROLE_ID } from '../core/default-roles.ts'
import { InputError } from '../core/validation.ts'

export type MeetingSegment = TranscriptSegment
export type MeetingItem = { text: string; sourceIds: string[] }
export type MeetingAction = MeetingItem & { owner: string; deadline: string }
export type MeetingMinutes = { title: string; overview: string; decisions: MeetingItem[]; actions: MeetingAction[]; unknown: MeetingItem[] }
type MeetingRole = { version: number; name: string; duties: string; requirements: string; format: string }
export type MeetingJob = {
  id: string; fileName: string; extension: string; size: number; createdAt: string; updatedAt: string
  mode: 'quick' | 'guided'; audience: string; focus: string; summaryModel: string
  role?: MeetingRole
  status: 'uploading' | 'transcribing' | 'transcribed' | 'generating' | 'ready' | 'error'
  timingStatus?: 'processing' | 'ready' | 'error'; timingError?: string; timing?: { segments: MeetingSegment[]; links: Record<string, string[]> };
  error?: string; segments: MeetingSegment[]; minutes?: MeetingMinutes
}
export type MeetingSummary = Pick<MeetingJob, 'id' | 'mode' | 'audience' | 'focus' | 'summaryModel' | 'status' | 'updatedAt' | 'createdAt'> & { title: string; roleVersion?: number }

const MAX_MB = 100
const ALLOWED = new Set(['.mp3', '.m4a', '.wav', '.aac', '.flac', '.ogg', '.opus', '.webm', '.mp4'])
const ID = /^[a-f0-9-]{36}$/i
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const string = (value: unknown, max = 200) => typeof value === 'string' ? value.trim().slice(0, max) : ''
const errorText = (error: unknown) => error instanceof Error ? error.message : String(error)

export type MeetingAsrConfig = { modelRef?: string; endpoint: string; model: string; apiKey: string; format: 'json' | 'verbose_json'; maxMb: number }

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
  private timingRunning = new Set<string>()
  private running = new Set<string>()
  private deleted = new Set<string>()
  private controllers = new Map<string, AbortController>()
  private pending = new Map<string, Set<Promise<unknown>>>()
  private removing = new Set<string>()
  private uploads = new Map<string, IncomingMessage>()
  private track<T>(id: string, run: () => Promise<T>): Promise<T> {
    if (this.removing.has(id) || this.deleted.has(id)) return Promise.reject(new InputError('此会议正在移除或已删除', 409))
    const pending = this.pending.get(id) ?? new Set<Promise<unknown>>()
    this.pending.set(id, pending)
    const task = Promise.resolve().then(() => {
      if (this.removing.has(id) || this.deleted.has(id)) throw new InputError('此会议正在移除或已删除', 409)
      return run()
    })
    pending.add(task)
    void task.finally(() => { pending.delete(task); if (!pending.size && this.pending.get(id) === pending) this.pending.delete(id) }).catch(() => {})
    return task
  }
  constructor(private readonly root: string, private readonly workbenchText: (prompt: string, modelRoute: string, signal?: AbortSignal) => Promise<string>, private readonly currentRole?: () => Role | undefined, private readonly currentState?: () => State, private readonly asrSettings?: () => Partial<MeetingAsrConfig> | undefined, private readonly jev?: JevService, private readonly skillGuidance?: (roleId:string,version:number,cwd?:string,createdAt?:number)=>string, private readonly resolveAsr?: () => Promise<MeetingAsrConfig>) {}
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
    const published = version === undefined ? latest(role.versions) : role.versions.find(item => item.version === version)
    if (!published) throw new InputError('会议纪要岗位版本不存在，请重新选择岗位', 409)
    if (this.currentState) {
      const state = this.currentState()
      if (createdAt && wasRevoked(state, role.id, published, Date.parse(createdAt))) throw new InputError('此会议任务的授权已撤销，请新建会议继续使用', 409)
      if (!allowedActions(state, role.id, published).includes('transcribe')) throw new InputError('此会议岗位版本的转写权限已撤销或未获授权，请新建会议继续使用', 409)
    }
    return { version: published.version, name: published.name, duties: published.duties, requirements: published.requirements, format: published.format }
  }
  async init() {
    await mkdir(this.root, { recursive: true })
    for (const file of await readdir(this.root)) {
      if (!ID.test(file.replace(/\.json$/, '')) || !file.endsWith('.json')) continue
      try {
        const job = await this.get(file.slice(0, -5))
        if (job.timingStatus === 'processing') { job.timingStatus = 'error'; job.timingError = '时间定位被重启中断，原纪要保留，可重新补全'; await this.save(job) }
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
      return { ready: state === 'ready', state, provider: '自定义语音识别接口', endpointHost: value.endpoint ? new URL(value.endpoint).origin : '', endpoint: value.endpoint, asrModel: value.model, format: value.format, maxMb: value.maxBytes / 1024 / 1024, hasKey: Boolean(value.apiKey), maxBytes: value.maxBytes, message: unavailable || roleUnavailable || (state === 'ready' ? '语音识别接口已配置，尚需实际调用验证' : '请在默认配置中选择识别模型，并检测转写支持') }
    }
    catch (error) { return { ready: false, provider: '自定义语音识别接口', maxBytes: 25 * 1024 * 1024, message: errorText(error) } }
  }
  private path(id: string) { if (!ID.test(id)) throw new InputError('无效任务标识'); return join(this.root, `${id}.json`) }
  private audio(job: MeetingJob) { return join(this.root, `${job.id}${job.extension}`) }
  async get(id: string): Promise<MeetingJob> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try { const job = JSON.parse(await readFile(this.path(id), 'utf8')) as MeetingJob; job.summaryModel ??= ''; job.segments = job.segments.map(row => hasTiming(row) ? row : { ...row, start: null, end: null }); return job }
      catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new InputError('会议任务不存在', 404); if (!(error instanceof SyntaxError) || attempt === 2) throw error; await sleep(10) }
    }
    throw new Error('会议状态暂不可读')
  }
  private async save(job: MeetingJob) {
    if (this.deleted.has(job.id)) return
    job.updatedAt = new Date().toISOString()
    await writeFile(this.path(job.id), JSON.stringify(job))
  }
  async list(offset = 0, limit = 30, cursor?: string): Promise<{ items: MeetingSummary[]; total: number; unreadableCount: number; nextCursor?: string }> {
    if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new InputError('会议分页参数无效')
    let boundary: { time: number; id: string } | undefined
    if (cursor) {
      try { boundary = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')); if (!boundary || !Number.isFinite(boundary.time) || typeof boundary.id !== 'string' || !ID.test(boundary.id)) throw new Error() }
      catch { throw new InputError('会议分页游标无效') }
    }
    const items: MeetingSummary[] = []
    let unreadableCount = 0
    for (const file of await readdir(this.root)) {
      if (!file.endsWith('.json') || !ID.test(file.slice(0, -5)) || this.deleted.has(file.slice(0, -5)) || this.removing.has(file.slice(0, -5))) continue
      try {
        const job = await this.get(file.slice(0, -5))
        if (job.id !== file.slice(0, -5) || !Number.isFinite(Date.parse(job.updatedAt)) || !Number.isFinite(Date.parse(job.createdAt)) || !['quick','guided'].includes(job.mode) || typeof job.fileName !== 'string') throw new Error('会议记录格式无效')
        items.push({ id: job.id, title: job.minutes?.title || job.fileName, mode: job.mode, audience: job.audience, focus: job.focus, summaryModel: job.summaryModel, status: job.status, updatedAt: job.updatedAt, createdAt: job.createdAt, roleVersion: job.role?.version })
      } catch { unreadableCount++ }
    }
    // Immutable creation time keeps paging stable while existing jobs finish or are removed.
    items.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.id.localeCompare(b.id))
    const remaining = boundary ? items.filter(item => Date.parse(item.createdAt) < boundary.time || (Date.parse(item.createdAt) === boundary.time && item.id.localeCompare(boundary.id) > 0)) : items.slice(offset)
    const page = remaining.slice(0, limit), last = page.at(-1)
    const nextCursor = remaining.length > page.length && last ? Buffer.from(JSON.stringify({ time: Date.parse(last.createdAt), id: last.id })).toString('base64url') : undefined
    return { items: page, total: items.length, unreadableCount, nextCursor }
  }
  async remove(id: string) {
    if (this.removing.has(id)) throw new InputError('会议正在移除，请稍后重试', 409)
    this.removing.add(id)
    try {
      let job: MeetingJob
      try { job = await this.get(id) } catch (error) { if (error instanceof InputError && error.status === 404) return; throw error }
      this.controllers.get(id)?.abort(new Error('会议已请求移除'))
      this.uploads.get(id)?.destroy(new Error('会议已请求移除'))
      let timeout: ReturnType<typeof setTimeout> | undefined
      try {
        await Promise.race([
          Promise.allSettled([...(this.pending.get(id) ?? [])]),
          new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new InputError('任务尚未确认停止，会议记录保留，请稍后重试', 409)), 10000) }),
        ])
      } finally { clearTimeout(timeout) }
      await rm(this.audio(job), { force: true })
      await rm(`${this.audio(job)}.upload`, { force: true })
      await rm(this.path(id), { force: true })
      this.deleted.add(id)
    } finally { this.removing.delete(id) }
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
    this.uploads.set(id, req)
    try { return await this.track(id, () => this.uploadAudio(id, req)) }
    finally { if (this.uploads.get(id) === req) this.uploads.delete(id) }
  }
  private async uploadAudio(id: string, req: IncomingMessage) {
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
      void this.track(job.id, () => this.transcribe(job.id)).catch(() => {})
      return job
    } catch (error) { handle.destroy(); await rm(temp, { force: true }); job.status = 'error'; job.error = errorText(error); await this.save(job); throw error }
  }
  async retry(id: string) {
    const job = await this.get(id)
    this.role(job.role?.version, job.createdAt)
    if (job.status !== 'error') throw new InputError('只有失败的任务可以重试', 409)
    if (!job.size) throw new InputError('请重新选择录音上传', 409)
    job.status = job.segments.length ? 'transcribed' : 'transcribing'; delete job.error; await this.save(job)
    if (!job.segments.length) void this.track(id, () => this.transcribe(id)).catch(() => {})
    return job
  }
  private async transcribe(id: string) {
    if (this.running.has(id)) return
    this.running.add(id)
    const controller = new AbortController(); this.controllers.set(id, controller)
    try {
      const job = await this.get(id), { endpoint, apiKey, model, format } = this.resolveAsr ? config(await this.resolveAsr()) : this.config()
      if (!endpoint || !model) throw new Error('请先配置语音识别接口和模型')
      const form = new FormData()
      form.set('model', model)
      form.set('response_format', format)
      if (format === 'verbose_json') form.set('timestamp_granularities[]', 'segment')
      form.set('file', await openAsBlob(this.audio(job)), job.fileName)
      const sent = await fetch(endpoint, { method: 'POST', redirect: 'error', headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {}, body: form, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20 * 60_000)]) })
      const response = await sent.text()
      if (!sent.ok) throw new Error(`语音识别失败（HTTP ${sent.status}），请在模型模块检查接口、Key、模型和配额`)
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
  private transcriptText(rows: MeetingSegment[]) { return rows.map(row => `[${row.id} ${hasTiming(row) ? Math.floor(row.start / 1000) + '秒' : '时间未知'} ${row.speaker}] ${row.text}`).join('\n') }
  async generate(id: string, edited?: MeetingSegment[], instruction?: string, summaryModel?: string) {
    return this.track(id, () => this.startGenerate(id, edited, instruction, summaryModel))
  }
  private async startGenerate(id: string, edited?: MeetingSegment[], instruction?: string, summaryModel?: string) {
    const job = await this.get(id)
    this.role(job.role?.version, job.createdAt)
    if (this.timingRunning.has(id) || job.timingStatus === 'processing') throw new InputError('时间定位处理中，请完成后再修改纪要', 409)
    if (!['transcribed', 'ready', 'error'].includes(job.status) || !job.segments.length) throw new InputError('请先完成录音转写', 409)
    if (edited) {
      if (edited.length !== job.segments.length || edited.some((row, index) => row.id !== job.segments[index].id)) throw new InputError('转写片段与原录音不一致')
      job.segments = edited.map((row, index) => ({ ...job.segments[index], text: string(row.text, 5000), speaker: string(row.speaker, 100) || '发言人' }))
    }
    if (summaryModel !== undefined) job.summaryModel = string(summaryModel, 200)
    job.status = 'generating'; delete job.error; await this.save(job)
    void this.track(id, () => this.finishGenerate(job, instruction)).catch(() => {})
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
      const prompt = `${roleGuidance}${job.role?this.skillGuidance?.(MEETING_ROLE_ID,job.role.version,undefined,Date.parse(job.createdAt))??'':''}用途：${job.audience || '通用会议纪要'}；重点：${job.focus || '结论与待办'}。${instruction ? `用户修改要求：${string(instruction, 1000)}。` : ''}\n请输出 JSON 对象，字段 title、overview、decisions（{text,sourceIds}数组）、actions（{text,owner,deadline,sourceIds}数组）、unknown（{text,sourceIds}数组）。sourceIds 只能取转写中的 s编号。没有依据的事项不要编造；缺少负责人或期限留空并放入待确认。${previous}\n转写内容：\n${source}`
      const minutes = parseMinutes(await this.ask(prompt+(jev?.guidance()??''), job.summaryModel, controller.signal), job.segments)
      const reviewed=await jev?.check('review',{transcript:text,minutes},controller.signal)
      if(reviewed?.decision==='clarify')throw new InputError('JEV 纪要复核需要确认，未覆盖已有纪要：'+reviewed.summary,409)
      controller.signal.throwIfAborted(); this.role(job.role?.version, job.createdAt)
      delete job.timing; delete job.timingStatus; delete job.timingError; job.minutes = minutes; job.status = 'ready'; await this.save(job)
    } catch (error) { job.status = 'error'; job.error = controller.signal.aborted ? '组件已停用，本次处理已停止；历史结果保留' : errorText(error); await this.save(job) } finally { jev?.finish(); if (this.controllers.get(job.id) === controller) this.controllers.delete(job.id) }
  }
  async repairTiming(id: string) {
    if (this.running.has(id)) throw new InputError('此会议正在处理，请稍后重试', 409)
    this.running.add(id); this.timingRunning.add(id)
    try {
      const job = await this.get(id)
      this.role(job.role?.version, job.createdAt)
      if (job.status !== 'ready' || !job.minutes || !job.size) throw new InputError('请先完成会议纪要', 409)
      job.timingStatus = 'processing'; delete job.timingError; await this.save(job)
      void this.track(id, () => this.finishTiming(job)).catch(() => {})
      return job
    } catch (error) { this.running.delete(id); this.timingRunning.delete(id); throw error }
  }
  private async finishTiming(job: MeetingJob) {
    const controller = new AbortController(); this.controllers.set(job.id, controller)
    try {
      const { endpoint, model, apiKey } = this.resolveAsr ? config(await this.resolveAsr()) : this.config()
      if (!endpoint || !model) throw new Error('请在能力中心选择支持时间戳的识别模型')
      const form = new FormData()
      form.set('model', model); form.set('response_format', 'verbose_json'); form.set('timestamp_granularities[]', 'segment')
      form.set('file', await openAsBlob(this.audio(job)), job.fileName)
      const response = await fetch(endpoint, { method: 'POST', redirect: 'error', headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {}, body: form, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20 * 60_000)]) })
      if (!response.ok) throw new Error(`补全时间定位失败（HTTP ${response.status}），请在能力中心检测支持时间戳的模型；原纪要保留`)
      const segments = parseSegments(await response.json()).filter(hasTiming).map((row, index) => ({ ...row, id: `t${index + 1}` }))
      if (!segments.length) throw new Error('当前服务未返回有效时间戳。请在能力中心选择支持时间戳的识别模型；原纪要与校对内容已保留')
      const items = [...job.minutes!.decisions, ...job.minutes!.actions, ...job.minutes!.unknown]
      const transcript = JSON.stringify(segments)
      if (transcript.length > 80000) throw new Error('带时间戳转写过长，本次未关联；原纪要保留')
      const raw = await this.ask(`只为现有纪要查找录音来源，不修改任何纪要文字。返回 JSON {"links":[{"index":0,"sources":[{"id":"t1","quote":"该片段中的逐字原文"}]}]}。index 对应纪要数组；每项最多4个来源，无直接证据或仅表示信息缺失的事项返回空 sources。quote 必须为对应片段中的连续原文，禁止猜测时间。纪要：${JSON.stringify(items.map(i => i.text))}\n带时间戳转写：${transcript}`, job.summaryModel, controller.signal)
      const parsed = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1))
      const links: Record<string, string[]> = {}
      for (const entry of Array.isArray(parsed.links) ? parsed.links : []) {
        if (!Number.isInteger(entry.index) || !items[entry.index]) continue
        const ids = (Array.isArray(entry.sources) ? entry.sources : []).filter((src: any) => typeof src.quote === 'string' && src.quote.trim().length >= 4 && segments.some(row => row.id === src.id && row.text.includes(src.quote.trim()))).map((src: any) => src.id as string)
        links[sourceKey(items[entry.index])] = [...new Set<string>(ids)].slice(0, 4)
      }
      if (!Object.values(links).some(ids => ids.length)) throw new Error('已取得时间片段，但未找到可靠纪要来源；原纪要保留')
      controller.signal.throwIfAborted(); this.role(job.role?.version, job.createdAt)
      job.timing = { segments, links }; job.timingStatus = 'ready'; delete job.timingError
      await this.save(job)
    } catch (error) {
      job.timingStatus = 'error'; job.timingError = controller.signal.aborted ? '时间定位已停止，原纪要保留' : errorText(error)
      await this.save(job)
    } finally { this.running.delete(job.id); this.timingRunning.delete(job.id); if (this.controllers.get(job.id) === controller) this.controllers.delete(job.id) }
  }
  async componentActivities() {
    const rows = await Promise.all([...this.controllers.keys()].map(async id => {
      try { const job = await this.get(id); return { id, roleId: MEETING_ROLE_ID, roleVersion: job.role?.version, name: job.fileName, kind: 'meeting', status: job.status, componentIds: ['meeting-asr'] } }
      catch { return { id, roleId: MEETING_ROLE_ID, name: '会议任务（记录暂不可读）', kind: 'meeting', status: 'stopping', componentIds: ['meeting-asr'] } }
    }))
    return rows
  }
  async reconcile() {
    await Promise.all([...this.controllers].map(async ([id, controller]) => {
      try { const job = await this.get(id); this.role(job.role?.version, job.createdAt) } catch { controller.abort() }
    }))
  }
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
