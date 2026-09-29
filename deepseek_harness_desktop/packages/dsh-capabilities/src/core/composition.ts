import { components, type Definition, type Snapshot } from './model.ts'

export function availableComponents(capabilityId?: string) {
  const scoped = components.filter(c => c.capabilityIds?.includes(capabilityId ?? ''))
  return scoped.length ? scoped : components.filter(c => !c.capabilityIds)
}
export function requiredComponents(capabilityId?: string) { return availableComponents(capabilityId).filter(c => c.required) }
export function compositionSupported(data: Snapshot, capabilityId?: string) {
  return (data.compositionVersion ?? 0) >= Math.max(1, ...availableComponents(capabilityId).map(c => c.compositionVersion))
}
export function compatibilityIssues(value: Definition, capabilityId?: string) {
  const allowed = availableComponents(capabilityId)
  return value.components.filter(p => !allowed.some(c => c.id === p.componentId)).map(p => `${components.find(c => c.id === p.componentId)?.name ?? p.componentId}不支持当前能力的执行流程`)
}
export function missingAssociations(value: Definition, capabilityId?: string) {
  return [...requiredComponents(capabilityId).filter(c => !value.components.some(p => p.componentId === c.id)).map(c => c.id), ...missingDependencies(value)]
}

export const dependencyName = (id: string) => id.replace('@deepseek-ai/dsh-', '')
/** Environment requirements (CLI/extension) are not removable plugin associations. */
export function supportDependencies(value: Definition): string[] {
  return [...new Set(value.components.flatMap(part => components.find(c => c.id === part.componentId)?.dependencies.filter(id => id.startsWith('@')) ?? []))]
}
export function dependencyUsers(value: Definition, id: string) {
  return value.components.flatMap(part => {
    const descriptor = components.find(c => c.id === part.componentId)
    return descriptor?.dependencies.includes(id) ? [descriptor] : []
  })
}
export function missingDependencies(value: Definition) {
  return supportDependencies(value).filter(id => value.excludedDependencies?.includes(id))
}
export function compositionIds(value: Definition) {
  const ids = [...value.components.map(p => p.componentId), ...supportDependencies(value).filter(id => !value.excludedDependencies?.includes(id))]
  return [...(value.componentOrder ?? []).filter(id => ids.includes(id)), ...ids.filter(id => !value.componentOrder?.includes(id))]
}
export function addAssociation(value: Definition, id: string): Definition {
  if (supportDependencies(value).includes(id)) return { ...value, excludedDependencies: (value.excludedDependencies ?? []).filter(dep => dep !== id) }
  const descriptor = components.find(c => c.id === id)
  if (!descriptor || value.components.some(p => p.componentId === id)) return value
  return { ...value, components: [...value.components, { componentId: id, actions: [...descriptor.actions] }] }
}
export function removeAssociation(value: Definition, id: string): Definition {
  if (supportDependencies(value).includes(id)) return { ...value, excludedDependencies: [...new Set([...(value.excludedDependencies ?? []), id])], componentOrder: (value.componentOrder ?? []).filter(key => key !== id) }
  const next = { ...value, components: value.components.filter(p => p.componentId !== id) }
  const needed = supportDependencies(next)
  next.excludedDependencies = (value.excludedDependencies ?? []).filter(dep => needed.includes(dep))
  const remaining = [...next.components.map(p => p.componentId), ...needed]
  next.componentOrder = (value.componentOrder ?? []).filter(key => remaining.includes(key))
  return next
}
export function moveAssociation(value: Definition, id: string, target: string): Definition {
  const ids = compositionIds(value), from = ids.indexOf(id), to = ids.indexOf(target)
  if (from < 0 || to < 0 || from === to) return value
  ids.splice(from, 1); ids.splice(to, 0, id)
  return { ...value, componentOrder: ids }
}
