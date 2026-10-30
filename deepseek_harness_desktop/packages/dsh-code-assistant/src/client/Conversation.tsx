import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import { visibleConversation, toolResult } from '../core/conversation.mjs'
import s from './code-assistant.module.css'

export const messageTime = (value?: number | string) => value && Number.isFinite(new Date(value).getTime()) ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '时间未记录'
function CodeBlock({ text, label = '代码', command, result }: { text: string; label?: string; command?: string; result?: string }) {
  const [notice, setNotice] = useState('')
  return <div className={s.console}><div className={s.consoleHeader}><span>{label}</span>{result && <span className={s.consoleResult}>{result}</span>}<button type="button" onClick={() => { void (async () => { try { await navigator.clipboard.writeText(command === undefined ? text : [command, text].filter(Boolean).join('\n')); setNotice('已复制') } catch { setNotice('复制失败，请选择文本复制') } })() }}>复制</button></div>{command !== undefined && <pre className={s.commandText}><code>{command}</code></pre>}{text && <>{command !== undefined && <div className={s.outputLabel}>输出</div>}<pre><code>{text}</code></pre></>}{notice && <small role="status">{notice}</small>}</div>
}
function Prose({ text }: { text: string }) {
  // Render fences as text, including an unfinished streaming fence. Never execute HTML.
  const blocks: React.ReactNode[] = []; let plain: string[] = [], code: string[] | null = null, fence = '', language = ''
  const flush = () => { if (plain.length) { blocks.push(<div className={s.prose} key={blocks.length}>{plain.join('\n').split(/(`[^`\n]+`)/g).map((value, i) => value.startsWith('`') && value.endsWith('`') ? <code key={i}>{value.slice(1, -1)}</code> : value)}</div>); plain = [] } }
  for (const line of text.split('\n')) {
    const match = line.match(/^\s*(`{3,}|~{3,})(.*)$/)
    if (!code && match) { flush(); fence = match[1]!; language = match[2]!.trim(); code = []; continue }
    if (code && match && match[1]![0] === fence[0] && match[1]!.length >= fence.length && !match[2]!.trim()) { blocks.push(<CodeBlock key={blocks.length} text={code.join('\n')} label={language || '代码'}/>); code = null; continue }
    if (code) code.push(line); else plain.push(line)
  }
  if (code) blocks.push(<CodeBlock key={blocks.length} text={code.join('\n')} label={language || '代码'}/>); flush()
  return <>{blocks}</>
}
export function ToolMessage({ part }: { part: any }) {
  const state = part.state || {}, result = toolResult(part)
  const title = ({ read: '读取文件', grep: '搜索内容', glob: '查找文件', edit: '修改代码', write: '写入文件', bash: '运行命令', shell: '运行命令', todowrite: '任务计划' } as Record<string, string>)[part.tool] || part.tool
  const output = typeof state.output === 'string' ? state.output : state.output ? JSON.stringify(state.output, null, 2) : ''
  const details = <><CodeBlock label={result.command ? '终端命令' : '工具输入'} text={result.command ? String(state.input?.command || '') : JSON.stringify(state.input || {}, null, 2)}/>{(output || state.error) && <CodeBlock label={state.error ? '错误输出' : '输出'} text={String(state.error || output)}/>}<time>{messageTime(state.time?.end || state.time?.start)}</time></>
  return result.command ? <section className={s.commandResult} data-status={result.status}><CodeBlock label="终端" command={String(state.input?.command || '')} text={String(state.error || output)} result={`${result.label}${result.exit !== null ? ` · 退出码 ${result.exit}` : state.status === 'completed' ? ' · 未记录退出码' : ''}`}/><time>{messageTime(state.time?.end || state.time?.start)}</time></section> : <details className={s.tool} data-status={result.status}><summary>{title} · {result.label}<small>{state.title || state.input?.filePath || ''}</small></summary>{details}</details>
}
function Message({ message }: { message: any }) {
  return <article className={s.message} data-role={message.info?.role}><strong>{message.info?.role === 'user' ? '你' : '代码助手'}</strong>{(message.parts || []).map((part: any, i: number) => part.type === 'text' ? <Prose text={part.text || ''} key={part.id || i}/> : part.type === 'tool' ? <ToolMessage part={part} key={part.id || i}/> : part.type === 'reasoning' ? <details className={s.reasoning} key={part.id || i}><summary>思考过程</summary><Prose text={part.text || ''}/></details> : part.type === 'file' ? <p key={part.id || i}>附件：{part.filename || part.mime || '文件'}</p> : null)}{message.info?.error && <p className={s.error}>{message.info.error.data?.message || message.info.error.name}</p>}<time>{messageTime(message.info?.time?.completed || message.info?.time?.created)}</time></article>
}
type Props = { task: { id: string; messages: any[]; status: string; permissions: any[]; removedQuestionIds?: string[] } | null; onChangeQuestion: (id: string, removed: boolean) => Promise<void>; removeIcon?: React.ReactNode; disabled?: boolean; selected: string; jump: number; onSelect: (id: string) => void; evidence?: React.ReactNode }
export function Conversation({ task, selected, jump, onSelect, evidence, onChangeQuestion, removeIcon, disabled }: Props) {
  const [query, setQuery] = useState(''), [directoryOpen, setDirectoryOpen] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null), [changeError, setChangeError] = useState(''), [changing, setChanging] = useState(false)
  const scroll = useRef<HTMLDivElement>(null), navigation = useRef<HTMLDivElement>(null), directoryButton = useRef<HTMLButtonElement>(null), search = useRef<HTMLInputElement>(null), nodes = useRef(new Map<string, HTMLElement>()), directoryId = useId()
  const following = useRef(true)
  const { rounds, unassigned } = useMemo(() => visibleConversation(task), [task?.messages, task?.status, task?.removedQuestionIds])
  const current = rounds.find(q => q.id === selected) || rounds.at(-1), index = current ? rounds.indexOf(current) : -1
  const rows = rounds.filter(q => q.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  useEffect(() => { setQuery(''); setDirectoryOpen(false); setRemoving(null); setChangeError(''); following.current = true }, [task?.id])
  useEffect(() => {
    if (!directoryOpen) return
    search.current?.focus()
    const close = (event: PointerEvent) => { if (!removing && !navigation.current?.contains(event.target as Node)) setDirectoryOpen(false) }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [directoryOpen, removing])
  const change = async (id: string, removed: boolean) => {
    if (changing || disabled) return
    setChanging(true); setChangeError('')
    try { await onChangeQuestion(id, removed); setRemoving(null) }
    catch (error) { setChangeError(error instanceof Error ? error.message : String(error)) }
    finally { setChanging(false) }
  }
  const undoId = task?.removedQuestionIds?.at(-1)
  const select = (id: string) => { onSelect(id); setDirectoryOpen(false); if (directoryOpen) directoryButton.current?.focus() }
  useEffect(() => { const el = current && nodes.current.get(current.id), box = scroll.current; if (el && box) box.scrollTop += el.getBoundingClientRect().top - box.getBoundingClientRect().top }, [task?.id, current?.id, jump])
  useEffect(() => {
    const box = scroll.current
    if (box && task?.status === 'running' && index === rounds.length - 1 && following.current) box.scrollTop = box.scrollHeight
  }, [task?.messages, task?.status])
  return <>
    {rounds.length > 0 && <div className={s.questionToolbar} ref={navigation} onKeyDown={event => { if (event.key === 'Escape' && directoryOpen) { event.preventDefault(); if (!changing) { setRemoving(null); setDirectoryOpen(false); directoryButton.current?.focus() } } }}>
      <button type="button" ref={directoryButton} aria-expanded={directoryOpen} aria-controls={directoryId} onClick={() => setDirectoryOpen(value => !value)}>问题目录 · {rounds.length}</button>
      <span className={s.currentQuestion} title={current?.title}>{current?.title}</span><span className={s.questionCount}>{index + 1} / {rounds.length}</span>
      <button type="button" disabled={index <= 0} aria-label="上一问" title="上一问" onClick={() => select(rounds[index - 1]!.id)}>‹</button><button type="button" disabled={index >= rounds.length - 1} aria-label="下一问" title="下一问" onClick={() => select(rounds[index + 1]!.id)}>›</button>
      {index < rounds.length - 1 && <button type="button" className={s.latestQuestion} onClick={() => select(rounds.at(-1)!.id)}>回到最新</button>}
      {directoryOpen && <nav id={directoryId} className={`${s.questionIndex} ${s.questionPopover}`} aria-label="本次对话的问题目录"><div><strong>本次提问 · {rounds.length}</strong><button type="button" aria-label="关闭问题目录" onClick={() => { setDirectoryOpen(false); directoryButton.current?.focus() }}>×</button></div><input ref={search} type="search" aria-label="搜索本次提问" placeholder="找一下我问过什么…" value={query} onChange={e => setQuery(e.target.value)}/><div className={s.questionList}>{rows.map(q => <div className={s.questionItem} key={q.id}><button type="button" disabled={changing} aria-label={`第 ${q.index} 问：${q.title}`} aria-current={current?.id === q.id ? 'true' : undefined} onClick={() => select(q.id)}><span>{q.index}</span><span>{q.title}</span><small data-status={q.status}>{q.statusLabel}</small></button><button type="button" className={s.removeQuestion} aria-label={`移除提问：${q.title}`} title={disabled ? '当前操作完成后可移除' : '移除提问'} disabled={disabled || changing} onClick={() => { setChangeError(''); setRemoving(q.id) }}>{removeIcon || '移除'}</button></div>)}{!rows.length && <p>没有匹配的问题</p>}</div>{removing && <div className={s.questionConfirm} role="group" aria-label="确认移除提问"><strong>移除这次提问？</strong><p>该提问及回答将从对话中隐藏，可撤销。已执行的代码修改保留。</p>{changeError && <p role="alert">{changeError}</p>}<div><button type="button" disabled={changing} onClick={() => { setRemoving(null); setChangeError('') }}>取消</button><button type="button" className={s.questionDanger} disabled={disabled || changing} onClick={() => void change(removing, true)}>{changing ? '正在移除…' : '移除提问'}</button></div></div>}</nav>}
    </div>}
    {undoId && <div className={s.questionUndo} role="status"><span>已移除 {task!.removedQuestionIds!.length} 次提问</span><button type="button" disabled={disabled || changing} onClick={() => void change(undoId, false)}>撤销移除提问</button></div>}
    {changeError && !removing && <p className={s.error} role="alert">{changeError}</p>}
    <div className={s.messages} ref={scroll} aria-label="连续对话内容" onScroll={() => { const box = scroll.current; if (box) following.current = box.scrollHeight - box.scrollTop - box.clientHeight < 72 }}>
      {!task?.messages?.length && <div className={s.intro}><h3>从一个具体问题开始</h3><p>说明要修复的问题或新增的功能。修改和命令会先展示审批。</p></div>}
      {!!task?.messages?.length && !rounds.length && !unassigned.length && <div className={s.intro}><p>本次提问已全部移除，可撤销或继续提问。</p></div>}
      {evidence}
      {unassigned.length > 0 && <details className={s.reasoning}><summary>未关联到问题的历史消息（{unassigned.length}）</summary>{unassigned.map((m, i) => <Message key={m.info?.id || i} message={m}/>)}</details>}
      {rounds.map(q => <section className={s.questionRound} data-question-id={q.id} data-selected={q.id === current?.id} ref={node => { if (node) nodes.current.set(q.id, node); else nodes.current.delete(q.id) }} key={q.id}><div className={s.roundHeading}><span>第 {q.index} 问</span><small data-status={q.status}>{q.statusLabel}</small></div>{q.messages.map((m, i) => <Message key={m.info?.id || i} message={m}/>)}</section>)}
      {task?.status === 'running' && <p className={s.working} role="status">{task.permissions.length ? '等待你审批下面的操作' : '正在处理任务…'}</p>}
    </div>
  </>
}
