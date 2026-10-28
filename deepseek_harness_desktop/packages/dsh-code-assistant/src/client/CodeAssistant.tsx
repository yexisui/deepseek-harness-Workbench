import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { CodeEditor } from './Editor.tsx'
import { TaskHistory, projectKey, type HistoryModalProps, type HistoryState, type HistoryItem } from './TaskHistory.tsx'
import { Conversation } from './Conversation.tsx'
import { useCodePanels } from './useCodePanels.ts'
import s from './code-assistant.module.css'

type Props = { panelToggleClassName?: string; Modal: React.ComponentType<HistoryModalProps>; removeIcon?: React.ReactNode; renderEvidence?: (taskId: string | undefined, active: boolean) => React.ReactNode; Toggle: React.ComponentType<{ checked: boolean; disabled?: boolean; label: string; onChange: (value: boolean) => void }>; roleId: string; roleVersion?: number; draftKey: string; initialTaskId?: string; initialDraft?: string; initialTitle?: string; onDraftChange?: (value: string) => void; onTaskChange?: (task: { id: string; title: string } | null) => void; loadModels: () => Promise<{ id: string; name: string }[]> }
type Task = { id: string; cwd: string; title: string; model: string; mode: string; status: string; error: string; messages: any[]; permissions: any[]; updatedAt: string }
type File = { path: string; text: string; version: string; reason?: string }
// Keep editor buffers when the host temporarily unmounts a work area (new chat, role or settings).
// Browser close/reload is separately protected by beforeunload.
const editorDrafts = new Map<string, { file: File; text: string }>()
type State = { git: boolean; branch: string; head: string; index: string; fingerprint: string; files: { path: string; index: string; worktree: string; conflict: boolean }[] }
async function api<T = any>(route: string, params: Record<string, string> = {}, body?: unknown): Promise<T> {
  const response = await fetch('/api/capabilities/code-assistant/' + route + '?' + new URLSearchParams(params), { credentials: 'same-origin', ...(body === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }) })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || '代码模块请求失败')
  return result
}
type ProjectDesktop = { selectProjectDirectory?: () => Promise<string | null>; openCodeProjectDirectory?: (path: string) => Promise<void> }
const desktop = () => (window as Window & { desktop?: ProjectDesktop }).desktop
const statusName = (value: string) => ({ idle: '准备就绪', running: '正在执行', done: '已完成', stopped: '已停止', failed: '执行失败', interrupted: '已中断' }[value] || value)

export function CodeAssistant(props: Props) {
  const EnableSwitch = props.Toggle
  const [reading, setReading] = useState(false), composer = useRef<HTMLTextAreaElement>(null)
  const panels = useCodePanels(), [selectedQuestion, setSelectedQuestion] = useState(''), [questionJump, setQuestionJump] = useState(0)
  const storageKey = 'workbench-code-assistant-' + props.roleId + '-' + props.draftKey
  const [task, setTask] = useState<Task | null>(null), taskRef = useRef(task); taskRef.current = task
  const [history, setHistory] = useState<HistoryState>({ tasks: [], removedProjects: [], removedTasks: [] }), [projects, setProjects] = useState<{ path: string; name: string }[]>([]), [cwd, setCwd] = useState('')
  const [historyOpen, setHistoryOpen] = useState(false), [historyUndo, setHistoryUndo] = useState<HistoryItem | null>(null), historyRevision = useRef(0), historyPending = useRef(false), historyRead = useRef(0)
  const [models, setModels] = useState<{ id: string; name: string }[]>([]), [model, setModel] = useState(''), [mode, setMode] = useState('read'), [health, setHealth] = useState<any>(null)
  const [draft, setDraft] = useState(props.initialDraft || ''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const [files, setFiles] = useState<string[]>([]), [state, setState] = useState<State | null>(null), [filter, setFilter] = useState(''), [matches, setMatches] = useState<any[] | null>(null)
  const [file, setFile] = useState<File | null>(null), [text, setText] = useState(''), [selection, setSelection] = useState(''), [diff, setDiff] = useState<{ before: File; after: File } | null>(null), [scope, setScope] = useState('unstaged')
  const [newFile, setNewFile] = useState(''), [showChanges, setShowChanges] = useState(false), [commit, setCommit] = useState<any>(null), [commitMessage, setCommitMessage] = useState('')
  const pending = useRef(false), alive = useRef(true), currentFile = useRef(file); currentFile.current = file
  const draftRef = useRef(draft); draftRef.current = draft
  const dirty = !!file && text !== file.text, dirtyRef = useRef(dirty); dirtyRef.current = dirty
  const tasks = history.tasks
  const running = task?.status === 'running'
  const action = async (fn: () => Promise<void>) => { if (pending.current) return; pending.current = true; setBusy(true); setError(''); setNotice(''); try { await fn() } catch (error) { if (alive.current) setError(error instanceof Error ? error.message : String(error)) } finally { pending.current = false; if (alive.current) setBusy(false) } }
  const accept = (next: Task) => { if (!alive.current) return; taskRef.current = next; setTask(next); setCwd(next.cwd); props.onTaskChange?.({ id: next.id, title: next.title }); try { sessionStorage.setItem(storageKey, next.id) } catch {} }
  const listTasks = async () => { const read = ++historyRead.current, revision = historyRevision.current; const next = await api<HistoryState>('history', { roleId: props.roleId }); if (alive.current && read === historyRead.current && revision === historyRevision.current && !historyPending.current) setHistory(next) }
  const refresh = async (id = taskRef.current?.id) => {
    if (!id) return
    const [listing, snapshot] = await Promise.all([api<{ files: string[] }>('files', { id }), api<State>('state', { id })])
    if (taskRef.current?.id !== id || !alive.current) return
    setFiles(listing.files); setState(snapshot)
    const selected = currentFile.current
    if (selected && !dirtyRef.current) {
      const next = await api<File>('file', { id, path: selected.path })
      if (taskRef.current?.id === id && currentFile.current?.path === selected.path && !dirtyRef.current) { setFile(next); setText(next.text) }
    }
  }
  const openTask = async (id: string) => {
    if (taskRef.current?.id === id) return true
    if (taskRef.current?.status === 'running') throw new Error('当前任务正在运行，请等待完成后再切换')
    if (dirty && !window.confirm('当前文件有未保存修改，放弃这些编辑并切换任务？')) return false
    if (dirty && taskRef.current) editorDrafts.delete(taskRef.current.id)
    const next = await api<Task>('task', { id }); setSelectedQuestion(''); accept(next); setModel(next.model); setMode(next.mode); setFile(null); currentFile.current = null; setDiff(null); setMatches(null); await refresh(id)
    const cached = editorDrafts.get(id)
    if (cached && taskRef.current?.id === id) { setFile(cached.file); setText(cached.text) }
    return true
  }
  const ensure = async (directory = cwd) => {
    if (taskRef.current) return taskRef.current
    if (!directory) throw new Error('请先选择本地项目文件夹')
    const next = await api<Task>('create', {}, { requestId: crypto.randomUUID(), cwd: directory, roleId: props.roleId, roleVersion: props.roleVersion, model, title: props.initialTitle })
    accept(next); await refresh(next.id); await listTasks(); return next
  }
  const chooseFile = async (path: string, asDiff = false, side = scope) => {
    if (dirty && !window.confirm('当前文件有未保存修改，放弃后重新读取文件？')) return
    if (dirty && taskRef.current) editorDrafts.delete(taskRef.current.id)
    const current = await ensure(), next = await api<File>('file', { id: current.id, path })
    setFile(next); setText(next.text); setSelection(''); setScope(side)
    setDiff(asDiff ? await api('diff', { id: current.id, path, scope: side }) : null)
  }
  useEffect(() => {
    alive.current = true
    void action(async () => {
      const [projectList, modelList, serviceHealth] = await Promise.all([api<typeof projects>('projects'), props.loadModels(), api('health')])
      if (!alive.current) return
      setProjects(projectList); setModels(modelList); setHealth(serviceHealth); setCwd('')
      await listTasks()
      const id = props.initialTaskId || sessionStorage.getItem(storageKey)
      if (id) await openTask(id)
    })
    return () => { alive.current = false }
  }, [props.roleId, props.draftKey])
  useEffect(() => { props.onDraftChange?.(draft) }, [draft])
  useLayoutEffect(() => { const input = composer.current; if (input) { input.style.height = '0px'; input.style.height = Math.min(128, Math.max(52, input.scrollHeight)) + 'px' } }, [draft])
  useEffect(() => {
    if (!historyOpen) return
    let stopped = false
    const update = async () => { if (stopped || historyPending.current) return; try { await listTasks() } catch { /* Keep the last snapshot when background refresh fails. */ } }
    void update()
    const timer = setInterval(() => void update(), 3000)
    return () => { stopped = true; clearInterval(timer) }
  }, [historyOpen, props.roleId])
  const changeHistory = async (item: HistoryItem, restore: boolean) => {
    historyPending.current = true; historyRevision.current++
    try {
      const route = 'history/' + (item.kind === 'project' ? 'project/' : '') + (restore ? 'restore' : 'remove')
      const next = await api<HistoryState>(route, {}, { ...(item.kind === 'project' ? { cwd: item.cwd } : { id: item.id }), roleId: props.roleId })
      if (alive.current) setHistory(next)
    } finally { historyRevision.current++; historyPending.current = false }
  }
  useEffect(() => {
    if (!task?.id || !file) return
    if (dirty) editorDrafts.set(task.id, { file, text })
    else editorDrafts.delete(task.id)
  }, [task?.id, file, text, dirty])
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => { if (dirtyRef.current) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', guard); return () => window.removeEventListener('beforeunload', guard)
  }, [])
  useEffect(() => {
    if (!task?.id || !running) return
    let stopped = false, timer: ReturnType<typeof setTimeout>
    const poll = async () => { try { const next = await api<Task>('task', { id: task.id }); if (!stopped) { accept(next); if (next.status !== 'running') { await refresh(task.id); await listTasks() } } } catch (error) { if (!stopped) setError((error as Error).message) } if (!stopped) timer = setTimeout(poll, 900) }
    timer = setTimeout(poll, 300); return () => { stopped = true; clearTimeout(timer) }
  }, [task?.id, running])
  const send = () => action(async () => {
    if (dirty) throw new Error('请先保存当前文件，或撤销未保存编辑，再启动代码任务')
    const current = await ensure(), requestId = crypto.randomUUID()
    const context = selection && file ? `\n\n当前选区（${file.path}）：\n${selection}` : ''
    accept(await api('send', {}, { id: current.id, requestId, message: draft + context, model, mode }))
    setDraft(''); setSelection(''); setSelectedQuestion(''); panels.toggle('right', true); await listTasks()
  })
  const resetTask = () => {
    if (taskRef.current) editorDrafts.delete(taskRef.current.id)
    setSelectedQuestion(''); setTask(null); taskRef.current = null; props.onTaskChange?.(null); setFile(null); currentFile.current = null; setText(''); setDiff(null); setFiles([]); setState(null); setMode('read'); setSelection(''); setMatches(null); setFilter(''); setShowChanges(false); setCommit(null); setNewFile(''); sessionStorage.removeItem(storageKey)
  }
  const newTask = () => action(async () => {
    if (dirty && !window.confirm('放弃当前未保存编辑并新建任务？')) return
    resetTask(); setNotice('选择项目后发送任务即可开始')
  })
  const openProject = async (path: string) => {
    if (!path) return
    const list = await api<typeof projects>('project', {}, { path })
    if (!alive.current) return
    const selected = list.find(item => projectKey(item.path) === projectKey(path))?.path || path
    setProjects(list); setCwd(selected); await ensure(selected)
  }
  const projectAddress = () => action(async () => {
    if (cwd) {
      const bridge = desktop()
      if (!bridge?.openCodeProjectDirectory) throw new Error('请在桌面端打开项目文件夹；更新后请正常重开工作台')
      await bridge.openCodeProjectDirectory(cwd)
    } else {
      const bridge = desktop()
      const selected = bridge?.selectProjectDirectory ? await bridge.selectProjectDirectory() : window.prompt('输入本地项目目录')
      if (selected?.trim()) await openProject(selected.trim())
    }
  })
  const removeProject = () => action(async () => {
    if (!cwd || running) return
    if (dirty && !window.confirm('当前文件有未保存修改，放弃编辑并移除当前项目？')) return
    const list = await api<typeof projects>('project/remove', {}, { path: cwd })
    if (!alive.current) return
    resetTask(); setCwd(''); setProjects(list); setNotice('已移除当前项目')
  })
  const selectQuestion = (id: string) => { setSelectedQuestion(id); setQuestionJump(value => value + 1); panels.toggle('right', true) }
  const panelButton = (side: 'left' | 'right', expanded: boolean) => <button type="button" className={expanded ? [s.collapseButton, props.panelToggleClassName].filter(Boolean).join(' ') : s.restorePanel} aria-label={`${expanded ? '收起' : '展开'}${side === 'left' ? '项目文件' : '开发对话'}`} aria-expanded={expanded} aria-controls={`${storageKey}-${side}`} title={`${expanded ? '收起' : '展开'}${side === 'left' ? '项目文件' : '开发对话'}`} onClick={() => {
    if (reading) setReading(false)
    panels.toggle(side, !expanded)
    requestAnimationFrame(() => panels.root.current?.querySelector<HTMLButtonElement>(`button[aria-label="${expanded ? '展开' : '收起'}${side === 'left' ? '项目文件' : '开发对话'}"]`)?.focus())
  }}><span aria-hidden="true">{(side === 'left') === expanded ? '‹' : '›'}</span>{!expanded && <span className={s.railLabel}>{side === 'left' ? '项目文件' : '开发对话'}</span>}</button>
  const separator = (side: 'left' | 'right') => <button type="button" role="separator" className={s.resizeHandle} data-side={side} hidden={reading || panels.compact || !panels.layout[side === 'left' ? 'leftOpen' : 'rightOpen']} aria-label={`调整${side === 'left' ? '文件栏' : '对话栏'}宽度`} aria-orientation="vertical" aria-valuemin={side === 'left' ? 140 : 300} aria-valuemax={Math.round(panels.limit(side))} aria-valuenow={Math.round(panels.actual[side])} title="拖动调整宽度；方向键微调，Esc取消" {...panels.events(side)}/>
  const paths = (showChanges ? state?.files.map(row => row.path) ?? [] : files).filter(path => path.toLowerCase().includes(filter.toLowerCase()))
  return <section className={s.root} aria-label="代码助手工作区">
    <header className={s.header}><div><strong>代码助手</strong><span className={s.badge}>OpenCode · 本地工具</span></div><div className={s.toolbar}><span className={s.status} data-running={running}>{task ? statusName(task.status) : health?.installed ? '已安装' : '引擎未安装'}</span><button onClick={() => void action(() => refresh())} disabled={busy || !task}>刷新文件</button><button onClick={() => void newTask()} disabled={busy || running}>新任务</button></div></header>
    <div className={s.projectBar}>
      <select aria-label="本地项目" value={cwd} disabled={!!task || busy || running} onChange={event => { const path = event.target.value; if (path) void action(() => openProject(path)); else setCwd('') }}><option value="">选择项目</option>{cwd && !projects.some(project => project.path === cwd) && <option value={cwd}>{cwd}</option>}{projects.map(project => <option key={project.path} value={project.path}>{project.name || project.path}</option>)}</select>
      <div className={s.projectAddress}><button type="button" className={s.addressPath} aria-label={cwd ? '打开当前项目文件夹' : '选择本地项目文件夹'} title={cwd || '选择本地项目文件夹'} disabled={busy} onClick={() => void projectAddress()}>{cwd || '点击选择本地项目文件夹'}</button>{cwd && <button type="button" className={s.addressRemove} aria-label="移除当前项目" title="移除当前项目" disabled={busy || running} onClick={() => void removeProject()}>×</button>}</div>
      <button type="button" className={s.historyButton} aria-label="任务记录" aria-haspopup="dialog" disabled={busy} onClick={() => setHistoryOpen(true)}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 11a9 9 0 1 1 2.7 7M3 4v7h7M12 7v5l3 2"/></svg><span>对话记录</span><small>{tasks.length} 段</small></button>
    </div>
    {(error || task?.error) && <div className={s.error} role="alert">{error || task?.error}</div>}{notice && <div className={s.notice} role="status">{notice}</div>}
    <div className={s.workspace} ref={panels.root} style={panels.style} data-compact={panels.compact} data-reading={reading} data-resizing={!!panels.dragging}>
      <aside className={s.collapsedPanel} data-side="left" hidden={!reading && panels.layout.leftOpen}>{panelButton('left', false)}</aside>
      <aside className={s.files} id={`${storageKey}-left`} aria-label="项目文件" hidden={reading || !panels.layout.leftOpen}><div className={s.sectionTitle}><strong>{showChanges ? '项目变更' : '项目文件'}</strong><span>{state?.git ? state.branch : '本地目录'}</span>{panelButton('left', true)}</div><div className={s.segment}><button aria-pressed={!showChanges} onClick={() => { setShowChanges(false); setMatches(null) }}>文件</button><button aria-pressed={showChanges} onClick={() => { setShowChanges(true); setMatches(null) }}>变更 {state?.files.length || 0}</button></div>
        <div className={s.search}><input aria-label="搜索代码" placeholder="筛选文件或搜索代码" value={filter} onChange={event => { setFilter(event.target.value); setMatches(null) }} onKeyDown={event => { if (event.key === 'Enter' && task) void action(async () => setMatches(await api('search', { id: task.id, q: filter }))) }} /><button aria-label="搜索代码内容" disabled={!filter || !task || busy} onClick={() => void action(async () => setMatches(await api('search', { id: task!.id, q: filter })))}>⌕</button></div>
        <div className={s.fileList}>{matches ? matches.length ? matches.map((match, i) => <button key={i} title={match.text} onClick={() => void action(() => chooseFile(match.path))}><b>{match.path}:{match.line}</b><small>{match.text}</small></button>) : <p>没有匹配的代码</p> : paths.map(path => { const status = state?.files.find(row => row.path === path); return <div key={path} className={s.fileRow} data-active={file?.path === path}><button title={path} onClick={() => void action(() => chooseFile(path, showChanges, status?.worktree === ' ' ? 'staged' : 'unstaged'))}><span>{path.split('/').at(-1)}</span><small>{path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : ''}</small></button>{showChanges && <button title={status?.index !== ' ' && status?.index !== '?' ? '取消暂存此文件' : '暂存此文件'} disabled={busy || running} onClick={() => void action(async () => { setState(await api('stage', {}, { id: task!.id, path, unstage: status?.index !== ' ' && status?.index !== '?', expected: state })); setNotice('Git 暂存区已更新') })}>{status?.index !== ' ' && status?.index !== '?' ? '−' : '+'}</button>}</div> })}{!task && <p>打开本地项目后，在这里浏览文件。</p>}</div>
        {!showChanges && <div className={s.addFile}><input aria-label="新文件路径" placeholder="新文件相对路径" value={newFile} onChange={event => setNewFile(event.target.value)} /><button disabled={!newFile || busy || running} onClick={() => void action(async () => { await chooseFile(newFile); setNewFile('') })}>＋</button></div>}
        {showChanges && <button disabled={!state?.git || busy || running} onClick={() => void action(async () => { const preview = await api('preview', { id: task!.id }); if (!preview.files.length) throw new Error('请先暂存要提交的文件'); setCommit(preview); setCommitMessage('') })}>审阅暂存并提交</button>}
      </aside>
      {separator('left')}
      <aside className={`${s.collapsedPanel} ${s.readingRail}`} hidden={!reading}><button type="button" className={s.restorePanel} aria-label="退出专注阅读并返回代码" onClick={() => setReading(false)}><span aria-hidden="true">›</span><span className={s.railLabel}>代码预览</span></button></aside>
      <main className={s.code} hidden={reading}><div className={s.codeToolbar}><span title={file?.path}>{file?.path || '代码与差异'}{dirty ? ' · 未保存' : ''}</span>{file && <div className={s.toolbar}><button aria-pressed={!!diff} disabled={busy || dirty} onClick={() => void action(async () => { if (diff) setDiff(null); else setDiff(await api('diff', { id: task!.id, path: file.path, scope })) })}>{diff ? '返回代码' : '查看差异'}</button>{diff && <select aria-label="差异范围" value={scope} onChange={event => { setScope(event.target.value); void action(async () => setDiff(await api('diff', { id: task!.id, path: file.path, scope: event.target.value }))) }}><option value="unstaged">未暂存</option><option value="staged">已暂存</option></select>}<button disabled={!dirty || busy || running || !!diff} onClick={() => void action(async () => { const next = await api<File>('save', {}, { id: task!.id, path: file.path, content: text, version: file.version }); setFile(next); setText(next.text); await refresh(); setNotice('文件已保存') })}>保存</button></div>}</div>
        {file ? file.reason ? <p className={s.empty}>{file.reason}</p> : <CodeEditor key={file.path + (diff ? ':diff' : ':file')} path={file.path} value={diff ? diff.after.text : text} before={diff?.before.text} readOnly={running || busy} onChange={setText} onSelect={setSelection} /> : <div className={s.empty}><span className={s.codeIcon}>{'{ }'}</span><h3>在项目里阅读、修改和验证代码</h3><p>选择左侧文件查看代码，或在右侧描述开发任务。修改和命令会先展示审批。</p><div className={s.suggestions}>{['梳理这个项目的结构和启动方式', '检查当前变更中的问题，先不要修改', '为核心功能补充测试并运行检查'].map(prompt => <button key={prompt} onClick={() => setDraft(prompt)}>{prompt}</button>)}</div></div>}
      </main>
      {separator('right')}
      <aside className={s.collapsedPanel} data-side="right" hidden={panels.layout.rightOpen}>{panelButton('right', false)}</aside>
      <aside className={s.chat} id={`${storageKey}-right`} aria-label="开发对话" hidden={!panels.layout.rightOpen}><div className={s.sectionTitle}><div className={s.conversationTitle}><strong title={task?.title}>{task?.title || '开发对话'}</strong>{selection && <small>已引用选区</small>}</div><button type="button" className={s.readingButton} aria-pressed={reading} onClick={() => setReading(value => !value)}>{reading ? '退出专注' : '专注阅读'}</button>{panelButton('right', true)}</div>
        <Conversation task={task} selected={selectedQuestion} jump={questionJump} onSelect={selectQuestion} evidence={props.renderEvidence?.(task?.id, !!running)}/>
        {task?.permissions.map(permission => <div className={s.approval} key={permission.id}><strong>{['bash', 'shell'].includes(permission.permission) ? '允许运行这条命令？' : '允许这次文件修改？'}</strong><pre>{permission.metadata?.diff || permission.metadata?.command || permission.patterns?.join('\n') || JSON.stringify(permission.metadata, null, 2)}</pre><div><button disabled={busy} onClick={() => void action(async () => accept(await api('permission', {}, { id: task.id, permissionId: permission.id, allow: false })))}>拒绝</button><button className={s.primary} disabled={busy} onClick={() => void action(async () => accept(await api('permission', {}, { id: task.id, permissionId: permission.id, allow: true })))}>允许本次</button></div></div>)}
        <div className={s.composer}><textarea ref={composer} rows={2} aria-label="代码任务说明" placeholder="描述要完成的开发任务…" value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && draft.trim() && !busy && !running) { event.preventDefault(); void send() } }} /><div className={s.composerActions}><select aria-label="代码助手模型" value={model} disabled={running || busy} onChange={event => setModel(event.target.value)}><option value="">使用工作台默认模型</option>{models.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select><label><EnableSwitch checked={mode === 'edit'} disabled={running || busy} label="允许请求修改和运行" onChange={value => setMode(value ? 'edit' : 'read')} /><span>{mode === 'edit' ? '修改与运行需审批' : '只读审查'}</span></label>{running ? <button className={s.stop} disabled={busy} onClick={() => void action(async () => { accept(await api('stop', {}, { id: task!.id })); await refresh() })}>停止</button> : <button className={s.primary} disabled={!draft.trim() || busy || !cwd || !health?.installed} onClick={() => void send()}>{busy ? '处理中…' : '发送'}</button>}</div></div>
      </aside>
    </div>
    {historyOpen && <TaskHistory Modal={props.Modal} removeIcon={props.removeIcon} history={history} currentCwd={cwd} currentTaskId={task?.id} running={!!running} undo={historyUndo} onUndoChange={setHistoryUndo} onClose={() => setHistoryOpen(false)} onOpen={async (id, questionId) => { if (!await openTask(id)) return false; selectQuestion(questionId || ''); return true }} onRemove={item => changeHistory(item, false)} onRestore={item => changeHistory(item, true)} />}
    {commit && <div className={s.overlay}><div className={s.dialog} role="dialog" aria-modal="true" aria-label="审阅本地提交"><h3>审阅暂存内容</h3><p>本次提交包含暂存区的 {commit.files.length} 个文件。</p><pre>{commit.patch || commit.files.join('\n')}</pre><input autoFocus aria-label="提交说明" placeholder="填写提交说明" value={commitMessage} onChange={event => setCommitMessage(event.target.value)} /><div><button disabled={busy} onClick={() => setCommit(null)}>取消</button><button className={s.primary} disabled={busy || !commitMessage.trim()} onClick={() => void action(async () => { await api('commit', {}, { id: task!.id, message: commitMessage, expected: { head: commit.head, index: commit.index } }); setCommit(null); await refresh(); setNotice('本地提交已完成') })}>创建本地提交</button></div></div></div>}
  </section>
}
