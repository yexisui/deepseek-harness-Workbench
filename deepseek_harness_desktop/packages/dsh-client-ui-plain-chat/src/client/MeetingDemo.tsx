import { choiceMessage, recoverChoices, selectionLabels, modeLabel, type SelectionStep, type MeetingMessage } from './meeting-choices.ts'
import { recordingApi } from '../../../../shared/client/recording-client.ts'
import { fileSearchCommand } from '../../../../shared/client/file-search-client.ts'
import { recordingCommand } from '../../../../shared/client/recording-client.ts'
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
type SelectionEdit = { messageId?: number; step: SelectionStep; mode: Exclude<Mode, null>; audience: string; focus: string }
type Message = MeetingMessage
type Segment = TranscriptSegment
type Item = { text: string; sourceIds: string[] }
type Action = Item & { owner: string; deadline: string }
type Minutes = { title: string; overview: string; decisions: Item[]; actions: Action[]; unknown: Item[] }
type Job = { needsRegeneration?: boolean; createdAt: string; updatedAt: string; transcribedAt?: string; minutesGeneratedAt?: string; id: string; fileName: string; size: number; status: 'uploading' | 'transcribing' | 'transcribed' | 'generating' | 'ready' | 'error'; error?: string; segments: Segment[]; minutes?: Minutes; timingStatus?: 'processing' | 'ready' | 'error'; timingError?: string; timing?: { segments: Segment[]; links: Record<string, string[]> } }
type Availability = { ready: boolean; message: string; maxBytes: number; provider: string }
export type MeetingDemoState = { continueAt?: number; selectionEdit?: SelectionEdit | null; transcriptDraft?: Segment[]; mode: Mode; phase: Phase; audience: string; focus: string; summaryModel: string; messages: Message[]; trace: string[]; draft: string; jobId: string | null; showTranscript: boolean; roleId?: string; roleVersion?: number; tab?: 'chat'|'trace' }

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

export function MeetingDemo({ conversationTitle, initialState, loadModels, onSnapshot, onCommit, onReset, assistant, roleVersion, roleId, recordingSource, canProcess = true, canGenerate = true, sourceHeader }: { recordingSource?: {id:string;operation:string;jobId?:string};canProcess?:boolean;canGenerate?:boolean;sourceHeader?:React.ReactNode;conversationTitle?: string; initialState?: unknown; loadModels?: () => Promise<Array<{ id: string; name: string }>>; onSnapshot?: (state: MeetingDemoState) => void; onCommit?: (title: string) => void; onReset?: () => void; assistant?: Pick<RoleDefinition, 'name' | 'color' | 'icon'>; roleVersion?: number; roleId?: string } = {}) {
  const initial = useRef(restore(initialState) ?? (recordingSource ? {mode:recordingSource.operation==='quick'?'quick':'guided',phase:recordingSource.jobId?'processing':recordingSource.operation==='guided'?'audience':'processing',audience:'',focus:'',summaryModel:'',messages:[{id:0,kind:'assistant',text:recordingSource.operation==='guided'&&!recordingSource.jobId?'先选择纪要用途和关注重点。':'使用本会话已保存录音继续处理。',createdAt:new Date().toISOString()}],trace:['从已保存录音接续'],draft:'',jobId:recordingSource.jobId??null,showTranscript:false} as MeetingDemoState : undefined))
  const assistantName = assistant?.name ?? '会议纪要助手'
  const assistantColor = assistant?.color ?? '#6683bd'
  const assistantIcon = assistant?.icon ?? { kind: 'builtin', id: 'document' } as const
  const [mode, setMode] = useState<Mode>(initial.current?.mode ?? null)
  const [phase, setPhase] = useState<Phase>(initial.current?.phase ?? 'start')
  const [audience, setAudience] = useState(initial.current?.audience ?? '')
  const [focus, setFocus] = useState(initial.current?.focus ?? '')
  const [summaryModel, setSummaryModel] = useState(initial.current?.summaryModel ?? '')
  const [models, setModels] = useState<Array<{ id: string; name: string }>>([])
  const [messages, setMessages] = useState<Message[]>(() => recoverChoices(initial.current?.messages ?? [{ id: 0, kind: 'intro', createdAt: new Date().toISOString() }], { mode, audience, focus }))
  const [trace, setTrace] = useState<string[]>(initial.current?.trace ?? ['打开会议纪要助手'])
  const [tab, setTab] = useState<'chat' | 'trace'>(initial.current?.tab === 'trace'?'trace':'chat')
  const [draft, setDraft] = useState(initial.current?.draft ?? '')
  const [jobId, setJobId] = useState<string | null>(initial.current?.jobId ?? null)
  const [job, setJob] = useState<Job | null>(null)
  const [segments, setSegments] = useState<Segment[]>(initial.current?.transcriptDraft ?? [])
  const [showTranscript, setShowTranscript] = useState(initial.current?.showTranscript ?? false)
  const [availability, setAvailability] = useState<Availability | null>(null)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [selectionEdit, setSelectionEdit] = useState<SelectionEdit | null>(() => { const edit = initial.current?.selectionEdit; return edit ? { ...edit, messageId: choiceMessage(messages, edit.step)?.id } : null })
  const [continueAt, setContinueAt] = useState<number | undefined>(initial.current?.continueAt)
  const selectionPhase = continueAt !== undefined && mode === 'guided' && !audience ? 'audience' : continueAt !== undefined && mode === 'guided' && !focus ? 'focus' : phase
  const mutation = useRef(0)
  const editing = useRef(false)
  const [sourceRequest, setSourceRequest] = useState<{ id: string; play: boolean; timed: boolean; fromStart?: boolean } | null>(null)
  const [timingConfirm, setTimingConfirm] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const player = useRef<HTMLAudioElement>(null)
  const pinned=useRef(!initial.current?.selectionEdit)
  const [newProgress,setNewProgress]=useState(false)
  const scroll = useRef<HTMLDivElement>(null)
  const nextId = useRef(Math.max(0, ...messages.map(message => message.id)) + 1)
  const snapshotCallback = useRef(onSnapshot)
  snapshotCallback.current = onSnapshot

  useEffect(() => { snapshotCallback.current?.({ continueAt, selectionEdit, transcriptDraft: segments, mode, phase, audience, focus, summaryModel, messages, trace, draft, jobId, showTranscript, roleId, roleVersion, tab }) }, [continueAt, selectionEdit, segments, mode, phase, audience, focus, summaryModel, messages, trace, draft, jobId, showTranscript, roleId, roleVersion, tab])
  useEffect(() => { void api<Availability>('/config').then(setAvailability).catch(error => setAvailability({ ready: false, message: String(error), maxBytes: 0, provider: '自定义语音识别接口' })) }, [])
  useEffect(() => { if (loadModels) void loadModels().then(setModels).catch(() => setModels([])) }, [loadModels])
  useEffect(() => {
    if (!jobId) return
    let active = true
    const check = async () => {
      if (editing.current) return
      const revision = mutation.current
      try {
        const next = await api<Job>(`/job/${jobId}`)
        if (!active || editing.current || revision !== mutation.current) return
        setJob(next)
        if (!recordingSource && next.fileName) setMessages(current => choiceMessage(current, 'audio') ? current : [...current, { id: nextId.current++, kind: 'upload', choiceStep: 'audio', file: next.fileName, createdAt: next.createdAt }])
        if (next.status === 'transcribed') {
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
    if (phase !== 'start' || selectionEdit) return
    onCommit?.(`会议纪要 · ${value === 'quick' ? '快速生成' : '引导整理'}`)
    setMode(value)
    add({ kind: 'user', choiceStep: 'mode', text: value === 'quick' ? '快速生成' : '引导整理' }, { kind: 'assistant', text: value === 'quick' ? '上传录音后，我会直接生成纪要草稿。' : '先选择纪要用途和关注重点，再上传录音核对转写。' })
    setPhase(value === 'quick' ? 'upload' : 'audience'); log(`选择${value === 'quick' ? '快速生成' : '引导整理'}`)
  }
  const chooseAudience = (value: string) => { if (selectionPhase !== 'audience' || selectionEdit) return; if(jobId){void saveSelection({step:'audience',mode:mode ?? 'guided',audience:value,focus});return} setAudience(value); setPhase('focus'); add({ kind: 'user', choiceStep: 'audience', text: value }, { kind: 'assistant', text: '这次希望重点突出什么？' }); log(`纪要用途：${value}`) }
  const chooseFocus = (value: string) => { if (selectionPhase !== 'focus' || selectionEdit) return; if(jobId){void saveSelection({step:'focus',mode:mode ?? 'guided',audience,focus:value});return} setFocus(value); add({ kind: 'user', choiceStep: 'focus', text: value }); if(recordingSource){void beginRecording(value);return} setPhase('upload'); add({ kind: 'assistant', text: '准备好了，请上传录音。' }); log(`关注重点：${value}`) }
  const sourceStarted=useRef(false)
  const beginRecording=async(selectedFocus=focus)=>{
    if(!recordingSource||busy||!canProcess)return
    setBusy(true);setPhase('processing');setNotice('')
    try{const result=await recordingApi<{job:Job}>('followup/start',{id:recordingSource.id,operation:recordingSource.operation,audience,focus:selectedFocus,summaryModel});setJobId(result.job.id);setJob(result.job)}
    catch(e){setNotice(e instanceof Error?e.message:String(e));setPhase('upload')}
    finally{setBusy(false)}
  }
  useEffect(()=>{if(recordingSource&&!jobId&&phase==='processing'&&!sourceStarted.current){sourceStarted.current=true;void beginRecording()}},[])
  const onFile = async (file?: File) => {
    if (!file || (phase !== 'upload' && selectionEdit?.step !== 'audio') || busy || recordingSource || !canProcess) return
    if (!/\.(mp3|m4a|wav|aac|flac|ogg|opus|webm|mp4)$/i.test(file.name)) { setNotice('请选择 MP3、M4A、WAV 等支持的音视频文件'); return }
    if (file.size > (availability?.maxBytes ?? 0)) { setNotice('录音超过当前上传限制'); return }
    if (!availability?.ready) { setNotice(availability?.message || '转写服务尚未配置'); return }
    const selected = selectionEdit ?? { mode: mode ?? 'quick', audience, focus }
    if (selected.mode === 'guided' && (!selected.audience.trim() || !selected.focus.trim())) {
      void openSelection(!selected.audience.trim() ? 'audience' : 'focus'); setNotice('请先补齐用途和重点，再选择录音'); if (input.current) input.current.value = ''; return
    }
    setBusy(true); editing.current = true; mutation.current++
    try {
      const replacing = Boolean(jobId)
      const created = jobId ? { id: jobId } : await post<Job>('/create', { title: conversationTitle, fileName: file.name, mode: selected.mode, audience: selected.audience, focus: selected.focus, summaryModel, roleId, roleVersion })
      setJobId(created.id)
      const query = new URLSearchParams({ replace: file.name, mode: selected.mode, audience: selected.audience, focus: selected.focus, summaryModel })
      const uploaded = await api<Job>(`/upload/${created.id}${replacing ? '?' + query : ''}`, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: file })
      setMessages(current => current.filter(message => !['transcript', 'minutes'].includes(message.kind)))
      setSegments([]); setShowTranscript(false); setSourceRequest(null); setTimingConfirm(false)
      setSelectionEdit(null); setContinueAt(undefined); setJob(uploaded); setPhase('processing')
      setMode(selected.mode); setAudience(selected.audience); setFocus(selected.focus)
      const audioAnswer = choiceMessage(messages, 'audio')
      if (audioAnswer) setMessages(current => current.map(message => message.id === audioAnswer.id ? { ...message, file: file.name, createdAt: new Date().toISOString(), choiceStep: 'audio' } : message))
      else add({ kind: 'upload', choiceStep: 'audio', file: file.name })
      log(`${replacing ? '更换' : '上传'}录音：${file.name}`); log('录音上传完成，开始语音转写')
    } catch (error) { setNotice(error instanceof Error ? error.message : String(error)); if (!job?.size) setPhase('upload') }
    finally { editing.current = false; mutation.current++; setBusy(false); if (input.current) input.current.value = '' }
  }
  const retry = async () => {
    if (!jobId) return
    if (job && !job.size) { setJobId(null); setJob(null); setPhase('upload'); setNotice('请重新选择录音上传'); return }
    if (job?.segments.length) {
      if (mode === 'guided') { setPhase('transcript'); setSegments(current => current.length ? current : job.segments); setMessages(current => current.some(message => message.kind === 'transcript') ? current : [...current, { id: nextId.current++, kind: 'transcript', createdAt: job.transcribedAt }]); return }
      void generate(); return
    }
    setBusy(true)
    try { const next = await post<Job>('/retry', { id: jobId }); setJob(next); setPhase(next.status === 'transcribed' ? 'transcript' : 'processing'); log('重试处理录音') }
    catch (error) { setNotice(error instanceof Error ? error.message : String(error)) }
    finally { setBusy(false) }
  }
  const generate = async (instruction?: string) => {
    if (!canGenerate){setNotice('此岗位的后续处理已停用，已有结果仍可查看');return}
    if (!jobId || busy || selectionEdit || job?.timingStatus === 'processing') return
    setBusy(true); setPhase('processing')
    try {
      await post('/generate', { id: jobId, summaryModel, ...(instruction ? { instruction } : segments.length ? { segments } : {}) })
      setJob(current => current ? { ...current, status: 'generating' } : current)
      log(instruction ? `修改纪要：${instruction}` : '核对转写并生成纪要')
    } catch (error) { setNotice(error instanceof Error ? error.message : String(error)); if(instruction)setDraft(current=>current||instruction);setPhase(instruction ? 'ready' : 'transcript') }
    finally { setBusy(false) }
  }
  const openSelection = async (step: SelectionStep, messageId = choiceMessage(messages, step)?.id) => {
    if (busy || !canProcess || (jobId && !job)) return
    pinned.current = false
    setBusy(true); editing.current = true; mutation.current++
    try {
      if (job && (['transcribing', 'generating'].includes(job.status) || job.timingStatus === 'processing')) {
        const stopped = await post<Job>('/stop', { id: jobId })
        setJob(stopped); setPhase(stopped.minutes ? 'ready' : stopped.segments.length ? 'transcript' : 'upload')
        log('停止本轮，返回修改选择'); setNotice('本轮已停止，可以重新选择后继续')
      }
      if (messageId === undefined) {
        messageId = nextId.current++
        setMessages(current => [...current, { id: messageId!, kind: step === 'audio' ? 'upload' : 'user', choiceStep: step, ...(step === 'audio' ? { file: job?.fileName } : { text: step === 'mode' ? modeLabel(mode ?? 'guided') : step === 'audience' ? audience || '通用' : focus || '结论与待办' }) }])
      }
      setSelectionEdit({ step, messageId, mode: mode ?? 'guided', audience, focus })
      setTab('chat')
    } catch (error) { setNotice(error instanceof Error ? error.message : String(error)) }
    finally { editing.current = false; mutation.current++; setBusy(false) }
  }
  const cancelSelection = () => {
    const id = selectionEdit?.messageId; setSelectionEdit(null)
    window.requestAnimationFrame(() => document.getElementById('meeting-reset-' + id)?.focus({ preventScroll: true }))
  }
  useEffect(() => {
    if (!selectionEdit || tab !== 'chat') return
    const editor = document.getElementById('meeting-choice-' + selectionEdit.messageId)
    const bubble = editor?.closest('article') ?? editor
    bubble?.scrollIntoView?.({ block: 'nearest', behavior: 'auto' })
    editor?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')?.focus({ preventScroll: true })
  }, [selectionEdit?.messageId, selectionEdit?.step, tab, newProgress])
  const saveSelection = async (replacement = selectionEdit) => {
    if (!replacement || busy) return
    const selected = { ...replacement, audience: replacement.audience.trim(), focus: replacement.focus.trim() }
    if (selected.step === 'audience' && !selected.audience || selected.step === 'focus' && !selected.focus) { setNotice('请输入要采用的选项'); return }
    setBusy(true); editing.current = true; mutation.current++
    try {
      const next = jobId ? await post<Job>('/options', { id: jobId, mode: selected.mode, audience: selected.audience, focus: selected.focus, summaryModel }) : null
      const previous = selected.step === 'mode' ? modeLabel(mode ?? 'guided') : selected.step === 'audience' ? audience : focus
      const value = selected.step === 'mode' ? modeLabel(selected.mode) : selected.step === 'audience' ? selected.audience : selected.focus
      if (selected.messageId === undefined) {
        selected.messageId = nextId.current++
        setMessages(current => [...current, { id: selected.messageId!, kind: 'user', text: value, choiceStep: selected.step, createdAt: new Date().toISOString() }])
      }
      setMode(selected.mode); setAudience(selected.audience); setFocus(selected.focus)
      setMessages(current => current.map(message => message.id === selected.messageId ? { ...message, text: value, choiceStep: selected.step, createdAt: previous === value ? message.createdAt : new Date().toISOString() } : message))
      if (previous !== value) log('重新选择' + selectionLabels[selected.step] + '：' + (previous || '默认') + ' → ' + value)
      setSelectionEdit(null)
      if (next) {
        setJob(next)
        if (selected.mode === 'guided' && (!selected.audience || !selected.focus)) add({kind:'assistant',text:!selected.audience ? '先选择纪要用途和关注重点。' : '这次希望重点突出什么？'})
        if (next.status === 'ready' && !next.needsRegeneration) { setPhase('ready'); setContinueAt(undefined) }
        else { setContinueAt(selected.messageId); setPhase(next.segments.length ? 'transcript' : 'upload') }
      } else {
        const nextPhase = selected.mode === 'quick' ? 'upload' : !selected.audience ? 'audience' : !selected.focus ? 'focus' : 'upload'
        setPhase(nextPhase)
        if (recordingSource && nextPhase === 'upload') setContinueAt(selected.messageId)
        else {
          const prompt = nextPhase === 'audience' ? '先选择纪要用途和关注重点。' : nextPhase === 'focus' ? '这次希望重点突出什么？' : '准备好了，请上传录音。'
          if ([...messages].reverse().find(message => message.kind === 'assistant')?.text !== prompt) add({ kind: 'assistant', text: prompt })
        }
      }
    } catch (error) { setNotice(error instanceof Error ? error.message : String(error)) }
    finally { editing.current = false; mutation.current++; setBusy(false) }
  }
  const continueSelection = async () => {
    if (busy || selectionEdit) return
    if (selectionPhase === 'audience' || selectionPhase === 'focus') { setNotice('请先补齐纪要用途和重点'); return }
    setContinueAt(undefined)
    if (!jobId && recordingSource) { await beginRecording(); return }
    if (job?.segments.length) {
      if (mode === 'guided' && !job.minutes) {
        setPhase('transcript')
        setMessages(current => current.some(message => message.kind === 'transcript') ? current : [...current, { id: nextId.current++, kind: 'transcript', createdAt: job.transcribedAt }])
      } else await generate()
    } else await retry()
  }
  const revise = (value: string) => { if (phase !== 'ready' || !value.trim()) return; if (job?.timingStatus === 'processing') { setNotice('正在补全时间定位，请完成后再修改纪要'); return };  void generate(value) }
  const send = () => {
    if (selectionEdit) { setNotice('请先保存或取消当前修改，输入已保留'); return }
    if(fileSearchCommand(draft)||recordingCommand(draft)){setDraft('');return}
    if (job?.timingStatus === 'processing') { setNotice('正在补全时间定位，请完成后再发送，输入已保留'); return }
    const value = draft.trim(); if (!value) return; setDraft('')
    if (selectionPhase === 'audience') return chooseAudience(value)
    if (selectionPhase === 'focus') return chooseFocus(value)
    if (phase === 'ready') return revise(value)
    if(recordingSource&&phase==='transcript'&&['生成纪要','整理纪要','快速生成纪要'].includes(value))return void generate()
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
    {editable && <div className={s.cardFooter}>{modelControl}<span>可修改说话人和识别文字，确认后生成纪要。</span><button className={s.primary} disabled={!canGenerate || busy || !!selectionEdit || job?.timingStatus === 'processing'} onClick={() => void generate()}>确认转写，生成纪要 →</button></div>}
  </div>
  const minutesCard = () => !job?.minutes ? null : <div className={s.resultCard}>
    <div className={s.cardHead}><div><small>{job.needsRegeneration ? '上一次保存的纪要 · 将按新选择更新' : '会议纪要 · 可继续对话修改'}</small><h3>{job.minutes.title}</h3></div><span>基于录音生成</span></div>
    <div className={s.minutes}><section><h4>会议概览</h4><p>{job.minutes.overview}</p></section><section><h4>主要结论</h4>{job.minutes.decisions.map((item, index) => <p key={index}>{item.text} {sourceLinks(item)}</p>)}</section><section><h4>行动项</h4>{job.minutes.actions.map((item, index) => <div className={s.actionLine} key={index}><strong>{item.text}</strong><span>{item.owner || '负责人待确认'} · {item.deadline || '期限待确认'} {sourceLinks(item)}</span></div>)}</section><section><h4>待确认事项</h4>{job.minutes.unknown.map((item, index) => <p key={index}>{item.text} {sourceLinks(item)}</p>)}</section></div>
    <div className={s.cardFooter}><button onClick={() => void copyMinutes()}>复制纪要</button><button onClick={printMinutes}>打印 / 保存 PDF</button><button onClick={() => { setSourceRequest(null); setShowTranscript(value => !value) }}>{showTranscript ? '收起转写' : '查看转写原文'}</button></div>
    <div className={s.modelRow}>{modelControl}<button disabled={!canGenerate || busy || !!selectionEdit || job?.timingStatus === 'processing'} onClick={() => void generate()}>用所选模型重新生成</button></div>
    {!job.segments.every(hasTiming) && <div className={s.cardFooter}><span>{job.timingStatus === 'processing' ? '正在补全时间定位，原纪要保留…' : job.timingError || (job.timing ? '已关联有依据的时间片段；其余条目仍可查看原文' : '当前转写缺少分段时间，来源暂不支持准确回听')}</span><button disabled={busy || !!selectionEdit || job.timingStatus === 'processing' || job.status !== 'ready'} onClick={() => setTimingConfirm(true)}>补全时间定位</button><button onClick={() => openCapabilityLink({ section: 'capability-center', capabilityId: MEETING_CAPABILITY_ID })}>识别模型设置</button></div>}
    {timingConfirm && <div className={s.cardFooter} role="group" aria-label="确认补全时间定位"><p>将使用当前识别模型重新处理已保存录音，并用纪要模型关联来源，可能产生调用费用。原纪要与人工校对内容保留；已关联分段定位能力时按录音切片获取时间，否则使用识别服务返回的时间戳。</p><button disabled={busy} onClick={() => void repairTiming()}>开始补全</button><button onClick={() => setTimingConfirm(false)}>取消</button></div>}
    {showTranscript && transcriptCard(false)}
  </div>
  const assistantMessage = (children: React.ReactNode, key: number, time?: React.ReactNode) => <article className={s.message} key={key}><RoleAppearanceIcon roleId={roleId ?? MEETING_DEMO_ROLE_ID} icon={assistantIcon} color={assistantColor}/><div className={s.messageBody}><div className={s.byline}>{assistantName}</div>{children}{time}</div></article>
  const selectionEditor = (message: Message) => selectionEdit?.messageId !== message.id ? null : <div className={s.selectionEditor} id={'meeting-choice-' + message.id} role="group" aria-label="重新选择当前步骤" onKeyDown={event => { if (event.key === 'Escape' && !busy) { event.stopPropagation(); cancelSelection() } }}>
    <strong>重新选择{selectionLabels[selectionEdit.step]}</strong>
    {selectionEdit.step === 'mode' && <div className={s.choices}>{(['quick','guided'] as const).map(value => <button key={value} disabled={busy} aria-pressed={selectionEdit.mode === value} onClick={() => void saveSelection({...selectionEdit,mode:value})}>{modeLabel(value)}</button>)}</div>}
    {(selectionEdit.step === 'audience' || selectionEdit.step === 'focus') && <>
      <div className={s.choices}>{(selectionEdit.step === 'audience' ? ['团队同步','领导汇报','客户沟通'] : ['结论与待办','风险与问题','完整讨论']).map(value => <button key={value} disabled={busy} aria-pressed={selectionEdit[selectionEdit.step as 'audience'|'focus'] === value} onClick={() => void saveSelection({...selectionEdit,[selectionEdit.step]:value})}>{value}</button>)}</div>
      <div className={s.customChoice}><input aria-label={selectionEdit.step === 'audience' ? '新的纪要用途' : '新的整理重点'} maxLength={100} disabled={busy} value={selectionEdit[selectionEdit.step]} onChange={event => setSelectionEdit({...selectionEdit,[selectionEdit.step]:event.target.value})} onKeyDown={event => { if(event.key === 'Enter' && !event.nativeEvent.isComposing) {event.preventDefault();void saveSelection()} }}/><button disabled={busy} onClick={() => void saveSelection()}>采用</button></div>
    </>}
    {selectionEdit.step === 'audio' && <><p>{job?.size ? '当前录音：' + job.fileName + '。更换后重新转写，其他选择保留。' : '选择录音，已有用途和重点会保留。'}</p><div className={s.choices}><button disabled={busy || !availability?.ready} onClick={() => input.current?.click()}>{job?.size ? '选择其他录音' : '选择录音'}</button>{!!job?.size && <button disabled={busy} onClick={() => {setSelectionEdit(null);setContinueAt(message.id)}}>保留录音</button>}</div></>}
    <div className={s.choices}><button disabled={busy} onClick={cancelSelection}>取消</button>{busy && <span role="status">正在保存…</span>}</div>
  </div>
  const activePromptId = [...messages].reverse().find(message => message.kind === 'assistant')?.id
  const renderMessage = (message: Message) => {
    const activePrompt = !selectionEdit && message.id === activePromptId
    const value = message.kind === 'minutes' ? job?.minutesGeneratedAt ?? message.createdAt : message.kind === 'transcript' ? job?.transcribedAt ?? message.createdAt : message.createdAt ?? (message.kind === 'intro' || message.kind === 'upload' ? job?.createdAt : undefined)
    const stamp = <MessageTime value={value ?? (message.kind === 'minutes' ? job?.updatedAt : undefined)} label={!value && message.kind === 'minutes' ? '任务最后更新：' : ''}/>
    if (message.kind === 'user' || message.kind === 'upload') {
      const step = message.choiceStep
      const resettable = step && choiceMessage(messages, step)?.id === message.id && canProcess && !(recordingSource && (step === 'audio' || step === 'mode'))
      return <article className={s.userMessage} key={message.id} data-choice-step={step} data-message-id={message.id}><div className={selectionEdit?.messageId === message.id ? s.editingBubble : undefined}>
        <div className={s.answerLine}><span>{message.kind === 'upload' ? <>♫　<strong>{message.file}</strong><small>会议录音</small></> : message.text}</span>{resettable && <button id={'meeting-reset-' + message.id} className={s.resetChoice} title={'重新选择' + selectionLabels[step]} aria-label={'重新选择' + selectionLabels[step]} aria-expanded={selectionEdit?.messageId === message.id} disabled={busy || !!jobId && !job || !!selectionEdit && selectionEdit.messageId !== message.id} onClick={() => void openSelection(step, message.id)}><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 10a9 9 0 1 1 2.8 8.5"/><path d="M3 4v6h6"/></svg></button>}</div>{stamp}
        {selectionEditor(message)}
        {continueAt === message.id && !selectionEdit && selectionPhase !== 'audience' && selectionPhase !== 'focus' && <div className={s.selectionContinue}><small>{job?.minutes ? '选择已更新，原纪要保留。' : '已有录音和校对内容保留。'}</small><button disabled={busy || !canProcess || !!job?.segments.length && !canGenerate} onClick={() => void continueSelection()}>{job?.minutes || mode === 'quick' && !!job?.segments.length ? '按新选择继续生成' : '继续处理'}</button></div>}
      </div></article>
    }
    if (message.kind === 'intro') return assistantMessage(<><p className={s.lead}>你好，我是{assistantName}。</p><p>我可以帮你把会议录音整理为结论和待办。先选择这次的处理方式：</p>{mode ? <p className={s.selectedMode}>已选择 {mode === 'quick' ? '快速生成' : '引导整理'} · 后续仍可在对话中修改</p> : <div className={s.modes}><button onClick={() => chooseMode('quick')}><b>⚡　快速生成</b><span>上传录音后直接生成纪要草稿</span><em>适合马上看结果 →</em></button><button onClick={() => chooseMode('guided')}><b>☷　引导整理</b><span>先选用途与重点，再核对转写</span><em>适合需要把控细节 →</em></button></div>}<p className={s.muted}>录音由你配置的语音识别接口处理；纪要使用工作台模型。{availability?.message}</p></>, message.id, stamp)
    if (message.kind === 'assistant') return assistantMessage(<><p>{message.text}</p>{activePrompt && selectionPhase === 'audience' && message.text?.startsWith('先选择') && <div className={s.choices}>{['团队同步', '领导汇报', '客户沟通'].map(value => <button key={value} onClick={() => chooseAudience(value)}>{value}</button>)}</div>}{activePrompt && selectionPhase === 'focus' && message.text === '这次希望重点突出什么？' && <div className={s.choices}>{['结论与待办', '风险与问题', '完整讨论'].map(value => <button key={value} onClick={() => chooseFocus(value)}>{value}</button>)}</div>}{activePrompt && phase === 'upload' && (message.text?.startsWith('上传录音') || message.text?.startsWith('准备好了')) && <><div className={s.uploadPrompt}><span>♫</span><div><strong>添加会议录音</strong><small>MP3、M4A、WAV 等 · 最大 {Math.round((availability?.maxBytes ?? 25 * 1024 * 1024) / 1024 / 1024)} MB</small></div><button className={s.primary} disabled={!availability?.ready || busy} onClick={() => input.current?.click()}>选择录音</button>{!availability?.ready && <button type="button" onClick={() => openCapabilityLink({ section: 'capability-center', capabilityId: MEETING_CAPABILITY_ID })}>前往能力中心</button>}</div>{modelControl}</>}</>, message.id, stamp)
    if (message.kind === 'transcript' && selectionPhase !== 'transcript') return null
    if (message.kind === 'transcript') return assistantMessage(<><p>转写已完成。请核对说话人和关键内容，确认后生成纪要。</p>{transcriptCard(true)}</>, message.id, stamp)
    if (message.kind === 'minutes') return assistantMessage(<><p>纪要已生成。你可以继续在下方对话框提出修改。</p>{minutesCard()}<div className={s.choices}><span>试试：</span>{['把待办放在前面', '缩短摘要', '突出待确认事项'].map(value => <button key={value} onClick={() => revise(value)}>{value}</button>)}</div></>, message.id, stamp)
    return null
  }
  const status = job?.status
  return <div className={s.root} data-meeting-demo="true">
    <div className={s.heading}><div>{!recordingSource&&!conversationTitle && <span>你好</span>}<strong>{conversationTitle || assistantName}</strong></div><div><span className={s.demoBadge}>{availability?.ready ? '录音转纪要' : '待配置'}</span>{!recordingSource&&<button onClick={() => onReset?.()}>重新开始</button>}</div></div>
    <div className={s.tabs} role="tablist" aria-label="会话视图"><button role="tab" aria-selected={tab === 'chat'} onClick={() => setTab('chat')}>对话</button><button role="tab" aria-selected={tab === 'trace'} onClick={() => setTab('trace')}>轨迹</button></div>
    {mode && canProcess && <section className={s.workflow} aria-label="本次处理步骤">
      <div className={s.workflowSteps}>
        {!recordingSource && <button disabled={busy || !!jobId && !job || !!selectionEdit} aria-label="修改生成方式" onClick={() => void openSelection('mode')}>方式：{modeLabel(mode)}</button>}
        <button disabled={busy || !!jobId && !job || !!selectionEdit} aria-label="修改纪要用途" title={audience || undefined} onClick={() => void openSelection('audience')}>用途：{audience || (mode === 'guided' ? '待选择' : '通用')}</button>
        <button disabled={busy || !!jobId && !job || !!selectionEdit} aria-label="修改整理重点" title={focus || undefined} onClick={() => void openSelection('focus')}>重点：{focus || (mode === 'guided' ? '待选择' : '结论与待办')}</button>
        {!recordingSource && <button disabled={busy || !!jobId && !job || !!selectionEdit} aria-label="修改录音" title={job?.fileName || undefined} onClick={() => void openSelection('audio')}>录音：{job?.fileName || choiceMessage(messages, 'audio')?.file || '待上传'}</button>}
      </div>
      <small>{selectionEdit ? '在对应气泡中选择，或取消修改' : job && (['transcribing', 'generating'].includes(job.status) || job.timingStatus === 'processing') ? '点击步骤可停止本轮并修改' : '点击步骤可重新选择'}</small>
    </section>}
    <div className={s.scroll} ref={scroll} onScroll={()=>{const el=scroll.current;if(el)pinned.current=el.scrollHeight-el.scrollTop-el.clientHeight<80}} role="tabpanel">{tab === 'chat' ? <div className={s.messages}>{sourceHeader}{recordingSource&&phase==='upload'&&<div className={s.cardFooter}><p>使用当前已保存录音继续处理</p>{modelControl}<button disabled={busy||!canProcess} onClick={()=>void beginRecording()}>继续处理录音</button></div>}{messages.filter(m=>m.kind!=='minutes').map(renderMessage)}<ExecutionHistory kind="meeting" id={jobId} active={Boolean(job&&(['uploading','transcribing','generating'].includes(job.status)||job.timingStatus==='processing'))}/>{messages.filter(m=>m.kind==='minutes').map(renderMessage)}{job?.minutes&&!messages.some(m=>m.kind==='minutes')&&assistantMessage(<><p>上一次保存的纪要</p>{minutesCard()}<MessageTime value={job.minutesGeneratedAt}/></>,-4)}{!selectionEdit && phase === 'processing' && status !== 'error' && assistantMessage(<div className={s.progress}><span>◌</span><div><strong>{status === 'generating' || status === 'transcribed' ? '正在生成纪要…' : status === 'uploading' ? '正在上传录音…' : '正在转写录音…'}</strong><small>可以切换会话，处理完成后回来查看</small><div className={s.progressTrack}><i/></div></div></div>, -1)}{status === 'error' && assistantMessage(<div className={s.resultCard}><div className={s.cardHead}><div><small>本轮未完成</small><h3>{job?.error}</h3></div></div><div className={s.cardFooter}><button disabled={busy || !!selectionEdit || !canProcess} onClick={() => void retry()}>继续处理</button><button disabled={busy || !canProcess} onClick={() => void openSelection(recordingSource ? 'focus' : 'audio')}>修改选择</button></div></div>, -2)}</div> : <div className={s.trace}><h2>会话轨迹</h2><p>记录本次会议处理步骤。</p><ol>{trace.map((entry, index) => <li key={index}><span>{String(index + 1).padStart(2, '0')}</span>{entry}</li>)}</ol></div>}</div>
    {newProgress&&<button className={s.progressAction} onClick={()=>{pinned.current=true;setNewProgress(false);scroll.current?.scrollTo({top:scroll.current.scrollHeight,behavior:'smooth'})}}>有新进展 · 回到底部</button>}
    {job&&(['transcribing','generating'].includes(job.status)||job.timingStatus==='processing')&&<button className={s.progressAction} disabled={busy} onClick={() => void openSelection(recordingSource ? 'focus' : 'audio')}>停止本轮</button>}
    <div className={s.composerWrap}><div className={s.composer}><textarea aria-label="输入消息" value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) { event.preventDefault(); send() } }} placeholder={phase === 'start' ? '先选择上方的整理方式，或输入消息' : phase === 'audience' ? '输入纪要用途' : phase === 'focus' ? '输入关注重点' : phase === 'ready' ? '输入要求，继续修改纪要' : '输入消息，继续对话'}/><div className={s.composerTools}><div><button aria-label="添加录音" title="添加录音" disabled={!!recordingSource || !!selectionEdit || phase !== 'upload' || !availability?.ready || busy} onClick={() => input.current?.click()}>＋</button><span>{availability?.ready ? '录音交由已配置的识别接口处理' : '语音识别尚未配置'}</span></div><div><span>{assistantName}</span><button className={s.send} aria-label="发送消息" disabled={!draft.trim() || busy || !!selectionEdit} onClick={send}>↑</button></div></div></div>{notice && <p className={s.notice} role="status">{notice}</p>}</div>
    <input ref={input} type="file" accept=".mp3,.m4a,.wav,.aac,.flac,.ogg,.opus,.webm,.mp4" hidden onChange={event => void onFile(event.target.files?.[0])}/>
  </div>
}

