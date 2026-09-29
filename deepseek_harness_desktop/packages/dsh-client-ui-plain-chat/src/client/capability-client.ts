import { useEffect, useSyncExternalStore } from 'react'
import type { Command, Snapshot } from '../../../dsh-capabilities/src/core/model.ts'
export type ClientView = { data: Snapshot | null; error: string; revision: number }
let view: ClientView = { data: null, error: '', revision: 0 }
const listeners = new Set<() => void>()
let pending: Promise<void> | undefined
function emit(patch: Partial<ClientView>) { view = { ...view, ...patch, revision: view.revision + 1 }; listeners.forEach(fn => fn()) }
async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/capabilities/${path}`, { credentials: 'same-origin', ...(body === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }) })
  const value = await response.json().catch(() => ({ error: '能力服务尚未加载，请检查工作台运行配置。' }))
  if (!response.ok) throw new Error(value.error ?? '能力服务请求失败')
  return value
}
export const capabilityClient = {
  getSnapshot: () => view,
  subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } },
  refresh() {
    if (pending) return pending
    pending = request<Snapshot>('state').then(data => emit({ data, error: '' })).catch(error => emit({ error: String(error.message ?? error) })).finally(() => { pending = undefined })
    return pending
  },
  async command(command: Command, revision = view.data?.state.revision) {
    if (revision === undefined) throw new Error('请先等待能力数据加载')
    const result = await request<{ id: string }>('command', { revision, command })
    await capabilityClient.refresh(); return result.id
  },
  async check(connect = false) { await request(connect ? 'connect' : 'check', {}); await capabilityClient.refresh() },
  async stop(sessionId: string) { await request('stop', { sessionId }); await capabilityClient.refresh() },
  async uploadRoleIcon(dataUrl: string): Promise<string> {
    const result = await request<{ id: string }>('icons', { dataUrl })
    if (!/^[a-f0-9]{64}$/.test(result.id)) throw new Error('图标保存结果无效，请重试')
    return result.id
  },
}
export function useCapabilities() {
  const state = useSyncExternalStore(capabilityClient.subscribe, capabilityClient.getSnapshot)
  useEffect(() => {
    void capabilityClient.refresh()
    const refresh = () => { if (!document.hidden) void capabilityClient.refresh() }
    const timer = window.setInterval(refresh, 15000)
    window.addEventListener('focus', refresh)
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh) }
  }, [])
  return state
}
export const editorDrafts = new Map<string, { value: unknown; revision: number }>()
export type CapabilityLink = { section: 'capability-center' | 'plugins'; capabilityId?: string; moduleName?: string }
export function openCapabilityLink(link: CapabilityLink) {
  try { sessionStorage.setItem('workbench-capability-link', JSON.stringify(link)) } catch { /* Optional navigation memory. */ }
  window.dispatchEvent(new CustomEvent('workbench-capability-link', { detail: link }))
}
export function lastCapabilityLink(): CapabilityLink | undefined { try { return JSON.parse(sessionStorage.getItem('workbench-capability-link') ?? 'null') ?? undefined } catch { return undefined } }
