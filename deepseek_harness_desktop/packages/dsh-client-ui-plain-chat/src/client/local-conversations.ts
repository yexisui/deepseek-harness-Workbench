/** Local rows that exist before the host creates a real chat Session. */
export type LocalConversation = {
  id: string
  role: string
  kind: 'draft' | 'demo'
  title: string
  draft: string
  updatedAt: number
  meeting?: unknown
}

type Snapshot = { items: LocalConversation[]; activeId: string | null }
const DRAFTS_KEY = 'workbench-local-drafts-v1'
const DEMOS_KEY = 'workbench-meeting-demos-v1'
const ACTIVE_KEY = 'workbench-local-active-v1'

function readRows(storage: Storage, key: string, kind: LocalConversation['kind']): LocalConversation[] {
  try {
    const value: unknown = JSON.parse(storage.getItem(key) ?? '[]')
    if (!Array.isArray(value)) return []
    return value.filter((row): row is LocalConversation => row && typeof row === 'object' && typeof row.id === 'string' && typeof row.role === 'string' && row.kind === kind && typeof row.title === 'string' && typeof row.draft === 'string' && typeof row.updatedAt === 'number')
  } catch { return [] }
}

export function createLocalConversations(mint: () => string = () => `local-${crypto.randomUUID()}`) {
  const saved = [...readRows(sessionStorage, DRAFTS_KEY, 'draft'), ...readRows(localStorage, DEMOS_KEY, 'demo')]
  let activeId: string | null = null
  try { const id = sessionStorage.getItem(ACTIVE_KEY); if (id && saved.some(row => row.id === id)) activeId = id } catch { /* Optional storage. */ }
  let snapshot: Snapshot = { items: saved.sort((a, b) => b.updatedAt - a.updatedAt), activeId }
  const listeners = new Set<() => void>()
  const persist = () => {
    try {
      sessionStorage.setItem(DRAFTS_KEY, JSON.stringify(snapshot.items.filter(row => row.kind === 'draft')))
      if (snapshot.activeId) sessionStorage.setItem(ACTIVE_KEY, snapshot.activeId)
      else sessionStorage.removeItem(ACTIVE_KEY)
    } catch { /* The active page still works if storage is unavailable. */ }
    try { localStorage.setItem(DEMOS_KEY, JSON.stringify(snapshot.items.filter(row => row.kind === 'demo'))) } catch { /* Demo history stays in memory if storage is unavailable. */ }
  }
  const update = (items: LocalConversation[], nextActive = snapshot.activeId) => {
    snapshot = { items: items.sort((a, b) => b.updatedAt - a.updatedAt), activeId: nextActive }
    persist()
    listeners.forEach(listener => listener())
  }
  const active = () => snapshot.items.find(row => row.id === snapshot.activeId)
  const leave = () => {
    const current = active()
    update(snapshot.items.filter(row => row !== current || row.kind === 'demo' || row.draft.trim()), null)
  }
  const start = (role = 'chat') => {
    const current = active()
    const retained = snapshot.items.filter(row => row !== current || row.kind === 'demo' || row.draft.trim())
    const now = Date.now()
    const row: LocalConversation = { id: mint(), role, kind: 'draft', title: '新对话', draft: '', updatedAt: now }
    update([row, ...retained], row.id)
    return row
  }
  const ensure = (role = 'chat') => active() ?? start(role)
  const patch = (id: string, change: Partial<LocalConversation>) => {
    const current = snapshot.items.find(row => row.id === id)
    if (!current) return
    const next = { ...current, ...change, updatedAt: Date.now() }
    update(snapshot.items.map(row => row.id === id ? next : row))
  }
  return {
    restoreMeetings: (rows: LocalConversation[]) => {
      const known = new Set(snapshot.items.map(row => (row.meeting as { jobId?: string } | undefined)?.jobId).filter(Boolean))
      const added = rows.filter(row => { const id = (row.meeting as { jobId?: string })?.jobId; if (!id || known.has(id)) return false; known.add(id); return true })
      if (added.length) update([...snapshot.items, ...added])
    },
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    active,
    start,
    ensure,
    leave,
    open: (id: string) => { if (snapshot.items.some(row => row.id === id)) update(snapshot.items, id) },
    remove: (id: string) => update(snapshot.items.filter(row => row.id !== id), snapshot.activeId === id ? null : snapshot.activeId),
    setRole: (id: string, role: string) => patch(id, { role }),
    setDraft: (id: string, draft: string) => patch(id, { draft, title: draft.trim() ? draft.trim().slice(0, 28) : '新对话' }),
    setMeeting: (id: string, meeting: unknown, draft: string) => patch(id, { meeting, draft }),
    commitDemo: (id: string, title: string) => patch(id, { kind: 'demo', title }),
    commitChat: (id: string) => update(snapshot.items.filter(row => row.id !== id), snapshot.activeId === id ? null : snapshot.activeId),
  }
}
