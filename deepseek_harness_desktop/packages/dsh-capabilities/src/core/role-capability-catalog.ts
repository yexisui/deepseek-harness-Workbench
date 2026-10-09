import { latest, type Capability, type Version } from './model.ts'
import { MEETING_CAPABILITY_ID, MEETING_ROLE_ID } from './default-roles.ts'

/** The management center and role library enumerate the same active records. */
export function capabilityCatalog(capabilities: Capability[]) {
  return capabilities.filter(capability => !capability.removedAt)
}

/** Compatibility describes implemented routes; connection health is not an admission check. */
export function roleCapabilityReason(roleId: string | undefined, capability: Capability, version: Version | undefined = latest(capability.versions)): string | undefined {
  if (capability.removedAt) return '能力已移除，请先在能力中心恢复'
  if (!version) return '未发布，请先在能力中心发布'
  if (capability.id === MEETING_CAPABILITY_ID) return roleId === MEETING_ROLE_ID ? undefined : '会议录音转写仅供会议纪要助手使用'
  if (roleId === MEETING_ROLE_ID && !version.components.some(part => part.actions.some(action => action.startsWith('pack:') && action.endsWith(':plan-audio-segments')))) return '此能力尚未接入会议流程'
  return undefined
}
