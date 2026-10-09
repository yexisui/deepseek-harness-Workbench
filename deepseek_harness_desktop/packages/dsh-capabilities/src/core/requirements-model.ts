/** Persisted requirements contracts. Pure data and rendering, shared by host and UI. */
export const REQUIREMENTS_CAPABILITY_ID = 'requirements-analysis'
export const REQUIREMENTS_COMPONENT_ID = 'requirements-service'
export const REQUIREMENTS_ROLE_ID = 'builtin-analyst'
export type RequirementStatus = 'pending' | 'confirmed' | 'review' | 'deferred'
export type SourceRef = { materialId?: string; revision?: number; messageId?: string; quote: string }
export type Requirement = {
  id: string; number: string; title: string; description: string; module: string
  kind: 'functional' | 'nonfunctional' | 'constraint'; priority: 'must' | 'should' | 'could'
  status: RequirementStatus; actor: string; trigger: string; preconditions: string; steps: string
  rules: string; exceptions: string; inputs: string; outputs: string; acceptance: string
  sources: SourceRef[]; origin: 'user' | 'source' | 'assistant'; removed?: boolean; replaces?: string[]
}
export type RequirementMaterial = { id: string; name: string; kind: 'text' | 'txt' | 'markdown'; text: string; revision: number; removed?: boolean; history: { revision: number; text: string; name: string }[] }
export type RequirementFlow = { id: string; name: string; actor: string; action: string; condition: string; result: string; next: string; exception: string; requirementIds: string[] }
export type RequirementRule = { id: string; name: string; condition: string; action: string; exception: string; requirementIds: string[]; sources: SourceRef[] }
export type RequirementQuestion = { id: string; number: string; question: string; reason: string; options: string[]; answer: string; status: 'open' | 'answered' | 'resolved' | 'deferred' | 'dismissed'; blocking: boolean; requirementIds: string[]; sources: SourceRef[] }
export type RequirementSettings = { purpose: 'discussion' | 'review' | 'handoff'; depth: 'brief' | 'standard' | 'detailed'; focus: string; questionStyle: 'short' | 'detailed'; model: string; language: string }
export type RequirementOverview = { background: string; goal: string; scope: string; excluded: string; roles: string }
export type RequirementData = { overview: RequirementOverview; requirements: Requirement[]; flows: RequirementFlow[]; rules: RequirementRule[]; questions: RequirementQuestion[] }
export type RequirementMessage = { runId?: string; id: string; role: 'user' | 'assistant'; text: string; createdAt: string; context?: string }
export type RequirementEvent = { runId?: string; id: string; at: string; kind: 'material' | 'analysis' | 'change' | 'confirm' | 'export' | 'version'; text: string; objectId?: string }
export type ProposalItem = { id: string; kind: 'requirement' | 'flow' | 'rule' | 'question' | 'overview'; targetId?: string; value: Requirement | RequirementFlow | RequirementRule | RequirementQuestion | RequirementOverview; accepted?: boolean; rejected?: boolean }
export type RequirementProposal = { sections?: {id:string;content:string}[]; id: string; baseRevision: number; summary: string; items: ProposalItem[]; createdAt: string }
export type RequirementRun = { id: string; operation: 'analyze' | 'clarify' | 'check' | 'revise' | 'document'; status: 'running' | 'ready' | 'error' | 'stopped' | 'interrupted'; startedAt: string; finishedAt?: string; error?: string; model: string; instruction: string; context?: string; baseRevision: number }
export type RequirementVersion = { id: string; number: number; title: string; note: string; createdAt: string; selectedIds: string[]; data: RequirementData; materials: RequirementMaterial[]; settings: RequirementSettings; markdown: string }
export type RequirementDocument = { markdown: string; dataRevision: number; depth: RequirementSettings['depth']; selectedIds: string[]; createdAt: string }
export type RequirementSection = { id: string; title: string; guidance: string; enabled: boolean; content: string; contentSet?: boolean }
export type RequirementProject = { path: string; ledger: boolean; ledgerName: string; files: string[]; error?: string }
export type RequirementRevision = { id: string; at: string; summary: string; sections: RequirementSection[]; data: RequirementData }
export const defaultRequirementSections = (): RequirementSection[] => [
  ['problem','当前问题','现在是什么情况，有哪些具体表现'], ['outcome','期望结果','调整后的行为和结果'],
  ['changes','本次修改要求','逐条列出要实现的行为'], ['preserve','保留要求','必须保持的原有行为'],
  ['questions','待确认问题','尚不明确、冲突或需要业务决定的内容'], ['acceptance','验收示例','输入或操作以及预期结果'],
].map(([id,title,guidance])=>({id,title,guidance,enabled:true,content:''}))
export function requirementSectionContent(section: RequirementSection, task: RequirementData): string {
  if(section.contentSet || section.content) return section.content
  const rows=activeRequirements(task)
  const fallback: Record<string,string>={problem:task.overview.background,outcome:task.overview.goal,
    changes:rows.map(r=>r.number+' '+r.title+'：'+r.description+(r.origin==='assistant'?'（助手建议）':'')).join('\n'),
    preserve:rows.filter(r=>r.kind==='constraint').map(r=>r.description).join('\n'),
    questions:openQuestions(task).map(q=>q.number+' '+q.question+(q.answer?'；当前答复：'+q.answer:'')).join('\n'),
    acceptance:rows.map(r=>r.acceptance?r.number+' '+r.acceptance:'').filter(Boolean).join('\n')}
  return fallback[section.id]??''
}
export type RequirementTask = RequirementData & {
  sections?: RequirementSection[]; project?: RequirementProject; revisions?: RequirementRevision[]

  schema: 1; id: string; revision: number; dataRevision: number; title: string; mode: 'quick' | 'guided'
  roleId: string; roleVersion: number; capabilityId: string; capabilityVersion: number; authorityAt: number
  roleGuidance: { name: string; duties: string; requirements: string; format: string }
  createdAt: string; updatedAt: string; settings: RequirementSettings; draft: string
  materials: RequirementMaterial[]; messages: RequirementMessage[]; events: RequirementEvent[]
  proposal?: RequirementProposal; run?: RequirementRun; document?: RequirementDocument; versions: RequirementVersion[]
}
export type RequirementSummary = Pick<RequirementTask, 'id' | 'title' | 'mode' | 'updatedAt' | 'roleId' | 'roleVersion'> & { confirmed: number; total: number; openQuestions: number; running: boolean }
export type RequirementDefaults = Pick<RequirementSettings, 'depth' | 'questionStyle' | 'model'>
export type RequirementAvailability = { ready: boolean; message: string; modelConfigured: boolean; defaults: RequirementDefaults; revision: number; maxTextChars: number }
export type RequirementCommand =
  | { type: 'sections.save'; sections: RequirementSection[]; baseDataRevision?: number }
  | { type: 'revision.restore'; id: string }
  | { type: 'project.attach'; path: string; ledger: boolean }
  | { type: 'project.detach' }
  | { type: 'project.refresh' }
  | { type: 'project.import'; path: string }
  | { type: 'project.importMany'; paths: string[] }
  | { type: 'materials.import'; materials: Pick<RequirementMaterial, 'name' | 'kind' | 'text'>[] }
  | { type: 'save'; title?: string; overview?: RequirementOverview; settings?: RequirementSettings; draft?: string; mode?: 'quick' | 'guided' }
  | { type: 'material.save'; material: Partial<RequirementMaterial> & { name: string; kind: RequirementMaterial['kind']; text: string } }
  | { type: 'material.remove'; id: string; removed: boolean }
  | { type: 'requirement.save'; requirement: Partial<Requirement> & { title: string }; replaces?: string[] }
  | { type: 'requirement.status'; ids: string[]; status: RequirementStatus }
  | { type: 'requirement.remove'; ids: string[]; removed: boolean }
  | { type: 'requirement.split'; id: string; titles: string[] }
  | { type: 'requirement.merge'; ids: string[]; title: string }
  | { type: 'flow.save'; flow: Partial<RequirementFlow> & { name: string } }
  | { type: 'flow.remove'; id: string }
  | { type: 'flow.move'; id: string; direction: -1 | 1 }
  | { type: 'rule.save'; rule: Partial<RequirementRule> & { name: string } }
  | { type: 'rule.remove'; id: string }
  | { type: 'question.save'; question: Partial<RequirementQuestion> & { question: string } }
  | { type: 'question.answer'; id: string; answer: string }
  | { type: 'question.status'; id: string; status: RequirementQuestion['status'] }
  | { type: 'proposal.apply'; proposalId: string; ids: string[] }
  | { type: 'proposal.reject'; proposalId: string; ids: string[] }
  | { type: 'run'; operation: RequirementRun['operation']; instruction: string; context?: string; model?: string; requestId: string }
  | { type: 'run.stop' }
  | { type: 'document.generate'; depth: RequirementSettings['depth']; selectedIds?: string[] }
  | { type: 'version.create'; selectedIds: string[]; note: string }
  | { type: 'version.restore'; id: string }
  | { type: 'export'; format: 'markdown' | 'clipboard' | 'print'; versionId?: string }

export const defaultRequirementSettings = (): RequirementSettings => ({ purpose: 'discussion', depth: 'standard', focus: '流程、权限、异常', questionStyle: 'short', model: '', language: '中文' })
export const emptyRequirementOverview = (): RequirementOverview => ({ background: '', goal: '', scope: '', excluded: '', roles: '' })
export const emptyRequirement = (): Omit<Requirement, 'id' | 'number'> => ({ title: '', description: '', module: '', kind: 'functional', priority: 'must', status: 'pending', actor: '', trigger: '', preconditions: '', steps: '', rules: '', exceptions: '', inputs: '', outputs: '', acceptance: '', sources: [], origin: 'user' })
export const requirementStatusNames: Record<RequirementStatus, string> = { pending: '待确认', confirmed: '已确认', review: '待复核', deferred: '暂缓' }
export const questionStatusNames: Record<RequirementQuestion['status'], string> = { open: '待回答', answered: '已回答·待处理', resolved: '已解决', deferred: '暂缓', dismissed: '不适用' }
export const activeRequirements = (task: RequirementData) => task.requirements.filter(item => !item.removed)
export const openQuestions = (task: RequirementData) => task.questions.filter(item => !['resolved', 'dismissed'].includes(item.status))
export function requirementMarkdown(task: RequirementData & { title: string; materials?: RequirementMaterial[]; sections?: RequirementSection[] }, depth: RequirementSettings['depth'] = 'standard', selectedIds?: string[]): string {
  if(task.sections && !selectedIds) return ['# '+task.title, '> 需求工作草稿；需求确认不代表实现或验收完成。', ...task.sections.filter(s=>s.enabled).map(s=>'## '+s.title+'\n\n'+(requirementSectionContent(s,task)||'待补充'))].join('\n\n')+'\n'
  const requirements = activeRequirements(task).filter(item => !selectedIds || selectedIds.includes(item.id))
  const included = new Set(requirements.map(item => item.id))
  const related = (ids: string[]) => !ids.length || ids.some(id => included.has(id))
  const value = (s: string) => s.trim() || '待确认'
  const sourceLabel = (source: SourceRef) => {
    const material = task.materials?.find(m => m.id === source.materialId)
    const name = material && source.revision !== material.revision ? material.history.find(h => h.revision === source.revision)?.name ?? material.name : material?.name
    return `${name ?? (source.messageId ? '用户对话' : '保留的资料引文')}${source.revision ? ` · 修订 ${source.revision}` : ''}「${source.quote}」`
  }
  const lines = [`# ${task.title || '需求说明'}`, '', '## 业务背景与目标', '', `背景：${value(task.overview.background)}`, '', `目标：${value(task.overview.goal)}`, '', '## 范围与角色', '', `本次范围：${value(task.overview.scope)}`, '', `暂不包含：${value(task.overview.excluded)}`, '', `使用角色：${value(task.overview.roles)}`]
  if (depth !== 'brief') {
    lines.push('', '## 业务流程', '')
    for (const [i, step] of task.flows.filter(f => related(f.requirementIds)).entries()) lines.push(`${i + 1}. ${step.name}｜${value(step.actor)}：${value(step.action)}`, `   条件：${value(step.condition)}；结果：${value(step.result)}；下一步：${value(step.next)}；异常：${value(step.exception)}`)
  }
  lines.push('', '## 需求清单', '')
  for (const r of requirements) {
    lines.push(`### ${r.number} ${r.title}`, '', `状态：${requirementStatusNames[r.status]}｜优先级：${({ must: '必须', should: '应该', could: '可以' })[r.priority]}｜模块：${value(r.module)}`, '', value(r.description), '', `验收标准：${value(r.acceptance)}`)
    if (depth !== 'brief') for (const [label, field] of [['角色',r.actor],['触发条件',r.trigger],['前置条件',r.preconditions],['操作步骤',r.steps],['业务规则',r.rules],['异常处理',r.exceptions]]) lines.push('', `${label}：${value(field)}`)
    if (depth === 'detailed') lines.push('', `输入：${value(r.inputs)}`, '', `输出：${value(r.outputs)}`)
    lines.push('', `来源：${r.sources.length ? r.sources.map(sourceLabel).join('；') : r.origin === 'user' ? '用户手工整理' : '助手建议，待核实依据'}`)
  }
  if (depth !== 'brief') {
    lines.push('', '## 业务规则', '')
    for (const r of task.rules.filter(r=>related(r.requirementIds))) lines.push(`- ${r.name}：${value(r.condition)} → ${value(r.action)}；例外：${value(r.exception)}`)
  }
  lines.push('', '## 待确认事项', '')
  for (const q of openQuestions(task).filter(q=>related(q.requirementIds))) lines.push(`- ${q.number} ${q.question}（${questionStatusNames[q.status]}${q.blocking ? '，影响确认' : ''}）${q.answer ? `\n  当前答复：${q.answer}` : ''}`)
  if (!openQuestions(task).filter(q=>related(q.requirementIds)).length) lines.push('当前范围暂无未处理问题。')
  lines.push('', '## 资料来源', '')
  for (const m of task.materials ?? []) lines.push(`- ${m.name}，修订 ${m.revision}${m.removed ? '（已从后续分析移除，引用快照保留）' : ''}`)
  return lines.join('\n') + '\n'
}
