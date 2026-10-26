import React, { useEffect, useRef, useState } from 'react'
import { CodeEditor } from './Editor.tsx'
import s from './code-assistant.module.css'

type Props = { renderEvidence?: (taskId: string | undefined, active: boolean) => React.ReactNode; Toggle: React.ComponentType<{ checked: boolean; disabled?: boolean; label: string; onChange: (value: boolean) => void }>; roleId: string; roleVersion?: number; draftKey: string; initialTaskId?: string; initialDraft?: string; initialTitle?: string; onDraftChange?: (value: string) => void; onTaskChange?: (task: { id: string; title: string } | null) => void; loadModels: () => Promise<{ id: string; name: string }[]> }
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
const time = (value?: number | string) => value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '时间未记录'
const statusName = (value: string) => ({ idle: '准备就绪', running: '正在执行', done: '已完成', stopped: '已停止', failed: '执行失败', interrupted: '已中断' }[value] || value)
function ToolMessage({ part }: { part: any }) {
  const state = part.state ?? {}
  return <details className={s.tool}><summary><span>{state.status === 'completed' ? '✓' : state.status === 'error' ? '!' : '◌'}</span> {({ read: '读取文件', grep: '搜索内容', glob: '查找文件', edit: '修改代码', write: '写入文件', bash: '运行命令', todowrite: '任务计划' } as Record<string, string>)[part.tool] || part.tool}<small>{state.title || state.input?.filePath || state.input?.command || ''}</small></summary><pre>{JSON.stringify(state.input ?? {}, null, 2)}</pre>{(state.output || state.error) && <pre>{state.output || state.error}</pre>}<time>{time(state.time?.end)}</time></details>
}

export function CodeAssistant(props: Props) {
  const EnableSwitch = props.Toggle
  const storageKey = 'workbench-code-assistant-' + props.roleId + '-' + props.draftKey
  const [task, setTask] = useState<Task | null>(null), taskRef = useRef(task); taskRef.current = task
  const [tasks, setTasks] = useState<any[]>([]), [projects, setProjects] = useState<{ path: string; name: string }[]>([]), [cwd, setCwd] = useState(''), [projectInput, setProjectInput] = useState('')
  const [models, setModels] = useState<{ id: string; name: string }[]>([]), [model, setModel] = useState(''), [mode, setMode] = useState('read'), [health, setHealth] = useState<any>(null)
  const [draft, setDraft] = useState(props.initialDraft || ''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const [files, setFiles] = useState<string[]>([]), [state, setState] = useState<State | null>(null), [filter, setFilter] = useState(''), [matches, setMatches] = useState<any[] | null>(null)
  const [file, setFile] = useState<File | null>(null), [text, setText] = useState(''), [selection, setSelection] = useState(''), [diff, setDiff] = useState<{ before: File; after: File } | null>(null), [scope, setScope] = useState('unstaged')
  const [newFile, setNewFile] = useState(''), [showChanges, setShowChanges] = useState(false), [commit, setCommit] = useState<any>(null), [commitMessage, setCommitMessage] = useState('')
  const pending = useRef(false), alive = useRef(true), currentFile = useRef(file); currentFile.current = file
  const draftRef = useRef(draft); draftRef.current = draft
  const dirty = !!file && text !== file.text, dirtyRef = useRef(dirty); dirtyRef.current = dirty
  const running = task?.status === 'running'
  const action = async (fn: () => Promise<void>) => { if (pending.current) return; pending.current = true; setBusy(true); setError(''); setNotice(''); try { await fn() } catch (error) { if (alive.current) setError(error instanceof Error ? error.message : String(error)) } finally { pending.current = false; if (alive.current) setBusy(false) } }
  const accept = (next: Task) => { if (!alive.current) return; taskRef.current = next; setTask(next); setCwd(next.cwd); props.onTaskChange?.({ id: next.id, title: next.title }); try { sessionStorage.setItem(storageKey, next.id) } catch {} }
  const listTasks = async () => setTasks(await api('tasks', { roleId: props.roleId }))
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
    if (dirty && !window.confirm('当前文件有未保存修改，放弃这些编辑并切换任务？')) return
    if (dirty && taskRef.current) editorDrafts.delete(taskRef.current.id)
    const next = await api<Task>('task', { id }); accept(next); setModel(next.model); setMode(next.mode); setFile(null); currentFile.current = null; setDiff(null); setMatches(null); await refresh(id)
    const cached = editorDrafts.get(id)
    if (cached && taskRef.current?.id === id) { setFile(cached.file); setText(cached.text) }
  }
  const ensure = async () => {
    if (taskRef.current) return taskRef.current
    if (!cwd) throw new Error('请先选择或添加本地项目')
    const next = await api<Task>('create', {}, { requestId: crypto.randomUUID(), cwd, roleId: props.roleId, roleVersion: props.roleVersion, model, title: props.initialTitle })
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
      setProjects(projectList); setModels(modelList); setHealth(serviceHealth); setCwd(projectList[0]?.path || '')
      await listTasks()
      const id = props.initialTaskId || sessionStorage.getItem(storageKey)
      if (id) await openTask(id)
    })
    return () => { alive.current = false }
  }, [props.roleId, props.draftKey])
  useEffect(() => { props.onDraftChange?.(draft) }, [draft])
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
    setDraft(''); setSelection(''); await listTasks()
  })
  const newTask = () => action(async () => {
    if (dirty && !window.confirm('放弃当前未保存编辑并新建任务？')) return
    if (dirty && taskRef.current) editorDrafts.delete(taskRef.current.id)
    setTask(null); taskRef.current = null; props.onTaskChange?.(null); setFile(null); currentFile.current = null; setText(''); setDiff(null); setFiles([]); setState(null); setMode('read'); setNotice('选择项目后发送任务即可开始'); sessionStorage.removeItem(storageKey)
  })
  const paths = (showChanges ? state?.files.map(row => row.path) ?? [] : files).filter(path => path.toLowerCase().includes(filter.toLowerCase()))
  return <section className={s.root} aria-label="代码助手工作区">
    <header className={s.header}><div><strong>代码助手</strong><span className={s.badge}>OpenCode · 本地工具</span></div><div className={s.toolbar}><span className={s.status} data-running={running}>{task ? statusName(task.status) : health?.installed ? '已安装' : '引擎未安装'}</span><button onClick={() => void action(() => refresh())} disabled={busy || !task}>刷新文件</button><button onClick={() => void newTask()} disabled={busy || running}>新任务</button></div></header>
    <div className={s.projectBar}><select aria-label="本地项目" value={cwd} disabled={!!task || busy} onChange={event => setCwd(event.target.value)}><option value="">选择项目</option>{projects.map(project => <option key={project.path} value={project.path}>{project.name || project.path}</option>)}</select>{task ? <span className={s.path} title={cwd}>{cwd}</span> : <><input aria-label="项目目录" placeholder="或输入本地项目目录" value={projectInput} onChange={event => setProjectInput(event.target.value)} /><button disabled={!projectInput.trim() || busy} onClick={() => void action(async () => { const list = await api<typeof projects>('project', {}, { path: projectInput }); setProjects(list); setCwd(list.find(item => item.path.toLowerCase() === projectInput.toLowerCase())?.path || list.at(-1)?.path || ''); setProjectInput('') })}>添加项目</button><button disabled={!cwd || busy} onClick={() => void action(async () => { await ensure() })}>打开项目</button></>}
      <select aria-label="代码任务记录" value={task?.id || ''} disabled={busy || running} onChange={event => { if (event.target.value) void action(() => openTask(event.target.value)) }}><option value="">任务记录</option>{tasks.map(row => <option value={row.id} key={row.id}>{row.title}</option>)}</select></div>
    {(error || task?.error) && <div className={s.error} role="alert">{error || task?.error}</div>}{notice && <div className={s.notice} role="status">{notice}</div>}
    <div className={s.workspace}>
      <aside className={s.files}><div className={s.sectionTitle}><strong>{showChanges ? '项目变更' : '项目文件'}</strong><span>{state?.git ? state.branch : '本地目录'}</span></div><div className={s.segment}><button aria-pressed={!showChanges} onClick={() => { setShowChanges(false); setMatches(null) }}>文件</button><button aria-pressed={showChanges} onClick={() => { setShowChanges(true); setMatches(null) }}>变更 {state?.files.length || 0}</button></div>
        <div className={s.search}><input aria-label="搜索代码" placeholder="筛选文件或搜索代码" value={filter} onChange={event => { setFilter(event.target.value); setMatches(null) }} onKeyDown={event => { if (event.key === 'Enter' && task) void action(async () => setMatches(await api('search', { id: task.id, q: filter }))) }} /><button aria-label="搜索代码内容" disabled={!filter || !task || busy} onClick={() => void action(async () => setMatches(await api('search', { id: task!.id, q: filter })))}>⌕</button></div>
        <div className={s.fileList}>{matches ? matches.length ? matches.map((match, i) => <button key={i} title={match.text} onClick={() => void action(() => chooseFile(match.path))}><b>{match.path}:{match.line}</b><small>{match.text}</small></button>) : <p>没有匹配的代码</p> : paths.map(path => { const status = state?.files.find(row => row.path === path); return <div key={path} className={s.fileRow} data-active={file?.path === path}><button title={path} onClick={() => void action(() => chooseFile(path, showChanges, status?.worktree === ' ' ? 'staged' : 'unstaged'))}><span>{path.split('/').at(-1)}</span><small>{path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : ''}</small></button>{showChanges && <button title={status?.index !== ' ' && status?.index !== '?' ? '取消暂存此文件' : '暂存此文件'} disabled={busy || running} onClick={() => void action(async () => { setState(await api('stage', {}, { id: task!.id, path, unstage: status?.index !== ' ' && status?.index !== '?', expected: state })); setNotice('Git 暂存区已更新') })}>{status?.index !== ' ' && status?.index !== '?' ? '−' : '+'}</button>}</div> })}{!task && <p>打开本地项目后，在这里浏览文件。</p>}</div>
        {!showChanges && <div className={s.addFile}><input aria-label="新文件路径" placeholder="新文件相对路径" value={newFile} onChange={event => setNewFile(event.target.value)} /><button disabled={!newFile || busy || running} onClick={() => void action(async () => { await chooseFile(newFile); setNewFile('') })}>＋</button></div>}
        {showChanges && <button disabled={!state?.git || busy || running} onClick={() => void action(async () => { const preview = await api('preview', { id: task!.id }); if (!preview.files.length) throw new Error('请先暂存要提交的文件'); setCommit(preview); setCommitMessage('') })}>审阅暂存并提交</button>}
      </aside>
      <main className={s.code}><div className={s.codeToolbar}><span title={file?.path}>{file?.path || '代码与差异'}{dirty ? ' · 未保存' : ''}</span>{file && <div className={s.toolbar}><button aria-pressed={!!diff} disabled={busy || dirty} onClick={() => void action(async () => { if (diff) setDiff(null); else setDiff(await api('diff', { id: task!.id, path: file.path, scope })) })}>{diff ? '返回代码' : '查看差异'}</button>{diff && <select aria-label="差异范围" value={scope} onChange={event => { setScope(event.target.value); void action(async () => setDiff(await api('diff', { id: task!.id, path: file.path, scope: event.target.value }))) }}><option value="unstaged">未暂存</option><option value="staged">已暂存</option></select>}<button disabled={!dirty || busy || running || !!diff} onClick={() => void action(async () => { const next = await api<File>('save', {}, { id: task!.id, path: file.path, content: text, version: file.version }); setFile(next); setText(next.text); await refresh(); setNotice('文件已保存') })}>保存</button></div>}</div>
        {file ? file.reason ? <p className={s.empty}>{file.reason}</p> : <CodeEditor key={file.path + (diff ? ':diff' : ':file')} path={file.path} value={diff ? diff.after.text : text} before={diff?.before.text} readOnly={running || busy} onChange={setText} onSelect={setSelection} /> : <div className={s.empty}><span className={s.codeIcon}>{'{ }'}</span><h3>在项目里阅读、修改和验证代码</h3><p>选择左侧文件查看代码，或在右侧描述开发任务。修改和命令会先展示审批。</p><div className={s.suggestions}>{['梳理这个项目的结构和启动方式', '检查当前变更中的问题，先不要修改', '为核心功能补充测试并运行检查'].map(prompt => <button key={prompt} onClick={() => setDraft(prompt)}>{prompt}</button>)}</div></div>}
      </main>
      <aside className={s.chat}><div className={s.sectionTitle}><strong>{task?.title || '开发任务'}</strong><span>{selection ? '已引用选区' : ''}</span></div><div className={s.messages} aria-live="polite">{!task?.messages?.length && <div className={s.intro}><h3>从一个具体任务开始</h3><p>说明要修复的问题或新增的功能。代码助手会读取项目、提出修改，并运行你批准的命令。</p><p>模型使用工作台现有配置。文件、编辑器和任务记录保存在本机。</p></div>}{props.renderEvidence?.(task?.id,!!running)}{task?.messages.map(message => <article key={message.info.id} className={s.message} data-role={message.info.role}><strong>{message.info.role === 'user' ? '你' : '代码助手'}</strong>{message.parts.map((part: any) => part.type === 'text' ? <div className={s.prose} key={part.id}>{part.text}</div> : part.type === 'tool' ? <ToolMessage part={part} key={part.id} /> : part.type === 'reasoning' ? <details className={s.reasoning} key={part.id}><summary>思考过程</summary><div className={s.prose}>{part.text}</div></details> : null)}{message.info.error && <p className={s.error}>{message.info.error.data?.message || message.info.error.name}</p>}<time>{time(message.info.time?.completed || message.info.time?.created)}</time></article>)}{running && <p className={s.working}>{task?.permissions.length ? '等待你审批下面的操作' : '正在处理任务…'}</p>}</div>
        {task?.permissions.map(permission => <div className={s.approval} key={permission.id}><strong>{['bash', 'shell'].includes(permission.permission) ? '允许运行这条命令？' : '允许这次文件修改？'}</strong><pre>{permission.metadata?.diff || permission.metadata?.command || permission.patterns?.join('\n') || JSON.stringify(permission.metadata, null, 2)}</pre><div><button disabled={busy} onClick={() => void action(async () => accept(await api('permission', {}, { id: task.id, permissionId: permission.id, allow: false })))}>拒绝</button><button className={s.primary} disabled={busy} onClick={() => void action(async () => accept(await api('permission', {}, { id: task.id, permissionId: permission.id, allow: true })))}>允许本次</button></div></div>)}
        <div className={s.composer}><select aria-label="代码助手模型" value={model} disabled={running || busy} onChange={event => setModel(event.target.value)}><option value="">使用工作台默认模型</option>{models.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select><textarea aria-label="代码任务说明" placeholder="描述要完成的开发任务…" value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && draft.trim() && !busy && !running) { event.preventDefault(); void send() } }} /><div className={s.composerActions}><label><EnableSwitch checked={mode === 'edit'} disabled={running || busy} label="允许请求修改和运行" onChange={value => setMode(value ? 'edit' : 'read')} /><span>{mode === 'edit' ? '修改与运行需审批' : '只读审查'}</span></label>{running ? <button className={s.stop} disabled={busy} onClick={() => void action(async () => { accept(await api('stop', {}, { id: task!.id })); await refresh() })}>停止</button> : <button className={s.primary} disabled={!draft.trim() || busy || !cwd || !health?.installed} onClick={() => void send()}>{busy ? '处理中…' : '发送'}</button>}</div></div>
      </aside>
    </div>
    {commit && <div className={s.overlay}><div className={s.dialog} role="dialog" aria-modal="true" aria-label="审阅本地提交"><h3>审阅暂存内容</h3><p>本次提交包含暂存区的 {commit.files.length} 个文件。</p><pre>{commit.patch || commit.files.join('\n')}</pre><input autoFocus aria-label="提交说明" placeholder="填写提交说明" value={commitMessage} onChange={event => setCommitMessage(event.target.value)} /><div><button disabled={busy} onClick={() => setCommit(null)}>取消</button><button className={s.primary} disabled={busy || !commitMessage.trim()} onClick={() => void action(async () => { await api('commit', {}, { id: task!.id, message: commitMessage, expected: { head: commit.head, index: commit.index } }); setCommit(null); await refresh(); setNotice('本地提交已完成') })}>创建本地提交</button></div></div></div>}
  </section>
}
