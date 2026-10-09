import { componentRestrictionKeys } from './component-registry.ts'
import { actionsOf, latest, type Action, type State, type RoleVersion } from './model.ts'

export function roleForPreset(state: State, preset?: string | null) {
  for (const role of state.roles) { const version = role.versions.find(v => v.preset === preset); if (version) return { role, version } }
}
/** Revocation also covers historical sessions that were not loaded at the time of a toggle. */
export function wasRevoked(state: State, roleId: string, snapshot: RoleVersion, createdAt: number): boolean {
  return [`role:${roleId}`, ...snapshot.capabilities.filter(b => b.enabled).map(b => `capability:${b.capabilityId}`)]
    .some(key => (state.revokedAt?.[key] ?? -1) >= createdAt) || componentRestrictionKeys(state, snapshot).some(id => (state.componentRestrictions?.[id]?.revokedAt ?? -1) >= createdAt)
}
/** Snapshot ∩ current restrictions. Later additions can never expand an existing session. */
export function allowedActions(state: State, roleId: string, snapshot: RoleVersion): Action[] {
  const role = state.roles.find(r => r.id === roleId), current = role && latest(role.versions)
  if (!role?.enabled || !current) return []
  const activeActions = (value?: import("./model.ts").Definition) => actionsOf(value && { ...value, components: value.components.filter(p => state.componentRestrictions?.[p.componentId]?.enabled !== false) })
  const allowed = new Set<Action>()
  for (const old of snapshot.capabilities) {
    const now = current.capabilities.find(b => b.capabilityId === old.capabilityId)
    const cap = state.capabilities.find(c => c.id === old.capabilityId)
    if (!old.enabled || (!current.directSave && !now?.enabled) || !cap?.enabled || cap.removedAt) continue
    const original = cap.versions.find(v => v.version === old.version)
    const ceilings = cap.versions.filter(v => v.version >= old.version && !v.directSave).map(activeActions)
    // A revoke followed by a later re-grant must not resurrect permissions in an old session.
    const roleCeilings = role.versions.filter(v => v.version >= snapshot.version && !v.directSave).map(v => {
      const binding = v.capabilities.find(b => b.capabilityId === old.capabilityId)
      return binding?.enabled ? binding.actions ?? activeActions(cap.versions.find(c => c.version === binding.version)) : []
    })
    for (const action of old.actions ?? activeActions(original)) if (activeActions(original).includes(action) && [...ceilings, ...roleCeilings].every(a => a.includes(action))) allowed.add(action)
  }
  return [...allowed]
}
export function browserActions(actions: readonly Action[]): Action[] { return actions.filter(action => action === 'navigate' || action === 'read' || action === 'screenshot') }
/** Published snapshots keep their skill version; removals cannot be undone for old sessions. */
export function allowedRoleSkills(state:State,roleId:string,snapshot:RoleVersion){
  const role=state.roles.find(r=>r.id===roleId)
  if(!role?.enabled||role.archivedAt)return []
  return (snapshot.skills??[]).filter(old=>old.enabled&&role.versions.filter(v=>v.version>=snapshot.version&&!v.directSave).every(v=>(v.skills??[]).some(now=>now.id===old.id&&now.name===old.name&&now.enabled)))
}
export function requiredAction(tool: string, args: Record<string, unknown>): Action | 'session' | undefined {
  if (tool === 'browser_session' && ['start', 'stop', 'list'].includes(String(args.action))) return args.url === undefined ? 'session' : 'navigate'
  if (tool === 'browser_page' && args.action === 'navigate') return 'navigate'
  if (tool === 'browser_inspect' && ['observe', 'snapshot', 'html'].includes(String(args.action))) return 'read'
  if (tool === 'browser_inspect' && args.action === 'screenshot') return 'screenshot'
}
export function callViolation(tool: string, args: Record<string, unknown>, allowed: Action[], owned: string[]): string | undefined {
  const action = requiredAction(tool, args)
  if (!action || (action === 'session' ? browserActions(allowed).length === 0 : !allowed.includes(action))) return '此岗位未获准执行该浏览器动作，或对应能力已停用。'
  if ('tabId' in args || 'device' in args) return '首期仅操作本会话创建的默认页面，不接受其他标签页或设备设置。'
  if (tool === 'browser_session' && ['start', 'list'].includes(String(args.action))) {
    if (args.session !== undefined) return '创建或列出会话时不能指定其他会话标识。'
  } else if (typeof args.session !== 'string' || !owned.includes(args.session)) return '必须显式传入本岗位会话创建的浏览器 session，不能使用其他会话的窗口。'
  if (args.url !== undefined) {
    try { const url = new URL(String(args.url)); if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return '仅支持没有嵌入凭据的 HTTP(S) 网页地址。' }
    catch { return '网页地址无效。' }
  }
}
