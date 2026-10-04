import { latest, type Capability, type Snapshot, type Version } from '../../../dsh-capabilities/src/core/model.ts'
type Availability = { ready?: boolean; state?: string; message?: string } | null | undefined
/** One presentation contract for cards and role composition, keyed by component descriptors. */
export function capabilityPresentation(data: Snapshot, capability: Capability, version: Version | undefined = latest(capability.versions), meeting?: Availability, requirements?: Availability) {
  const parts = version?.components ?? capability.draft.components
  const descriptors = parts.map(part => data.components.find(component => component.id === part.componentId))
  const management = descriptors[0]?.management
  const icon = descriptors[0]?.icon ?? 'document'
  let label: string, message: string
  if (!parts.length || descriptors.some(value => !value)) { label = '组件待适配'; message = '部分组件尚未适配，请在组件中心检查。' }
  else if (descriptors.some(value => value?.management !== management)) { label = '分项检测'; message = '此能力包含不同服务，请在组件中心分别检查。' }
  else if (management === 'developer') { label = '项目内检测'; message = '进入开发对话并绑定项目后检测文件、Git 和验证环境；默认只读。' }
  else if (management === 'requirements') { label = requirements?.ready ? '可使用' : requirements ? '待配置' : '检测中'; message = requirements?.message ?? '正在读取需求分析配置…' }
  else if (management === 'meeting-asr') { label = meeting?.ready ? '已配置' : meeting?.state === 'disabled' ? '不可用' : meeting ? '待配置' : '检测中'; message = meeting?.message ?? '正在检查语音识别配置…' }
  else { label = data.health.state === 'ready' ? '可使用' : '待连接'; message = data.health.message }
  if (capability.removedAt) { label = '已移除'; message = '能力已移除，请在能力中心恢复。' }
  else if (!capability.enabled) { label = '已停用'; message = '能力已停用，请在能力中心启用。' }
  else if (!version) { label = '草稿'; message = '能力尚未发布。' }
  else if (parts.some(part => data.state.componentRestrictions?.[part.componentId]?.enabled === false)) { label = '组件已停用'; message = '关联组件已全局停用，请在组件中心检查。' }
  return { icon, label, message }
}
