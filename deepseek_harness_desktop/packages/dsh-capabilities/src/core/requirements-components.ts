import type { Action, Definition, Part, State } from './model.ts'

export const requirementParts: Part[] = [
  { componentId: 'requirement-document', actions: ['edit-requirement-document'] },
  { componentId: 'requirement-writing', actions: ['write-requirement-document'] },
  { componentId: 'requirement-questions', actions: ['ask-requirement-sources'] },
  { componentId: 'requirement-review', actions: ['review-requirement-document'] },
]
export const requirementActions: Action[] = ['analyze-requirements', ...requirementParts.flatMap(p => p.actions)]
export type RequirementOperation = 'legacy' | 'importTemplate' | 'importSource' | 'edit' | 'write' | 'ask' | 'review' | 'retrieve'
export type RequirementAccess = Record<RequirementOperation, { allowed: boolean; message: string }>
export function requirementAccess(actions: readonly Action[]): RequirementAccess {
  const has = (action: Action) => actions.includes(action)
  const entry = (allowed: boolean, message: string) => ({ allowed, message: allowed ? '' : message })
  return {
    legacy: entry(has('analyze-requirements'), '旧需求整理组件未启用'),
    importTemplate: entry(has('edit-requirement-document'), '模板文档处理组件未启用'),
    importSource: entry(has('edit-requirement-document') || has('ask-requirement-sources'), '请启用模板文档处理或资料问答组件'),
    edit: entry(has('edit-requirement-document'), '模板文档处理组件未启用'),
    write: entry(has('write-requirement-document') && has('edit-requirement-document') && has('review-requirement-document'), 'AI编写需要模板文档处理、AI需求编写和文档审阅与版本组件'),
    ask: entry(has('ask-requirement-sources'), '资料问答组件未启用'),
    review: entry(has('review-requirement-document') && has('edit-requirement-document'), '审阅需要模板文档处理和文档审阅与版本组件'),
    retrieve: entry(has('search-knowledge'), '外部知识库检索组件未关联或未启用'),
  }
}

/** Split the old local grant without adding external access or renumbering historical bindings. */
export function migrateRequirementComponents(state: State): boolean {
  if (state.requirementsComponentsVersion === 1) return false
  const cap = state.capabilities.find(c => c.id === 'requirements-analysis')
  const expand = (value: Definition) => {
    if (!value.components.some(p => p.componentId === 'requirements-service' && p.actions.includes('analyze-requirements'))) return
    value.components.push(...structuredClone(requirementParts.filter(p => !value.components.some(old => old.componentId === p.componentId))))
  }
  if (cap) {
    expand(cap.draft)
    for (const version of cap.versions) expand(version)
    for (const role of state.roles) for (const version of [role.draft, ...role.versions]) for (const binding of version.capabilities) {
      if (binding.capabilityId === cap.id && binding.actions?.includes('analyze-requirements')) {
        const target = cap.versions.find(v => v.version === binding.version)
        if (target) binding.actions = [...new Set([...binding.actions, ...target.components.filter(p => requirementParts.some(part => part.componentId === p.componentId)).flatMap(p => p.actions)])]
      }
    }
  }
  state.requirementsComponentsVersion = 1
  return true
}
