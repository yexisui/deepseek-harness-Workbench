import { ExecutionHistory } from './ExecutionProcess.tsx'
import { MessageTime } from './MessageTime.tsx'
import { hasTiming, sourceKey, type TranscriptSegment } from '../../../dsh-capabilities/src/core/meeting-timing.ts'
import { playAt } from './meeting-playback.ts'
import { printDocument } from './print-document.ts'
import React, { useEffect, useRef, useState } from 'react'
import type { RoleDefinition } from '../../../dsh-capabilities/src/core/model.ts'
import { RoleAppearanceIcon } from './RoleAppearance.tsx'
import { MEETING_DEMO_ROLE_ID } from './ManagedRoles.tsx'
import { MEETING_CAPABILITY_ID } from '../../../dsh-capabilities/src/core/default-roles.ts'
import { openCapabilityLink } from './capability-client.ts'
import s from './MeetingDemo.module.css'

type Mode = 'quick' | 'guided' | null
type Phase = 'start' | 'audience' | 'focus' | 'upload' | 'processing' | 'transcript' | 'ready'
type Message = { createdAt?: string; id: number; kind: 'intro' | 'user' | 'assistant' | 'upload' | 'transcript' | 'minutes'; text?: string; file?: string }
type Segment = TranscriptSegment
type Item = { text: string; sourceIds: string[] }
type Action = Item & { owner: string; deadline: string }
type Minutes = { title: string; overview: string; decisions: Item[]; actions: Action[]; unknown: Item[] }
type Job = { createdAt: string; updatedAt: string; transcribedAt?: string; minutesGeneratedAt?: string; id: string; fileName: string; size: number; status: 'uploading' | 'transcribing' | 'transcribed' | 'generating' | 'ready' | 'error'; error?: string; segments: Segment[]; minutes?: Minutes; timingStatus?: 'processing' | 'ready' | 'error'; timingError?: string; timing?: { segments: Segment[]; links: Record<string, string[]> } }
type Availability = { ready: boolean; message: string; maxBytes: number; provider: string }
export type MeetingDemoState = { mode: Mode; phase: Phase; audience: string; focus: string; summaryModel: string; messages: Message[]; trace: string[]; draft: string; jobId: string | null; showTranscript: boolean; roleVersion?: number; tab?: 'chat'|'trace' }

const endpoint = '/api/capabilities/meeting'
const formatTime = (ms: number) => `${Math.floor(ms / 60000).toString().padStart(2, '0')}:${Math.floor(ms % 60000 / 1000).toString().padStart(2, '0')}`
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char)

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${endpoint}${path}`, { credentials: 'same-origin', ...init })
  const body = await response.json().catch(() => ({})) as { error?: string }
  if (!response.ok) throw new Error(body.error || `请求失败（${response.status}）`)
  return body as T
}
function post<T>(path: string, body: unknown) { return api<T>(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) }
function restore(value: unknown): MeetingDemoState | undefined {
  if (!value || typeof value !== 'object') return undefined
  const state = value as MeetingDemoState
  if (!Array.isArray(state.messages) || !Array.isArray(state.trace) || typeof state.draft !== 'string') return undefined
  if (typeof state.jobId === 'string' || state.phase === 'start') return state
  // Earlier UI-only conversations had fixed sample results and no real audio.
  return { ...state, phase: ['audience', 'focus', 'upload'].includes(state.phase) ? state.phase : 'upload', jobId: null, showTranscript: false, messages: state.messages.filter(message => !['transcript', 'minutes', 'upload'].includes(message.kind)) }
}
function minutesText(minutes: Minutes): string {
  const lines = [minutes.title, '', '会议概览', minutes.overview, '', '主要结论', ...minutes.decisions.map(item => `• ${item.text}`), '', '行动项', ...minutes.actions.map(item => `• ${item.text}${item.owner ? `｜负责人：${item.owner}` : ''}${item.deadline ? `｜期限：${item.deadline}` : ''}`), '', '待确认事项', ...minutes.unknown.map(item => `• ${item.text}`)]
  return lines.join('\n')
}

export function MeetingDemo({ initialState, loadModels, onSnapshot, onCommit, onReset, assistant, roleVersion }: { initialState?: unknown; loadModels?: () => Promise<Array<{ id: string; name: string }>>; onSnapshot?: (state: MeetingDemoState) => void; onCommit?: (title: string) => void; onReset?: () => void; assistant?: Pick<RoleDefinition, 'name' | 'color' | 'icon'>; roleVersion?: number } = {}) {
  const initial = useRef(restore(initialState))
  const assistantName = assistant?.name ?? '会议纪要助手'
  const assistantColor = assistant?.color ?? '#6683bd'
  const assistantIcon = assistant?.icon ?? { kind: 'builtin', id: 'document' } as const
  const [mode, setMode] = useState<Mode>(initial.current?.mode ?? null)
  const [phase, setPhase] = useState<Phase>(initial.current?.phase ?? 'start')
  const [audience, setAudience] = useState(initial.current?.audience ?? '')
  const [focus, setFocus] = useState(initial.current?.focus ?? '')
  const [summaryModel, setSummaryModel] = useState(initial.current?.summaryModel ?? '')
  const [models, setModels] = useState<Array<{ id: string; name: string }>>([])
  const [messages, setMessages] = useState<Message[]>(initial.current?.messages ?? [{ id: 0, kind: 'intro', createdAt: new Date().toISOString() }])
  const [trace, setTrace] = useState<string[]>(initial.current?.trace ?? ['打开会议纪要助手'])
  const [tab, setTab] = useState<'chat' | 'trace'>(initial.current?.tab === 'trace'?'trace':'chat')
  const [draft, setDraft] = useState(initial.current?.draft ?? '')
  const [jobId, setJobId] = useState<string | null>(initial.current?.jobId ?? null)
  const [job, setJob] = useState<Job | null>(null)
  const [segments, setSegments] = useState<Segment[]>([])
  const [showTranscript, setShowTranscript] = useState(initial.current?.showTranscript ?? false)
  const [availability, setAvailability] = useState<Availability | null>(null)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [sourceRequest, setSourceRequest] = useState<{ id: string; play: boolean; timed: boolean; fromStart?: boolean } | null>(null)
  const [timingConfirm, setTimingConfirm] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const player = useRef<HTMLAudioElement>(null)
  const pinned=useRef(true)
  const [newProgress,setNewProgress]=useState(false)
  const scroll = useRef<HTMLDivElement>(null)
  const nextId = useRef(Math.max(0, ...messages.map(message => message.id)) + 1)
  const snapshotCallback = useRef(onSnapshot)
  snapshotCallback.current = onSnapshot

  useEffect(() => { snapshotCallback.current?.({ mode, phase, audience, focus, summaryModel, messages, trace, draft, jobId, showTranscript, roleVersion, tab }) }, [mode, phase, audience, focus, summaryModel, messages, trace, draft, jobId, showTranscript, roleVersion, tab])
  useEffect(() => { void api<Availability>('/config').then(setAvailability).catch(error => setAvailability({ ready: false, message: String(error), maxBytes: 0, provider: '自定义语音识别接口' })) }, [])
  useEffect(() => { if (loadModels) void loadModels().then(setModels).catch(() => setModels([])) }, [loadModels])
  useEffect(() => {
    if (!jobId) return
    let active = true
    const check = async () => {
      try {
        const next = await api<Job>(`/job/${jobId}`)
        if (!active) return
        setJob(next)
        if (next.status === 'transcribed' && mode === 'guided') {
          setPhase('transcript')
          setSegments(current => current.length ? current : next.segments)
          setMessages(current => current.some(message => message.kind === 'transcript') ? current : [...current, { id: nextId.current++, kind: 'transcript', createdAt: next.transcribedAt }])
        } else if (next.status === 'error' && next.minutes) { setPhase('ready');setSegments(next.segments)
        } else if (next.status === 'ready') {
          setPhase('ready')
          setSegments(next.segments)
          setMessages(current => { const completed = current.map(message => message.kind === 'assistant' && message.text === '正在根据录音与现有纪要修改…' ? { ...message, text: '已根据你的要求更新上方纪要。', createdAt: next.minutesGeneratedAt } : message); return completed.some(message => message.kind === 'minutes') ? completed : [...completed, { id: nextId.current++, kind: 'minutes', createdAt: next.minutesGeneratedAt }] })
        }
      } catch (error) { if (active) setNotice(error instanceof Error ? error.message : String(error)) }
    }
    void check()
    const timer = window.setInterval(() => { if (!job || job.timingStatus === 'processing' || ['uploading', 'transcribing', 'generating'].includes(job.status)) void check() }, 2500)
    return () => { active = false; window.clearInterval(timer) }
  }, [jobId, mode, job?.status, job?.timingStatus])
  useEffect(() => { if(tab!=='chat')return;if(pinned.current&&scroll.current?.scrollTo)scroll.current.scrollTo({top:scroll.current.scrollHeight,behavior:'smooth'});else setNewProgress(true) }, [messages,phase,tab])
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(''), 6000); return () => window.clearTimeout(timer) }, [notice])
  const add = (...entries: Omit<Message, 'id'>[]) => setMessages(current => [...current, ...entries.map(entry => ({ ...entry, createdAt: new Date().toISOString(), id: nextId.current++ }))])
  const log = (value: string) => setTrace(current => [...current, value])
  const chooseMode = (value: Exclude<Mode, null>) => {
    if (phase !== 'start') return
    onCommit?.(`会议纪要 · ${value === 'quick' ? '快速生成' : '引导整理'}`)
    setMode(value)
    add({ kind: 'user', text: value === 'quick' ? '快速生成' : '引导整理' }, { kind: 'assistant', text: value === 'quick' ? '上传录音后，我会直接生成纪要草稿。' : '先选择纪要用途和关注重点，再上传录音核对转写。' })
    setPhase(value === 'quick' ? 'upload' : 'audience'); log(`选择${value === 'quick' ? '快速生成' : '引导整理'}`)
  }
  const chooseAudience = (value: string) => { if (phase !== 'audience') return; setAudience(value); setPhase('focus'); add({ kind: 'user', text: value }, { kind: 'assistant', text: '这次希望重点突出什么？' }); log(`纪要用途：${value}`) }
  const chooseFocus = (value: string) => { if (phase !== 'focus') return; setFocus(value); setPhase('upload'); add({ kind: 'user', text: value }, { kind: 'assistant', text: '准备好了，请上传录音。' }); log(`关注重点：${value}`) }
  const onFile = async (file?: File) => {
    if (!file || phase !== 'upload' || busy) return
    if (!/\.(mp3|m4a|wav|aac|flac|ogg|opus|webm|mp4)$/i.test(file.name)) { setNotice('请选择 MP3、M4A、WAV 等支持的音视频文件'); return }
    if (file.size > (availability?.maxBytes ?? 0)) { setNotice('录音超过当前上传限制'); return }
    if (!availability?.ready) { setNotice(availability?.message || '转写服务尚未配置'); return }
    setBusy(true); setPhase('processing'); add({ kind: 'upload', file: file.name }); log(`上传录音：${file.name}`)
    try {
      const created = await post<Job>('/create', { fileName: file.name, mode, audience, focus, summaryModel, roleVersion })
      setJobId(created.id)
      const uploaded = await api<Job>(`/upload/${created.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: file })
      setJob(uploaded); log('录音上传完成，开始语音转写')
    } catch (error) { setNotice(error instanceof Error ? error.message : String(error)); setPhase('upload') }
    finally { setBusy(false); if (input.current) input.current.value = '' }
  }
  const retry = async () => {
    if (!jobId) return
    if (job && !job.size) { setJobId(null); setJob(null); setPhase('upload'); setNotice('请重新选择录音上传'); return }
    if (job?.segments.length) { void generate(); return }
    setBusy(true)
    try { const next = await post<Job>('/retry', { id: jobId }); setJob(next); setPhase(next.status === 'transcribed' ? 'transcript' : 'processing'); log('重试处理录音') }
    catch (error) { setNotice(error instanceof Error ? error.message : String(error)) }
    finally { setBusy(false) }
  }
  const generate = async (instruction?: string) => {
    if (!jobId || busy || job?.timingStatus === 'processing') return
    setBusy(true); setPhase('processing')
    try {
      await post('/generate', { id: jobId, summaryModel, ...(instruction ? { instruction } : mode === 'guided' ? { segments } : {}) })
      setJob(current => current ? { ...current, status: 'generating' } : current)
      log(instruction ? `修改纪要：${instruction}` : '核对转写并生成纪要')
    } catch (error) { setNotice(error instanceof Error ? error.message : String(error)); if(instruction)setDraft(current=>current||instruction);setPhase(instruction ? 'ready' : 'transcript') }
    finally { setBusy(false) }
  }
  const revise = (value: string) => { if (phase !== 'ready' || !value.trim()) return; if (job?.timingStatus === 'processing') { setNotice('正在补全时间定位，请完成后再修改纪要'); return };  void generate(value) }
  const send = () => {
    if (job?.timingStatus === 'processing') { setNotice('正在补全时间定位，请完成后再发送，输入已保留'); return }
    const value = draft.trim(); if (!value) return; setDraft('')
    if (phase === 'audience') return chooseAudience(value)
    if (phase === 'focus') return chooseFocus(value)
    if (phase === 'ready') return revise(value)
    if (phase === 'start') add({ kind: 'user', text: value }, { kind: 'assistant', text: '请先选择“快速生成”或“引导整理”。' })
    else setNotice(phase === 'transcript' ? '请先在转写原文中核对并确认' : phase === 'processing' ? '正在处理录音，请稍候' : '请先上传录音')
  }
  const seek = (id: string, timed = false, play = true) => {
    setShowTranscript(true); setSourceRequest({ id, timed, play })
  }
  useEffect(() => {
    if (!sourceRequest || tab !== 'chat') return
    const row = (sourceRequest.timed ? job?.timing?.segments : job?.segments)?.find(row => row.id === sourceRequest.id)
    if (!row) return
    document.getElementById(`meeting-source-${row.id}`)?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
    const controller = new AbortController()
    if (sourceRequest.play && player.current) {
      void playAt(player.current, sourceRequest.fromStart ? 0 : hasTiming(row) ? row.start / 1000 : 0, controller.signal).catch(error => { if (!controller.signal.aborted) setNotice(error.message) })
    }
    return () => controller.abort()
  }, [sourceRequest, showTranscript, tab])
  const repairTiming = async () => {
    if (!jobId || busy) return
    setTimingConfirm(false); setBusy(true)
    try { setJob(await api<Job>('/timing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: jobId }) })); log('请求补全时间定位，保留原纪要和校对内容') }
    catch (error) { setNotice(error instanceof Error ? error.message : String(error)) }
    finally { setBusy(false) }
  }
  const sourceLinks = (item: Item) => {
    const timed = job?.timing?.links[sourceKey(item)]
    if (timed?.length) return timed.map(id => { const row = job?.timing?.segments.find(row => row.id === id); return row && hasTiming(row) ? <button key={id} className={s.sourceLink} onClick={() => seek(id, true)}>{row.timingKind === 'chunk' ? '回听片段' : '回听'} {formatTime(row.start)}</button> : null })
    return item.sourceIds.map(id => { const row = job?.segments.find(row => row.id === id); return row ? <button key={id} className={s.sourceLink} onClick={() => seek(id, false, hasTiming(row))}>{hasTiming(row) ? `${row.timingKind === 'chunk' ? '回听片段' : '回听'} ${formatTime(row.start)}` : '查看原文'}</button> : null })
  }
  const displaySegments = sourceRequest?.timed && job?.timing ? job.timing.segments : job?.segments ?? []
  const segmentLabel = (row: Segment) => hasTiming(row) ? formatTime(row.start) : '时间未知'
  const modelControl = <label className={s.modelControl}>纪要模型<select aria-label="纪要模型" value={summaryModel} onChange={event => setSummaryModel(event.target.value)}><option value="">工作台默认模型</option>{models.map(model => <option key={model.id} value={model.id}>{model.name} · {model.id}</option>)}</select></label>
  const copyMinutes = async () => { if (!job?.minutes) return; try { await navigator.clipboard.writeText(minutesText(job.minutes)); setNotice('已复制当前纪要') } catch { setNotice('复制失败，可选中文字手动复制') } }
  const printMinutes = () => {
    if (!job?.minutes) return
    const html = minutesText(job.minutes).split('\n').map(line => `<div>${escapeHtml(line) || '&nbsp;'}</div>`).join('')
    printDocument(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${escapeHtml(job.minutes.title)}</title><style>body{font:15px/1.7 system-ui,sans-serif;max-width:760px;margin:40px auto;color:#202938}div{white-space:pre-wrap}div:first-child{font-size:24px;font-weight:700;margin-bottom:20px}@page{size:A4;margin:18mm}</style></head><body>${html}</body></html>`)
  }
  const transcriptCard = (editable: boolean) => <div className={s.resultCard}>
    <div className={s.cardHead}><div><small>录音转写</small><h3>{editable ? '请先核对原文' : '转写原文'}</h3></div><span>{(editable ? segments : displaySegments).length} 个片段</span></div>
    {jobId && <div className={s.audioBar}><audio ref={player} controls preload="metadata" src={`${endpoint}/audio/${jobId}`}/><small>{(editable ? segments : displaySegments).some(hasTiming) ? (editable ? segments : displaySegments).some(row => row.timingKind === 'chunk') ? '按录音片段起点回听；时间表示片段范围' : '点击有效时间戳回听；未知时间仅查看原文' : '当前转写未提供分段时间，可从头播放'}</small><button className={s.sourceLink} onClick={() => { const row = (editable ? segments : displaySegments)[0]; if (row) { setShowTranscript(true); setSourceRequest({ id: row.id, timed: Boolean(sourceRequest?.timed), play: true, fromStart: true }) } }}>从头播放</button></div>}
    <div className={s.transcriptRows}>{(editable ? segments : displaySegments).map((row, index) => <div className={s.transcriptRow} key={row.id} id={`meeting-source-${row.id}`} style={sourceRequest?.id === row.id ? { outline: '2px solid var(--color-primary, #6683bd)', outlineOffset: '2px' } : undefined}><button className={s.sourceLink} onClick={() => seek(row.id, !editable && Boolean(sourceRequest?.timed), hasTiming(row))}>{hasTiming(row) ? formatTime(row.start) : '原文'}</button><div>{editable ? <><input className={s.speakerInput} aria-label={`${segmentLabel(row)} 发言人`} value={row.speaker} onChange={event => setSegments(current => current.map((item, i) => i === index ? { ...item, speaker: event.target.value } : item))}/><textarea aria-label={`${segmentLabel(row)} 转写文字`} value={row.text} onChange={event => setSegments(current => current.map((item, i) => i === index ? { ...item, text: event.target.value } : item))}/></> : <><strong>{row.speaker}</strong><p>{row.text}</p></>}</div></div>)}</div>
    {editable && <div className={s.cardFooter}><span>可修改说话人和识别文字，确认后生成纪要。</span><button className={s.primary} disabled={busy || job?.timingStatus === 'processing'} onClick={() => void generate()}>确认转写，生成纪要 →</button></div>}
  </div>
  const minutesCard = () => !job?.minutes ? null : <div className={s.resultCard}>
    <div className={s.cardHead}><div><small>会议纪要 · 可继续对话修改</small><h3>{job.minutes.title}</h3></div><span>基于录音生成</span></div>
    <div className={s.minutes}><section><h4>会议概览</h4><p>{job.minutes.overview}</p></section><section><h4>主要结论</h4>{job.minutes.decisions.map((item, index) => <p key={index}>{item.text} {sourceLinks(item)}</p>)}</section><section><h4>行动项</h4>{job.minutes.actions.map((item, index) => <div className={s.actionLine} key={index}><strong>{item.text}</strong><span>{item.owner || '负责人待确认'} · {item.deadline || '期限待确认'} {sourceLinks(item)}</span></div>)}</section><section><h4>待确认事项</h4>{job.minutes.unknown.map((item, index) => <p key={index}>{item.text} {sourceLinks(item)}</p>)}</section></div>
    <div className={s.cardFooter}><button onClick={() => void copyMinutes()}>复制纪要</button><button onClick={printMinutes}>打印 / 保存 PDF</button><button onClick={() => { setSourceRequest(null); setShowTranscript(value => !value) }}>{showTranscript ? '收起转写' : '查看转写原文'}</button></div>
    <div className={s.modelRow}>{modelControl}<button disabled={busy || job?.timingStatus === 'processing'} onClick={() => void generate()}>用所选模型重新生成</button></div>
    {!job.segments.every(hasTiming) && <div className={s.cardFooter}><span>{job.timingStatus === 'processing' ? '正在补全时间定位，原纪要保留…' : job.timingError || (job.timing ? '已关联有依据的时间片段；其余条目仍可查看原文' : '当前转写缺少分段时间，来源暂不支持准确回听')}</span><button disabled={busy || job.timingStatus === 'processing' || job.status !== 'ready'} onClick={() => setTimingConfirm(true)}>补全时间定位</button><button onClick={() => openCapabilityLink({ section: 'capability-center', capabilityId: MEETING_CAPABILITY_ID })}>识别模型设置</button></div>}
    {timingConfirm && <div className={s.cardFooter} role="group" aria-label="确认补全时间定位"><p>将使用当前识别模型重新处理已保存录音，并用纪要模型关联来源，可能产生调用费用。原纪要与人工校对内容保留；已关联分段定位能力时按录音切片获取时间，否则使用识别服务返回的时间戳。</p><button disabled={busy} onClick={() => void repairTiming()}>开始补全</button><button onClick={() => setTimingConfirm(false)}>取消</button></div>}
    {showTranscript && transcriptCard(false)}
  </div>
  const assistantMessage = (children: React.ReactNode, key: number, time?: React.ReactNode) => <article className={s.message} key={key}><RoleAppearanceIcon roleId={MEETING_DEMO_ROLE_ID} icon={assistantIcon} color={assistantColor}/><div className={s.messageBody}><div className={s.byline}>{assistantName}</div>{children}{time}</div></article>
  const renderMessage = (message: Message) => {
    const value = message.kind === 'minutes' ? job?.minutesGeneratedAt ?? message.createdAt : message.kind === 'transcript' ? job?.transcribedAt ?? message.createdAt : message.createdAt ?? (message.kind === 'intro' || message.kind === 'upload' ? job?.createdAt : undefined)
    const stamp = <MessageTime value={value ?? (message.kind === 'minutes' ? job?.updatedAt : undefined)} label={!value && message.kind === 'minutes' ? '任务最后更新：' : ''}/>
    if (message.kind === 'user' || message.kind === 'upload') return <article className={s.userMessage} key={message.id}><div>{message.kind === 'upload' ? <>♫　<strong>{message.file}</strong><small>会议录音</small></> : message.text}{stamp}</div></article>
    if (message.kind === 'intro') return assistantMessage(<><p className={s.lead}>你好，我是{assistantName}。</p><p>我可以帮你把会议录音整理为结论和待办。先选择这次的处理方式：</p>{mode ? <p className={s.selectedMode}>已选择 {mode === 'quick' ? '快速生成' : '引导整理'} · 后续仍可在对话中修改</p> : <div className={s.modes}><button onClick={() => chooseMode('quick')}><b>⚡　快速生成</b><span>上传录音后直接生成纪要草稿</span><em>适合马上看结果 →</em></button><button onClick={() => chooseMode('guided')}><b>☷　引导整理</b><span>先选用途与重点，再核对转写</span><em>适合需要把控细节 →</em></button></div>}<p className={s.muted}>录音由你配置的语音识别接口处理；纪要使用工作台模型。{availability?.message}</p></>, message.id, stamp)
    if (message.kind === 'assistant') return assistantMessage(<><p>{message.text}</p>{phase === 'audience' && message.text?.startsWith('先选择') && <div className={s.choices}>{['团队同步', '领导汇报', '客户沟通'].map(value => <button key={value} onClick={() => chooseAudience(value)}>{value}</button>)}</div>}{phase === 'focus' && message.text === '这次希望重点突出什么？' && <div className={s.choices}>{['结论与待办', '风险与问题', '完整讨论'].map(value => <button key={value} onClick={() => chooseFocus(value)}>{value}</button>)}</div>}{phase === 'upload' && (message.text?.startsWith('上传录音') || message.text?.startsWith('准备好了')) && <><div className={s.uploadPrompt}><span>♫</span><div><strong>添加会议录音</strong><small>MP3、M4A、WAV 等 · 最大 {Math.round((availability?.maxBytes ?? 25 * 1024 * 1024) / 1024 / 1024)} MB</small></div><button className={s.primary} disabled={!availability?.ready || busy} onClick={() => input.current?.click()}>选择录音</button>{!availability?.ready && <button type="button" onClick={() => openCapabilityLink({ section: 'capability-center', capabilityId: MEETING_CAPABILITY_ID })}>前往能力中心</button>}</div>{modelControl}</>}</>, message.id, stamp)
    if (message.kind === 'transcript' && phase !== 'transcript') return null
    if (message.kind === 'transcript') return assistantMessage(<><p>转写已完成。请核对说话人和关键内容，确认后生成纪要。</p>{transcriptCard(true)}</>, message.id, stamp)
    if (message.kind === 'minutes') return assistantMessage(<><p>纪要已生成。你可以继续在下方对话框提出修改。</p>{minutesCard()}<div className={s.choices}><span>试试：</span>{['把待办放在前面', '缩短摘要', '突出待确认事项'].map(value => <button key={value} onClick={() => revise(value)}>{value}</button>)}</div></>, message.id, stamp)
    return null
  }
  const status = job?.status
  return <div className={s.root} data-meeting-demo="true">
    <div className={s.heading}><div><span>你好</span><strong>{assistantName}</strong></div><div><span className={s.demoBadge}>{availability?.ready ? '录音转纪要' : '待配置'}</span><button onClick={() => onReset?.()}>重新开始</button></div></div>
    <div className={s.tabs} role="tablist" aria-label="会话视图"><button role="tab" aria-selected={tab === 'chat'} onClick={() => setTab('chat')}>对话</button><button role="tab" aria-selected={tab === 'trace'} onClick={() => setTab('trace')}>轨迹</button></div>
    <div className={s.scroll} ref={scroll} onScroll={()=>{const el=scroll.current;if(el)pinned.current=el.scrollHeight-el.scrollTop-el.clientHeight<80}} role="tabpanel">{tab === 'chat' ? <div className={s.messages}>{messages.filter(m=>m.kind!=='minutes').map(renderMessage)}<ExecutionHistory kind="meeting" id={jobId} active={Boolean(job&&(['uploading','transcribing','generating'].includes(job.status)||job.timingStatus==='processing'))}/>{messages.filter(m=>m.kind==='minutes').map(renderMessage)}{job?.minutes&&!messages.some(m=>m.kind==='minutes')&&assistantMessage(<><p>上一次保存的纪要</p>{minutesCard()}<MessageTime value={job.minutesGeneratedAt}/></>,-4)}{phase === 'processing' && status !== 'error' && assistantMessage(<div className={s.progress}><span>◌</span><div><strong>{status === 'generating' || status === 'transcribed' ? '正在生成纪要…' : status === 'uploading' ? '正在上传录音…' : '正在转写录音…'}</strong><small>可以切换会话，处理完成后回来查看</small><div className={s.progressTrack}><i/></div></div></div>, -1)}{status === 'error' && assistantMessage(<div className={s.resultCard}><div className={s.cardHead}><div><small>本轮未完成</small><h3>{job?.error}</h3></div></div><div className={s.cardFooter}><button disabled={busy} onClick={() => void retry()}>重试</button></div></div>, -2)}</div> : <div className={s.trace}><h2>会话轨迹</h2><p>记录本次会议处理步骤。</p><ol>{trace.map((entry, index) => <li key={index}><span>{String(index + 1).padStart(2, '0')}</span>{entry}</li>)}</ol></div>}</div>
    {newProgress&&<button className={s.progressAction} onClick={()=>{pinned.current=true;setNewProgress(false);scroll.current?.scrollTo({top:scroll.current.scrollHeight,behavior:'smooth'})}}>有新进展 · 回到底部</button>}
    {job&&(['transcribing','generating'].includes(job.status)||job.timingStatus==='processing')&&<button className={s.progressAction} disabled={busy} onClick={()=>{setBusy(true);void post<Job>('/stop',{id:jobId}).then(next=>{setJob(next);setNotice('本轮已停止，录音与已保存结果保留')}).catch(e=>setNotice(e.message)).finally(()=>setBusy(false))}}>停止本轮</button>}
    <div className={s.composerWrap}><div className={s.composer}><textarea aria-label="输入消息" value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) { event.preventDefault(); send() } }} placeholder={phase === 'start' ? '先选择上方的整理方式，或输入消息' : phase === 'audience' ? '输入纪要用途' : phase === 'focus' ? '输入关注重点' : phase === 'ready' ? '输入要求，继续修改纪要' : '输入消息，继续对话'}/><div className={s.composerTools}><div><button aria-label="添加录音" title="添加录音" disabled={phase !== 'upload' || !availability?.ready || busy} onClick={() => input.current?.click()}>＋</button><span>{availability?.ready ? '录音交由已配置的识别接口处理' : '语音识别尚未配置'}</span></div><div><span>{assistantName}</span><button className={s.send} aria-label="发送消息" disabled={!draft.trim() || busy} onClick={send}>↑</button></div></div></div>{notice && <p className={s.notice} role="status">{notice}</p>}</div>
    <input ref={input} type="file" accept=".mp3,.m4a,.wav,.aac,.flac,.ogg,.opus,.webm,.mp4" hidden onChange={event => void onFile(event.target.files?.[0])}/>
  </div>
}
