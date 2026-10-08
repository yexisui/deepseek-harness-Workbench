import { components, type Action, type Component, type Definition, type State } from './model.ts'
import { InputError, list, object, text } from './validation.ts'

/** Portable manifests contain no local paths, settings, role bindings or execution history. */
export type PackageAction = { id: string; name: string; description: string }
export type PackageComponent = { id: string; name: string; entry: string; actions: PackageAction[] }
export type CapabilityManifest = {
  schema: 1; protocol: 'dsh-worker-v1'; id: string; version: string
  name: string; description: string; instructions: string; author: string; license: string
  permissions: ('node' | 'model')[]; components: PackageComponent[]; files: Record<string, string>
  derivedFrom?: { id: string; version: string; hash: string }
}
export type PackageRelease = { manifest: CapabilityManifest; hash: string; installedAt: string }
export type PackageOrigin = { id: string; draftBackups: { savedAt: string; definition: Definition }[] }
export type PackageHealth = { capabilityId: string; installed: boolean; loaded: boolean; ready: boolean; message: string; needsModel: boolean }
export type PackagePreview = {
  token: string; hash: string; manifest: CapabilityManifest; bytes: number; fileCount: number; revision: number
  existing?: { id: string; name: string; duplicate: boolean; removed: boolean; draftChanged: boolean; version: string; changes: string[] }
  needsModel: boolean; trust: string
}
export const packageTrust = '此能力包含本机 Node.js 代码，可访问当前账户的文件和网络。只导入你信任的制作者提供的能力；动作声明不是安全沙箱。导入不会自动执行任务。'
export const digestPattern = /^[a-f0-9]{64}$/
const slug = (value: unknown, label: string, max = 48) => {
  const result = text(value, label, max, true)
  if (!/^[a-z][a-z0-9-]*$/.test(result)) throw new InputError(`${label}只能使用小写字母、数字和连字符`)
  return result
}
export function manifest(value: unknown): CapabilityManifest {
  const v = object(value)
  const allowed = ['schema','protocol','id','version','name','description','instructions','author','license','permissions','components','files','derivedFrom']
  if (Object.keys(v).some(key => !allowed.includes(key))) throw new InputError('能力清单含未支持的字段；请按 dsh-worker-v1 协议重新导出')
  if (v.schema !== 1 || v.protocol !== 'dsh-worker-v1') throw new InputError('工作台不支持此能力包协议，请使用 dsh-worker-v1')
  const packageId = text(v.id, '作品标识', 80, true)
  if (!/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/.test(packageId)) throw new InputError('作品标识应类似 com.example.my-ability')
  const version = text(v.version, '作品版本', 40, true)
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) throw new InputError('作品版本须使用三个数字，例如 1.0.0')
  const permissions = list(v.permissions, 2).map(p => { if (p !== 'node' && p !== 'model') throw new InputError('不支持的能力权限声明'); return p })
  if (!permissions.includes('node') || new Set(permissions).size !== permissions.length) throw new InputError('运行组件必须声明 node 本机代码权限，且不能重复')
  const parts = list(v.components, 20).map(p => {
    const c = object(p)
    const actions = list(c.actions, 10).map(a => { const item = object(a); return { id: slug(item.id, '动作标识'), name: text(item.name, '动作名称', 80, true), description: text(item.description, '动作说明', 2000, true) } })
    if (!actions.length || new Set(actions.map(a => a.id)).size !== actions.length) throw new InputError('组件动作为空或重复')
    return { id: slug(c.id, '组件标识'), name: text(c.name, '组件名称', 80, true), entry: text(c.entry, '执行入口', 200, true), actions }
  })
  if (!parts.length || new Set(parts.map(p => p.id)).size !== parts.length) throw new InputError('能力组件为空或重复')
  const files = object(v.files)
  if (!Object.keys(files).length || Object.keys(files).length > 500) throw new InputError('交付清单需要 1 至 500 个文件')
  for (const [path, hash] of Object.entries(files)) {
    if (!/^(runtime|resources|docs)\//.test(path) || typeof hash !== 'string' || !digestPattern.test(hash)) throw new InputError('交付文件须位于 runtime、resources 或 docs 目录，并提供 SHA-256')
  }
  for (const c of parts) if (!c.entry.startsWith('runtime/') || !c.entry.endsWith('.cjs') || !Object.hasOwn(files, c.entry)) throw new InputError('组件入口必须是清单中的 runtime/*.cjs 构建产物')
  let derivedFrom: CapabilityManifest['derivedFrom']
  if (v.derivedFrom !== undefined) { const d = object(v.derivedFrom); if (!digestPattern.test(String(d.hash))) throw new InputError('派生来源摘要无效'); derivedFrom = { id: text(d.id, '原作品标识', 80, true), version: text(d.version, '原作品版本', 40, true), hash: String(d.hash) } }
  return { schema: 1, protocol: 'dsh-worker-v1', id: packageId, version, name: text(v.name, '能力名称', 80, true), description: text(v.description, '简介', 1000), instructions: text(v.instructions, '使用说明', 8000), author: text(v.author, '制作者', 120, true), license: text(v.license, '分发许可', 200, true), permissions, components: parts, files: files as Record<string,string>, ...(derivedFrom ? { derivedFrom } : {}) }
}
// The namespace is the complete external identity, not the user-facing name or local capability ID.
export const packageComponentId = (id: string, part: string) => `pkg:${id}:${part}`
export const packageActionId = (id: string, part: string, action: string): Action => `pack:${id}:${part}:${action}`
export function packageDefinition(m: CapabilityManifest): Definition {
  return { name: m.name, description: m.description, instructions: m.instructions, components: m.components.map(c => ({ componentId: packageComponentId(m.id, c.id), actions: c.actions.map(a => packageActionId(m.id, c.id, a.id)) })) }
}
export function catalogFor(state: State): readonly Component[] {
  const extra = new Map<string, Component>()
  for (const release of Object.values(state.packageReleases ?? {})) {
    const m = release.manifest, scope = state.capabilities.filter(c => c.packageOrigin?.id === m.id).map(c => c.id)
    if (!scope.length) continue
    for (const part of m.components) {
      const id = packageComponentId(m.id, part.id), old = extra.get(id)
      extra.set(id, { id, name: part.name, provider: m.id, version: m.version, actions: [...new Set([...(old?.actions ?? []), ...part.actions.map(a => packageActionId(m.id, part.id, a.id))])], actionLabels: { ...old?.actionLabels, ...Object.fromEntries(part.actions.map(a => [packageActionId(m.id, part.id, a.id), a.name])) }, dependencies: [], icon: 'document', sourceLabel: m.author, management: 'package', capabilityIds: scope, compositionVersion: 2 })
    }
  }
  return [...components, ...extra.values()]
}
export function definitionChanged(a: Definition, b?: Definition) {
  return !b || (['name','description','instructions','components','excludedDependencies','componentOrder'] as const).some(k => JSON.stringify(a[k] ?? []) !== JSON.stringify(b[k] ?? []))
}
