import type { ConversationHistoryRow } from './LocalConversationRows.tsx'

export type HistoryRole = { id: string; enabled: boolean; draft: { name: string; color: string; icon?: any }; versions: { name: string; color: string; icon?: any; preset: string }[] }
export type NumberLedger = Record<string, Record<string, number>>
export type HistoryPreferences = { sort: 'time' | 'number'; direction: 'asc' | 'desc'; expanded: Record<string, boolean> }
export const defaultHistoryPreferences: HistoryPreferences = { sort: 'time', direction: 'desc', expanded: {} }
export function readHistoryStorage<T>(key: string, fallback: T): T {
  try { const value = JSON.parse(localStorage.getItem(key) ?? 'null'); return value && typeof value === 'object' && !Array.isArray(value) ? value : fallback } catch { return fallback }
}
export function saveHistoryStorage(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* Display remains usable when browser storage is unavailable. */ }
}
export function roleForPreset(preset: unknown, roles: HistoryRole[]): string {
  if (!preset || preset === 'workbench-chat') return 'chat'
  const role = roles.find(r => r.versions.some(v => v.preset === preset))
  if (role) return role.id
  const old = String(preset).match(/^workbench-role-(.+)-v\d+$/)
  return old?.[1] ?? `preset:${preset}`
}
export function historyRole(id: string, roles: HistoryRole[], rows: ConversationHistoryRow[]) {
  const role = roles.find(r => r.id === id)
  const appearance = role?.versions.at(-1) ?? role?.draft
  return { id, name: id === 'chat' ? '自由聊天' : appearance?.name ?? rows.find(r => r.role === id && r.roleName)?.roleName ?? '历史助手', color: appearance?.color ?? '#6683bd', icon: appearance?.icon, enabled: role?.enabled ?? false }
}
export function nativeHistoryRows(list: any, workspaces: any[], archived: readonly string[], roles: HistoryRole[]): ConversationHistoryRow[] {
  const archivedIds = new Set(archived)
  return (list.ids ?? Object.keys(list.byId ?? {})).flatMap((id: string) => {
    const row = list.byId[id]
    if (!row || archivedIds.has(id) || row.origin === 'subagent' || row.blank && id !== list.current) return []
    const workspace = workspaces.find(w => w.sessionIds?.includes(id))
    return [{ id: `session:${id}`, nativeId: id, title: row.title || (row.blank ? '新会话' : row.displayTitle) || '未命名对话', role: roleForPreset(row.projectionValues?.agentPreset, roles), kind: row.blank ? 'draft' as const : 'demo' as const, draft: '', updatedAt: row.updatedAt, workspace: workspace?.title ?? workspace?.path?.split(/[\\/]/).pop(), running: row.running, completed: row.completed }]
  })
}
/** Reconcile the complete saved history, then append after the highest remaining number. */
export function allocateHistoryNumbers(previous: NumberLedger, rows: ConversationHistoryRow[]): NumberLedger {
  const saved = rows.filter(row => row.kind !== 'draft')
  const next: NumberLedger = {}
  const maximum = new Map<string, number>()
  // Keep existing identities before allocating any new rows. Missing rows have been deleted.
  for (const row of saved) {
    const number = previous[row.role]?.[row.id]
    if (!Number.isSafeInteger(number) || number <= 0) continue
    ;(next[row.role] ??= {})[row.id] = number
    maximum.set(row.role, Math.max(maximum.get(row.role) ?? 0, number))
  }
  for (const row of [...saved].sort((a, b) => (a.createdAt ?? Infinity) - (b.createdAt ?? Infinity) || a.id.localeCompare(b.id))) {
    if (next[row.role]?.[row.id]) continue
    const number = (maximum.get(row.role) ?? 0) + 1
    ;(next[row.role] ??= {})[row.id] = number
    maximum.set(row.role, number)
  }
  const unchanged = Object.keys(previous).length === Object.keys(next).length && Object.entries(next).every(([role, group]) =>
    Object.keys(previous[role] ?? {}).length === Object.keys(group).length && Object.entries(group).every(([id, number]) => previous[role]?.[id] === number))
  return unchanged ? previous : next
}
export function sortHistory(rows: ConversationHistoryRow[], preferences: Pick<HistoryPreferences, 'sort' | 'direction'>, ledger: NumberLedger) {
  const value = (r: ConversationHistoryRow) => preferences.sort === 'number' ? ledger[r.role]?.[r.id] : r.updatedAt
  return [...rows].sort((a, b) => {
    if (a.kind === 'draft' || b.kind === 'draft') return Number(b.kind === 'draft') - Number(a.kind === 'draft') || a.id.localeCompare(b.id)
    const av = value(a), bv = value(b), aKnown = Number.isFinite(av), bKnown = Number.isFinite(bv)
    if (aKnown !== bKnown) return aKnown ? -1 : 1
    return (aKnown && bKnown ? ((av ?? 0) - (bv ?? 0)) * (preferences.direction === 'asc' ? 1 : -1) : 0) || a.id.localeCompare(b.id)
  })
}
export function searchHistory(rows: ConversationHistoryRow[], query: string, roles: HistoryRole[]) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  return rows.filter(row => {
    const text = [row.title, row.workspace, historyRole(row.role, roles, rows).name].join(' ').toLocaleLowerCase()
    return terms.every(term => text.includes(term))
  })
}
export function shortHistoryTime(time: number) {
  if (!Number.isFinite(time)) return ''
  const date = new Date(time), now = new Date()
  const day = date.toLocaleDateString('zh-CN', { ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }), month: '2-digit', day: '2-digit' })
  return `${day} ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })}`
}
