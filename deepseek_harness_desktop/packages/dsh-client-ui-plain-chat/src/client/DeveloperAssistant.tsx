import React, { useEffect, useRef, useState } from 'react'
import type { DeveloperContext, DeveloperProject, DeveloperTask } from '../../../dsh-capabilities/src/core/developer-model.ts'
import type { BranchesView, GraphView, WorktreeListView } from '../../../dsh-git-graph/src/core/types.ts'
import type { CommitPreview, FileView, WorkspaceDiff, WorkspaceState } from '../../../dsh-git-graph/src/core/workspace.ts'
import { developerApi as api, developerUrl } from './developer-client.ts'
import { DeveloperProjectSettings } from './DeveloperProjectSettings.tsx'
import { Modal } from './PreviewModal.tsx'
import s from './DeveloperAssistant.module.css'

const tabs = [['develop', '开发'], ['changes', '变更'], ['versions', '版本'], ['runs', '运行']]
const scopes = [['round', '本轮变更'], ['task', '任务累计'], ['uncommitted', '未提交'], ['branch', '分支比较']]
type Props = { taskId?: string; draftKey: string; roleId: string; roleVersion?: number; initialDraft?: string; onDraftChange?: (value: string) => void; loadModels: () => Promise<{ id: string; name: string }[]>; onCommit: (task: DeveloperTask) => void }
type Preference = { cwd: string; tab: string; scope: string; path: string; draft: string; model: string; contexts: DeveloperContext[]; chat: boolean; versionTab: string; runTab: string }
function saved(key: string, draft = ''): Preference {
  try { const raw = JSON.parse(sessionStorage.getItem(key) ?? '{}'); return { cwd: '', tab: 'develop', scope: 'uncommitted', path: '', draft, model: '', contexts: [], chat: true, versionTab: 'commits', runTab: 'checks', ...raw } } catch { return { cwd: '', tab: 'develop', scope: 'uncommitted', path: '', draft, model: '', contexts: [], chat: true, versionTab: 'commits', runTab: 'checks' } }
}
function Tabs({ values, value, onChange, label }: { values: string[][]; value: string; onChange: (value: string) => void; label: string }) {
  return <div className={s.tabs} role="tablist" aria-label={label}>{values.map(([id, title], index) => <button role="tab" key={id} aria-selected={value === id} tabIndex={value === id ? 0 : -1} onClick={() => onChange(id!)} onKeyDown={e => {
    const next = e.key === 'ArrowRight' ? (index + 1) % values.length : e.key === 'ArrowLeft' ? (index + values.length - 1) % values.length : e.key === 'Home' ? 0 : e.key === 'End' ? values.length - 1 : -1
    if (next >= 0) { e.preventDefault(); onChange(values[next]![0]!); (e.currentTarget.parentElement?.children[next] as HTMLElement)?.focus() }
  }}>{title}</button>)}</div>
}
export function DeveloperAssistant(props: Props) {
  const storageKey = 'workbench-developer-view-' + (props.taskId ?? props.draftKey)
  const [view, setView] = useState(() => saved(storageKey, props.initialDraft)), viewRef = useRef(view); viewRef.current = view
  const set = (patch: Partial<Preference>) => setView(old => ({ ...old, ...patch }))
  const [task, setTask] = useState<DeveloperTask | null>(null), taskRef = useRef(task); taskRef.current = task
  const [state, setState] = useState<WorkspaceState | null>(null), [files, setFiles] = useState<string[]>([]), [excluded, setExcluded] = useState<string[]>([])
  const [projects, setProjects] = useState<{ path: string; name: string }[]>([]), [projectPath, setProjectPath] = useState(''), [models, setModels] = useState<{ id: string; name: string }[]>([])
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [refreshing, setRefreshing] = useState(false), [updated, setUpdated] = useState(''), [epoch, setEpoch] = useState(0), [fileEpoch, setFileEpoch] = useState(0)
  const [search, setSearch] = useState(''), [matches, setMatches] = useState<{ path: string; line: number; text: string }[] | null>(null), [changed, setChanged] = useState<string[]>([]), [compareLabel, setCompareLabel] = useState('')
  const [file, setFile] = useState<FileView | null>(null), [diff, setDiff] = useState<WorkspaceDiff | null>(null), [showDiff, setShowDiff] = useState(false), [split, setSplit] = useState(false), [opened, setOpened] = useState<string[]>([]), [group, setGroup] = useState('unstaged')
  const [base, setBase] = useState(''), [selectedRound, setSelectedRound] = useState(''), [checkpoint, setCheckpoint] = useState('')
  const versionTab=view.versionTab,runTab=view.runTab,setVersionTab=(versionTab:string)=>set({versionTab}),setRunTab=(runTab:string)=>set({runTab})
  const [graph, setGraph] = useState<GraphView | null>(null), [branches, setBranches] = useState<BranchesView | null>(null), [worktrees, setWorktrees] = useState<(WorktreeListView & { tasks?: { id: string; title: string; cwd: string; running: boolean }[] }) | null>(null)
  const [commit, setCommit] = useState(''), [runId, setRunId] = useState(''), [project, setProject] = useState<(DeveloperProject & { candidates: unknown[] }) | null>(null), [showFiles, setShowFiles] = useState(false)
  const [dialog, setDialog] = useState(''), [name, setName] = useState(''), [message, setMessage] = useState(''), [preview, setPreview] = useState<CommitPreview | null>(null), [previewDiffs, setPreviewDiffs] = useState<WorkspaceDiff[]>([])
  const [restore, setRestore] = useState<{ fingerprint: string; files: { path: string; reason: string; action: string }[] } | null>(null), [settingsDirty, setSettingsDirty] = useState(false)
  const [selectedLines, setSelectedLines] = useState<{ start: number; end: number; side: 'before' | 'after' } | null>(null), [hunk, setHunk] = useState(0), codeRef = useRef<HTMLDivElement>(null)
  const [requestId] = useState(() => { const key = storageKey + '-request'; let id = sessionStorage.getItem(key); if (!id) { id = crypto.randomUUID(); sessionStorage.setItem(key, id) } return id })
  const alive = useRef(true), pending = useRef(false), sending = useRef<string | null>(null)
  const cwd = task?.cwd ?? view.cwd, running = !!task && (task.rounds.some(r => r.status === 'running') || task.checks.some(c => c.status === 'running'))
  const accept = (next: DeveloperTask) => { props.onCommit(next); if (!alive.current) return; if (taskRef.current?.id === next.id && taskRef.current.revision > next.revision) return; taskRef.current = next; setTask(next) }
  const run = async (fn: () => Promise<void>) => { if (pending.current) return; pending.current = true; setBusy(true); setError(''); try { await fn() } catch (e) { if (alive.current) setError(e instanceof Error ? e.message : String(e)) } finally { pending.current = false; if (alive.current) setBusy(false) } }
  const refresh = () => setEpoch(e => e + 1)
  const ensure = async () => {
    if (taskRef.current) return taskRef.current
    if (!cwd) throw new Error('请先选择本地项目')
    const next = await api<DeveloperTask>('create', {}, { requestId, cwd, roleId: props.roleId, roleVersion: props.roleVersion, model: view.model }); accept(next); return next
  }
  const taskAction = async (route: string, data: Record<string, unknown> = {}) => { const current = await ensure(); const next = await api<DeveloperTask>(route, {}, { id: current.id, ...data }); accept(next); refresh() }
  const chooseFile = (path: string, side = 'unstaged') => { set({ path }); setGroup(side); setSelectedLines(null); setShowFiles(false); setOpened(items => items.includes(path) ? items : [...items, path]); setHunk(0) }
  useEffect(() => { alive.current = true; void api<typeof projects>('projects').then(setProjects).catch(e => setError(e.message)); void props.loadModels().then(setModels).catch(e => setError(e.message)); return () => { alive.current = false } }, [])
  useEffect(() => { try { sessionStorage.setItem(storageKey, JSON.stringify(view)) } catch { /* Keep in-memory draft if storage is full. */ } props.onDraftChange?.(view.draft) }, [view, storageKey])
  useEffect(() => {
    let current = true
    if (taskRef.current?.id === props.taskId) return
    if (props.taskId) void api<DeveloperTask>('task', { id: props.taskId }).then(next => { if (!current) return; accept(next); const savedView = saved(storageKey); set({ ...savedView, cwd: next.cwd, draft: savedView.draft || next.draft, model: savedView.model || next.model }) }).catch(e => { if (current) setError(e.message) })
    return () => { current = false }
  }, [props.taskId])
  useEffect(() => {
    if (!task?.id || !running) return
    let stopped = false, timer: ReturnType<typeof setTimeout>
    const poll = async () => { try { const next = await api<DeveloperTask>('task', { id: task.id }); if (!stopped) accept(next) } catch (e) { if (!stopped) setError((e as Error).message) } if (!stopped) timer = setTimeout(poll, 1300) }
    timer = setTimeout(poll, 1000); return () => { stopped = true; clearTimeout(timer) }
  }, [task?.id, running])
  useEffect(() => {
    setState(null); setFiles([]); setFile(null); setDiff(null); setOpened([]); setSelectedLines(null); setUpdated('')
  }, [cwd])
  useEffect(() => {
    if (!cwd) return
    let current = true; setRefreshing(true)
    void Promise.all([api<WorkspaceState>('state', { cwd }), api<{ files: string[]; excluded: string[] }>('files', { cwd }), api<typeof project>('project', { cwd })]).then(([state, listing, config]) => {
      if (!current) return; setState(state); setFiles(listing.files); setExcluded(listing.excluded); setProject(config); setUpdated(new Date().toLocaleTimeString()); setError('')
    }).catch(e => { if (current) setError('刷新失败，保留上次内容：' + e.message) }).finally(() => { if (current) setRefreshing(false) })
    return () => { current = false }
  }, [cwd, epoch, running])
  useEffect(() => {
    if (!cwd) return
    const source = new EventSource(developerUrl('events', { cwd })); let timer: ReturnType<typeof setTimeout>
    const change = () => { clearTimeout(timer); timer = setTimeout(() => { refresh(); setFileEpoch(e => e + 1) }, 700) }
    source.addEventListener('change', change); window.addEventListener('focus', change)
    source.onerror = () => setError('实时刷新连接中断，正在重连；可手动刷新')
    return () => { clearTimeout(timer); source.close(); window.removeEventListener('focus', change) }
  }, [cwd])
  const effectiveScope = view.tab === 'versions' && versionTab === 'commits' && commit ? 'commit' : view.scope === 'uncommitted' ? group : view.scope
  useEffect(() => {
    if (!cwd) return
    let current = true
    const load = async () => {
      if (view.tab === 'develop' || view.scope === 'uncommitted') { setChanged([]); setCompareLabel('HEAD / 暂存区 / 工作目录'); return }
      if (effectiveScope === 'branch' || effectiveScope === 'commit') {
        const ref = effectiveScope === 'commit' ? commit : base
        if (!ref) { setChanged([]); return }
        const result = await api<{ files: string[]; base: string; target: string }>('compare', { cwd, ref, commit: String(effectiveScope === 'commit') }); if (current) { setChanged(result.files); setCompareLabel((result.base.slice(0, 8) || '空版本') + ' → ' + result.target.slice(0, 8)) }
      } else if (task) {
        const result = await api<{ files: string[]; label: string }>('changes', { id: task.id, scope: effectiveScope, selected: effectiveScope === 'round' ? selectedRound : checkpoint }); if (current) { setChanged(result.files); setCompareLabel(result.label) }
      } else { setChanged([]); setCompareLabel('首次发送或保存任务后记录起点') }
    }
    void load().catch(e => { if (current) setError(e.message) }); return () => { current = false }
  }, [cwd, view.tab, effectiveScope, base, commit, task?.revision, state?.fingerprint, selectedRound, checkpoint])
  useEffect(() => {
    if (!cwd || !view.path) { setFile(null); setDiff(null); return }
    let current = true
    const load = async () => {
      if (view.tab === 'develop' && !showDiff) { const data = await api<FileView>('file', { cwd, path: view.path }); if (current) { setFile(data); setDiff(null) }; return }
      const scope = view.tab === 'develop' ? group : effectiveScope
      if (['task', 'round', 'checkpoint'].includes(scope) && !task) return
      const data = await api<WorkspaceDiff>('diff', { cwd, path: view.path, scope, id: task?.id ?? '', selected: scope === 'round' ? selectedRound : checkpoint, ref: scope === 'commit' ? commit : base }); if (!data.before || !data.after || typeof data.patch !== 'string') throw new Error('差异响应无效，请重新读取'); if (current) { setDiff(data); setFile(null) }
    }
    void load().catch(e => { if (current) setError(e.message) }); return () => { current = false }
  }, [cwd, view.path, view.tab, effectiveScope, group, showDiff, fileEpoch, selectedRound, checkpoint, base, commit, task?.id])
  useEffect(() => {
    if (!cwd || view.tab !== 'versions') return
    let current = true
    void Promise.all([api<GraphView | null>('graph', { cwd }), api<BranchesView | null>('branches', { cwd }), api<typeof worktrees>('worktrees', { cwd })]).then(([a, b, c]) => { if (current) { setGraph(a); setBranches(b); setWorktrees(c) } }).catch(e => { if (current) setError(e.message) }); return () => { current = false }
  }, [cwd, view.tab, epoch])
  const addContext = (instruction = '') => {
    if (!view.path) return
    const side = selectedLines?.side ?? 'after', content = diff ? diff[side] : file
    if (!content || content.reason) return
    const lines = content.text.split('\n'), start = selectedLines?.start ?? 1, end = selectedLines?.end ?? Math.min(lines.length, 160)
    const context: DeveloperContext = { path: view.path, side, version: content.version, start, end, text: lines.slice(start - 1, end).join('\n').slice(0, 16000) }
    set({ contexts: [...view.contexts.filter(c => !(c.path === context.path && c.start === context.start && c.side === context.side)), context].slice(-12), draft: instruction ? `${instruction} ${view.path}:${start}-${end}\n${view.draft}` : view.draft, chat: true, versionTab: 'commits', runTab: 'checks' })
  }
  const send = () => void run(async () => {
    if (!view.draft.trim()) return
    const sent = view.draft, contexts = view.contexts, current = await ensure()
    sending.current ??= crypto.randomUUID()
    const next = await api<DeveloperTask>('send', {}, { id: current.id, requestId: sending.current, message: sent, contexts, model: view.model }); sending.current = null; accept(next)
    if (viewRef.current.draft === sent) set({ draft: '', contexts: [] }); refresh()
  })
  const openCommit = () => void run(async () => {
    await ensure(); const result = await api<CommitPreview>('preview', { cwd }); setPreview(result); setPreviewDiffs([]); setDialog('commit')
    const diffs = await Promise.all(result.files.filter(path => !excluded.includes(path)).map(path => api<WorkspaceDiff>('diff', { cwd, path, scope: 'staged' }))); setPreviewDiffs(diffs)
  })
  const createAt = async (root: string) => { const next = await api<DeveloperTask>('create', {}, { requestId: crypto.randomUUID(), cwd: root, roleId: props.roleId, roleVersion: props.roleVersion, model: view.model }); accept(next); set({ cwd: root, path: '', tab: 'develop', scope: 'uncommitted' }); setOpened([]); setDialog(''); refresh() }
  const latestCheck = task?.checks.at(-1), selectedCheck = task?.checks.find(c => c.id === runId) ?? latestCheck
  const statusText = (check: NonNullable<typeof latestCheck>) => ({ running: '运行中', passed: '通过', failed: '失败', stopped: '已停止', interrupted: '已中断' }[check.status]) + (check.changedDuringRun ? ' · 运行期间代码变化' : check.fingerprint !== state?.fingerprint ? ' · 当前代码待复验' : '')
  const groups = [
    { id: 'unstaged', title: '未暂存', items: state?.files.filter(f => !f.conflict && f.index !== '?' && f.worktree !== ' ') ?? [] },
    { id: 'staged', title: '已暂存', items: state?.files.filter(f => !f.conflict && f.index !== ' ' && f.index !== '?') ?? [] },
    { id: 'untracked', title: '未跟踪', items: state?.files.filter(f => f.index === '?') ?? [] },
    { id: 'conflict', title: '冲突', items: state?.files.filter(f => f.conflict) ?? [] },
  ]
  const code = (content: FileView, side: 'before' | 'after') => <div className={s.codePane}>{content.reason ? <p className={s.empty}>{content.reason} · {content.size} 字节</p> : content.text.split('\n').map((line, index) => <div className={`${s.codeLine} ${selectedLines?.side === side && index + 1 >= selectedLines.start && index + 1 <= selectedLines.end ? s.selectedLine : ''}`} key={index}><button title="点击选择行，Shift 点击扩展片段" aria-label={`选择${side === 'before' ? '旧' : '新'}版本第 ${index + 1} 行`} onClick={e => setSelectedLines(e.shiftKey && selectedLines?.side === side ? { side, start: Math.min(selectedLines.start, index + 1), end: Math.max(selectedLines.start, index + 1) } : { side, start: index + 1, end: index + 1 })}>{index + 1}</button><code>{line || ' '}</code></div>)}</div>
  const codePanel = <section className={s.code} aria-label="代码与差异">
    <div className={s.openFiles}>{opened.map(path => <span key={path}><button aria-pressed={view.path === path} onClick={() => chooseFile(path, group)}>{path.split('/').at(-1)}</button><button aria-label={'关闭文件 ' + path} onClick={() => { const next = opened.filter(p => p !== path); setOpened(next); if (view.path === path) set({ path: next.at(-1) ?? '' }) }}>×</button></span>)}</div>
    <div className={s.codeBar}><strong title={view.path}>{view.path || '选择文件'}</strong>{view.path && <><button onClick={() => { setShowDiff(!showDiff); if (view.tab !== 'develop') set({ tab: 'develop' }) }}>{view.tab === 'develop' && !showDiff ? '查看差异' : '查看代码'}</button><button onClick={() => setFileEpoch(e => e + 1)}>重新读取</button><button onClick={() => addContext()}>添加到对话</button><button onClick={() => void run(async () => { await api('open-editor', {}, { cwd, path: view.path }) })}>外部编辑器</button></>}</div>
    {diff && <div className={s.codeBar}><small>{diff.label}</small><button aria-pressed={split} onClick={() => setSplit(!split)}>{split ? '行内差异' : '左右对照'}</button><button onClick={() => { const nodes = codeRef.current?.querySelectorAll('[data-hunk]'); if (!nodes?.length) return; const next = (hunk + 1) % nodes.length; setHunk(next); nodes[next]?.scrollIntoView({ block: 'center' }) }}>下一处修改</button></div>}
    {selectedLines && <div className={s.codeBar}><small>已选 {selectedLines.start}–{selectedLines.end} 行</small>{['解释', '审查', '修改', '补测试'].map(label => <button key={label} onClick={() => addContext(label)}>{label}</button>)}</div>}
    <div className={s.codeScroll} ref={codeRef}>{file ? code(file, 'after') : diff ? diff.before.reason || diff.after.reason ? <p className={s.empty}>{diff.before.reason || diff.after.reason}</p> : split ? <div className={s.split}>{code(diff.before, 'before')}{code(diff.after, 'after')}</div> : diff.patch ? <pre className={s.patch}>{diff.patch.split('\n').map((line, index) => <span data-hunk={line.startsWith('@@') || undefined} className={line.startsWith('+') ? s.added : line.startsWith('-') ? s.removed : line.startsWith('@@') ? s.hunk : ''} key={index}>{line || ' '}<br/></span>)}</pre> : <p className={s.empty}>此比较范围内没有文本变化</p> : <p className={s.empty}>从左侧选择文件，阅读代码或审阅变化。</p>}</div>
  </section>
  const fileList = <aside className={`${s.files} ${showFiles ? s.filesOpen : ''}`} aria-label="项目文件"><div className={s.codeBar}><strong>{view.tab === 'develop' ? '项目文件' : '变更文件'}</strong><button onClick={() => setShowFiles(false)}>收起</button></div><input aria-label="搜索文件" placeholder="搜索路径或内容" value={search} onChange={e => { setSearch(e.target.value); setMatches(null) }}/><button onClick={() => void run(async () => setMatches(await api('search', { cwd, q: search })))}>搜索内容</button>
    <div className={s.fileRows}>{matches ? matches.map((m, i) => <button key={i} onClick={() => { chooseFile(m.path); set({ tab: 'develop' }); setShowDiff(false); setSelectedLines({ side: 'after', start: m.line, end: m.line }) }}>{m.path}:{m.line}<small>{m.text}</small></button>) : view.tab === 'develop' ? files.filter(path => path.toLowerCase().includes(search.toLowerCase())).map(path => <button aria-pressed={view.path === path} key={path} title={path} onClick={() => chooseFile(path)}>{path}</button>) : view.scope === 'uncommitted' && effectiveScope !== 'commit' ? groups.map(g => <div key={g.id}><h4>{g.title} · {g.items.length}</h4>{g.items.filter(f => f.path.includes(search)).map(f => <button key={f.path} aria-pressed={view.path === f.path && group === (g.id === 'staged' ? 'staged' : 'unstaged')} title={f.oldPath ? `${f.oldPath} → ${f.path}` : f.path} onClick={() => chooseFile(f.path, g.id === 'staged' ? 'staged' : 'unstaged')}><b>{f.index === '?' ? 'A' : (g.id === 'staged' ? f.index : f.worktree)}</b> {f.path}</button>)}</div>) : changed.filter(path => path.includes(search)).map(path => <button key={path} aria-pressed={view.path === path} onClick={() => chooseFile(path)}>{path}</button>)}</div>
    <small>{excluded.length} 个凭据、生成物或运行目录排除项</small>
  </aside>
  return <section className={s.workspace} data-dsh-plugin="developer-assistant">
    <header className={s.header}><div><span className={s.eyebrow}>开发工作区</span><h2>{task?.title ?? '新开发任务'}</h2></div><div className={s.actions}><button disabled={busy} onClick={() => { setName(task?.title ?? '新开发任务'); setDialog('title') }}>任务名称</button><button disabled={!cwd} onClick={() => setDialog('settings')}>项目设置</button><button aria-pressed={view.chat} onClick={() => set({ chat: !view.chat })}>对话</button></div></header>
    <div className={s.context}><button title={cwd} onClick={() => setDialog('project')}>{cwd ? cwd.split(/[\\/]/).at(-1) : '选择本地项目'}</button><button onClick={() => { set({ tab: 'versions' }); setVersionTab('branches') }}>{!cwd ? '未选择项目' : !state ? '读取 Git 状态…' : state.git ? state.branch || '分离 HEAD' : '未初始化 Git'}</button><span title={cwd}>{cwd || '绑定项目后开始阅读和开发'}</span><select aria-label="工作权限" value={task?.permission ?? 'read'} disabled={busy || !cwd} onChange={e => { const permission = e.target.value; void run(async () => { const current = await ensure(); accept(await api('settings', {}, { id: current.id, revision: current.revision, settings: { permission } })) }) }}><option value="read">只读讨论</option><option value="edit">允许编辑</option></select></div>
    <Tabs values={tabs} value={view.tab} onChange={tab => set({ tab })} label="开发助手主页签"/>
    <div className={s.refresh}><span role="status">{refreshing ? '正在刷新…' : updated ? '上次读取 ' + updated : '等待选择项目'}{state ? ` · ${state.files.length} 个变更文件` : ''}</span><button disabled={!cwd || refreshing} onClick={() => { refresh(); setFileEpoch(e => e + 1) }}>刷新</button></div>
    {error && <p role="alert" className={s.error}>{error}</p>}
    {!cwd ? <div className={s.empty}><h3>选择本地项目</h3><p>先阅读代码；需要修改时，将顶部权限切换为“允许编辑”。</p><select aria-label="已有项目" value={view.cwd} onChange={e => set({ cwd: e.target.value })}><option value="">选择已登记项目</option>{projects.map(p => <option key={p.path} value={p.path}>{p.name} · {p.path}</option>)}</select><input aria-label="本地项目路径" placeholder="输入本地项目绝对路径" value={projectPath} onChange={e => setProjectPath(e.target.value)}/><button disabled={busy || !projectPath.trim()} onClick={() => void run(async () => { const p = await api<{ path: string }>('register', {}, { cwd: projectPath }); set({ cwd: p.path }); refresh() })}>添加并打开目录</button></div> : <>
      {!state?.git && state && <div className={s.notice}>当前是普通文件夹，可以浏览和讨论。<button disabled={busy} onClick={() => { setDialog('init') }}>初始化 Git</button></div>}
      <div className={`${s.body} ${view.chat ? '' : s.noChat}`}>
        <main className={s.main}>
          {view.tab === 'changes' && <><Tabs values={scopes} value={view.scope} onChange={scope => { set({ scope }); setCheckpoint('') }} label="比较范围"/><div className={s.codeBar}><small>{compareLabel}</small>{view.scope === 'round' && <select aria-label="开发轮次" value={selectedRound} onChange={e => setSelectedRound(e.target.value)}><option value="">最新一轮</option>{task?.rounds.map((r, i) => <option key={r.id} value={r.id}>第 {i + 1} 轮 · {r.status}</option>)}</select>}{view.scope === 'branch' && <input aria-label="比较基准" placeholder="输入分支或提交，例如 main" value={base} onChange={e => setBase(e.target.value)}/>}
            {view.scope === 'uncommitted' ? <><button disabled={busy || !view.path || running} onClick={() => void run(() => taskAction('git', { command: { type: group === 'staged' ? 'unstage' : 'stage', paths: [view.path], expected: state } }))}>{group === 'staged' ? '取消暂存此文件' : '暂存整个文件'}</button><button disabled={busy || running} onClick={openCommit}>提交预览</button></> : <button onClick={() => set({ scope: 'uncommitted' })}>整理提交</button>}</div></>}
          {(view.tab === 'develop' || view.tab === 'changes') && <><button className={s.fileToggle} onClick={() => setShowFiles(!showFiles)}>文件列表</button><div className={s.editor}>{fileList}{codePanel}</div></>}
          {view.tab === 'versions' && <><Tabs label="版本页面" values={[["commits", "提交记录"], ["branches", "分支与目录"], ["checkpoints", "检查点"]]} value={versionTab} onChange={setVersionTab}/>
            {versionTab === 'commits' && <div className={s.versionGrid}><aside className={s.history}>{graph?.commits.map(c => <button key={c.oid} aria-pressed={commit === c.oid} onClick={() => { setCommit(c.oid); set({ scope: 'commit' }); chooseFile('') }}><b>{c.oid.slice(0, 7)} · {c.subject}</b><small>{c.author} · {new Date(c.authorTime * 1000).toLocaleString()}</small><small>{c.refs.join(' · ')}</small></button>)}{!graph?.commits.length && <p className={s.empty}>尚无提交记录</p>}</aside><section className={s.main}>{commit && <div className={s.codeBar}><code>{commit.slice(0, 12)}</code><button onClick={() => void navigator.clipboard.writeText(commit).catch(e => setError(e.message))}>复制标识</button><button onClick={() => { setBase(commit); set({ tab: 'changes', scope: 'branch' }) }}>设为比较起点</button><select aria-label="提交中的文件" value={view.path} onChange={e => chooseFile(e.target.value)}><option value="">选择文件</option>{changed.map(path => <option key={path}>{path}</option>)}</select></div>}{codePanel}</section></div>}
            {versionTab === 'branches' && <div className={s.scroll}><div className={s.codeBar}><h3>本地分支</h3><button disabled={busy || running} onClick={() => { setName('codex/'); setDialog('branch') }}>创建分支</button><button disabled={busy || running} onClick={() => { setName(''); setDialog('worktree') }}>创建独立目录</button></div>{branches?.branches.map(b => <div className={s.row} key={b.name}><strong>{b.name}{b.current ? ' · 当前' : ''}</strong><div><button onClick={() => { setBase(b.name); set({ tab: 'changes', scope: 'branch' }) }}>比较</button><button disabled={busy || running || b.current} onClick={() => { setName(b.name); setDialog('switch') }}>切换</button></div></div>)}<h3>工作目录</h3>{worktrees?.worktrees.map(w => <div className={s.card} key={w.path}><strong>{w.branch || '分离 HEAD'}{w.main ? ' · 主目录' : ''}</strong><p>{w.path}</p><small>{worktrees.tasks?.filter(t => t.cwd.replaceAll('\\', '/') === w.path.replaceAll('\\', '/')).map(t => t.title + (t.running ? '（运行中）' : '')).join('、') || '暂无开发任务'}</small><button disabled={busy || w.path.replaceAll('\\', '/') === cwd.replaceAll('\\', '/')} onClick={() => void run(async () => { await api('register', {}, { cwd: w.path }); await createAt(w.path) })}>在此目录新建开发任务</button></div>)}</div>}
            {versionTab === 'checkpoints' && <div className={s.scroll}><div className={s.codeBar}><h3>任务检查点</h3><button disabled={busy || running} onClick={() => { setName(''); setDialog('checkpoint') }}>新建检查点</button></div><p>保存项目文本快照，排除凭据、生成物、链接及大文件；不会创建 Git 提交。</p>{task?.checkpoints.map(c => <div className={s.row} key={c.id}><div><strong>{c.name}</strong><small>{new Date(c.at).toLocaleString()}</small></div><div><button onClick={() => { setCheckpoint(c.id); set({ tab: 'changes', scope: 'checkpoint' }) }}>与当前比较</button><button disabled={busy || running || task.permission !== 'edit'} onClick={() => void run(async () => { setCheckpoint(c.id); setRestore(await api('restore-preview', { id: task.id, checkpoint: c.id })); setDialog('restore') })}>恢复预览</button></div></div>)}</div>}
          </>}
          {view.tab === 'runs' && <><Tabs label="运行页面" values={[["checks", "验证记录"], ["output", "终端输出"], ["events", "操作轨迹"]]} value={runTab} onChange={setRunTab}/><div className={s.scroll}>
            {runTab === 'checks' && <><div className={s.codeBar}><h3>项目检查</h3><button onClick={() => setDialog('settings')}>配置命令</button>{project?.commands.map(c => <button disabled={busy || running} key={c.id} onClick={() => void run(() => taskAction('verify', { commandId: c.id, requestId: crypto.randomUUID() }))}>运行 {c.name}</button>)}</div>{!project?.commands.length && <p>尚未确认验证命令。可从项目 package.json 中选择脚本，或在项目设置中添加命令。</p>}{task?.checks.slice().reverse().map(c => <div className={s.card} key={c.id}><strong>{c.name} · {statusText(c)}</strong><code>{c.command}</code><small>{c.cwd} · 代码 {c.fingerprint.slice(0, 10)} · {new Date(c.at).toLocaleString()}</small><small>验证对象为工作目录中纳入比较的文件；凭据与生成物不计入指纹。暂存区内容需单独检查。</small><button onClick={() => { setRunId(c.id); setRunTab('output') }}>查看输出</button>{c.status === 'running' && <button disabled={busy} onClick={() => void run(() => taskAction('stop'))}>停止检查</button>}</div>)}</>}
            {runTab === 'output' && <><select aria-label="选择进程输出" value={selectedCheck?.id ?? ''} onChange={e => setRunId(e.target.value)}>{task?.checks.map(c => <option key={c.id} value={c.id}>{c.name} · {new Date(c.at).toLocaleString()}</option>)}</select>{selectedCheck ? <><p>{statusText(selectedCheck)} · 退出码 {selectedCheck.exitCode ?? '—'}</p><pre className={s.terminal}>{selectedCheck.output || '等待进程输出…'}</pre><button onClick={() => set({ chat: true, versionTab: 'commits', runTab: 'checks', draft: `请分析这次验证输出：\n${selectedCheck.command}\n${selectedCheck.output.slice(-12000)}` })}>围绕输出讨论</button></> : <p>尚无运行输出</p>}</>}
            {runTab === 'events' && task?.events.slice().reverse().map(e => <div className={s.row} key={e.id}><div><small>{new Date(e.at).toLocaleTimeString()} · {e.kind}</small><span>{e.text}</span></div>{e.path && <button onClick={() => { chooseFile(e.path!); set({ tab: 'changes', scope: 'uncommitted' }) }}>{e.path}</button>}</div>)}
          </div></>}
        </main>
        {view.chat && <aside className={s.chat} aria-label="开发对话"><div className={s.codeBar}><strong>开发对话</strong><button onClick={() => set({ chat: false })}>收起</button></div><div className={s.messages}>{task?.messages.map(m => <article className={m.role === 'user' ? s.userMessage : s.assistantMessage} key={m.id}><small>{m.role === 'user' ? '你' : '开发助手'}</small><p>{m.text}</p>{m.contexts?.map((c, i) => <details key={i}><summary>{c.path}:{c.start}–{c.end} · {c.version.slice(0, 8)}</summary><pre>{c.text}</pre></details>)}</article>)}{!task?.messages.length && <p className={s.empty}>选中代码行添加上下文，或直接描述要理解和修改的功能。</p>}{task?.rounds.at(-1) && <div className={s.execution}><strong>{running ? '正在执行' : '最近一轮：' + task.rounds.at(-1)!.status}</strong><p>{task.rounds.at(-1)?.error || task.events.at(-1)?.text}</p><button onClick={() => set({ tab: 'changes', scope: 'round' })}>查看本轮变更</button></div>}</div><div className={s.composer}><div className={s.contextChips}>{view.contexts.map((c, i) => <button key={i} title={c.text} onClick={() => set({ contexts: view.contexts.filter((_, j) => i !== j) })}>{c.path}:{c.start}–{c.end} ×</button>)}</div><textarea aria-label="开发消息" placeholder="描述要理解、修改或验证的功能…" value={view.draft} onChange={e => { sending.current = null; set({ draft: e.target.value }) }} onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); if (!busy && !running) send() } }}/><select aria-label="开发模型" value={view.model} onChange={e => set({ model: e.target.value })}><option value="">工作台默认模型</option>{models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select><div className={s.actions}><small>{task?.permission === 'edit' ? '允许项目内编辑' : '只读讨论'} · Ctrl+Enter 发送</small>{running ? <button disabled={busy} onClick={() => void run(() => taskAction('stop'))}>停止</button> : <button className={s.primary} disabled={busy || !view.draft.trim()} onClick={send}>{busy ? '处理中…' : '发送'}</button>}</div></div></aside>}
      </div>
      <footer className={s.footer}><button onClick={() => set({ tab: 'runs' })}>{running ? '执行进行中' : latestCheck ? `${latestCheck.name}：${statusText(latestCheck)}` : '尚未运行验证'}</button><span>{task ? '任务已保存' : '首次发送或操作时保存任务'}</span></footer>
    </>}
    {dialog && <Modal title={{ settings: '项目设置', title: '任务名称', project: '选择项目', commit: '提交预览', branch: '创建分支', switch: '切换分支', worktree: '独立工作目录', checkpoint: '新建检查点', restore: '恢复检查点', init: '初始化 Git' }[dialog] ?? '操作'} closeLabel="关闭开发操作" wide={dialog === 'commit' || dialog === 'settings'} onClose={() => { if (!settingsDirty || window.confirm('项目设置尚未保存，放弃本次修改？')) { setDialog(''); setSettingsDirty(false) } }}><div className={s.dialog}>
      {dialog === 'settings' && <DeveloperProjectSettings cwd={cwd} disabled={running} onEditingChange={setSettingsDirty} onSaved={() => { setSettingsDirty(false); refresh(); setDialog('') }}/>}
      {['title', 'branch', 'switch', 'worktree', 'checkpoint'].includes(dialog) && <><label>{dialog === 'branch' ? '分支名称（从当前 HEAD 创建并切换）' : dialog === 'switch' ? '即将切换到分支；此目录中其他会话也会受到影响' : '名称'}<input autoFocus aria-label="操作名称" value={name} disabled={dialog === 'switch'} onChange={e => setName(e.target.value)}/></label>{dialog === 'worktree' && <p>起点为当前 HEAD，原目录的未提交修改保留在原处。创建后会在新目录建立独立任务。</p>}<button className={s.primary} disabled={busy || !name.trim()} onClick={() => void run(async () => {
        if (dialog === 'title') { const current = await ensure(); accept(await api('settings', {}, { id: current.id, revision: current.revision, settings: { title: name } })) }
        if (dialog === 'branch' || dialog === 'switch') await taskAction('git', { command: { type: dialog, name } })
        if (dialog === 'checkpoint') await taskAction('checkpoint', { name })
        if (dialog === 'worktree') { const current = await ensure(); const result = await api<{ path: string }>('worktree', {}, { id: current.id, name, base: 'HEAD' }); await createAt(result.path) }
        setDialog(''); refresh()
      })}>确认{dialog === 'switch' ? '切换' : '保存'}</button></>}
      {dialog === 'project' && <><p>更换项目会建立新的开发任务，当前记录保留。</p>{projects.map(p => <button key={p.path} disabled={busy} onClick={() => void run(async () => { if (task) await createAt(p.path); else { set({ cwd: p.path, path: '' }); setDialog('') } })}>{p.name} · {p.path}</button>)}</>}
      {dialog === 'init' && <><p>在以下目录创建 Git 仓库：</p><code>{cwd}</code><p>现有文件不会自动暂存或提交。建议先检查 .gitignore。</p><button disabled={busy} onClick={() => void run(async () => { await api('init', {}, { cwd }); setDialog(''); refresh() })}>初始化此目录</button></>}
      {dialog === 'commit' && preview && <><p>提交到 {preview.branch || '分离 HEAD'}，完整暂存区共 {preview.files.length} 个文件。原有暂存项一并列在下方。</p><pre>{preview.patch}</pre>{preview.files.map(path => <details key={path}><summary>{path}</summary><pre className={s.patch}>{previewDiffs.find(d => d.path === path)?.patch || '正在读取或文件不支持文本预览'}</pre></details>)}<label>提交说明<textarea aria-label="提交说明" value={message} onChange={e => setMessage(e.target.value)}/></label><p>验证针对工作目录；提交前将重新检查 HEAD 和索引版本。</p><button className={s.primary} disabled={busy || !message.trim() || !preview.files.length} onClick={() => void run(async () => { await taskAction('git', { command: { type: 'commit', message, expected: preview } }); setMessage(''); setDialog('') })}>提交到当前分支</button></>}
      {dialog === 'restore' && restore && <><p>仅恢复本任务写入且之后未被改动的文件。暂存区保持原状。</p>{restore.files.map(f => <p key={f.path}>{f.action} {f.path} · {f.reason || '可恢复'}</p>)}<button disabled={busy || !restore.files.some(f => !f.reason)} onClick={() => void run(async () => { await taskAction('restore', { checkpoint, fingerprint: restore.fingerprint, paths: restore.files.filter(f => !f.reason).map(f => f.path) }); setDialog('') })}>恢复可处理的文件</button></>}
      {error && <p role="alert" className={s.error}>{error}</p>}
    </div></Modal>}
  </section>
}
