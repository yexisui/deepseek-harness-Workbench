import { actionsOf, type RoleVersion, type State } from '../../../dsh-capabilities/src/core/model.ts'
import { REQUIREMENTS_CAPABILITY_ID } from '../../../dsh-capabilities/src/core/requirements-model.ts'

/** Route by the exact published binding, including custom roles; the service enforces current authority. */
export function usesRequirements(state: State | undefined, version: RoleVersion | undefined) {
  const binding = version?.capabilities.find(item => item.capabilityId === REQUIREMENTS_CAPABILITY_ID && item.enabled)
  if (!state || !binding) return false
  const capability = state.capabilities.find(item => item.id === binding.capabilityId)
  const published = capability?.versions.find(item => item.version === binding.version)
  return actionsOf(published).includes('analyze-requirements') && (!binding.actions || binding.actions.includes('analyze-requirements'))
}
