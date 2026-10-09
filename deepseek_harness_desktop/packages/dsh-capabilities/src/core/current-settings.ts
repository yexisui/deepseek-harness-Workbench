import { latest, type Binding, type RoleDefinition, type State } from './model.ts'

/** Update only this association; unrelated unfinished edits stay untouched. */
export function applyCapabilitySettings(state: State, id: string, number: number, now: string) {
  const cap = state.capabilities.find(c => c.id === id)!
  const actions = latest(cap.versions)!.components.flatMap(p => p.actions)
  const update = (bindings: Binding[]) => bindings.map(b => b.capabilityId === id ? { ...b, version: number, ...(b.actions ? { actions: b.actions.filter(a => actions.includes(a)) } : {}) } : b)
  for (const role of state.roles) {
    if (role.removedAt) continue
    role.draft.capabilities = update(role.draft.capabilities)
    const current = latest(role.versions)
    if (!current?.capabilities.some(b => b.capabilityId === id)) continue
    saveRoleSettings(role, { ...current, capabilities: update(current.capabilities) }, now)
  }
}

export function saveRoleSettings(role: State['roles'][number], value: RoleDefinition, now: string) {
  const current = latest(role.versions)
  const definition = ({ name, color, icon, duties, requirements, format, capabilities, skills }: RoleDefinition) => ({ name, color, icon, duties, requirements, format, capabilities, skills })
  if (current && JSON.stringify(definition(current)) === JSON.stringify(definition(value))) return
  const number = (current?.version ?? 0) + 1
  role.versions.push({ ...structuredClone(definition(value)), version: number, createdAt: now, preset: 'workbench-role-' + role.id + '-v' + number, directSave: true })
}
