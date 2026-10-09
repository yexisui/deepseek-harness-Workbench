import { actionsOf, type RoleVersion, type State } from '../../../dsh-capabilities/src/core/model.ts'
export type CapabilityMode = 'chat' | 'meeting' | 'requirements' | 'developer'
export function roleCapabilityModes(state?: State, version?: RoleVersion): { mode: CapabilityMode; label: string }[] {
  const result: { mode: CapabilityMode; label: string }[] = [{mode:'chat',label:'对话与工具'}]
  for (const binding of version?.capabilities ?? []) {
    if (!binding.enabled) continue
    const cap = state?.capabilities.find(c => c.id === binding.capabilityId), published = cap?.versions.find(v => v.version === binding.version)
    const actions = binding.actions ?? actionsOf(published)
    const mode: CapabilityMode = actions.includes('transcribe') ? 'meeting' : actions.includes('analyze-requirements') ? 'requirements' : actions.includes('develop') ? 'developer' : 'chat'
    if (mode !== 'chat' && !result.some(r => r.mode === mode)) result.push({mode,label:published?.name ?? cap?.draft.name ?? mode})
  }
  return result
}
export function defaultCapabilityMode(modes: ReturnType<typeof roleCapabilityModes>): CapabilityMode {
  return modes.length === 2 ? modes[1]!.mode : 'chat'
}
