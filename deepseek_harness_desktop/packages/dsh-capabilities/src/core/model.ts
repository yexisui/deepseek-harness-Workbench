/** JSON-only contract shared by the host and UI; never imports a host service. */
import { defaultRoles } from './default-roles.ts'
import type { RoleIconSpec } from './appearance.ts'
export type Action = 'navigate' | 'read' | 'screenshot'
export type Part = { componentId: string; actions: Action[] }
export type Definition = { name: string; description: string; instructions: string; components: Part[] }
export type Version = Definition & { version: number; createdAt: string }
export type Capability = { id: string; source: 'builtin' | 'local'; enabled: boolean; pinned: boolean; removedAt?: string; draft: Definition; versions: Version[] }
export type Binding = { capabilityId: string; version: number; enabled: boolean; actions?: Action[] }
export type RoleDefinition = { name: string; color: string; icon?: RoleIconSpec; duties: string; requirements: string; format: string; capabilities: Binding[] }
export type RoleVersion = RoleDefinition & { version: number; preset: string; createdAt: string }
export type Role = { id: string; enabled: boolean; draft: RoleDefinition; versions: RoleVersion[] }
export type State = { schema: 1; revision: number; updatedAt: string; capabilities: Capability[]; roles: Role[]; defaultRolesVersion?: 1; stoppedSessions?: string[]; revokedAt?: Record<string, number> }
export type Component = { id: string; name: string; provider: string; version: string; actions: readonly Action[]; dependencies: readonly string[] }
export const browserPackage = '@wxg-prc-cpg/browser-skill-dsh-plugin'
export const components: readonly Component[] = [{ id: 'browserskill', name: '浏览器操作', provider: browserPackage, version: '0.3.0', actions: ['navigate', 'read', 'screenshot'], dependencies: ['@deepseek-ai/dsh-tools', '@deepseek-ai/dsh-agent', '@deepseek-ai/dsh-session', '@deepseek-ai/dsh-skill', '@deepseek-ai/dsh-attachment', 'bsk', 'browser-extension'] }]
export const actionNames: Record<Action, string> = { navigate: '打开网页', read: '读取网页', screenshot: '截取页面' }
export const emptyDefinition = (): Definition => ({ name: '', description: '', instructions: '', components: [] })
export const emptyRole = (): RoleDefinition => ({ name: '', color: '#4F73E8', duties: '', requirements: '', format: '', capabilities: [] })
export const latest = <T>(versions: T[]): T | undefined => versions.at(-1)
export function initialState(now = new Date().toISOString()): State {
  const definition: Definition = { name: '浏览器操作', description: '在独立浏览器窗口中打开、读取网页与截图。', instructions: '先说明目标，再打开网页并读取结果。仅使用已授权的浏览器动作；完成后关闭本会话的浏览器窗口。', components: [{ componentId: 'browserskill', actions: ['navigate', 'read', 'screenshot'] }] }
  return { schema: 1, revision: 0, updatedAt: now, defaultRolesVersion: 1, roles: defaultRoles(now), capabilities: [{ id: 'browser', source: 'builtin', enabled: true, pinned: true, draft: definition, versions: [{ ...structuredClone(definition), version: 1, createdAt: now }] }] }
}
export type Command =
  | { type: 'capability.save'; id?: string; definition: Definition; publish: boolean; applyToRoles?: string[] }
  | { type: 'capability.copy'; id: string }
  | { type: 'capability.toggle'; id: string; enabled: boolean }
  | { type: 'capability.pin'; id: string; pinned: boolean }
  | { type: 'capability.remove'; id: string }
  | { type: 'capability.restore'; id: string }
  | { type: 'capability.restoreMany'; ids: string[] }
  | { type: 'capability.purge'; ids: string[] }
  | { type: 'role.save'; id?: string; definition: RoleDefinition; publish: boolean }
  | { type: 'role.toggle'; id: string; enabled: boolean }
export type Health = { checkedAt: string | null; installed: boolean; loaded: boolean; state: 'unknown' | 'missing' | 'disconnected' | 'ready' | 'degraded'; message: string; cliVersion?: string; browsers: { id: string; name: string }[] }
export type Task = { sessionId: string; roleId: string; roleVersion: number; name: string; status: 'idle' | 'running' | 'stopping' | 'stopped' | 'error'; error?: string; action?: string; browserSessions: string[] }
export type DependencyHealth = { id: string; installed: boolean; loaded: boolean; version?: string; pendingRestart: boolean }
export type Snapshot = { state: State; components: readonly Component[]; health: Health; tasks: Task[]; dependencies?: DependencyHealth[] }

export function resolveBinding(state: State, binding: Binding): Version | undefined {
  return state.capabilities.find(c => c.id === binding.capabilityId)?.versions.find(v => v.version === binding.version)
}
export function actionsOf(definition?: Definition): Action[] {
  return [...new Set(definition?.components.flatMap(part => part.actions) ?? [])]
}
/** 永久删除必须保护所有历史岗位版本，不能只检查当前列表或活动会话。 */
export function capabilityDeletionReferences(state: State, capabilityId: string): Role[] {
  return state.roles.filter(role => role.draft.capabilities.some(binding => binding.capabilityId === capabilityId)
    || role.versions.some(version => version.capabilities.some(binding => binding.capabilityId === capabilityId)))
}
export function references(state: State, componentId: string, tasks: Task[] = []) {
  const capabilities = state.capabilities.filter(c => c.draft.components.some(p => p.componentId === componentId) || c.versions.some(v => v.components.some(p => p.componentId === componentId)))
  const ids = new Set(capabilities.map(c => c.id))
  const roles = state.roles.filter(r => r.draft.capabilities.some(b => ids.has(b.capabilityId)) || latest(r.versions)?.capabilities.some(b => ids.has(b.capabilityId)))
  const active = tasks.filter(t => !['stopped'].includes(t.status) && state.roles.find(r => r.id === t.roleId)?.versions.find(v => v.version === t.roleVersion)?.capabilities.some(b => ids.has(b.capabilityId)))
  return { capabilities, roles, tasks: active }
}
