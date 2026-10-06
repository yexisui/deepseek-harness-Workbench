import { components, type Component, type Definition, type RoleDefinition, type State } from './model.ts'
import { compatibilityIssues, dependencyName, missingAssociations, supportDependencies } from './composition.ts'
import { roleIconIds, roleIconAssetIdPattern, type RoleIconSpec } from './appearance.ts'
import { REQUIREMENTS_CAPABILITY_ID } from './requirements-model.ts'
import { DEVELOPER_CAPABILITY_ID } from './developer-model.ts'
export class InputError extends Error { constructor(message: string, readonly status = 400) { super(message) } }
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new InputError('需要有效的对象')
  return value as Record<string, unknown>
}
export function text(value: unknown, label: string, max: number, required = false): string {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new InputError(`${label}无效或过长`)
  return value
}
export function bool(value: unknown): boolean { if (typeof value !== 'boolean') throw new InputError('需要布尔值'); return value }
export function id(value: unknown): string { const result = text(value, '标识', 90, true); if (!/^[a-z][a-z0-9-]*$/.test(result)) throw new InputError('标识格式无效'); return result }
export function integer(value: unknown): number { if (!Number.isSafeInteger(value) || Number(value) < 0) throw new InputError('版本号无效'); return value as number }
export function list(value: unknown, max = 100): unknown[] { if (!Array.isArray(value) || value.length > max) throw new InputError('列表无效或过长'); return value }
export function roleIcon(value: unknown): RoleIconSpec {
  const icon = object(value)
  if (icon.kind === 'builtin' && roleIconIds.includes(icon.id as any)) return { kind: 'builtin', id: icon.id as typeof roleIconIds[number] }
  if (icon.kind === 'png' && typeof icon.assetId === 'string' && roleIconAssetIdPattern.test(icon.assetId)) return { kind: 'png', assetId: icon.assetId }
  throw new InputError('岗位图标无效，请选择推荐图标或重新上传 PNG')
}
export function definition(value: unknown, catalog: readonly Component[] = components): Definition {
  const data = object(value), seen = new Set<string>()
  const result: Definition = { name: text(data.name, '能力名称', 80, true), description: text(data.description, '简介', 1000), instructions: text(data.instructions, '使用说明', 8000), components: list(data.components, 20).map(value => {
    const part = object(value), componentId = text(part.componentId, '组件标识', 160, true), descriptor = catalog.find(c => c.id === componentId)
    if (!descriptor) throw new InputError('此组件尚未适配，不能作为可执行能力添加')
    if (seen.has(componentId)) throw new InputError('组件重复；请在已有组件中调整动作')
    seen.add(componentId)
    const actions = list(part.actions, 10).map(action => {
      if (!descriptor.actions.includes(action as any)) throw new InputError('动作未经适配或不受支持')
      return action as typeof descriptor.actions[number]
    })
    if (new Set(actions).size !== actions.length) throw new InputError('动作重复')
    return { componentId, actions }
  }) }
  const dependencies = supportDependencies(result, catalog)
  const associations = [...result.components.map(p => p.componentId), ...dependencies]
  for (const key of ['excludedDependencies', 'componentOrder'] as const) {
    if (data[key] === undefined) continue
    const values = list(data[key], 100).map(value => text(value, '组件关联', 160, true))
    const allowed = key === 'excludedDependencies' ? dependencies : associations
    if (new Set(values).size !== values.length || values.some(value => !allowed.includes(value))) throw new InputError('组件关联包含重复或不受支持的项目')
    result[key] = values
  }
  return result
}
export function roleDefinition(value: unknown, state: State): RoleDefinition {
  const data = object(value), color = text(data.color, '颜色', 7), seen = new Set<string>()
  if (!/^#[0-9a-f]{6}$/i.test(color)) throw new InputError('颜色无效')
  return { name: text(data.name, '岗位名称', 80, true), color, ...(data.icon === undefined ? {} : { icon: roleIcon(data.icon) }), duties: text(data.duties, '职责', 8000), requirements: text(data.requirements, '要求', 8000), format: text(data.format, '输出格式', 4000), capabilities: list(data.capabilities, 30).map(value => {
    const binding = object(value), capabilityId = id(binding.capabilityId), version = integer(binding.version)
    if (seen.has(capabilityId)) throw new InputError('同一能力不能重复添加')
    seen.add(capabilityId)
    const cap = state.capabilities.find(c => c.id === capabilityId)?.versions.find(v => v.version === version)
    if (!cap) throw new InputError('引用的能力版本不存在；先发布能力再添加到岗位')
    const available = new Set(cap.components.flatMap(p => p.actions))
    const actions = binding.actions === undefined ? undefined : list(binding.actions, 10).map(a => {
      if (!available.has(a as any)) throw new InputError('岗位覆盖只能缩小权限')
      return a as typeof cap.components[number]['actions'][number]
    })
    return { capabilityId, version, enabled: bool(binding.enabled), ...(actions === undefined ? {} : { actions: [...new Set(actions)] }) }
  }) }
}
export function issues(definition: Definition, capabilityId?: string, catalog: readonly Component[] = components): string[] {
  const missing = missingAssociations(definition, capabilityId, catalog)
  return [...compatibilityIssues(definition, capabilityId, catalog), ...(definition.components.length === 0 && !missing.length ? ['尚未添加组件'] : definition.components.flatMap(p => p.actions.length ? [] : ['至少选择一个业务动作'])), ...missing.map(id => `缺少必需组件：${catalog.find(c => c.id === id)?.name ?? dependencyName(id)}，补回后才能发布`)]
}
export function roleCompositionIssues(value: RoleDefinition): string[] {
  const active = value.capabilities.filter(binding => binding.enabled)
  if (active.some(binding => binding.capabilityId === DEVELOPER_CAPABILITY_ID) && active.some(binding => binding.capabilityId !== DEVELOPER_CAPABILITY_ID)) return ['开发工作区暂不支持与其他执行能力混用；草稿可以保存，请停用其他能力后发布。']
  return active.some(binding => binding.capabilityId === REQUIREMENTS_CAPABILITY_ID) && active.some(binding => binding.capabilityId !== REQUIREMENTS_CAPABILITY_ID)
    ? ['需求分析使用独立工作区，暂不支持与其他执行能力混用。请停用或移除其他能力后发布；草稿可以继续保存。'] : []
}
