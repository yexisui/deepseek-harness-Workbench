import React, { useEffect, useMemo, useRef, useState } from 'react'
import s from './task-history.module.css'
import type { QuestionSummary } from '../core/conversation.mjs'

export type TaskSummary = { id: string; title: string; cwd?: string; status: string; updatedAt?: string; questions?: QuestionSummary[] }
export type HistoryItem = { kind: 'task'; id: string; title: string } | { kind: 'project'; cwd: string; title: string }
export type HistoryState = { tasks: TaskSummary[]; removedProjects: { cwd: string; removedAt: string; count: number }[]; removedTasks: (TaskSummary & { removedAt: string })[] }
export type HistoryModalProps = { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean; closeLabel: string; className?: string; closeDisabled?: boolean }
type Props = {
  Modal: React.ComponentType<HistoryModalProps>; removeIcon?: React.ReactNode;
  history: HistoryState; currentCwd: string; currentTaskId?: string; running: boolean;
  undo: HistoryItem | null; onUndoChange: (item: HistoryItem | null) => void;
  onClose: () => void; onOpen: (id: string, questionId?: string) => Promise<boolean>;
  onRemove: (item: HistoryItem) => Promise<void>; onRestore: (item: HistoryItem) => Promise<void>;
}
const ALL = 'all', UNKNOWN = 'unknown'
export const projectKey = (path: string) => {
  const normalized = path.replaceAll('\\', '/').replace(/\/+$/, '') || '/'
  return /^[a-z]:\//i.test(path.replaceAll('\\', '/')) || path.startsWith('\\\\') ? normalized.toLowerCase() : normalized
}
const groupKey = (path?: string) => path ? projectKey(path) : UNKNOWN
const folderName = (path: string) => path.replaceAll('\\', '/').replace(/\/+$/, '').split('/').at(-1) || path
const projectItem = (cwd: string): HistoryItem => ({ kind: 'project', cwd, title: cwd ? folderName(cwd) : '未关联项目' })
const taskItem = (row: TaskSummary): HistoryItem => ({ kind: 'task', id: row.id, title: row.title || '新代码任务' })
const sameItem = (a: HistoryItem | null, b: HistoryItem) => a?.kind === b.kind && (a.kind === 'project' && b.kind === 'project' ? groupKey(a.cwd) === groupKey(b.cwd) : a.kind === 'task' && b.kind === 'task' && a.id === b.id)
const statusNames: Record<string, string> = { idle: '准备就绪', running: '正在执行', done: '已完成', stopped: '已停止', failed: '执行失败', interrupted: '已中断' }
const taskTime = (value?: string) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '时间未记录'
function FolderIcon({ all = false }: { all?: boolean }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{all ? <><path d="m12 3 10 5-10 5L2 8Z"/><path d="m2 12 10 5 10-5M2 16l10 5 10-5"/></> : <path d="M3 7V5h6l2 2h10v13H3Z"/>}</svg>
}

export function TaskHistory({ Modal, removeIcon, history, currentCwd, currentTaskId, running, undo, onUndoChange, onClose, onOpen, onRemove, onRestore }: Props) {
  const { tasks, removedProjects, removedTasks } = history
  const [project, setProject] = useState(currentCwd || ALL), [query, setQuery] = useState(''), [trash, setTrash] = useState(false)
  const [view, setView] = useState<'conversations' | 'questions'>('conversations')
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const [removing, setRemoving] = useState<HistoryItem | null>(null)
  const mounted = useRef(true), pending = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const hidden = new Set(removedProjects.map(row => groupKey(row.cwd)))
  const requestedKey = project === ALL || project === UNKNOWN ? project : groupKey(project)
  const key = hidden.has(requestedKey) ? ALL : requestedKey
  const groups = useMemo(() => {
    const removed = new Set(removedProjects.map(row => groupKey(row.cwd)))
    const result = new Map<string, { key: string; path: string; count: number; running: boolean }>()
    const add = (path: string) => { const id = groupKey(path); if (removed.has(id)) return; if (!result.has(id)) result.set(id, { key: id, path, count: 0, running: false }); return result.get(id)! }
    if (currentCwd) add(currentCwd)
    for (const row of tasks) { const group = add(row.cwd || ''); if (group) { group.count++; group.running ||= row.status === 'running' } }
    for (const row of removedTasks) add(row.cwd || '')
    if (project !== ALL) add(project === UNKNOWN ? '' : project)
    return [...result.values()]
  }, [tasks, removedTasks, removedProjects, currentCwd, project])
  const selectedGroup = groups.find(group => group.key === key)
  const match = (text: string) => text.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
  const projectTasks = tasks.filter(row => key === ALL || groupKey(row.cwd) === key)
  const rows = projectTasks.filter(row => match([row.title || '新代码任务', ...(row.questions || []).map(q => q.title)].join(' ')))
  const questions = projectTasks.flatMap(task => (task.questions || []).map(question => ({ task, question }))).filter(row => match(row.question.title)).sort((a, b) => (b.question.createdAt || 0) - (a.question.createdAt || 0))
  const trashRows = [
    ...removedProjects.map(row => ({ item: projectItem(row.cwd), cwd: row.cwd, removedAt: row.removedAt, detail: `${row.count} 条任务随项目恢复` })),
    ...removedTasks.map(row => ({ item: taskItem(row), cwd: row.cwd, removedAt: row.removedAt, detail: '任务记录' }))
  ].sort((a,b) => b.removedAt.localeCompare(a.removedAt)).filter(row => match(row.item.title + ' ' + (row.cwd || '')))
  const trashCount = removedProjects.length + removedTasks.length
  const act = async (fn: () => Promise<void>) => {
    if (pending.current) return
    pending.current = true; setBusy(true); setError('')
    try { await fn() } catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : String(cause)) }
    finally { pending.current = false; if (mounted.current) setBusy(false) }
  }
  const restore = (item: HistoryItem) => act(async () => { await onRestore(item); if (mounted.current) { setNotice(`已恢复「${item.title}」`); if (sameItem(undo, item)) onUndoChange(null) } })
  const switchProject = (path: string) => { setProject(path); setQuery(''); setError(''); setNotice('') }
  const switchTrash = (next: boolean) => { setTrash(next); setQuery(''); setError(''); setNotice('') }
  const askRemove = (item: HistoryItem) => { setError(''); setRemoving(item) }
  return <>
    <Modal title={trash ? '回收站' : '任务记录'} wide className={s.historyDialog} closeLabel="关闭任务记录" closeDisabled={busy} onClose={onClose}>
      <div className={trash ? s.trashBody : s.body}>
        {!trash && <nav className={s.projects} aria-label="按项目查看任务">
          <div className={s.projectsHeading}><span>项目</span><span>{groups.length}</span></div>
          <button type="button" className={s.project} aria-pressed={key === ALL} disabled={busy} onClick={() => switchProject(ALL)}><FolderIcon all/><span className={s.projectCopy}><strong>全部项目</strong><small>所有开发任务</small></span><span className={s.count}>{tasks.length}</span></button>
          {groups.map(group => <div className={s.projectRow} key={group.key} data-selected={key === group.key}>
            <button type="button" className={s.project} aria-label={group.path ? `项目：${group.path}` : '未关联项目'} title={group.path || '旧记录未保存项目路径'} aria-pressed={key === group.key} disabled={busy} onClick={() => switchProject(group.path || UNKNOWN)}><FolderIcon/><span className={s.projectCopy}><strong>{group.path ? folderName(group.path) : '未关联项目'}</strong><small>{group.path || '旧任务记录'}</small></span><span className={s.count}>{group.count}</span></button>
            <button type="button" className={s.remove} aria-label={`移除项目：${group.path || '未关联项目'}`} title={group.running ? '项目有任务运行中，结束后可移除' : '移除项目'} disabled={busy || group.running} onClick={() => askRemove(projectItem(group.path))}>{removeIcon || '移除'}</button>
          </div>)}
        </nav>}
        <main className={s.records}>
          <div className={s.recordsHeading}><div><h3>{trash ? '已移除的项目与任务' : key === ALL ? '全部项目' : selectedGroup?.path ? folderName(selectedGroup.path) : '未关联项目'}</h3>{!trash && currentCwd && key === groupKey(currentCwd) && <span className={s.current}>当前项目</span>}</div><p title={trash ? undefined : selectedGroup?.path}>{trash ? '恢复项目后，单独移除的任务仍留在回收站。项目文件始终保留。' : key === ALL ? '按更新时间查看所有项目的任务' : selectedGroup?.path || '这些旧记录没有项目路径'}</p></div>
          <label className={s.search}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10" cy="10" r="6.5"/><path d="m15 15 6 6"/></svg><input type="search" aria-label={trash ? '搜索回收站' : '搜索任务记录'} value={query} onChange={event => setQuery(event.target.value)} placeholder={trash ? '搜索项目或任务' : key === ALL ? '搜索所有项目的任务' : '搜索当前项目的任务'} /></label>
          {error && !removing && <p className={s.error} role="alert">{error}</p>}
          {!trash && <div className={s.viewTabs} aria-label="记录查看方式"><button type="button" aria-pressed={view === 'conversations'} onClick={() => setView('conversations')}>按对话</button><button type="button" aria-pressed={view === 'questions'} onClick={() => setView('questions')}>按问题</button></div>}
          <div className={s.listHeading}><span aria-live="polite">{trash ? `${trashRows.length} 项` : view === 'questions' ? `${questions.length} 个问题` : `${rows.length} 条记录 · ${rows.reduce((n, row) => n + (row.questions?.length || 0), 0)} 个问题`}</span><span>{trash ? '最近移除' : view === 'questions' ? '最近提问' : '最近更新'}</span></div>
          <div className={s.list}>
            {trash ? trashRows.map(row => <article className={s.task} key={row.item.kind + (row.item.kind === 'project' ? groupKey(row.item.cwd) : row.item.id)}>
              <div className={s.taskCopy}><strong><span className={s.kind}>{row.item.kind === 'project' ? '项目' : '任务'}</span>{row.item.title}</strong><div className={s.meta}><span>{row.detail}</span><time dateTime={row.removedAt}>{taskTime(row.removedAt)}</time></div><small className={s.taskProject} title={row.cwd}>{row.cwd || '未关联项目'}</small></div>
              <button type="button" className={s.open} disabled={busy} aria-label={`恢复${row.item.kind === 'project' ? '项目' : '任务'}：${row.item.kind === 'project' ? row.item.cwd || '未关联项目' : row.item.title}`} onClick={() => void restore(row.item)}>恢复</button>
            </article>) : view === 'questions' ? questions.map(({ task: row, question: q }) => <article className={s.task} key={row.id + ':' + q.id}>
              <div className={s.taskCopy}><strong>第 {q.index} 问 · {q.title}</strong><div className={s.meta}><span className={s.taskStatus} data-status={q.status}>{q.statusLabel}</span><time>{q.createdAt ? new Date(q.createdAt).toLocaleString('zh-CN', { hour12: false }) : '时间未记录'}</time></div><small className={s.taskProject} title={row.cwd}>{row.title} · {row.cwd || '未关联项目'}</small></div>
              <button type="button" className={s.open} aria-label={`定位问题：${q.title}`} disabled={busy || (running && row.id !== currentTaskId)} onClick={() => void act(async () => { if (await onOpen(row.id, q.id)) onClose() })}>定位</button>
            </article>) : rows.map(row => <article className={s.task} key={row.id}>
              <div className={s.taskCopy}><strong>{row.title || '新代码任务'}</strong><div className={s.meta}><span className={s.taskStatus} data-status={row.status}>{statusNames[row.status] || row.status || '状态未记录'}</span><time dateTime={row.updatedAt}>{taskTime(row.updatedAt)}</time><span>{row.questions?.length || 0} 个问题</span>{row.id === currentTaskId && <span>当前任务</span>}</div>{key === ALL && <small className={s.taskProject} title={row.cwd}>{row.cwd || '未关联项目'}</small>}</div>
              <div className={s.actions}><button type="button" className={s.open} aria-label={`打开任务：${row.title}`} disabled={busy || (running && row.id !== currentTaskId)} title={running && row.id !== currentTaskId ? '当前任务运行中，结束后可切换' : '打开任务'} onClick={() => void act(async () => { if (await onOpen(row.id)) onClose() })}>打开</button><button type="button" className={s.remove} aria-label={`移除任务记录：${row.title}`} disabled={busy || row.status === 'running'} title={row.status === 'running' ? '任务运行中，结束后可移除' : '移除任务记录'} onClick={() => askRemove(taskItem(row))}>{removeIcon || '移除'}</button></div>
            </article>)}
            {!(trash ? trashRows.length : view === 'questions' ? questions.length : rows.length) && <div className={s.empty}><FolderIcon/><p>{view === 'questions' && !trash ? query.trim() ? '没有找到匹配的问题' : '这些对话还没有保存的用户提问' : query.trim() ? trash ? '没有找到匹配的项目或任务' : '没有找到匹配的任务' : trash ? '回收站是空的' : '这个项目还没有任务记录'}</p></div>}
          </div>
        </main>
      </div>
      <footer className={s.footer}><span role="status">{notice || (trash ? '可随时恢复移除的项目与任务' : '选择任务可继续查看')}</span>{!trash && undo && <button type="button" className={s.open} disabled={busy} onClick={() => void restore(undo)}>撤销移除</button>}<button type="button" className={s.trashButton} aria-label={trash ? '返回任务记录' : '回收站'} disabled={busy} onClick={() => switchTrash(!trash)}>{!trash && removeIcon}{trash ? '返回任务记录' : `回收站${trashCount ? ` (${trashCount})` : ''}`}</button><button type="button" disabled={busy} onClick={onClose}>关闭</button></footer>
    </Modal>
    {removing && <Modal title={removing.kind === 'project' ? '移除这个项目？' : '移除这条记录？'} className={s.confirmDialog} closeLabel="取消移除" closeDisabled={busy} onClose={() => { setRemoving(null); setError('') }}>
      <div className={s.confirmBody}><strong>{removing.title}</strong><p>{removing.kind === 'project' ? '项目及其任务记录将移入回收站，可随时恢复。磁盘项目文件、Git 提交和已有对话内容保留。' : '这条任务记录将移入回收站，可随时恢复。项目文件、Git 提交和已有对话内容保留。'}</p>{error && <p className={s.error} role="alert">{error}</p>}</div>
      <footer className={s.footer}><button type="button" disabled={busy} onClick={() => { setRemoving(null); setError('') }}>取消</button><button type="button" className={s.danger} disabled={busy} onClick={() => void act(async () => { await onRemove(removing); if (mounted.current) { onUndoChange(removing); setNotice(`已移入回收站：「${removing.title}」`); if (removing.kind === 'project' && key === groupKey(removing.cwd)) setProject(ALL); setRemoving(null) } })}>{busy ? '正在移除…' : removing.kind === 'project' ? '移除项目' : '移除记录'}</button></footer>
    </Modal>}
  </>
}
