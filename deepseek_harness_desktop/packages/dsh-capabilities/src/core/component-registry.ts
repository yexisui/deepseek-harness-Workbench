import { components, references, resolveBinding, type Component, type State, type Task } from './model.ts'
import { availableComponents } from './composition.ts'

export type PluginRelation = { moduleName: string; role: 'provider' | 'adapter' | 'support'; required: boolean; reason: string }
export const relationNames = { provider: '功能提供', adapter: '工作台适配', support: '运行支持' }
/** Exact exported module identities. A parent package is never an implicit match for a child export. */
export function pluginRelations(component: Component): PluginRelation[] {
  return [
    { moduleName: component.provider, role: 'provider' as const, required: true, reason: `提供${component.name}的业务动作` },
    ...(component.pluginModule ? [{ moduleName: component.pluginModule, role: 'adapter' as const, required: true, reason: '按岗位授权加载动作并连接能力工作区' }] : []),
    ...component.dependencies.filter(id => id.startsWith('@')).map(moduleName => ({ moduleName, role: 'support' as const, required: true, reason: `支持${component.name}的运行` })),
  ]
}
export function relatedComponents(moduleName: string, catalog: readonly Component[] = components) {
  return catalog.filter(c => pluginRelations(c).some(r => r.moduleName === moduleName))
}
export function adaptedCapabilities(state: State, component: Component) {
  return state.capabilities.filter(c => !c.removedAt && availableComponents(c.id).some(d => d.id === component.id))
}
export function pluginReferences(state: State, moduleName: string, tasks: Task[] = [], catalog: readonly Component[] = components) {
  const related = relatedComponents(moduleName, catalog), ids = new Set(related.map(c => c.id))
  const refs = related.map(c => references(state, c.id, tasks))
  const unique = <T extends { id: string }>(values: T[]) => [...new Map(values.map(v => [v.id, v])).values()]
  return { components: related, capabilities: unique(refs.flatMap(r => r.capabilities)), roles: unique(refs.flatMap(r => r.roles)), tasks: [...new Map(refs.flatMap(r => r.tasks).map(t => [t.sessionId, t])).values()], componentIds: ids }
}
export type ComponentMetadata = { name?: string; description?: string; category?: string; pinned?: boolean; retiredAt?: string; enabled?: boolean; revokedAt?: number }
export type Candidate = ComponentMetadata & { id: string; name: string; description: string; category: string; provider: string; createdAt: string }
export type ComponentActivity = { roleId?: string; roleVersion?: number; id: string; componentIds: string[]; name: string; status: string; kind: string }
export type RegistryEvent = { id: string; at: string; componentId: string; action: string }
export type ComponentRegistry = { schema: 1; revision: number; metadata: Record<string, ComponentMetadata>; candidates: Candidate[]; events: RegistryEvent[]; operations: string[] }
export const emptyRegistry = (): ComponentRegistry => ({ schema: 1, revision: 0, metadata: {}, candidates: [], events: [], operations: [] })
export function registryCatalog(registry: ComponentRegistry) { return components.map(c => ({ ...c, name: registry.metadata[c.id]?.name || c.name })) }
export function componentPublishIssues(state: State, registry: ComponentRegistry, ids: string[]) {
  return ids.flatMap(id => { const meta = registry.metadata[id]; return meta?.retiredAt ? [`${components.find(c => c.id === id)?.name ?? id}已移入回收站，请恢复后发布`] : meta?.enabled === false ? [`${components.find(c => c.id === id)?.name ?? id}已全局停用，请启用后发布`] : [] })
}
export function componentRestrictionKeys(state: State, roleVersion: { capabilities: { capabilityId: string; version: number; enabled: boolean }[] }) {
  return [...new Set(roleVersion.capabilities.filter(b => b.enabled).flatMap(b => resolveBinding(state, b)?.components.map(p => p.componentId) ?? []))]
}

/** Package operations affect every explicit export supplied by that package. UI module matching stays exact. */
export const modulePackage = (moduleName: string) => moduleName.split('/').slice(0, moduleName.startsWith('@') ? 2 : 1).join('/')
export function packageComponents(packageId: string, catalog: readonly Component[] = components) { return catalog.filter(c => pluginRelations(c).some(r => modulePackage(r.moduleName) === packageId)) }
