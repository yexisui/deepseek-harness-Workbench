import { step } from '../../../../shared/host/execution.ts'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { join, resolve, relative, isAbsolute } from 'node:path'
import { tmpdir } from 'node:os'
import { latest } from '../core/model.ts'
import { MEETING_ROLE_ID } from '../core/default-roles.ts'
import { allowedActions, wasRevoked } from '../core/policy.ts'
import type { TranscriptSegment } from '../core/meeting-timing.ts'
import type { MeetingJob } from './meeting.ts'
import type { PackageRunner } from './package-runner.ts'

export type SegmentRecognition = (path: string, name: string, signal: AbortSignal) => Promise<TranscriptSegment[]>
export interface MeetingSegmenter {
  transcribe(job: MeetingJob, audio: string, signal: AbortSignal, recognize: SegmentRecognition, repair?: boolean): Promise<TranscriptSegment[] | undefined>
  components(id: string): string[]
  stopComponents(ids: string[]): void
}
function execute(file: string, args: string[], signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => execFile(file, args, { signal, windowsHide: true, timeout: 20 * 60_000, maxBuffer: 8 * 1024 * 1024, encoding: 'utf8' }, (error, stdout, stderr) => {
    if (error) reject(new Error(signal.aborted ? '录音分段已停止' : `音频处理失败：${error.code ?? '未知错误'}；请检查录音与 external-tools 中的 FFmpeg`))
    else resolve(stdout + '\n' + stderr)
  }))
}

/** Optional role-bound package plans segments; the host owns audio, credentials and cancellation. */
export class PackageMeetingSegmenter implements MeetingSegmenter {
  private active = new Map<string, { componentId: string; controller: AbortController }>()
  constructor(private runner: PackageRunner, private toolsRoot: string) {}
  components(id: string) { const active = this.active.get(id); return active ? [active.componentId] : [] }
  stopComponents(ids: string[]) { for (const active of this.active.values()) if (ids.includes(active.componentId)) active.controller.abort() }
  async transcribe(job: MeetingJob, audio: string, signal: AbortSignal, recognize: SegmentRecognition, repair = false) {
    const store = this.runner.packages.store, state = store.snapshot(), role = state.roles.find(r => r.id === (job.role?.id ?? MEETING_ROLE_ID))
    const version = repair ? latest(role?.versions ?? []) : role?.versions.find(v => v.version === job.role?.version)
    if (!version || !role?.enabled) return undefined
    const createdAt = repair ? Date.now() : Date.parse(job.createdAt)
    const actions = allowedActions(state, role.id, version)
    // Stable action semantics allow another imported package to supply this operation.
    const action = actions.find(a => a.startsWith('pack:') && a.endsWith(':plan-audio-segments'))
    const binding = action && version.capabilities.find(b => b.enabled && state.capabilities.find(c => c.id === b.capabilityId)?.versions.find(v => v.version === b.version)?.components.some(p => p.actions.includes(action)))
    if (!action || !binding) return undefined
    const componentId = `pkg:${action.split(':')[1]}:${action.split(':')[2]}`
    const controller = new AbortController(), combined = AbortSignal.any([signal, controller.signal])
    const allowed = () => { const current = store.snapshot(); return allowedActions(current, role.id, version).includes(action) && !wasRevoked(current, role.id, { ...version, capabilities: [binding] }, createdAt) }
    const check = () => { combined.throwIfAborted(); if (!allowed()) throw new Error('录音分段能力已停用或岗位授权已撤销') }
    const unsubscribe = store.subscribe(() => { if (!allowed()) controller.abort() })
    this.active.set(job.id, { componentId, controller })
    let temporary: string | undefined
    try {
      check()
      const root = join(this.toolsRoot, 'ffmpeg')
      let pointer: { ffmpeg: string; ffprobe: string }
      try { pointer = JSON.parse((await readFile(join(root, 'current.json'), 'utf8')).replace(/^\uFEFF/, '')) }
      catch { throw new Error('缺少 FFmpeg，请运行工作台 deploy.ps1 -Mode Tools 安装外部工具') }
      const tool = (name: string) => { const file = resolve(root, name), rel = relative(root, file); if (!rel || rel.startsWith('..') || isAbsolute(rel)) throw new Error('外部音频工具路径无效'); return file }
      const ffmpeg = tool(pointer.ffmpeg), ffprobe = tool(pointer.ffprobe)
      step('audio-split','解析录音并规划分段','running')
      const duration = Number((await execute(ffprobe, ['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',audio], combined)).trim())
      if (!Number.isFinite(duration) || duration <= 0) throw new Error('无法读取录音时长')
      const report = await execute(ffmpeg, ['-hide_banner','-nostdin','-i',audio,'-af','silencedetect=noise=-35dB:d=0.35','-f','null','-'], combined)
      const silences: {start:number;end:number}[] = []; let start: number | undefined
      for (const match of report.matchAll(/silence_(start|end):\s*([\d.]+)/g)) { if (match[1] === 'start') start = Number(match[2]); else if (start !== undefined) { silences.push({ start, end: Number(match[2]) }); start = undefined } }
      check()
      const planned = await this.runner.start(binding.capabilityId, binding.version, action, { duration, silences }, { signal: combined, role: { roleId: role.id, version, sessionCreatedAt: createdAt } })
      const result = await planned.done as { segments?: {start:number;end:number}[] }
      const plan = result?.segments
      if (!Array.isArray(plan) || !plan.length || plan.some((p,i) => !Number.isFinite(p.start) || !Number.isFinite(p.end) || p.end <= p.start || Math.abs(p.start-(i ? plan[i-1]!.end : 0)) > .01 || p.end > duration+.01) || Math.abs(plan.at(-1)!.end-duration) > .01) throw new Error('分段能力未返回有效的连续录音区间')
      step('audio-split','解析录音并规划分段','done',plan.length+' 个连续片段')
      temporary = await mkdtemp(join(tmpdir(), 'dsh-meeting-segments-'))
      const rows: TranscriptSegment[] = []
      for (const [index, segment] of plan.entries()) {
        check()
        const file = join(temporary, `part-${index+1}.wav`)
        await execute(ffmpeg, ['-hide_banner','-loglevel','error','-nostdin','-i',audio,'-ss',String(segment.start),'-t',String(segment.end-segment.start),'-vn','-ac','1','-ar','16000','-c:a','pcm_s16le',file], combined)
        check()
        step('segment-'+index,'转写录音片段 '+(index+1)+'/'+plan.length,'running',undefined,{current:index,total:plan.length})
        const text = (await recognize(file, `part-${index+1}.wav`, combined)).map(r => r.text).join('\n').trim()
        check()
        step('segment-'+index,'转写录音片段 '+(index+1)+'/'+plan.length,'done',text?'识别完成':'未识别到文字',{current:index+1,total:plan.length})
        if (text) rows.push({ id:`s${rows.length+1}`, start:Math.round(segment.start*1000), end:Math.round(segment.end*1000), speaker:'发言人', text, timingKind:'chunk' })
      }
      if (!rows.length) throw new Error('录音分段后未识别到可用语音')
      return rows
    } finally { unsubscribe(); this.active.delete(job.id); if (temporary) await rm(temporary, { recursive: true, force: true }) }
  }
}
