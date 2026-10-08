import { RequirementsNotebook } from './RequirementsNotebook.tsx'
import { MessageTime } from './MessageTime.tsx'
import { PillCheckbox } from '../../../../shared/client/PillCheckbox.tsx'
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { RoleDefinition } from '../../../dsh-capabilities/src/core/model.ts'
import { requirementMarkdown, activeRequirements, defaultRequirementSettings, emptyRequirement, emptyRequirementOverview, openQuestions, questionStatusNames, requirementStatusNames, REQUIREMENTS_CAPABILITY_ID, type ProposalItem, type Requirement, type RequirementAvailability, type RequirementCommand, type RequirementFlow, type RequirementMaterial, type RequirementOverview, type RequirementQuestion, type RequirementRule, type RequirementSettings, type RequirementSummary, type RequirementTask, type SourceRef } from '../../../dsh-capabilities/src/core/requirements-model.ts'
import { openCapabilityLink } from './capability-client.ts'
import { RoleAppearanceIcon } from './RoleAppearance.tsx'
import { commandRequirementTask, createRequirementTask, getRequirementConfig, getRequirementTask, RequirementsApiError, sourceText, summarizeRequirementTask } from './requirements-client.ts'
import s from './RequirementsAssistant.module.css'

type Props = { taskId?: string; draftKey?: string; initialDraft?: string; roleId: string; roleVersion?: number; assistant?: Pick<RoleDefinition, 'name' | 'color' | 'icon'>; loadModels?: () => Promise<Array<{ id: string; name: string }>>; onCommit?: (task: RequirementSummary) => void; onDraftChange?: (draft: string) => void }
type MainTab = 'chat' | 'workspace' | 'trace'
type WorkspaceTab = 'overview' | 'materials' | 'requirements' | 'flows' | 'questions' | 'document'
type EditorKind = 'overview' | 'settings' | 'material' | 'requirement' | 'flow' | 'rule' | 'question' | 'split' | 'merge' | 'version'
type Editor = { kind: EditorKind; value: Record<string, unknown>; base?: Record<string, unknown>; conflict?: boolean }
type LocalDraft = { draft?: string; editor?: Editor; mode?: 'quick' | 'guided'; modeSelected?: boolean; chatView?: 'chooser' | 'work'; creationId?: string; context?: string; answers?: Record<string, string>; tab?: MainTab; workspace?: WorkspaceTab; search?: string; statusFilter?: string; flowView?: 'flows'|'rules'; questionFilter?: string; documentDepth?: RequirementSettings['depth']; documentRange?: 'all'|'confirmed'|'selected'; versionId?: string; traceFilter?: string; selected?: string[]; scroll?: Record<string,number> }
const mainTabs = [['chat', '对话'], ['workspace', '需求结果'], ['trace', '轨迹']] as const
const workspaceTabs = [['overview', '概览'], ['materials', '资料'], ['requirements', '需求清单'], ['flows', '流程与规则'], ['questions', '待确认'], ['document', '需求文档']] as const
const priorityNames = { must: '必须', should: '应该', could: '可以' }
const originNames = { user: '用户整理', source: '资料提取', assistant: '助手建议' }
const fieldNames: Record<string, string> = { title: '名称', description: '需求描述', module: '所属模块', kind: '类型', priority: '优先级', status: '状态', actor: '执行角色', trigger: '触发条件', preconditions: '前置条件', steps: '操作步骤', rules: '业务规则', exceptions: '异常处理', inputs: '输入数据', outputs: '输出内容', acceptance: '验收标准', sources: '依据', origin: '提出方式', name: '名称', action: '处理动作', condition: '适用条件', result: '预期结果', next: '下一步', exception: '例外 / 异常分支', requirementIds: '关联需求', question: '需要确认的问题', reason: '为什么需要确认', options: '可选答案', answer: '当前答复', blocking: '影响需求确认', background: '业务背景与现状', goal: '业务目标', scope: '本次范围', excluded: '暂缓范围 / 外部依赖', roles: '使用角色' }
const operationNames = { analyze: '整理需求', clarify: '引导澄清', check: '检查遗漏', revise: '讨论修改', document: '调整文档内容' }
const editorNames: Record<EditorKind, string> = { overview: '编辑分析概览', settings: '本次分析设置', material: '资料内容', requirement: '需求详情', flow: '流程步骤', rule: '业务规则', question: '待确认问题', split: '拆分需求', merge: '合并需求', version: '保存确认版本' }
const id = () => crypto.randomUUID()
const time = (value: string) => new Date(value).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
function restoreLocal(key: string): LocalDraft { try { return JSON.parse(sessionStorage.getItem(key) ?? '{}') as LocalDraft } catch { return {} } }
function rememberLocal(key: string, value: LocalDraft) { try { sessionStorage.setItem(key, JSON.stringify(value)) } catch { /* Server draft saving remains available when browser storage is full. */ } }
function TabBar<T extends string>({ items, value, label, onChange }: { items: readonly (readonly [T, string])[]; value: T; label: string; onChange: (value: T) => void }) {
  return <div className={s.tabs} role="tablist" aria-label={label}>{items.map(([key, name], index) => <button type="button" key={key} role="tab" aria-selected={value === key} tabIndex={value === key ? 0 : -1} onClick={() => onChange(key)} onKeyDown={event => {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return
    event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length
    onChange(items[next][0]); (event.currentTarget.parentElement?.children[next] as HTMLButtonElement)?.focus()
  }}>{name}</button>)}</div>
}
function Empty({ title, children }: { title: string; children?: React.ReactNode }) { return <div className={s.empty}><span aria-hidden="true">▤</span><h3>{title}</h3><div>{children}</div></div> }
function Field({ label, value, onChange, multiline = false, placeholder, required = false }: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean; placeholder?: string; required?: boolean }) {
  return <label className={s.field}><span>{label}{required && <small> 必填</small>}</span>{multiline ? <textarea aria-label={label} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={3}/> : <input aria-label={label} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}/>}</label>
}
function SelectField({ label, value, options, onChange }: { label: string; value: string; options: readonly (readonly [string, string])[]; onChange: (value: string) => void }) { return <label className={s.field}><span>{label}</span><select aria-label={label} value={value} onChange={e => onChange(e.target.value)}>{options.map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label> }
function Modal({ title, children, footer, onClose }: { title: string; children: React.ReactNode; footer?: React.ReactNode; onClose: () => void }) {
  const dialog = useRef<HTMLDivElement>(null)
  const close = useRef(onClose); close.current = onClose
  useEffect(() => { const previous = document.activeElement as HTMLElement | null; dialog.current?.focus(); return () => { if (previous?.isConnected) previous.focus() } }, [])
  return <div className={s.overlay} onMouseDown={e => { if (e.target === e.currentTarget) close.current() }}><div ref={dialog} className={s.dialog} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} onKeyDown={e => {
    if (e.key === 'Escape') { e.stopPropagation(); close.current() }
    if (e.key === 'Tab') { const focusable = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]') ?? []); const first = focusable[0], last = focusable.at(-1); if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { e.preventDefault(); last?.focus() } else if (!e.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { e.preventDefault(); first?.focus() } }
  }}><header><h2>{title}</h2><button type="button" onClick={onClose} aria-label="关闭面板">×</button></header><div className={s.dialogBody}>{children}</div>{footer && <footer>{footer}</footer>}</div></div>
}
function DocumentPreview({ text }: { text: string }) { return <div className={s.document}>{text.split('\n').map((line, i) => line.startsWith('### ') ? <h3 key={i}>{line.slice(4)}</h3> : line.startsWith('## ') ? <h2 key={i}>{line.slice(3)}</h2> : line.startsWith('# ') ? <h1 key={i}>{line.slice(2)}</h1> : line ? <p key={i}>{line}</p> : <div className={s.docGap} key={i}/>)}</div> }

export function RequirementsAssistant({ taskId, draftKey, initialDraft, roleId, roleVersion, assistant, loadModels, onCommit, onDraftChange }: Props) {
  const instanceId = useRef(draftKey ?? id())
  const storageKey = useRef(`workbench-requirement-edit:${taskId || `new:${instanceId.current}`}`)
  const initial = useRef(restoreLocal(storageKey.current))
  const creationId = useRef(initial.current.creationId ?? id())
  const creationPromise = useRef<Promise<RequirementTask | undefined>>()
  const [task, setTask] = useState<RequirementTask | null>(null)
  const taskRef = useRef<RequirementTask | null>(null)
  const commitRef = useRef(onCommit); commitRef.current = onCommit
  const draftChangeRef = useRef(onDraftChange); draftChangeRef.current = onDraftChange
  const mounted = useRef(true)
  const [availability, setAvailability] = useState<RequirementAvailability | null>(null)
  const [models, setModels] = useState<Array<{ id: string; name: string }>>([])
  const [tab, setTab] = useState<MainTab>(initial.current.tab ?? 'chat')
  const [workspace, setWorkspace] = useState<WorkspaceTab>(initial.current.workspace ?? 'document')
  const [mode, setMode] = useState<'quick' | 'guided'>(initial.current.mode ?? 'quick')
  const modeRef = useRef(mode); modeRef.current = mode
  const [modeSelected, setModeSelected] = useState(initial.current.modeSelected ?? !!taskId)
  const [chatView, setChatView] = useState<'chooser' | 'work'>(initial.current.chatView ?? (taskId ? 'work' : 'chooser'))
  const [draft, setDraft] = useState(initial.current.draft ?? (taskId ? '' : initialDraft) ?? '')
  const draftRef = useRef(draft); draftRef.current = draft
  const [context, setContext] = useState(initial.current.context ?? '')
  const [editor, setEditor] = useState<Editor | undefined>(initial.current.editor)
  const editorRef = useRef(editor); editorRef.current = editor
  const [source, setSource] = useState<SourceRef | undefined>()
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(!!taskId)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const [draftSaveFailed, setDraftSaveFailed] = useState(false)
  const [selected, setSelected] = useState<string[]>(initial.current.selected ?? [])
  const [proposalSelection, setProposalSelection] = useState<string[]>([])
  const [search, setSearch] = useState(initial.current.search ?? '')
  const [statusFilter, setStatusFilter] = useState(initial.current.statusFilter ?? 'all')
  const [flowView, setFlowView] = useState<'flows' | 'rules'>(initial.current.flowView ?? 'flows')
  const [questionFilter, setQuestionFilter] = useState(initial.current.questionFilter ?? 'active')
  const [answers, setAnswers] = useState<Record<string, string>>(initial.current.answers ?? {})
  const [documentDepth, setDocumentDepth] = useState<RequirementSettings['depth']>(initial.current.documentDepth ?? 'standard')
  const [documentRange, setDocumentRange] = useState<'all' | 'confirmed' | 'selected'>(initial.current.documentRange ?? 'all')
  const [versionId, setVersionId] = useState(initial.current.versionId ?? '')
  const [traceFilter, setTraceFilter] = useState(initial.current.traceFilter ?? 'all')
  const [confirm, setConfirm] = useState<{ title: string; detail: string; command: RequirementCommand }>()
  const fileInput = useRef<HTMLInputElement>(null)
  const composer = useRef<HTMLTextAreaElement>(null)
  const scrollArea = useRef<HTMLElement>(null)
  const chooserHeading = useRef<HTMLHeadingElement>(null)
  const chatScroll = useRef({chooser:initial.current.scroll?.['chat:chooser']??0,work:initial.current.scroll?.['chat:work']??0}), positions=useRef(initial.current.scroll??{})
  const positionKey=tab==='workspace'?'workspace:'+workspace:tab==='chat'?'chat:'+chatView:tab
  const focusChatView = useRef(false)
  const assistantName = assistant?.name ?? '需求分析助手'
  const running = task?.run?.status === 'running'
  const requirements = task ? activeRequirements(task) : []
  const pendingQuestions = task ? openQuestions(task) : []
  const pendingProposal = task?.proposal?.items.filter(item => !item.accepted && !item.rejected) ?? []
  const selectedIds = selected.filter(key => requirements.some(r => r.id === key))
  const allSelected = documentRange === 'confirmed' ? requirements.filter(r => r.status === 'confirmed').map(r => r.id) : documentRange === 'selected' ? selectedIds : undefined
  const viewedVersion = task?.versions.find(v => v.id === versionId)
  const preview = task ? viewedVersion?.markdown ?? requirementMarkdown(task) : ''
  const hasUnsavedDraft = task ? task.draft !== draft : !!draft.trim()
  const localDraft = useRef<LocalDraft>({})
  localDraft.current = { draft, editor, mode, modeSelected, chatView, creationId: creationId.current, context, answers, tab, workspace, search, statusFilter, flowView, questionFilter, documentDepth, documentRange, versionId, traceFilter, selected, scroll:positions.current }
  function rememberCurrent() { rememberLocal(storageKey.current, localDraft.current) }
  function updateDraft(value: string) {
    draftRef.current = value; setDraft(value)
    localDraft.current = { ...localDraft.current, draft: value }; rememberCurrent()
    if (mounted.current) draftChangeRef.current?.(value)
  }
  const acceptTask = (next: RequirementTask) => {
    if (taskRef.current && next.id === taskRef.current.id && next.revision < taskRef.current.revision) return
    taskRef.current = next
    const key = `workbench-requirement-edit:${next.id}`
    if (storageKey.current !== key) {
      rememberLocal(key, localDraft.current)
      try { sessionStorage.removeItem(storageKey.current) } catch {}
      storageKey.current = key
    }
    if (mounted.current) setTask(next)
    commitRef.current?.(summarizeRequirementTask(next))
  }
  useEffect(() => {
    mounted.current = true
    void getRequirementConfig(roleId).then(value => { if (mounted.current) { setAvailability(value); if (!taskId && initial.current.documentDepth === undefined) setDocumentDepth(value.defaults.depth) } }).catch(e => { if (mounted.current) setError(String(e.message ?? e)) })
    if (loadModels) void loadModels().then(value => { if (mounted.current) setModels(value) }).catch(e => { if (mounted.current) setNotice(`模型列表暂不可用：${e.message ?? e}，仍可使用工作台默认模型。`) })
    if (taskId) void getRequirementTask(taskId).then(value => { if (mounted.current) { acceptTask(value); setMode(value.mode); setModeSelected(true); if(initial.current.documentDepth === undefined)setDocumentDepth(value.settings.depth); if (initial.current.draft === undefined) setDraft(value.draft) } }).catch(e => { if (mounted.current) setError(String(e.message ?? e)) }).finally(() => { if (mounted.current) setLoading(false) })
    return () => { mounted.current = false }
  }, [])
  useEffect(() => { rememberCurrent() }, [draft, editor, mode, modeSelected, chatView, context, answers, task?.id, tab, workspace, search, statusFilter, flowView, questionFilter, documentDepth, documentRange, versionId, traceFilter, selected])
  useLayoutEffect(() => {
    if (scrollArea.current) scrollArea.current.scrollTop = positions.current[positionKey]??0
    if (focusChatView.current) { (chatView === 'chooser' ? chooserHeading.current : composer.current)?.focus({ preventScroll: true }); focusChatView.current = false }
  }, [positionKey, loading])
  useEffect(() => {
    if (!task?.id || !running) return
    const refresh = async () => { if (busyRef.current) return; try { const value = await getRequirementTask(task.id); if (mounted.current) acceptTask(value) } catch (e) { if (mounted.current) setError(`任务状态读取失败：${e instanceof Error ? e.message : e}`) } }
    const timer = window.setInterval(() => void refresh(), 2500)
    return () => clearInterval(timer)
  }, [task?.id, running])
  useEffect(() => { setProposalSelection(task?.proposal?.items.filter(i => !i.accepted && !i.rejected).map(i => i.id) ?? []) }, [task?.proposal?.id])
  useEffect(() => {
    if (loading || (taskId && !task) || !hasUnsavedDraft || busy || running || draftSaveFailed) return
    const timer = window.setTimeout(() => { void persistDraft() }, 1000)
    return () => clearTimeout(timer)
  }, [draft, task?.draft, busy, running, loading, draftSaveFailed])
  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => { if (editorRef.current || (taskRef.current ? taskRef.current.draft !== draftRef.current : draftRef.current.trim())) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', beforeUnload); return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [])

  async function command(value: RequirementCommand, success?: string, quiet = false): Promise<RequirementTask | undefined> {
    if (busyRef.current || !taskRef.current) return
    busyRef.current = true; setBusy(true); if (!quiet) { setError(''); setNotice('') }
    try { const latest = await commandRequirementTask(taskRef.current.id, taskRef.current.revision, value); acceptTask(latest); if (success) setNotice(success); return latest }
    catch (e) { if (e instanceof RequirementsApiError && e.status === 409) { try { acceptTask(await getRequirementTask(taskRef.current.id)) } catch {} setError(`${e.message}。已重新读取保存结果，本地输入仍保留；请核对后重试。`) } else setError(e instanceof Error ? e.message : String(e)); return undefined }
    finally { busyRef.current = false; if (mounted.current) setBusy(false) }
  }
  async function ensureTask(titleHint?: string): Promise<RequirementTask | undefined> {
    if (taskRef.current) return taskRef.current
    if (creationPromise.current) return creationPromise.current
    if (busyRef.current || (taskId && !taskRef.current)) return
    busyRef.current = true; setBusy(true); setError('')
    rememberCurrent()
    const pending = (async () => {
      try {
        const settings = { ...defaultRequirementSettings(), ...availability?.defaults }
        const created = await createRequirementTask({ roleId, roleVersion, mode: modeRef.current, title: (draftRef.current.trim() || titleHint || '新的需求分析').slice(0, 32), settings, requestId: creationId.current, draft: draftRef.current })
        acceptTask(created); if (mounted.current) { setMode(created.mode); setModeSelected(true) }; return created
      } catch (e) { if (mounted.current) { setError(e instanceof Error ? e.message : String(e)); setDraftSaveFailed(!!draftRef.current.trim()) }; return undefined }
      finally { busyRef.current = false; creationPromise.current = undefined; if (mounted.current) setBusy(false) }
    })()
    creationPromise.current = pending
    return pending
  }
  async function persistDraft(retry = false) {
    if (busyRef.current && !creationPromise.current) return
    setDraftSaveFailed(false); if (retry) setError('')
    if (!taskRef.current && !draftRef.current.trim()) return
    const current = await ensureTask(); if (!current) return
    if (current.draft === draftRef.current) return
    const saved = await command({ type: 'save', draft: draftRef.current }, undefined, true)
    if (mounted.current) setDraftSaveFailed(!saved)
  }
  async function begin(selectedMode: 'quick' | 'guided') {
    if (busyRef.current || taskRef.current?.run?.status === 'running') return
    if (taskRef.current && selectedMode !== taskRef.current.mode) {
      if (!await command({ type: 'save', mode: selectedMode })) return
      setNotice(`已切换为${selectedMode === 'quick' ? '简易模式' : '常规模式'}，当前内容已保留。`)
    }
    modeRef.current = selectedMode; setMode(selectedMode); setModeSelected(true); focusChatView.current = true; setChatView('work'); setTab('chat')
    localDraft.current = { ...localDraft.current, mode: selectedMode, modeSelected: true, chatView: 'work' }; rememberCurrent()
    composer.current?.focus()
  }
  function showChooser() { focusChatView.current = true; setChatView('chooser'); setTab('chat'); localDraft.current = { ...localDraft.current, chatView: 'chooser' }; rememberCurrent() }
  function showWork() { focusChatView.current = true; setChatView('work'); setTab('chat'); localDraft.current = { ...localDraft.current, chatView: 'work' }; rememberCurrent() }
  async function run(operation: NonNullable<RequirementTask['run']>['operation'], instruction = draft, scope = context) {
    if (!instruction.trim() || running || busyRef.current) return
    const current = await ensureTask(); if (!current) return
    const saved = await command({ type: 'run', operation, instruction: instruction.trim(), context: scope || undefined, model: current.settings.model || undefined, requestId: id() })
    if (saved) { if (instruction === draftRef.current) updateDraft(''); setModeSelected(true); showWork() }
  }
  async function importFile(file?: File) {
    if (!file) return
    if (!/\.(txt|md|markdown)$/i.test(file.name)) { setError('第一版支持 TXT 和 Markdown 文件，请将其他文档中的文字粘贴到资料页。'); return }
    const max = availability?.maxTextChars ?? 100000
    if (file.size > max * 4) { setError(`文件过大，请拆成不超过 ${max.toLocaleString()} 字符的资料。`); return }
    try { const text = await file.text(); if (text.includes('\0') || text.length > max) throw new Error(`请使用 UTF-8 文本文件，每份不超过 ${max.toLocaleString()} 字符。`); setEditor({ kind: 'material', value: { name: file.name, kind: /\.txt$/i.test(file.name) ? 'txt' : 'markdown', text } }); setTab('workspace'); setWorkspace('materials') } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
  }
  function openEditor(kind: EditorKind, object?: object) {
    setError(''); const value = object ? { ...object } : kind === 'requirement' ? emptyRequirement() : kind === 'flow' ? { name: '', actor: '', action: '', condition: '', result: '', next: '', exception: '', requirementIds: [] } : kind === 'rule' ? { name: '', condition: '', action: '', exception: '', requirementIds: [], sources: [] } : kind === 'question' ? { question: '', reason: '', options: [], answer: '', status: 'open', blocking: false, requirementIds: [], sources: [] } : { name: '', text: '', kind: 'text' }
    setEditor({ kind, value, base: object ? { ...object } : undefined })
  }
  function currentEditorObject(edit: Editor): Record<string, unknown> | undefined {
    const current = taskRef.current; if (!current) return undefined
    if (edit.kind === 'overview') return { title: current.title, ...current.overview }
    if (edit.kind === 'settings') return { ...current.settings }
    const collection = edit.kind === 'requirement' ? current.requirements : edit.kind === 'material' ? current.materials : edit.kind === 'flow' ? current.flows : edit.kind === 'rule' ? current.rules : edit.kind === 'question' ? current.questions : []
    return collection.find(row => row.id === edit.value.id) as unknown as Record<string, unknown> | undefined
  }
  async function saveEditor() {
    if (!editor || busyRef.current) return
    const latest = currentEditorObject(editor)
    if (editor.base && JSON.stringify(editor.base) !== JSON.stringify(latest) && !editor.conflict) { setEditor({ ...editor, conflict: true }); setError('这项内容已有新修订。请对照下方的当前保存内容，再决定保留本地修改或加载新修订。'); return }
    const v = editor.value, str = (key: string) => String(v[key] ?? '')
    let value: RequirementCommand
    if (editor.kind === 'overview') { const overview = Object.fromEntries(Object.keys(emptyRequirementOverview()).map(key => [key, str(key)])) as RequirementOverview; if (!str('title').trim()) { setError('请填写分析名称。'); return } value = { type: 'save', title: str('title'), overview } }
    else if (editor.kind === 'settings') value = { type: 'save', settings: v as unknown as RequirementSettings }
    else if (editor.kind === 'requirement') { if (!str('title').trim()) { setError('请填写需求名称。'); return } value = { type: 'requirement.save', requirement: v as Partial<Requirement> & { title: string } } }
    else if (editor.kind === 'material') { if (!str('name').trim() || !str('text').trim()) { setError('请填写资料名称和内容。'); return } if (str('text').length > (availability?.maxTextChars ?? 100000)) { setError('资料超过允许的字符数，请拆分后保存。'); return } value = { type: 'material.save', material: v as Partial<RequirementMaterial> & Pick<RequirementMaterial, 'name' | 'kind' | 'text'> } }
    else if (editor.kind === 'flow') { if (!str('name').trim()) { setError('请填写步骤名称。'); return } value = { type: 'flow.save', flow: v as Partial<RequirementFlow> & { name: string } } }
    else if (editor.kind === 'rule') { if (!str('name').trim()) { setError('请填写规则名称。'); return } value = { type: 'rule.save', rule: v as Partial<RequirementRule> & { name: string } } }
    else if (editor.kind === 'question') { if (!str('question').trim()) { setError('请填写需要确认的问题。'); return } value = { type: 'question.save', question: v as Partial<RequirementQuestion> & { question: string } } }
    else if (editor.kind === 'split') { const titles = str('titles').split('\n').map(t => t.trim()).filter(Boolean); if (titles.length < 2) { setError('请至少填写两个新需求名称，每行一个。'); return } value = { type: 'requirement.split', id: str('id'), titles } }
    else if (editor.kind === 'merge') { if (!str('title').trim()) { setError('请填写合并后的名称。'); return } value = { type: 'requirement.merge', ids: v.ids as string[], title: str('title') } }
    else value = { type: 'version.create', selectedIds: v.ids as string[], note: str('note') }
    if (!await ensureTask(editor.kind === 'material' ? str('name') : editor.kind === 'requirement' ? str('title') : undefined)) return
    const result = await command(value, editor.kind === 'version' ? '确认版本已保存，可在需求文档中查看和导出。' : '修改已保存。')
    if (result) { setEditor(undefined); if (editor.kind === 'settings') setDocumentDepth(result.settings.depth); if (editor.kind === 'version') { setTab('workspace'); setWorkspace('document'); setVersionId(result.versions.at(-1)?.id ?? '') } }
  }
  function discuss(objectId: string) { setContext(objectId); showWork(); composer.current?.focus() }
  function goto(next: WorkspaceTab) { setTab('workspace'); setWorkspace(next) }
  function sourceLinks(sources: SourceRef[]) { return sources.length ? <div className={s.sources}>{sources.map((ref, i) => <button type="button" key={i} onClick={() => setSource(ref)} title={ref.quote}>↗ 依据 {i + 1}</button>)}</div> : <span className={s.muted}>尚未引用原文</span> }
  function contextLabel(objectId: string): string {
    const r = task?.requirements.find(row => row.id === objectId); if (r) return `${r.number} ${r.title}`
    const q = task?.questions.find(row => row.id === objectId); if (q) return `${q.number} ${q.question}`
    const other = [...task?.flows ?? [], ...task?.rules ?? []].find(row => row.id === objectId)
    return other?.name ?? '已移除的讨论对象'
  }
  function displayValue(key: string, value: unknown): string {
    if (key === 'sources' && Array.isArray(value)) return (value as SourceRef[]).map(ref => `「${ref.quote}」`).join('\n')
    if (key === 'requirementIds' && Array.isArray(value)) return value.map(id => requirements.find(r => r.id === id)?.number ?? id).join('、') || '本次分析'
    if (key === 'priority') return priorityNames[value as Requirement['priority']] ?? String(value)
    if (key === 'status') return ({ ...requirementStatusNames, ...questionStatusNames })[value as Requirement['status']] ?? String(value)
    if (key === 'origin') return originNames[value as Requirement['origin']] ?? String(value)
    if (typeof value === 'boolean') return value ? '是' : '否'
    return Array.isArray(value) ? value.join('\n') : String(value ?? '')
  }
  function objectDetails(object: Record<string, unknown>, before?: Record<string, unknown>) { return <dl className={s.details}>{Object.entries(object).filter(([key, value]) => fieldNames[key] && value !== undefined && (before || value !== '' && (!Array.isArray(value) || value.length)) && (!before || JSON.stringify(before[key]) !== JSON.stringify(value))).map(([key, value]) => <React.Fragment key={key}><dt>{fieldNames[key]}</dt><dd>{before && <div className={s.before}>原：{displayValue(key, before[key]) || '未填写'}</div>}<div>{before ? '建议：' : ''}{displayValue(key, value) || '清空此字段'}</div></dd></React.Fragment>)}</dl> }
  function proposalBefore(item: ProposalItem): Record<string, unknown> | undefined { if (!task) return; return (item.kind === 'overview' ? task.overview : item.kind === 'requirement' ? task.requirements.find(r => r.id === item.targetId) : item.kind === 'flow' ? task.flows.find(r => r.id === item.targetId) : item.kind === 'rule' ? task.rules.find(r => r.id === item.targetId) : task.questions.find(r => r.id === item.targetId)) as unknown as Record<string, unknown> | undefined }
  async function exportDocument(format: 'markdown' | 'clipboard' | 'print') {
    if (!task || !preview) return
    setError('')
    try {
      if (format === 'clipboard') await navigator.clipboard.writeText(preview)
      if (format === 'markdown') { const blob = new Blob([preview], { type: 'text/markdown;charset=utf-8' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${task.title.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')}${viewedVersion ? `-V${viewedVersion.number}` : '-讨论稿'}.md`; a.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000) }
      if (format === 'print') { const win = window.open('', '_blank'); if (!win) throw new Error('打印窗口被拦截，请允许此站点打开打印窗口后重试。'); const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!); win.document.write(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${escape(task.title)}</title><style>body{font:14px/1.8 system-ui,sans-serif;color:#182439;max-width:800px;margin:32px auto}pre{font:inherit;white-space:pre-wrap;overflow-wrap:anywhere}@page{size:A4;margin:18mm}</style></head><body><pre>${escape(preview)}</pre></body></html>`); win.document.close(); win.focus(); win.print() }
      await command({ type: 'export', format, versionId: viewedVersion?.id }, format === 'clipboard' ? '已复制当前文档。' : format === 'markdown' ? '已导出当前 Markdown 文档。' : '已打开系统打印窗口，可选择保存为 PDF。')
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
  }

  const modelOptions: [string, string][] = [['', '工作台默认模型'], ...models.map(m => [m.id, m.name] as [string, string])]
  if (task?.settings.model && !modelOptions.some(([value]) => value === task.settings.model)) modelOptions.push([task.settings.model, `${task.settings.model}（已保存）`])
  const formField = (key: string, label = fieldNames[key] ?? key, multiline = true, required = false) => <Field key={key} label={label} value={String(editor?.value[key] ?? '')} multiline={multiline} required={required} onChange={value => setEditor(current => current && { ...current, value: { ...current.value, [key]: value } })}/>
  const formSelect = (key: string, label: string, options: readonly (readonly [string, string])[]) => <SelectField label={label} value={String(editor?.value[key] ?? '')} options={options} onChange={value => setEditor(current => current && { ...current, value: { ...current.value, [key]: value } })}/>
  const relationField = () => <fieldset className={s.relations}><legend>关联需求</legend>{requirements.length ? requirements.map(r => <label key={r.id}><PillCheckbox type="checkbox" checked={(editor?.value.requirementIds as string[] ?? []).includes(r.id)} onChange={e => setEditor(current => current && { ...current, value: { ...current.value, requirementIds: e.target.checked ? [...(current.value.requirementIds as string[] ?? []), r.id] : (current.value.requirementIds as string[] ?? []).filter(key => key !== r.id) } })}/>{r.number} {r.title}</label>) : <small>先添加需求，再关联具体条目。未选中时适用于整个分析。</small>}</fieldset>
  const renderEditor = () => {
    if (!editor) return null
    return <Modal title={editorNames[editor.kind]} onClose={() => { setEditor(undefined); setError('') }} footer={<><span className={s.muted}>保存后更新本次分析</span><button onClick={() => setEditor(undefined)}>取消</button><button className={s.primary} disabled={busy} onClick={() => void saveEditor()}>{busy ? '正在保存…' : editor.conflict ? '采用本地修改并保存' : editor.kind === 'version' ? '保存确认版本' : '保存修改'}</button></>}>
      {error && <div role="alert" className={s.error}>{error}</div>}
      {editor.conflict && <section className={s.conflict}><h3>当前保存内容</h3>{objectDetails(currentEditorObject(editor) ?? {})}<button onClick={() => { const current = currentEditorObject(editor); if (current) { setEditor({ kind: editor.kind, value: { ...current }, base: { ...current } }); setError('') } }}>加载当前保存内容</button></section>}
      {editor.kind === 'overview' && <>{formField('title', '分析名称', false, true)}{['background', 'goal', 'scope', 'excluded', 'roles'].map(key => formField(key))}</>}
      {editor.kind === 'settings' && <><div className={s.twoColumns}>{formSelect('purpose', '输出用途', [['discussion', '业务讨论'], ['review', '需求评审'], ['handoff', '开发交接']])}{formSelect('depth', '整理深度', [['brief', '简要清单'], ['standard', '标准需求说明'], ['detailed', '详细规格']])}{formSelect('questionStyle', '提问节奏', [['short', '少量关键问题'], ['detailed', '逐项详细核对']])}{formSelect('model', '分析模型', modelOptions)}</div>{formField('focus', '关注重点')}{formField('language', '输出语言', false)}<p className={s.muted}>设置用于后续分析，已有需求和确认版本保持可追溯。</p></>}
      {editor.kind === 'material' && <>{formField('name', '资料名称', false, true)}{formField('text', '资料原文', true, true)}<p className={s.muted}>{String(editor.value.text ?? '').length.toLocaleString()} / {(availability?.maxTextChars ?? 100000).toLocaleString()} 字符。保存新修订时保留旧引用所用的原文。</p>{Array.isArray(editor.value.history) && editor.value.history.length > 0 && <details><summary>历史原文（{editor.value.history.length}）</summary>{(editor.value.history as RequirementMaterial['history']).map(h => <details key={h.revision}><summary>修订 {h.revision} · {h.name}</summary><pre className={s.rawText}>{h.text}</pre></details>)}</details>}</>}
      {editor.kind === 'requirement' && <><div className={s.contextNote}>{String(editor.value.number ?? '新需求')} · {requirementStatusNames[editor.value.status as Requirement['status']] ?? '待确认'}{editor.value.status === 'confirmed' && ' · 修改业务内容后需要重新确认'}</div>{formField('title', '需求名称', false, true)}{formField('description')}<div className={s.twoColumns}>{formField('module', '所属模块', false)}{formField('actor', '使用角色', false)}{formSelect('priority', '优先级', Object.entries(priorityNames))}{formSelect('kind', '需求类型', [['functional', '功能需求'], ['nonfunctional', '非功能需求'], ['constraint', '约束']])}</div>{formField('acceptance', '验收标准（什么情况、什么操作、什么结果）', true)}<details open><summary>业务过程与规则</summary>{['trigger', 'preconditions', 'steps', 'rules', 'exceptions', 'inputs', 'outputs'].map(key => formField(key))}</details><h3>原始依据</h3>{sourceLinks(editor.value.sources as SourceRef[] ?? [])}{!!editor.value.id && <><h3>相关操作记录</h3><ul className={s.compactList}>{task?.events.filter(e => e.objectId === editor.value.id).slice(-8).reverse().map(e => <li key={e.id}>{time(e.at)} · {e.text}</li>)}</ul><button onClick={() => { discuss(String(editor.value.id)); setEditor(undefined) }}>围绕此项讨论 →</button></>}</>}
      {editor.kind === 'flow' && <>{formField('name', '步骤名称', false, true)}{['actor', 'action', 'condition', 'result', 'next', 'exception'].map(key => formField(key, fieldNames[key], key !== 'actor'))}{relationField()}</>}
      {editor.kind === 'rule' && <>{formField('name', '规则名称', false, true)}{['condition', 'action', 'exception'].map(key => formField(key))}{relationField()}{sourceLinks(editor.value.sources as SourceRef[] ?? [])}</>}
      {editor.kind === 'question' && <>{formField('question', '需要确认的问题', true, true)}{formField('reason')}<Field label="可选答案（每行一个）" multiline value={(editor.value.options as string[] ?? []).join('\n')} onChange={value => setEditor({ ...editor, value: { ...editor.value, options: value.split('\n') } })}/><label className={s.check}><PillCheckbox type="checkbox" checked={!!editor.value.blocking} onChange={e => setEditor({ ...editor, value: { ...editor.value, blocking: e.target.checked } })}/>未处理前，相关需求不能确认</label>{relationField()}{sourceLinks(editor.value.sources as SourceRef[] ?? [])}</>}
      {editor.kind === 'split' && <><p>原需求将保留追溯关系，新条目需要分别完善内容和验收标准。</p>{formField('titles', '新需求名称（每行一个，至少两条）', true, true)}</>}
      {editor.kind === 'merge' && <><p>将合并所选 {(editor.value.ids as string[]).length} 条需求，原条目保留在已移除记录中。</p>{formField('title', '合并后的需求名称', false, true)}</>}
      {editor.kind === 'version' && <><p>固定所选需求的当前内容，作为可导出的确认版本。</p><ul className={s.compactList}>{requirements.filter(r => (editor.value.ids as string[]).includes(r.id)).map(r => <li key={r.id}>{r.number} {r.title} · {requirementStatusNames[r.status]}</li>)}</ul>{formField('note', '版本说明（例如：报销基础功能 V1）')}<p className={s.muted}>保存时检查所选需求的确认状态、验收标准及关联的阻断问题。</p></>}
    </Modal>
  }

  async function notebookCommand(value:RequirementCommand) { if(!await ensureTask())return;return command(value,undefined,true) }
  const setupView=<RequirementsNotebook task={task} mode={mode} busy={busy||!!running} view="setup" onCommand={notebookCommand} onGuide={instruction=>void run('clarify',instruction)}/>
  const chooserView = <div className={`${s.chat} ${s.chooser}`}>
    <div className={s.intro}><RoleAppearanceIcon color={assistant?.color ?? '#9b77bc'} icon={assistant?.icon ?? { kind: 'builtin', id: 'analyst' }}/><div><small>{assistantName}</small><h2 ref={chooserHeading} tabIndex={-1}>{task ? '选择接下来如何分析' : '选择分析方式'}</h2><p>{task ? '继续处理当前需求，已有资料和结果已保留。' : '提供业务描述、会议纪要或需求初稿，一起梳理流程、功能和需要确认的问题。'}</p></div></div>
    {task && <section className={s.chooserSummary}><div><strong>{task.title}</strong><p>{task.materials.filter(m => !m.removed).length} 份资料 · {requirements.length} 条需求 · {pendingQuestions.length} 个待确认问题</p></div><button onClick={showWork}>返回对话</button></section>}
    {!task && modeSelected && <div className={s.chooserReturn}><span className={s.muted}>当前方式：{mode === 'quick' ? '简易模式' : '常规模式'}</span><button onClick={showWork}>返回对话</button></div>}
    {running && <section className={s.progress} role="status"><span className={s.spinner}/><div><strong>正在{operationNames[task!.run!.operation]}…</strong><p>本轮结束后可切换分析方式，也可以先停止本轮分析。</p></div><button disabled={busy} onClick={() => void command({ type: 'run.stop' }, '本轮分析已停止，原资料和已保存结果保留。')}>停止</button></section>}
    <div className={s.modes}><button aria-label="选择简易模式" aria-pressed={modeSelected && mode === 'quick'} disabled={busy || loading || running} onClick={() => void begin('quick')}><span>▤</span><b>简易模式 {modeSelected && mode === 'quick' && <small>当前使用</small>}</b><p>输入问题和参考资料，AI 自动分析、整理并维护结果。</p><em>选择简易模式 →</em></button><button aria-label="选择常规模式" aria-pressed={modeSelected && mode === 'guided'} disabled={busy || loading || running} onClick={() => void begin('guided')}><span>☷</span><b>常规模式 {modeSelected && mode === 'guided' && <small>当前使用</small>}</b><p>按照选中的栏目逐步讨论，随时编辑内容、调整范围和输出。</p><em>选择常规模式 →</em></button></div>
    {setupView}{!task && <div className={s.workflow}><span>提供想法</span><i>→</i><span>自动整理</span><i>→</i><span>持续完善</span><i>→</i><span>形成文档</span></div>}
  </div>
  const workView = <div className={s.chat}>{setupView}
    <div className={s.intro}><RoleAppearanceIcon color={assistant?.color ?? '#9b77bc'} icon={assistant?.icon ?? { kind: 'builtin', id: 'analyst' }}/><div><small>{assistantName}</small><h2>{task?.messages.length ? '把想法逐步整理成可确认的需求' : '从一个想法，开始讲清需求。'}</h2><p>提供业务描述、会议纪要或需求初稿，一起梳理流程、功能和需要确认的问题。</p></div></div>
    {!task && <><div className={s.toolbar}><span className={s.tag}>当前方式：{mode === 'quick' ? '简易模式' : '常规模式'}</span></div><section className={s.card}><h3>{mode === 'quick' ? '准备好资料后，开始整理' : '先告诉我想解决什么问题'}</h3><p className={s.muted}>{mode === 'quick' ? '粘贴业务描述、会议纪要，或导入文本文件。保存资料后可主动开始整理。' : '描述当前做法、需要解决的问题和业务目标。你也可以先补充资料或手工记录一条需求。'}</p><div className={s.toolbar}><button onClick={() => openEditor('material')}>＋ 粘贴资料</button><button onClick={() => fileInput.current?.click()}>添加 TXT / Markdown</button><button onClick={() => openEditor('requirement')}>＋ 新增需求</button></div></section></>}
    {task && <><div className={s.toolbar}><span className={s.tag}>当前方式：{task.mode === 'quick' ? '简易模式' : '常规模式'}</span><span className={s.muted}>{task.materials.filter(m => !m.removed).length} 份资料 · {requirements.length} 条需求</span><button onClick={() => goto('requirements')}>打开需求清单 →</button></div>
      {!task.messages.length && <section className={s.card}><h3>{task.mode === 'quick' ? '准备好资料后，开始整理' : '先告诉我想解决什么问题'}</h3><p className={s.muted}>{task.mode === 'quick' ? '添加原文或文本文件，再点击“整理需求清单”。结果会自动整理并保存，随时可以编辑。' : '例如：目前部门报销依靠表格传递，我希望员工能在线提交并查询审批进度。'}</p><div className={s.toolbar}><button onClick={() => openEditor('material')}>＋ 粘贴资料</button><button onClick={() => fileInput.current?.click()}>添加 TXT / Markdown</button>{task.materials.some(m => !m.removed) && <button className={s.primary} disabled={busy || running} onClick={() => void run('analyze', '请根据已有资料整理需求清单、业务流程、规则和待确认问题，并引用真实原文。')}>开始整理 →</button>}</div></section>}
      {task.messages.map(message => <article key={message.id} className={message.role === 'user' ? s.userMessage : s.assistantMessage}><small>{message.role === 'user' ? '你' : assistantName}{message.context && ` · ${contextLabel(message.context)}`}</small><p>{message.text}</p><MessageTime value={message.createdAt}/></article>)}
      {running && <section className={s.progress} role="status"><span className={s.spinner}/><div><strong>正在{operationNames[task.run!.operation]}…</strong><p>可以切换会话；完成后自动更新需求结果。</p></div><button disabled={busy} onClick={() => void command({ type: 'run.stop' }, '本轮分析已停止，原资料和已保存结果保留。')}>停止</button></section>}
      {task.run && ['error', 'interrupted', 'stopped'].includes(task.run.status) && <section className={s.runError}><strong>{task.run.status === 'error' ? '本轮分析失败' : task.run.status === 'interrupted' ? '上次分析被中断' : '本轮分析已停止'}</strong><p>{task.run.error || '可以调整输入后重试。'}</p><button disabled={busy} onClick={() => void run(task.run!.operation, task.run!.instruction)}>重试本轮分析</button></section>}
      {task.proposal && <details className={s.card}><summary>{task.proposal.items.some(i=>!i.accepted&&!i.rejected)?'历史分析建议 · 可继续分析更新':'已自动整理本轮需求 · 查看更新'}</summary><p>{task.proposal.summary}</p><button onClick={()=>goto('document')}>查看完整结果</button>{task.revisions?.at(-1)&&<button disabled={busy||running} onClick={()=>void command({type:'revision.restore',id:task.revisions!.at(-1)!.id})}>恢复最近一次修改前</button>}</details>}
      {pendingQuestions.length>0&&<details className={s.card}><summary>待确认内容 · {pendingQuestions.length} 项（可稍后处理）</summary><button onClick={()=>goto('questions')}>查看待确认内容</button></details>}
    </>}
  </div>

  const overviewView = task && <><div className={s.sectionHead}><div><small>分析概览</small><h2>{task.title}</h2></div><button onClick={() => openEditor('overview', { title: task.title, ...task.overview })}>编辑基本信息</button></div><div className={s.stats}><button onClick={() => goto('requirements')}><strong>{requirements.length}</strong><span>需求条目</span></button><button onClick={() => { setStatusFilter('confirmed'); goto('requirements') }}><strong>{requirements.filter(r => r.status === 'confirmed').length}<small> / {requirements.length}</small></strong><span>已确认</span></button><button onClick={() => goto('questions')}><strong>{pendingQuestions.length}</strong><span>待确认问题</span></button><button onClick={() => goto('document')}><strong>{task.versions.length}</strong><span>确认版本</span></button></div><div className={s.twoColumns}>{Object.entries(task.overview).map(([key, value]) => <section key={key} className={s.card}><h3>{fieldNames[key]}</h3><p className={value ? '' : s.muted}>{value || '尚未整理，可手工补充或通过对话澄清。'}</p></section>)}</div><section className={s.card}><div className={s.sectionHead}><h3>最近修改</h3><button onClick={() => setTab('trace')}>查看轨迹 →</button></div>{task.events.length ? <ul className={s.compactList}>{task.events.slice(-5).reverse().map(event => <li key={event.id}><time>{time(event.at)}</time> {event.text}</li>)}</ul> : <p className={s.muted}>添加资料或需求后，这里显示实际操作记录。</p>}</section></>
  const materialsView = task && <><div className={s.sectionHead}><div><h2>资料</h2><p>为每条需求保留可追溯的原文依据。</p></div><div className={s.toolbar}><button onClick={() => fileInput.current?.click()}>添加文本文件</button><button className={s.primary} onClick={() => openEditor('material')}>＋ 粘贴资料</button></div></div>{!task.materials.length ? <Empty title="还没有添加资料">粘贴业务描述、会议纪要，或导入 TXT、Markdown 文件。</Empty> : task.materials.map(material => <section key={material.id} className={`${s.card} ${material.removed ? s.dimmed : ''}`}><div className={s.sectionHead}><div><h3>{material.name}</h3><small>{material.kind === 'text' ? '粘贴文本' : material.kind.toUpperCase()} · 修订 {material.revision} · {material.text.length.toLocaleString()} 字符 · {requirements.reduce((n, r) => n + r.sources.filter(ref => ref.materialId === material.id).length, 0)} 处需求引用{material.removed && ' · 已移除'}</small></div><div className={s.toolbar}><button onClick={() => openEditor('material', material)}>查看 / 编辑</button><button disabled={busy || running || material.removed} onClick={() => { setContext(''); void run('analyze', `请重新整理资料「${material.name}」（${material.id}）的需求和问题，核对当前已有条目，提出有原文依据的新增或修改建议。`, '') }}>重新整理</button><button disabled={busy} onClick={() => material.removed ? void command({ type: 'material.remove', id: material.id, removed: false }, '资料已恢复。') : setConfirm({ title: '从本次分析移除资料', detail: '移除后不再用于后续分析。已有需求的引用和原文修订保留，可在这里恢复。', command: { type: 'material.remove', id: material.id, removed: true } })}>{material.removed ? '恢复资料' : '移除'}</button></div></div><p className={s.excerpt}>{material.text.slice(0, 260)}{material.text.length > 260 && '…'}</p></section>)}</>
  const filteredRequirements = (task?.requirements ?? []).filter(r => statusFilter === 'removed' ? r.removed : !r.removed && (statusFilter === 'all' || r.status === statusFilter)).filter(r => `${r.number} ${r.title} ${r.module} ${r.description}`.toLowerCase().includes(search.toLowerCase()))
  const requirementsView = task && <><div className={s.sectionHead}><div><h2>需求清单</h2><p>逐项完善规则和验收标准，再确认业务内容。</p></div><button className={s.primary} onClick={() => openEditor('requirement')}>＋ 新增需求</button></div><div className={s.filters}><input aria-label="搜索需求" placeholder="搜索编号、名称、模块…" value={search} onChange={e => setSearch(e.target.value)}/><select aria-label="需求状态筛选" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="all">全部有效需求</option>{Object.entries(requirementStatusNames).map(([key, name]) => <option key={key} value={key}>{name}</option>)}<option value="removed">已移除</option></select></div>{selectedIds.length > 0 && <div className={s.selectionBar}><span>已选 {selectedIds.length} 条</span><button disabled={busy} onClick={() => void command({ type: 'requirement.status', ids: selectedIds, status: 'confirmed' }, '所选需求已确认。')}>确认</button><button disabled={busy} onClick={() => void command({ type: 'requirement.status', ids: selectedIds, status: 'deferred' }, '所选需求已暂缓。')}>暂缓</button><button disabled={selectedIds.length < 2} onClick={() => setEditor({ kind: 'merge', value: { ids: selectedIds, title: '' } })}>合并</button><button onClick={() => setEditor({ kind: 'version', value: { ids: selectedIds, note: '' } })}>保存确认版本</button><button onClick={() => { setDocumentRange('selected'); goto('document') }}>生成所选文档</button><button aria-label="清除需求选择" onClick={() => setSelected([])}>×</button></div>}{filteredRequirements.length ? <div className={s.tableWrap}><table className={s.table}><thead><tr><th><PillCheckbox type="checkbox" aria-label="选择当前列表全部需求" checked={filteredRequirements.filter(r => !r.removed).length > 0 && filteredRequirements.filter(r => !r.removed).every(r => selectedIds.includes(r.id))} onChange={e => setSelected(e.target.checked ? [...new Set([...selected, ...filteredRequirements.filter(r => !r.removed).map(r => r.id)])] : selected.filter(key => !filteredRequirements.some(r => r.id === key)))}/></th><th>需求</th><th>模块 / 优先级</th><th>状态 / 依据</th><th>操作</th></tr></thead><tbody>{filteredRequirements.map(r => <tr key={r.id}><td><PillCheckbox type="checkbox" disabled={!!r.removed} aria-label={`选择 ${r.number}`} checked={selectedIds.includes(r.id)} onChange={e => setSelected(current => e.target.checked ? [...current, r.id] : current.filter(key => key !== r.id))}/></td><td><button className={s.rowTitle} onClick={() => openEditor('requirement', r)}><small>{r.number}</small><strong>{r.title}</strong></button><p className={s.excerpt}>{r.description || '待补充说明'}</p></td><td>{r.module || '未分组'}<small className={s.block}>{priorityNames[r.priority]}</small></td><td><span className={s.status} data-status={r.status}>{r.removed ? '已移除' : requirementStatusNames[r.status]}</span><small className={s.block}>{originNames[r.origin]}</small>{sourceLinks(r.sources)}</td><td><div className={s.rowActions}>{r.removed ? <button disabled={busy} onClick={() => void command({ type: 'requirement.remove', ids: [r.id], removed: false }, '需求已恢复，请重新核对。')}>恢复</button> : <><button onClick={() => discuss(r.id)}>讨论</button><button disabled={busy || r.status === 'confirmed'} onClick={() => void command({ type: 'requirement.status', ids: [r.id], status: 'confirmed' }, `${r.number} 已确认。`)}>确认</button><details><summary aria-label={`${r.number} 更多操作`}>更多</summary><div><button onClick={() => setEditor({ kind: 'split', value: { id: r.id, titles: '' } })}>拆分需求</button><button disabled={busy} onClick={() => void command({ type: 'requirement.status', ids: [r.id], status: r.status === 'deferred' ? 'pending' : 'deferred' })}>{r.status === 'deferred' ? '继续讨论' : '暂缓'}</button><button onClick={() => setConfirm({ title: '移除需求', detail: `${r.number} ${r.title} 将从工作草稿中移除。历史确认版本保留，可在“已移除”筛选中恢复。`, command: { type: 'requirement.remove', ids: [r.id], removed: true } })}>移除需求</button></div></details></>}</div></td></tr>)}</tbody></table></div> : <Empty title={search || statusFilter !== 'all' ? '没有匹配的需求' : '从第一条需求开始'}>通过对话整理后采用建议，或点击“新增需求”手工填写。</Empty>}</>
  const flowsView = task && <><div className={s.sectionHead}><div><h2>流程与规则</h2><p>明确执行人、条件、正常步骤与异常分支。</p></div><div className={s.toolbar}><button disabled={busy || running} onClick={() => void run('check', '请检查业务流程的执行人、下一步、退回、撤销、重复提交及规则冲突，把缺失内容列为待确认问题。')}>检查流程缺项</button><button className={s.primary} onClick={() => openEditor(flowView === 'flows' ? 'flow' : 'rule')}>＋ {flowView === 'flows' ? '添加步骤' : '添加规则'}</button></div></div><TabBar label="流程与规则视图" value={flowView} items={[["flows", "业务流程"], ["rules", "业务规则"]]} onChange={setFlowView}/>{flowView === 'flows' ? task.flows.length ? task.flows.map((flow, index) => <section key={flow.id} className={s.flowCard}><span className={s.stepNumber}>{index + 1}</span><div><div className={s.sectionHead}><h3>{flow.name}</h3><div className={s.toolbar}><button aria-label={`上移 ${flow.name}`} disabled={busy || index === 0} onClick={() => void command({ type: 'flow.move', id: flow.id, direction: -1 })}>↑</button><button aria-label={`下移 ${flow.name}`} disabled={busy || index === task.flows.length - 1} onClick={() => void command({ type: 'flow.move', id: flow.id, direction: 1 })}>↓</button><button onClick={() => openEditor('flow', flow)}>编辑</button><button onClick={() => discuss(flow.id)}>讨论</button><button aria-label={`移除步骤 ${flow.name}`} onClick={() => setConfirm({ title: '移除流程步骤', detail: `将从工作草稿中移除「${flow.name}」，请随后核对前后步骤和异常分支。`, command: { type: 'flow.remove', id: flow.id } })}>移除</button></div></div><p><b>{flow.actor || '执行人待确认'}</b> · {flow.action || '动作待确认'}</p><div className={s.flowDetails}><span>进入条件：{flow.condition || '待确认'}</span><span>预期结果：{flow.result || '待确认'}</span><span>下一步：{flow.next || '待确认'}</span><span>异常：{flow.exception || '待确认'}</span></div>{flow.requirementIds.length > 0 && <small>关联：{displayValue('requirementIds', flow.requirementIds)}</small>}</div></section>) : <Empty title="还没有业务流程">添加步骤，或通过对话梳理业务从开始到结束的过程。</Empty> : task.rules.length ? task.rules.map(rule => <section className={s.card} key={rule.id}><div className={s.sectionHead}><h3>{rule.name}</h3><div className={s.toolbar}><button onClick={() => openEditor('rule', rule)}>编辑</button><button onClick={() => discuss(rule.id)}>讨论</button><button onClick={() => setConfirm({ title: '移除业务规则', detail: `将从工作草稿中移除「${rule.name}」，历史确认版本保留。`, command: { type: 'rule.remove', id: rule.id } })}>移除</button></div></div>{objectDetails(rule as unknown as Record<string, unknown>)}{sourceLinks(rule.sources)}</section>) : <Empty title="还没有业务规则">补充权限、金额条件、数据校验或例外情况，并关联具体需求。</Empty>}</>
  const questionsView = task && <><div className={s.sectionHead}><div><h2>待确认</h2><p>集中处理缺失信息、冲突与业务选择。</p></div><button className={s.primary} onClick={() => openEditor('question')}>＋ 添加问题</button></div><div className={s.filters}><select aria-label="问题状态筛选" value={questionFilter} onChange={e => setQuestionFilter(e.target.value)}><option value="active">未处理的问题</option><option value="all">全部问题</option>{Object.entries(questionStatusNames).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></div>{task.questions.filter(q => questionFilter === 'all' || (questionFilter === 'active' ? !['resolved', 'dismissed'].includes(q.status) : q.status === questionFilter)).map(q => <section className={s.card} key={q.id}><div className={s.sectionHead}><h3>{q.number} · {q.question}</h3><span className={s.status} data-status={q.status}>{questionStatusNames[q.status]}</span></div><p>{q.reason || '请结合实际业务确认。'}</p><div className={s.toolbar}>{q.blocking && <span className={s.warningTag}>影响需求确认</span>}<small>影响范围：{displayValue('requirementIds', q.requirementIds)}</small>{sourceLinks(q.sources)}</div><div className={s.choices}>{q.options.filter(Boolean).map((option, index) => <button key={index} onClick={() => setAnswers(current => ({ ...current, [q.id]: option }))}>{option}</button>)}</div><Field label={`回答 ${q.number}`} multiline value={answers[q.id] ?? q.answer} placeholder="填写已确认的业务决定，也可以说明需要向谁核实" onChange={value => setAnswers(current => ({ ...current, [q.id]: value }))}/><div className={s.toolbar}><button className={s.primary} disabled={busy || !(answers[q.id] ?? q.answer).trim()} onClick={async () => { const result = await command({ type: 'question.answer', id: q.id, answer: answers[q.id] ?? q.answer }, '回答已保存。可生成修改建议，采用或手工修改需求后再标记解决。'); if (result) setAnswers(current => { const copy = { ...current }; delete copy[q.id]; return copy }) }}>保存回答</button><button disabled={busy || running || !q.answer} onClick={() => { setContext(q.id); void run('revise', `根据 ${q.number}「${q.question}」已保存的回答「${q.answer}」，提出相关需求和流程的修改建议。`, q.id) }}>根据回答更新建议</button><button disabled={busy || !['answered', 'deferred'].includes(q.status)} onClick={() => setConfirm({ title: '将问题标记为已解决', detail: '请确认回答已落实到相关需求、规则或流程中。此操作会解除该问题对需求确认的阻断。', command: { type: 'question.status', id: q.id, status: 'resolved' } })}>标记已解决</button><button disabled={busy} onClick={() => void command({ type: 'question.status', id: q.id, status: ['resolved', 'dismissed', 'deferred'].includes(q.status) ? 'open' : 'deferred' })}>{['resolved', 'dismissed', 'deferred'].includes(q.status) ? '重新打开' : '暂缓'}</button><button disabled={busy || q.status === 'dismissed'} onClick={() => setConfirm({ title: '标记问题不适用', detail: '仅当本次需求范围无需处理此问题时使用。标记后可重新打开。', command: { type: 'question.status', id: q.id, status: 'dismissed' } })}>不适用</button><button onClick={() => openEditor('question', q)}>编辑问题</button></div></section>)}{!task.questions.some(q => questionFilter === 'all' || (questionFilter === 'active' ? !['resolved', 'dismissed'].includes(q.status) : q.status === questionFilter)) && <Empty title="当前没有匹配的问题">可以通过对话检查遗漏，也可以手工添加需要业务人员确认的问题。</Empty>}</>
  const documentsView = task && <><RequirementsNotebook task={task} mode={mode} busy={busy||!!running} view="result" onCommand={notebookCommand} onGuide={instruction=>void run('clarify',instruction)}/><div className={s.toolbar}>{viewedVersion&&<span>导出内容：确认版本 V{viewedVersion.number}</span>}<button disabled={busy} onClick={()=>void exportDocument('clipboard')}>复制</button><button disabled={busy} onClick={()=>void exportDocument('markdown')}>导出 Markdown</button><button disabled={busy} onClick={()=>void exportDocument('print')}>打印 / 保存 PDF</button></div><details className={s.card}><summary>修改历史 · {task.revisions?.length??0} 次</summary>{[...(task.revisions??[])].reverse().map(r=><div className={s.versionRow} key={r.id}><div><strong>{r.summary}</strong><MessageTime value={r.at}/></div><button disabled={busy||running} onClick={()=>void command({type:'revision.restore',id:r.id})}>恢复到此修改前</button></div>)}</details>{task.versions.length>0&&<details className={s.card}><summary>原有确认版本 · {task.versions.length} 份</summary><SelectField label="查看版本" value={versionId} onChange={setVersionId} options={[["","当前需求"],...task.versions.map(v=>[v.id,'V'+v.number+' '+v.note] as const)]}/>{viewedVersion&&<DocumentPreview text={viewedVersion.markdown}/>}</details>}</>

  return <div className={s.root} data-requirements-assistant="true">
    <header className={s.heading}><div><strong>{task?.title ?? assistantName}</strong><span className={s.saveState}>{loading ? '正在读取…' : busy ? '正在保存…' : draftSaveFailed ? '草稿保存失败 · 本地输入已保留' : hasUnsavedDraft ? '输入草稿待保存' : task ? `已保存 · ${time(task.updatedAt)}` : chatView === 'chooser' ? '选择分析方式，也可以直接描述你的想法' : '当前会话 · 尚未保存业务内容'}</span></div><div className={s.toolbar}>{task && <>{requirements.length > 0 && <span className={s.countBadge}>{requirements.filter(r => r.status === 'confirmed').length}/{requirements.length} 已确认</span>}<button onClick={() => openEditor('settings', task.settings)}>分析设置</button></>}{chatView === 'work' && <button onClick={showChooser}>切换分析方式</button>}</div></header>
    <TabBar items={mainTabs} value={tab} label="需求分析视图" onChange={setTab}/>
    {error && !editor && <div className={s.error} role="alert">{error}<button aria-label="关闭错误提示" onClick={() => setError('')}>×</button></div>}
    {draftSaveFailed && !editor && <div className={s.draftRetry} role="status"><span>未保存的输入仍保留在当前会话。</span><button disabled={busy || loading} onClick={() => void persistDraft(true)}>重试保存草稿</button></div>}
    {notice && <div className={s.notice} role="status">{notice}<button aria-label="关闭提示" onClick={() => setNotice('')}>×</button></div>}
    {availability && !availability.ready && <div className={s.availability}><span>{availability.message}</span><button onClick={() => openCapabilityLink({ section: 'capability-center', capabilityId: REQUIREMENTS_CAPABILITY_ID })}>查看能力配置</button></div>}
    {tab === 'workspace' && <div className={s.subtabs}><TabBar items={workspaceTabs} value={workspace} label="需求工作区页面" onChange={setWorkspace}/></div>}
    <main ref={scrollArea} className={s.scroll} onScroll={event => { positions.current[positionKey]=event.currentTarget.scrollTop;if(tab==='chat')chatScroll.current[chatView]=event.currentTarget.scrollTop;rememberCurrent() }} role="tabpanel" aria-label={tab === 'workspace' ? workspaceTabs.find(([key]) => key === workspace)?.[1] : mainTabs.find(([key]) => key === tab)?.[1]}>{loading ? <Empty title="正在读取已保存的分析…"/> : taskId && !task ? <Empty title="分析记录暂时无法读取"><button onClick={async () => { setLoading(true); try { const next = await getRequirementTask(taskId); acceptTask(next); setDraft(initial.current.draft ?? next.draft); setError('') } catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setLoading(false) } }}>重新读取</button></Empty> : tab === 'chat' ? chatView === 'chooser' ? chooserView : workView : !task ? <Empty title={tab === 'trace' ? '尚无操作记录' : '添加资料或记录第一条需求'}>{tab === 'trace' ? '保存业务内容后，这里显示实际操作记录。' : <><p>确认保存后，可以在当前会话继续整理和编辑。</p><div className={s.toolbar}><button disabled={busy} onClick={() => openEditor('material')}>＋ 粘贴资料</button><button disabled={busy} onClick={() => fileInput.current?.click()}>添加 TXT / Markdown</button><button className={s.primary} disabled={busy} onClick={() => openEditor('requirement')}>＋ 新增需求</button></div></>}</Empty> : tab === 'workspace' ? <div className={s.workspace}>{({ overview: overviewView, materials: materialsView, requirements: requirementsView, flows: flowsView, questions: questionsView, document: documentsView })[workspace]}</div> : <div className={s.workspace}><div className={s.sectionHead}><div><h2>操作轨迹</h2><p>这里记录服务端实际完成的操作及处理结果。</p></div><button onClick={showWork}>返回对话继续讨论</button></div><select aria-label="轨迹类型筛选" value={traceFilter} onChange={e => setTraceFilter(e.target.value)}><option value="all">全部操作</option>{Object.entries({ material: '资料', analysis: '分析', change: '修改', confirm: '确认', version: '版本', export: '导出' }).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select><ol className={s.timeline}>{[...task.events].reverse().filter(event => traceFilter === 'all' || event.kind === traceFilter).map(event => <li key={event.id}><time>{time(event.at)}</time><div><p>{event.text}</p>{event.objectId && <button onClick={() => { const r = task.requirements.find(r => r.id === event.objectId), m = task.materials.find(m => m.id === event.objectId), q = task.questions.find(q => q.id === event.objectId), v = task.versions.find(v => v.id === event.objectId), f = task.flows.find(f => f.id === event.objectId), rule = task.rules.find(rule => rule.id === event.objectId); if (r) openEditor('requirement', r); else if (m) openEditor('material', m); else if (q) { goto('questions'); setQuestionFilter('all') } else if (v) { setVersionId(v.id); goto('document') } else if (f) openEditor('flow', f); else if (rule) openEditor('rule', rule); else setNotice('该操作对象的内容已变更，历史事件仍保留在轨迹中。') }}>查看关联内容 →</button>}</div></li>)}</ol>{!task.events.length && <Empty title="尚无操作记录"/>}</div>}</main>
    {tab === 'chat' && <div className={s.composerWrap}>{task && chatView === 'work' && <div className={s.quickActions}><button disabled={busy || running} onClick={() => void run('analyze', '请根据现有资料和对话整理需求清单，明确来源，并将不确定内容作为问题。')}>整理需求清单</button><button disabled={busy || running} onClick={() => void run('check', '请检查当前需求中的权限、异常、数据校验、重复或冲突，提出有依据的修改建议和待确认问题。')}>检查遗漏</button><button onClick={() => goto('document')}>查看需求结果</button></div>}<div className={s.composer}>{context && <div className={s.contextNote}>当前讨论：{contextLabel(context)}<button aria-label="取消当前讨论对象" onClick={() => setContext('')}>×</button></div>}<textarea ref={composer} aria-label="需求分析输入" value={draft} placeholder={mode === 'quick' ? '补充需求描述，或告诉我需要修改哪一项…' : '描述你的想法、当前问题或希望实现的功能…'} onChange={e => updateDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) { e.preventDefault(); void run(context ? 'revise' : mode === 'quick' ? 'analyze' : 'clarify') } }}/><div className={s.composerTools}><div><button aria-label="添加需求资料" disabled={busy || loading} onClick={() => openEditor('material')}>＋</button>{task && <select aria-label="本次分析模型" disabled={busy || running} value={task.settings.model} onChange={e => void command({ type: 'save', settings: { ...task.settings, model: e.target.value } })}>{modelOptions.map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select>}</div><div><small>{running ? '分析期间可继续输入草稿' : 'Enter 发送 · Shift+Enter 换行'}</small><button className={s.send} aria-label="发送需求分析消息" disabled={busy || running || loading || !draft.trim()} onClick={() => void run(context ? 'revise' : mode === 'quick' ? 'analyze' : 'clarify')}>↑</button></div></div></div></div>}
    <input ref={fileInput} type="file" hidden accept=".txt,.md,.markdown,text/plain,text/markdown" onChange={e => { void importFile(e.target.files?.[0]); e.target.value = '' }}/>
    {renderEditor()}
    {source && task && <Modal title="查看原始依据" onClose={() => setSource(undefined)}><h3>{sourceText(task, source).title}</h3><blockquote>{source.quote}</blockquote><h4>完整原文</h4><pre className={s.rawText}>{sourceText(task, source).text}</pre></Modal>}
    {confirm && <Modal title={confirm.title} onClose={() => setConfirm(undefined)} footer={<><button onClick={() => setConfirm(undefined)}>取消</button><button className={s.primary} disabled={busy} onClick={async () => { if (await command(confirm.command, '操作已保存。')) setConfirm(undefined) }}>{busy ? '正在保存…' : '确认'}</button></>}><p>{confirm.detail}</p>{error && <p className={s.error} role="alert">{error}</p>}</Modal>}
  </div>
}
