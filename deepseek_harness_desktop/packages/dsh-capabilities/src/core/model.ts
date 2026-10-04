/** JSON-only contract shared by the host and UI; never imports a host service. */
import { defaultRoles, MEETING_CAPABILITY_ID } from './default-roles.ts'
import type { RoleIconSpec } from './appearance.ts'
import { REQUIREMENTS_CAPABILITY_ID, REQUIREMENTS_COMPONENT_ID } from './requirements-model.ts'
import { DEVELOPER_CAPABILITY_ID, developerParts } from './developer-model.ts'
export type Action = 'navigate' | 'read' | 'screenshot' | 'transcribe' | 'analyze-requirements' | 'develop' | 'inspect-git' | 'verify-code'
export type Part = { componentId: string; actions: Action[] }
export type Definition = { name: string; description: string; instructions: string; components: Part[]; excludedDependencies?: string[]; componentOrder?: string[] }
export type Version = Definition & { version: number; createdAt: string }
export type Capability = { id: string; source: 'builtin' | 'local'; enabled: boolean; pinned: boolean; removedAt?: string; draft: Definition; versions: Version[] }
export type Binding = { capabilityId: string; version: number; enabled: boolean; actions?: Action[] }
export type RoleDefinition = { name: string; color: string; icon?: RoleIconSpec; duties: string; requirements: string; format: string; capabilities: Binding[] }
export type RoleVersion = RoleDefinition & { version: number; preset: string; createdAt: string }
export type Role = { id: string; enabled: boolean; draft: RoleDefinition; versions: RoleVersion[] }
export type State = { componentRestrictions?: Record<string, { enabled?: boolean; revokedAt?: number }>; schema: 1; revision: number; updatedAt: string; capabilities: Capability[]; roles: Role[]; defaultRolesVersion?: 1 | 2; meetingCapabilityVersion?: 1; requirementsCapabilityVersion?: 1; developerCapabilityVersion?: 1; stoppedSessions?: string[]; revokedAt?: Record<string, number> }
export type Component = {
  id: string; name: string; provider: string; version: string; actions: readonly Action[]; dependencies: readonly string[]
  icon: 'browser' | 'audio' | 'document'; sourceLabel: string; management: 'browser' | 'meeting-asr' | 'requirements' | 'developer'; pluginModule?: string
  /** Exclusive workflows cannot be assembled into unrelated capabilities until their execution adapter supports it. */
  capabilityIds?: readonly string[]; required?: boolean; compositionVersion: 1 | 2
}
export const browserPackage = '@wxg-prc-cpg/browser-skill-dsh-plugin'
export const components: readonly Component[] = [
  ...developerParts.map((part, i): Component => ({ id: part.componentId, name: ['项目文件与开发对话', 'Git 变更与版本', '项目验证运行'][i]!, provider: i === 1 ? '@linxin666/dsh-client-ui-git-graph' : '@linxin666/dsh-capabilities', version: '1.0.0', actions: [...part.actions], dependencies: [], icon: 'document', sourceLabel: '内置开发服务', management: 'developer', capabilityIds: [DEVELOPER_CAPABILITY_ID], required: true, compositionVersion: 2 })),
  { id: 'browserskill', name: '浏览器操作', provider: browserPackage, version: '0.3.0', actions: ['navigate', 'read', 'screenshot'], dependencies: ['@deepseek-ai/dsh-tools', '@deepseek-ai/dsh-agent', '@deepseek-ai/dsh-session', '@deepseek-ai/dsh-skill', '@deepseek-ai/dsh-attachment', 'bsk', 'browser-extension'], icon: 'browser', sourceLabel: 'BrowserSkill', management: 'browser', pluginModule: '@linxin666/dsh-capabilities/browser', compositionVersion: 1 },
  { id: 'meeting-asr', name: '会议录音转写', provider: '@linxin666/dsh-capabilities', version: '1.0.0', actions: ['transcribe'], dependencies: [], icon: 'audio', sourceLabel: '内置会议服务', management: 'meeting-asr', capabilityIds: [MEETING_CAPABILITY_ID], required: true, compositionVersion: 2 },
  { id: REQUIREMENTS_COMPONENT_ID, name: '需求分析服务', provider: '@linxin666/dsh-capabilities', version: '1.0.0', actions: ['analyze-requirements'], dependencies: [], icon: 'document', sourceLabel: '内置需求服务', management: 'requirements', capabilityIds: [REQUIREMENTS_CAPABILITY_ID], required: true, compositionVersion: 2 },
]
export const actionNames: Record<Action, string> = { navigate: '打开网页', read: '读取网页', screenshot: '截取页面', transcribe: '转写录音', 'analyze-requirements': '分析与整理需求', develop: '读取与按任务授权编辑项目', 'inspect-git': '审阅差异与手动 Git 操作', 'verify-code': '运行已确认的项目检查' }
export const emptyDefinition = (): Definition => ({ name: '', description: '', instructions: '', components: [] })
export const emptyRole = (): RoleDefinition => ({ name: '', color: '#4F73E8', duties: '', requirements: '', format: '', capabilities: [] })
export const latest = <T>(versions: T[]): T | undefined => versions.at(-1)
export function meetingCapability(now: string): Capability {
  const definition: Definition = { name: '会议录音转写', description: '上传会议录音并转写，支持按时间定位和核对原文；纪要由工作台模型生成。', instructions: '使用已配置的兼容语音识别接口处理录音。录音与转写内容仅在会议对话中使用；生成纪要前核对重要结论。', components: [{ componentId: 'meeting-asr', actions: ['transcribe'] }] }
  return { id: MEETING_CAPABILITY_ID, source: 'builtin', enabled: true, pinned: false, draft: definition, versions: [{ ...structuredClone(definition), version: 1, createdAt: now }] }
}
export function initialState(now = new Date().toISOString()): State {
  const definition: Definition = { name: '浏览器操作', description: '在独立浏览器窗口中打开、读取网页与截图。', instructions: '先说明目标，再打开网页并读取结果。仅使用已授权的浏览器动作；完成后关闭本会话的浏览器窗口。', components: [{ componentId: 'browserskill', actions: ['navigate', 'read', 'screenshot'] }] }
  return { schema: 1, revision: 0, updatedAt: now, defaultRolesVersion: 2, meetingCapabilityVersion: 1, requirementsCapabilityVersion: 1, developerCapabilityVersion: 1, roles: defaultRoles(now), capabilities: [{ id: 'browser', source: 'builtin', enabled: true, pinned: true, draft: definition, versions: [{ ...structuredClone(definition), version: 1, createdAt: now }] }, meetingCapability(now), requirementsCapability(now), developerCapability(now)] }
}
export function developerCapability(now: string): Capability {
  const definition: Definition = { name: '开发工作区', description: '围绕本地项目开发、查看 Git 变更、管理版本和运行检查。', instructions: '先绑定项目，默认只读。用户允许编辑后在项目内修改文件；提交由用户预览并主动触发。验证结果绑定代码版本。', components: developerParts.map(p => ({ componentId: p.componentId, actions: [...p.actions] })) }
  return { id: DEVELOPER_CAPABILITY_ID, source: 'builtin', enabled: true, pinned: false, draft: definition, versions: [{ ...structuredClone(definition), version: 1, createdAt: now }] }
}
export function requirementsCapability(now: string): Capability {
  const definition: Definition = { name: '需求分析', description: '通过对话澄清业务目标，将资料整理为有来源、可确认和持续修订的需求清单与文档。', instructions: '依据用户描述和提供的资料分析需求。区分原文依据、用户确认与助手建议；缺少的信息形成待确认问题。先展示修改建议，采用后更新需求草稿。', components: [{ componentId: REQUIREMENTS_COMPONENT_ID, actions: ['analyze-requirements'] }] }
  return { id: REQUIREMENTS_CAPABILITY_ID, source: 'builtin', enabled: true, pinned: false, draft: definition, versions: [{ ...structuredClone(definition), version: 1, createdAt: now }] }
}
export type Command =
  | { type: 'capability.save'; id?: string; definition: Definition; publish: boolean; applyToRoles?: string[] }
  | { type: 'capability.copy'; id: string }
  | { type: 'capability.toggle'; id: string; enabled: boolean }
  | { type: 'capability.pin'; id: string; pinned: boolean }
  | { type: 'capability.remove'; id: string }
  | { type: 'capability.restore'; id: string }
  | { type: 'capability.restoreMany'; ids: string[] }
  | { type: 'capability.purge'; ids: string[] }
  | { type: 'role.save'; id?: string; definition: RoleDefinition; publish: boolean }
  | { type: 'role.copy'; id: string }
  | { type: 'role.toggle'; id: string; enabled: boolean }
export type Health = { checkedAt: string | null; installed: boolean; loaded: boolean; state: 'unknown' | 'missing' | 'disconnected' | 'ready' | 'degraded'; message: string; cliVersion?: string; browsers: { id: string; name: string }[] }
export type Task = { sessionId: string; roleId: string; roleVersion: number; name: string; status: 'idle' | 'running' | 'stopping' | 'stopped' | 'error'; error?: string; action?: string; browserSessions: string[] }
export type DependencyHealth = { id: string; installed: boolean; loaded: boolean; version?: string; pendingRestart: boolean }
export type Snapshot = { compositionVersion?: 1 | 2; state: State; components: readonly Component[]; health: Health; tasks: Task[]; dependencies?: DependencyHealth[]; registry?: import("./component-registry.ts").ComponentRegistry; componentActivities?: import("./component-registry.ts").ComponentActivity[] }

export function resolveBinding(state: State, binding: Binding): Version | undefined {
  return state.capabilities.find(c => c.id === binding.capabilityId)?.versions.find(v => v.version === binding.version)
}
export function actionsOf(definition?: Definition): Action[] {
  // Incomplete drafts must never confer authority, even if loaded as a version by an old client.
  return [...new Set(definition?.components.flatMap(part => {
    const descriptor = components.find(c => c.id === part.componentId)
    return descriptor?.dependencies.some(dep => definition.excludedDependencies?.includes(dep)) ? [] : part.actions
  }) ?? [])]
}
/** 永久删除必须保护所有历史岗位版本，不能只检查当前列表或活动会话。 */
export function capabilityDeletionReferences(state: State, capabilityId: string): Role[] {
  return state.roles.filter(role => role.draft.capabilities.some(binding => binding.capabilityId === capabilityId)
    || role.versions.some(version => version.capabilities.some(binding => binding.capabilityId === capabilityId)))
}
export function references(state: State, componentId: string, tasks: Task[] = []) {
  const capabilities = state.capabilities.filter(c => c.draft.components.some(p => p.componentId === componentId) || c.versions.some(v => v.components.some(p => p.componentId === componentId)))
  const roles = state.roles.filter(r => r.draft.capabilities.some(b => resolveBinding(state, b)?.components.some(p => p.componentId === componentId)) || r.versions.some(v => v.capabilities.some(b => resolveBinding(state, b)?.components.some(p => p.componentId === componentId))))
  const active = tasks.filter(t => !['stopped'].includes(t.status) && state.roles.find(r => r.id === t.roleId)?.versions.find(v => v.version === t.roleVersion)?.capabilities.some(b => b.enabled && resolveBinding(state, b)?.components.some(p => p.componentId === componentId)))
  return { capabilities, roles, tasks: active }
}

export const rolePresentation = (role: Role): RoleDefinition => latest(role.versions) ?? role.draft
export function roleHasUnpublishedChanges(role: Role) {
  const published = latest(role.versions)
  return !!published && (['name', 'color', 'icon', 'duties', 'requirements', 'format', 'capabilities'] as const).some(key => JSON.stringify(role.draft[key]) !== JSON.stringify(published[key]))
}
