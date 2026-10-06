import { components, type Definition, type Snapshot, type Component } from './model.ts'

export function availableComponents(capabilityId?: string, catalog: readonly Component[] = components) {
  const scoped = catalog.filter(c => c.capabilityIds?.includes(capabilityId ?? ''))
  return scoped.length ? scoped : catalog.filter(c => !c.capabilityIds)
}
export function requiredComponents(capabilityId?: string, catalog: readonly Component[] = components) { return availableComponents(capabilityId, catalog).filter(c => c.required) }
export function compositionSupported(data: Snapshot, capabilityId?: string) {
  return (data.compositionVersion ?? 0) >= Math.max(1, ...availableComponents(capabilityId, data.components).map(c => c.compositionVersion))
}
export function compatibilityIssues(value: Definition, capabilityId?: string, catalog: readonly Component[] = components) {
  const allowed = availableComponents(capabilityId, catalog)
  return value.components.filter(p => !allowed.some(c => c.id === p.componentId)).map(p => `${catalog.find(c => c.id === p.componentId)?.name ?? p.componentId}不支持当前能力的执行流程`)
}
export function missingAssociations(value: Definition, capabilityId?: string, catalog: readonly Component[] = components) {
  return [...requiredComponents(capabilityId, catalog).filter(c => !value.components.some(p => p.componentId === c.id)).map(c => c.id), ...missingDependencies(value, catalog)]
}

export const dependencyName = (id: string) => id.replace('@deepseek-ai/dsh-', '')
/** Environment requirements (CLI/extension) are not removable plugin associations. */
export function supportDependencies(value: Definition, catalog: readonly Component[] = components): string[] {
  return [...new Set(value.components.flatMap(part => catalog.find(c => c.id === part.componentId)?.dependencies.filter(id => id.startsWith('@')) ?? []))]
}
export function dependencyUsers(value: Definition, id: string, catalog: readonly Component[] = components) {
  return value.components.flatMap(part => {
    const descriptor = catalog.find(c => c.id === part.componentId)
    return descriptor?.dependencies.includes(id) ? [descriptor] : []
  })
}
export function missingDependencies(value: Definition, catalog: readonly Component[] = components) {
  return supportDependencies(value, catalog).filter(id => value.excludedDependencies?.includes(id))
}
export function compositionIds(value: Definition, catalog: readonly Component[] = components) {
  const ids = [...value.components.map(p => p.componentId), ...supportDependencies(value, catalog).filter(id => !value.excludedDependencies?.includes(id))]
  return [...(value.componentOrder ?? []).filter(id => ids.includes(id)), ...ids.filter(id => !value.componentOrder?.includes(id))]
}
export function addAssociation(value: Definition, id: string, catalog: readonly Component[] = components): Definition {
  if (supportDependencies(value, catalog).includes(id)) return { ...value, excludedDependencies: (value.excludedDependencies ?? []).filter(dep => dep !== id) }
  const descriptor = catalog.find(c => c.id === id)
  if (!descriptor || value.components.some(p => p.componentId === id)) return value
  return { ...value, components: [...value.components, { componentId: id, actions: [...descriptor.actions] }] }
}
export function removeAssociation(value: Definition, id: string, catalog: readonly Component[] = components): Definition {
  if (supportDependencies(value, catalog).includes(id)) return { ...value, excludedDependencies: [...new Set([...(value.excludedDependencies ?? []), id])], componentOrder: (value.componentOrder ?? []).filter(key => key !== id) }
  const next = { ...value, components: value.components.filter(p => p.componentId !== id) }
  const needed = supportDependencies(next, catalog)
  next.excludedDependencies = (value.excludedDependencies ?? []).filter(dep => needed.includes(dep))
  const remaining = [...next.components.map(p => p.componentId), ...needed]
  next.componentOrder = (value.componentOrder ?? []).filter(key => remaining.includes(key))
  return next
}
export function moveAssociation(value: Definition, id: string, target: string, catalog: readonly Component[] = components): Definition {
  const ids = compositionIds(value, catalog), from = ids.indexOf(id), to = ids.indexOf(target)
  if (from < 0 || to < 0 || from === to) return value
  ids.splice(from, 1); ids.splice(to, 0, id)
  return { ...value, componentOrder: ids }
}
