import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ComponentType, type ReactNode } from 'react'
import { LocalConversationRows, type ConversationHistoryRow } from './LocalConversationRows.tsx'
import { RoleAppearanceIcon } from './RoleAppearance.tsx'
import { capabilityClient } from './capability-client.ts'
import { Modal } from './PreviewModal.tsx'
import { allocateHistoryNumbers, defaultHistoryPreferences, historyRole, nativeHistoryRows, readHistoryStorage, saveHistoryStorage, searchHistory, shortHistoryTime, sortHistory, type HistoryPreferences, type NumberLedger } from './conversation-history.ts'
import s from './AssistantHistory.module.css'

const PREFS = 'workbench-sidebar-preferences-v1', NUMBERS = 'workbench-sidebar-numbers-v1'
function Icon({ kind }: { kind: 'search' | 'clear' | 'time' | 'number' | 'asc' | 'desc' | 'plus' | 'chevron' }) {
  return <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{kind === 'search' ? <><circle cx="8.5" cy="8.5" r="5.5"/><path d="m13 13 4 4"/></> : kind === 'clear' ? <path d="m5 5 10 10M15 5 5 15"/> : kind === 'time' ? <><circle cx="10" cy="10" r="7"/><path d="M10 6v4l3 2"/></> : kind === 'number' ? <><path d="M9 5h8M9 10h8M9 15h8M3 3h1v5M3 12c2-2 3 0 1 2l-1 2h2"/></> : kind === 'plus' ? <path d="M10 4v12M4 10h12"/> : kind === 'chevron' ? <path d="m7 5 5 5-5 5"/> : <><path d={kind === 'asc' ? 'M6 16V4m-3 3 3-3 3 3' : 'M6 4v12m-3-3 3 3 3-3'}/><path d="M12 5h5M12 10h4M12 15h2"/></>}</svg>
}
export function AssistantHistory({ Original, browser, rows, activeId, onOpen, onRename, onRemove, onNew, onFork, historyStatus, ready }: {
  Original: ComponentType<any>; browser: any; rows: ConversationHistoryRow[]; activeId: string | null
  onFork: (id:string) => Promise<void>; onOpen: (id: string) => void; onRename: (id: string, title: string) => Promise<void>; onRemove: (id: string) => void; onNew: (role?: string) => void; historyStatus?: ReactNode; ready: boolean
}) {
  const capabilities = useSyncExternalStore(capabilityClient.subscribe, capabilityClient.getSnapshot)
  const roles = capabilities.data?.state.roles ?? []
  const list = browser.useSessions((value: any) => value)
  const pendingInteractions = browser.useSessionPendingInteraction?.((value: any) => value)
  const workspaces = browser.useWorkspaces?.((value: any) => value) ?? { items: [], archivedSessionIds: [] }
  const [query, setQuery] = useState('')
  const [archived, setArchived] = useState<Record<string, boolean>>(() => readHistoryStorage('workbench-special-archives-v1', {}))
  const [showArchived, setShowArchived] = useState(false)
  const setArchive = (id: string, value: boolean) => {
    const next = { ...archived }; if (value) next[id] = true; else delete next[id]
    localStorage.setItem('workbench-special-archives-v1', JSON.stringify(next)); setArchived(next)
  }
  const visibleRows = rows.filter(row => !archived[row.id])
  const [contentHits, setContentHits] = useState<{ query: string; items: { sessionId: string; snippet: string }[]; pending?: boolean; hasMore?: boolean; error?: boolean }>({ query: '', items: [] })
  const [preferences, setPreferences] = useState<HistoryPreferences>(() => {
    const saved = readHistoryStorage(PREFS, defaultHistoryPreferences)
    return { sort: saved.sort === 'number' ? 'number' : 'time', direction: saved.direction === 'asc' ? 'asc' : 'desc', expanded: saved.expanded && typeof saved.expanded === 'object' ? saved.expanded : {} }
  })
  const [numbers, setNumbers] = useState<NumberLedger>(() => readHistoryStorage(NUMBERS, {}))
  const [host, setHost] = useState<HTMLDivElement | null>(null)
  const searchInput = useRef<HTMLInputElement>(null)
  const nativeSaved = useMemo(() => nativeHistoryRows(list, workspaces.items, [], roles), [list, workspaces, roles])
  const native = useMemo(() => nativeSaved.filter(row => !workspaces.archivedSessionIds.includes(row.nativeId)).map(row => ({ ...row, pendingInteraction: ({ approval: '等待审批', 'plan-review': '等待确认方案', question: '等待回答' } as Record<string, string>)[pendingInteractions?.get(row.nativeId)?.kind] })), [nativeSaved, workspaces, pendingInteractions])
  const all = useMemo(() => [...visibleRows, ...native], [rows, native, archived])
  const assistantRows = all.filter(row => row.role !== 'chat')
  const current = activeId ?? (list.current ? `session:${list.current}` : null)
  const selectedRole = all.find(row => row.id === current)?.role
  // Archive hides a row without deleting it; numbering must include the full saved inventory.
  useEffect(() => { if (ready && capabilities.data && (!list.phase || list.phase === 'ready')) setNumbers(previous => allocateHistoryNumbers(previous, [...rows, ...nativeSaved])) }, [rows, nativeSaved, ready, list.phase, capabilities.data])
  useEffect(() => { saveHistoryStorage(NUMBERS, numbers) }, [numbers])
  useEffect(() => { saveHistoryStorage(PREFS, preferences) }, [preferences])
  useEffect(() => {
    if (selectedRole && selectedRole !== 'chat') setPreferences(previous => previous.expanded[selectedRole] === true ? previous : { ...previous, expanded: { ...previous.expanded, [selectedRole]: true } })
  }, [selectedRole, current])
  const nativeAssistantIds = new Set(native.filter(row => row.role !== 'chat').map(row => row.nativeId))
  const filteredList = useMemo(() => ({ ...list, ids: (list.ids ?? Object.keys(list.byId ?? {})).filter((id: string) => !nativeAssistantIds.has(id)), byId: Object.fromEntries(Object.entries(list.byId ?? {}).filter(([id]) => !nativeAssistantIds.has(id))) }), [list, native])
  const useFreeSessions = useCallback((select: (value: any) => any) => select(filteredList), [filteredList])
  const searching = Boolean(query.trim())
  useEffect(() => {
    const text = query.trim()
    if (!text || !browser.searchSessions) { setContentHits({ query: text, items: [] }); return }
    const controller = new AbortController()
    setContentHits({ query: text, items: [], pending: true })
    const timer = setTimeout(() => {
      browser.searchSessions(text, controller.signal).then((result: { items: { sessionId: string; snippet: string }[]; hasMore: boolean }) => { if (!controller.signal.aborted) setContentHits({ query: text, ...result }) }).catch(() => { if (!controller.signal.aborted) setContentHits({ query: text, items: [], error: true }) })
    }, 200)
    return () => { clearTimeout(timer); controller.abort() }
  }, [query, browser.searchSessions])
  const remoteMatches = contentHits.query === query.trim() ? contentHits.items : []
  const hitMap = new Map(searchHistory(all, query, roles).map(row => [row.id, row]))
  for (const match of remoteMatches) { const row = native.find(row => row.nativeId === match.sessionId); if (row) hitMap.set(row.id, row) }
  const hits = sortHistory([...hitMap.values()], { sort: 'time', direction: 'desc' }, numbers)
  const roleIds = [...new Set([...roles.map(role => role.id), ...assistantRows.map(row => row.role)])].filter(id => assistantRows.some(row => row.role === id))
  const title = (row: ConversationHistoryRow) => [row.title, row.workspace, Number.isFinite(row.updatedAt) ? new Date(row.updatedAt).toLocaleString('zh-CN') : ''].filter(Boolean).join('\n')
  const open = (id: string) => { const row = all.find(r => r.id === id); row?.nativeId ? browser.open(row.nativeId) : onOpen(id) }
  const rename = async (id: string, name: string) => { const row = all.find(r => r.id === id); if (row?.nativeId) await browser.renameSession(row.nativeId, name); else await onRename(id, name) }
  const fork = async (id: string) => { const row = all.find(r => r.id === id); if (row?.nativeId) await browser.forkSession(row.nativeId); else await onFork(id) }
  const archive = async (id: string) => { const row = all.find(r => r.id === id); if (row?.nativeId) await browser.archiveSession(row.nativeId); else setArchive(id, true) }
  const renderRows = (items: ConversationHistoryRow[], search = false) => <LocalConversationRows host={null} label="" rows={items} activeId={current} onOpen={open} onRename={rename} onRemove={onRemove} inline hideTypeBadge query={search ? query : ''} onFork={fork} canFork={() => true} onArchive={archive}
    stackedMeta rowTitle={title} rowLeading={row => row.kind !== 'draft' ? <span className={s.number}>{numbers[row.role]?.[row.id] ? `${numbers[row.role][row.id]}.` : '—'}</span> : null}
    rowMeta={row => search ? [historyRole(row.role, roles, all).name, row.workspace, shortHistoryTime(row.updatedAt)].filter(Boolean).join(' · ') : row.kind === 'draft' ? row.draft.trim() ? '草稿' : '临时' : shortHistoryTime(row.updatedAt)} searchResult={search}/>
  const ungroupedLabel = browser.t('actions.newSession.aria', { name: '自由聊天' })
  if (browser.wide === false) return <Original {...browser}/>
  return <section className={s.root} aria-label="对话导航" data-history-ready={ready && list.phase === 'ready' && Boolean(capabilities.data)}>
    <div className={s.search}><Icon kind="search"/><input ref={searchInput} aria-label="搜索对话" placeholder="搜索对话…" maxLength={200} value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') { setQuery(''); event.stopPropagation() } }}/>{query && <button type="button" aria-label="清空搜索" title="清空搜索" onClick={() => { setQuery(''); searchInput.current?.focus() }}><Icon kind="clear"/></button>}</div>
    <div className={s.scroll}>
      <div className={s.normal} hidden={searching}>
        <div ref={setHost} className={s.workspace} onClickCapture={event => {
          const button = (event.target as HTMLElement).closest('button[aria-label]')
          if (!button || button.getAttribute('aria-label') !== ungroupedLabel) return
          event.preventDefault(); event.stopPropagation(); onNew('chat')
          const group = button.closest('[role="treeitem"]'); if (group?.getAttribute('aria-expanded') === 'false') (group as HTMLElement).click()
        }}><Original {...browser} useSessions={useFreeSessions} t={(key: string, ...args: unknown[]) => key === 'group.ungrouped' ? '自由聊天' : browser.t(key, ...args)}/><LocalConversationRows host={host} label={ungroupedLabel} rows={visibleRows.filter(row => row.role === 'chat')} activeId={activeId} onOpen={onOpen} onRemove={onRemove} onRename={onRename} onFork={fork} canFork={() => true} onArchive={archive} fallbackLabel="自由聊天"/></div>
        <div className={s.heading}><span>助手专区</span><div className={s.actions}>
          <button type="button" title={`当前按${preferences.sort === 'time' ? '时间' : '序号'}排序，点击切换`} aria-label={`排序方式：${preferences.sort === 'time' ? '时间' : '序号'}`} onClick={() => setPreferences(p => ({ ...p, sort: p.sort === 'time' ? 'number' : 'time' }))}><Icon kind={preferences.sort === 'time' ? 'time' : 'number'}/></button>
          <button type="button" title={preferences.sort === 'time' ? preferences.direction === 'desc' ? '最新在前，点击切换' : '最早在前，点击切换' : preferences.direction === 'desc' ? '大号在前，点击切换' : '小号在前，点击切换'} aria-label={`排序方向：${preferences.direction === 'desc' ? '降序' : '升序'}`} onClick={() => setPreferences(p => ({ ...p, direction: p.direction === 'desc' ? 'asc' : 'desc' }))}><Icon kind={preferences.direction}/></button>
        </div></div>
        {!roleIds.length && <p className={s.empty}>助手对话会显示在这里</p>}
        {roleIds.map((id, index) => {
          const role = historyRole(id, roles, all), items = sortHistory(assistantRows.filter(row => row.role === id), preferences, numbers)
          const expanded = preferences.expanded[id] ?? (selectedRole ? selectedRole === id : index === 0)
          return <section key={id} className={s.group} data-assistant-group={id}>
            <div className={s.groupHeader}><button className={s.groupToggle} type="button" aria-expanded={expanded} onClick={() => setPreferences(p => ({ ...p, expanded: { ...p.expanded, [id]: !expanded } }))}>
              <span className={`${s.chevron} ${expanded ? s.expanded : ''}`}><Icon kind="chevron"/></span><RoleAppearanceIcon roleId={id} icon={role.icon} color={role.color} className={s.roleIcon}/><span className={s.groupName}>{role.name}</span><small>{items.length}</small>
            </button>{role.enabled && <button type="button" className={s.add} aria-label={`新建${role.name}对话`} title={`新建${role.name}对话`} onClick={() => onNew(id)}><Icon kind="plus"/></button>}</div>
            {expanded && renderRows(items)}
          </section>
        })}
      </div>
      {searching && <section aria-label="对话搜索结果" className={s.results}><p className={s.resultCount} role="status">{ready ? `找到 ${hits.length} 条对话` : `已找到 ${hits.length} 条（历史尚未完整读取）`}</p>{renderRows(hits, true)}{contentHits.pending && <p className={s.empty}>正在搜索普通会话正文…</p>}{contentHits.error && <p className={s.empty}>正文搜索暂不可用，已显示名称匹配结果。</p>}{contentHits.hasMore && <p className={s.empty}>正文匹配较多，请缩小搜索范围。</p>}{!hits.length && ready && !contentHits.pending && <p className={s.empty}>未找到匹配对话</p>}</section>}
      {rows.some(row => archived[row.id]) && <button type="button" onClick={() => setShowArchived(true)}>已归档的专用记录（{rows.filter(row => archived[row.id]).length}）</button>}
      {showArchived && <Modal title="已归档的专用记录" closeLabel="关闭" onClose={() => setShowArchived(false)}><div style={{padding:20}}>{rows.filter(row => archived[row.id]).map(row => <div key={row.id} style={{display:'flex',gap:12,marginBottom:12}}><span style={{flex:1}}>{row.title}</span><button onClick={() => setArchive(row.id, false)}>恢复</button></div>)}<p>归档保留原记录；此列表保存在当前浏览器中。</p></div></Modal>}
      {historyStatus && <div className={s.status}>{historyStatus}</div>}
    </div>
  </section>
}
