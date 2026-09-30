import { actionsOf, type RoleVersion, type State } from '../../../dsh-capabilities/src/core/model.ts'
import { DEVELOPER_CAPABILITY_ID, developerSummary, type DeveloperTask, type DeveloperSummary } from '../../../dsh-capabilities/src/core/developer-model.ts'
export const developerUrl = (route: string, params: Record<string, string> = {}) => '/api/capabilities/developer/' + route + '?' + new URLSearchParams(params)
export async function developerApi<T = unknown>(route: string, params: Record<string, string> = {}, body?: unknown, method = body === undefined ? 'GET' : 'POST'): Promise<T> {
  const response = await fetch(developerUrl(route, params), { method, credentials: 'same-origin', ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }) })
  const value = await response.json()
  if (!response.ok) throw new Error(value.error || `开发服务错误 (${response.status})`)
  return value as T
}
export function usesDeveloper(state: State | undefined, version: RoleVersion | undefined) {
  const binding = version?.capabilities.find(b => b.capabilityId === DEVELOPER_CAPABILITY_ID && b.enabled)
  return !!binding && actionsOf(state?.capabilities.find(c => c.id === binding.capabilityId)?.versions.find(v => v.version === binding.version)).includes('develop') && (!binding.actions || binding.actions.includes('develop'))
}
export function createDeveloperHistory() {
  let activeId: string | null = null
  try { activeId = sessionStorage.getItem('workbench-developer-active') } catch { /* Optional selection. */ }
  let state = { items: [] as DeveloperSummary[], activeId, error: '' }
  const listeners = new Set<() => void>(), removed = new Set<string>()
  const update = (next: Partial<typeof state>) => { state = { ...state, ...next }; try { state.activeId ? sessionStorage.setItem('workbench-developer-active', state.activeId) : sessionStorage.removeItem('workbench-developer-active') } catch { /* Server history remains. */ } listeners.forEach(fn => fn()) }
  return {
    subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } }, getSnapshot: () => state,
    load: async () => { try { const result = await developerApi<{ items: DeveloperSummary[] }>('tasks'); update({ items: result.items.filter(row => !removed.has(row.id)), error: '' }) } catch (error) { update({ error: error instanceof Error ? error.message : String(error) }) } },
    open: (id: string) => update({ activeId: id }), leave: () => update({ activeId: null }),
    upsert: (task: DeveloperTask, activate: boolean) => { if (removed.has(task.id)) return; const row = developerSummary(task), old = state.items.find(r => r.id === row.id); if (old && old.updatedAt > row.updatedAt) return; update({ items: [...state.items.filter(r => r.id !== row.id), row].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), ...(activate ? { activeId: row.id } : {}) }) },
    remove: async (id: string) => { await developerApi('task', { id }, undefined, 'DELETE'); removed.add(id); update({ items: state.items.filter(row => row.id !== id), activeId: state.activeId === id ? null : state.activeId }) },
  }
}
