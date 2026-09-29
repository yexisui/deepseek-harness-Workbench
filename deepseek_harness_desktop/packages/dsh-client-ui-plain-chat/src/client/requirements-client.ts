import type { RequirementAvailability, RequirementCommand, RequirementSettings, RequirementSummary, RequirementTask } from '../../../dsh-capabilities/src/core/requirements-model.ts'

export class RequirementsApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); this.name = 'RequirementsApiError' }
}
const endpoint = '/api/capabilities/requirements'
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${endpoint}${path}`, { credentials: 'same-origin', ...init })
  const body = await response.json().catch(() => ({ error: '需求分析服务未返回有效数据，请检查工作台运行状态。' }))
  if (!response.ok) throw new RequirementsApiError(body.error || `请求失败（${response.status}）`, response.status)
  return body as T
}
function post<T>(path: string, body: unknown) { return request<T>(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) }
export const getRequirementConfig = (roleId: string) => request<RequirementAvailability>(`/config?roleId=${encodeURIComponent(roleId)}`)
export const getRequirementTask = (id: string) => request<RequirementTask>(`/task/${encodeURIComponent(id)}`)
export const listRequirementTasks = ({ offset = 0, limit = 40 }: { offset?: number; limit?: number } = {}) => request<{ items: RequirementSummary[]; total: number }>(`/tasks?offset=${offset}&limit=${limit}`)
export const deleteRequirementTask = (id: string) => request<{ ok: boolean }>(`/task/${encodeURIComponent(id)}`, { method: 'DELETE' })
export const createRequirementTask = (body: { roleId: string; roleVersion?: number; mode: 'quick' | 'guided'; title: string; settings?: RequirementSettings; requestId?: string; draft?: string }) => post<RequirementTask>('/create', body)
export const commandRequirementTask = (id: string, revision: number, command: RequirementCommand) => post<RequirementTask>('/command', { id, revision, command })
export const summarizeRequirementTask = (task: RequirementTask): RequirementSummary => ({ id: task.id, title: task.title, mode: task.mode, updatedAt: task.updatedAt, roleId: task.roleId, roleVersion: task.roleVersion, confirmed: task.requirements.filter(r => !r.removed && r.status === 'confirmed').length, total: task.requirements.filter(r => !r.removed).length, openQuestions: task.questions.filter(q => !['resolved', 'dismissed'].includes(q.status)).length, running: task.run?.status === 'running' })

export function sourceText(task: RequirementTask, source: { materialId?: string; revision?: number; messageId?: string; quote: string }): { title: string; text: string } {
  if (source.materialId) {
    const material = task.materials.find(m => m.id === source.materialId)
    if (!material) return { title: '原资料不可用 · 保留引用片段', text: source.quote }
    const revision = source.revision ?? material.revision
    const entry = revision === material.revision ? material : material.history.find(h => h.revision === revision)
    return { title: `${entry?.name ?? material.name} · 修订 ${revision}${material.removed ? ' · 已移除' : ''}`, text: entry?.text ?? source.quote }
  }
  const message = task.messages.find(m => m.id === source.messageId)
  return { title: message ? `对话依据 · ${new Date(message.createdAt).toLocaleString()}` : '引用片段', text: message?.text ?? source.quote }
}
