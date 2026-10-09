import { latest, type Capability, type Version } from './model.ts'

/** The management center and role library enumerate the same active records. */
export function capabilityCatalog(capabilities: Capability[]) {
  return capabilities.filter(capability => !capability.removedAt)
}

/** Compatibility describes implemented routes; connection health is not an admission check. */
export function roleCapabilityReason(roleId: string | undefined, capability: Capability, version: Version | undefined = latest(capability.versions)): string | undefined {
  if (capability.removedAt) return '不能添加已移除的能力，请先在能力中心恢复'
  if (!version) return '未发布，请先在能力中心发布'
  return undefined
}
