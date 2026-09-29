import type { RequirementSummary, RequirementTask } from '../../../dsh-capabilities/src/core/requirements-model.ts'
import { listRequirementTasks, getRequirementTask, deleteRequirementTask } from './requirements-client.ts'

type HistoryState = { items: RequirementSummary[]; total: number; hasMore: boolean; activeId: string | null; loading: boolean; error: string }
const ACTIVE_KEY = 'workbench-requirements-active-v1'
const summarize = (task: RequirementTask): RequirementSummary => ({ id: task.id, title: task.title, mode: task.mode, updatedAt: task.updatedAt, roleId: task.roleId, roleVersion: task.roleVersion, confirmed: task.requirements.filter(r => !r.removed && r.status === 'confirmed').length, total: task.requirements.filter(r => !r.removed).length, openQuestions: task.questions.filter(q => !['resolved', 'dismissed'].includes(q.status)).length, running: task.run?.status === 'running' })
/** Persist only the selected ID in the browser. The server owns the complete history. */
export function createRequirementHistory(api = { list: listRequirementTasks, get: getRequirementTask, remove: deleteRequirementTask }) {
  let saved: string | null = null
  try { saved = sessionStorage.getItem(ACTIVE_KEY) } catch { /* Optional selection restoration. */ }
  let state: HistoryState = { items: [], total: 0, hasMore: false, activeId: saved, loading: false, error: '' }
  let offset = 0
  const removed = new Set<string>()
  const listeners = new Set<() => void>()
  const update = (patch: Partial<HistoryState>) => {
    state = { ...state, ...patch }
    try { if (state.activeId) sessionStorage.setItem(ACTIVE_KEY, state.activeId); else sessionStorage.removeItem(ACTIVE_KEY) } catch { /* Data remains on server. */ }
    listeners.forEach(listener => listener())
  }
  const merge = (items: RequirementSummary[]) => {
    const merged = new Map(state.items.map(item => [item.id, item]))
    for (const item of items) if (!removed.has(item.id) && (!merged.has(item.id) || merged.get(item.id)!.updatedAt <= item.updatedAt)) merged.set(item.id, item)
    return [...merged.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }
  const load = async (more = false) => {
    if (state.loading) return
    update({ loading: true, error: '' })
    try {
      const page = await api.list({ offset: more ? offset : 0, limit: 30 })
      offset = (more ? offset : 0) + page.items.length
      update({ items: merge(page.items), total: page.total, hasMore: offset < page.total })
      const id = state.activeId
      if (id && !state.items.some(item => item.id === id)) {
        const task = await api.get(id)
        update({ items: merge([summarize(task)]) })
      }
    } catch (error) { update({ error: error instanceof Error ? error.message : String(error) }) }
    finally { update({ loading: false }) }
  }
  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    load,
    active: () => state.items.find(item => item.id === state.activeId),
    open: (id: string) => { if (state.items.some(item => item.id === id)) update({ activeId: id }) },
    leave: () => update({ activeId: null }),
    upsert: (item: RequirementSummary, activate = false) => { if (!removed.has(item.id)) update({ items: merge([item]), total: state.total + Number(!state.items.some(row => row.id === item.id)), ...(activate ? { activeId: item.id } : {}) }) },
    remove: async (id: string) => {
      await api.remove(id)
      removed.add(id)
      update({ items: state.items.filter(item => item.id !== id), total: Math.max(0, state.total - 1), activeId: state.activeId === id ? null : state.activeId })
    },
  }
}
