import { latest, type Capability, type Definition, type Snapshot, type Version } from '../../../dsh-capabilities/src/core/model.ts'
import { issues } from '../../../dsh-capabilities/src/core/validation.ts'
export type Availability = { ready?: boolean; state?: string; message?: string; error?: string } | null | undefined
export type CapabilityStatusGroup = 'ready' | 'pending' | 'draft' | 'disabled' | 'unknown' | 'context'
export function capabilityManagement(data: Snapshot, capability: Capability) {
  const parts = (latest(capability.versions) ?? capability.draft).components
  const kinds = parts.map(part => data.components.find(c => c.id === part.componentId)?.management)
  return kinds.length && kinds.every(kind => kind && kind === kinds[0]) ? kinds[0] : undefined
}
export function capabilityHasUnpublishedChanges(capability: Capability) {
  const published = latest(capability.versions)
  return !!published && (['name','description','instructions','components','excludedDependencies','componentOrder'] as const).some(key => JSON.stringify(capability.draft[key] ?? (key === 'excludedDependencies' || key === 'componentOrder' ? [] : undefined)) !== JSON.stringify(published[key] ?? (key === 'excludedDependencies' || key === 'componentOrder' ? [] : undefined)))
}
export function capabilityDisplayDefinition(capability: Capability): Definition { return latest(capability.versions) ?? capability.draft }
/** Lists, filtering and role composition share status for the selected published version. */
export function capabilityPresentation(data: Snapshot, capability: Capability, version: Version | undefined = latest(capability.versions), meeting?: Availability, requirements?: Availability) {
  const parts = version?.components ?? capability.draft.components
  const descriptors = parts.map(part => data.components.find(component => component.id === part.componentId))
  const management = descriptors[0]?.management
  const icon = descriptors[0]?.icon ?? 'document'
  const status = (label: string, message: string, group: CapabilityStatusGroup) => ({icon,label,message,group})
  if (capability.removedAt) return status('已移除','能力已移除，请在能力中心恢复。','disabled')
  const packageStatus = data.packages?.find(h=>h.capabilityId===capability.id)
  if (capability.packageOrigin && packageStatus && !packageStatus.ready) return status(packageStatus.needsModel?'待配置':'组件待就绪',packageStatus.message,'pending')
  if (!capability.enabled) return status('已停用','能力已停用，请在能力中心启用。','disabled')
  if (!version) return status('草稿','能力尚未发布。','draft')
  if (!parts.length || descriptors.some(value => !value)) return status('组件待适配','部分组件尚未适配，请在组件中心检查。','pending')
  if (parts.some(part => data.state.componentRestrictions?.[part.componentId]?.enabled === false)) return status('组件已停用','关联组件已全局停用，请在组件中心检查。','pending')
  const problems = issues(version,capability.id,data.components)
  if (problems.length) return status('组件待完善',problems.join('；'),'pending')
  if (descriptors.some(value => value?.management !== management)) return status('分项检测','此能力包含不同服务，请在组件中心分别检查。','unknown')
  if (management === 'package') return packageStatus?.ready ? status('已启用',packageStatus.message,'ready') : status('待检测','正在读取执行组件状态','unknown')
  if (management === 'developer') return status('项目内检测','进入开发对话并绑定项目后检测文件、Git 和验证环境；默认只读。','context')
  const service = management === 'requirements' ? requirements : management === 'meeting-asr' ? meeting : undefined
  if (management === 'requirements' || management === 'meeting-asr') {
    if (service?.error) return status('状态未知',service.error,'unknown')
    if (!service) return status('检测中','正在读取服务配置…','unknown')
    if (service.state === 'disabled') return status('不可用',service.message ?? '服务已停用。','pending')
    return status(service.ready ? management === 'meeting-asr' ? '已配置' : '可使用' : '待配置',service.message ?? '请检查服务配置。',service.ready ? 'ready' : 'pending')
  }
  if (management !== 'browser' || data.health.state === 'unknown') return status('状态未知',data.health.message || '尚未检测连接。','unknown')
  return status(data.health.state === 'ready' ? '可使用' : '待连接',data.health.message,data.health.state === 'ready' ? 'ready' : 'pending')
}
