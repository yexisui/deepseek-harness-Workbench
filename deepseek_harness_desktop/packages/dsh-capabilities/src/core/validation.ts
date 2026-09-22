import { components, type Definition, type RoleDefinition, type State } from './model.ts'
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
export function definition(value: unknown): Definition {
  const data = object(value), seen = new Set<string>()
  return { name: text(data.name, '能力名称', 80, true), description: text(data.description, '简介', 1000), instructions: text(data.instructions, '使用说明', 8000), components: list(data.components, 20).map(value => {
    const part = object(value), componentId = id(part.componentId), descriptor = components.find(c => c.id === componentId)
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
}
export function roleDefinition(value: unknown, state: State): RoleDefinition {
  const data = object(value), color = text(data.color, '颜色', 7), seen = new Set<string>()
  if (!/^#[0-9a-f]{6}$/i.test(color)) throw new InputError('颜色无效')
  return { name: text(data.name, '岗位名称', 80, true), color, duties: text(data.duties, '职责', 8000), requirements: text(data.requirements, '要求', 8000), format: text(data.format, '输出格式', 4000), capabilities: list(data.capabilities, 30).map(value => {
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
export function issues(definition: Definition): string[] {
  return definition.components.length === 0 ? ['尚未添加组件'] : definition.components.flatMap(p => p.actions.length ? [] : ['至少选择一个业务动作'])
}
