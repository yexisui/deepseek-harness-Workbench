// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { RequirementsAssistant } from '../src/client/RequirementsAssistant.tsx'
import { defaultRequirementSections, defaultRequirementSettings, emptyRequirement, emptyRequirementOverview, requirementMarkdown, type RequirementCommand, type RequirementTask } from '../../dsh-capabilities/src/core/requirements-model.ts'
import { getRequirementTask, listRequirementTasks, sourceText } from '../src/client/requirements-client.ts'

let root: Root | undefined
let host: HTMLDivElement
const taskId = '10000000-0000-4000-8000-000000000001'
const reqId = '10000000-0000-4000-8000-000000000002'
const now = '2026-09-29T08:00:00.000Z'
function fixture(): RequirementTask { return { schema: 1, id: taskId, revision: 1, dataRevision: 1, title: '报销需求分析', mode: 'guided', roleId: 'builtin-analyst', roleVersion: 2, capabilityId: 'requirements-analysis', capabilityVersion: 1, authorityAt: 1, roleGuidance: { name: '需求分析助手', duties: '', requirements: '', format: '' }, createdAt: now, updatedAt: now, settings: defaultRequirementSettings(), draft: '', overview: emptyRequirementOverview(), requirements: [{ ...emptyRequirement(), id: reqId, number: 'REQ-001', title: '提交报销', description: '员工在线提交申请', acceptance: '填写必填字段后可提交' }], flows: [], rules: [], questions: [], materials: [], messages: [], events: [], versions: [] } }
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }) }
function server(initial = fixture(), onCommand?: (command: RequirementCommand, task: RequirementTask) => Response | void, onCreate?: (body: Record<string, unknown>, attempt: number) => Response | void) {
  let task = structuredClone(initial)
  const commands: RequirementCommand[] = []
  const creates: Record<string, unknown>[] = []
  let createBody: Record<string, unknown> = {}
  const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    if (url.includes('/config?')) return json({ ready: true, message: '需求分析能力可用', modelConfigured: true, defaults: { depth: 'standard', questionStyle: 'short', model: '' }, revision: 1, maxTextChars: 100000 })
    if (url.endsWith(`/task/${taskId}`)) return json(task)
    if (url.endsWith('/create')) {
      createBody = JSON.parse(String(init?.body)); creates.push(createBody)
      const override = onCreate?.(createBody, creates.length); if (override) return override
      task = { ...task, requirements: [], title: String(createBody.title), mode: createBody.mode as 'guided' | 'quick', draft: String(createBody.draft ?? '') }
      return json(task)
    }
    if (url.endsWith('/command')) {
      const body = JSON.parse(String(init?.body)) as { id: string; revision: number; command: RequirementCommand }
      commands.push(body.command)
      if (body.revision !== task.revision) return json({ error: '分析记录已更新' }, 409)
      const override = onCommand?.(body.command, task); if (override) return override
      const c = body.command
      if(c.type === 'sections.save') task.sections=c.sections
      if (c.type === 'save') { if (c.draft !== undefined) task.draft = c.draft; if (c.settings) task.settings = c.settings; if (c.overview) task.overview = c.overview; if (c.mode) task.mode = c.mode }
      if (c.type === 'run') { task.draft = ''; task.messages.push({ id: 'm1', role: 'user', text: c.instruction, createdAt: now, context: c.context }); task.run = { id: c.requestId, operation: c.operation, status: 'ready', startedAt: now, model: c.model || 'default', instruction: c.instruction, baseRevision: task.dataRevision } }
      if (c.type === 'run.stop' && task.run) task.run.status = 'stopped'
      if (c.type === 'requirement.save') { const r = task.requirements.find(r => r.id === c.requirement.id); if (r) Object.assign(r, c.requirement); else task.requirements.push({ ...emptyRequirement(), ...c.requirement, id: reqId, number: 'REQ-001' }) }
      if (c.type === 'material.save') task.materials.push({ ...c.material, id: 'material-1', revision: 1, history: [] })
      if (c.type === 'proposal.apply') task.proposal!.items.forEach(item => { if (c.ids.includes(item.id)) item.accepted = true })
      if (c.type === 'question.answer') { const q = task.questions.find(q => q.id === c.id)!; q.answer = c.answer; q.status = 'answered' }
      if (c.type === 'question.status') task.questions.find(q => q.id === c.id)!.status = c.status
      if (c.type === 'document.generate') task.document = { markdown: requirementMarkdown(task, c.depth, c.selectedIds), selectedIds: c.selectedIds ?? task.requirements.filter(r => !r.removed).map(r => r.id), depth: c.depth, dataRevision: task.dataRevision, createdAt: now }
      task.revision += 1
      return json(task)
    }
    throw new Error(`Unexpected request: ${url}`)
  })
  vi.stubGlobal('fetch', fetch)
  return { commands, creates, fetch, get task() { return task }, get createBody() { return createBody } }
}
async function render(props: Partial<React.ComponentProps<typeof RequirementsAssistant>> = {}) {
  root = createRoot(host)
  await act(async () => { root!.render(<RequirementsAssistant roleId="builtin-analyst" roleVersion={2} {...props}/>); await Promise.resolve() })
}
async function click(label: string, scope: Element = host) {
  const element = button(label, scope)
  expect(element, `button ${label}`).toBeTruthy()
  await act(async () => { element!.click(); await Promise.resolve() })
}
function button(label: string, scope: Element = host) { return Array.from(scope.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent?.trim() === label || button.getAttribute('aria-label') === label) }
async function remount(props: Partial<React.ComponentProps<typeof RequirementsAssistant>> = {}) { await act(async () => root!.unmount()); root = undefined; await render(props) }
async function elapse(ms: number) { await act(async () => { await vi.advanceTimersByTimeAsync(ms) }) }
async function fill(label: string, text: string) {
  const element = host.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(`[aria-label="${label}"]`)!
  expect(element, `field ${label}`).toBeTruthy()
  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype
  await act(async () => { Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(element, text); element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true })) })
}
beforeEach(() => { (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true; sessionStorage.clear(); host = document.createElement('div'); document.body.append(host) })
afterEach(async () => { if (root) await act(async () => root?.unmount()); host.remove(); root = undefined; vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

it('creates a real analysis from the inherited input and sends the selected published role version', async () => {
  const api = server(), onCommit = vi.fn()
  await render({ initialDraft: '希望员工在线报销', onCommit, assistant: { name: '我的业务助手', color: '#123456', icon: { kind: 'builtin', id: 'analyst' } } })
  expect(host.textContent).toContain('我的业务助手')
  expect(host.querySelector<HTMLTextAreaElement>('[aria-label="需求分析输入"]')!.value).toBe('希望员工在线报销')
  await click('发送需求分析消息')
  expect(api.createBody).toMatchObject({ roleId: 'builtin-analyst', roleVersion: 2, mode: 'quick' })
  expect(api.commands).toContainEqual(expect.objectContaining({ type: 'run', operation: 'analyze', instruction: '希望员工在线报销' }))
  expect(onCommit).toHaveBeenCalledWith(expect.objectContaining({ id: taskId }))
  expect(host.querySelector<HTMLTextAreaElement>('[aria-label="需求分析输入"]')!.value).toBe('')
})

it('selects either analysis mode without creating a record, opening an editor or invoking the model', async () => {
  const api = server(), onCommit = vi.fn()
  await render({ draftKey: 'choose-only', onCommit })
  expect(host.textContent).toContain('选择分析方式')
  await click('选择简易模式')
  expect(host.querySelector('[role=dialog]')).toBeNull()
  expect(button('切换分析方式')).toBeTruthy()
  await click('切换分析方式'); await click('选择常规模式')
  await click('切换分析方式'); await click('返回对话')
  expect(api.creates).toEqual([])
  expect(api.commands).toEqual([])
  expect(onCommit).not.toHaveBeenCalled()
})

it('keeps the current task, draft and confirmed content while revisiting the chooser and changing only the next analysis mode', async () => {
  const task = fixture(); task.draft = '还需要核实审批人的权限'; task.requirements[0].status = 'confirmed'
  task.materials = [{ id: 'mat1', name: '访谈原稿', text: '员工提交报销', kind: 'text', revision: 1, history: [] }]
  task.overview = { ...task.overview, goal: '减少人工传递', scope: '部门报销' }
  task.flows = [{ id: 'flow1', name: '提交申请', actor: '员工', action: '提交', condition: '必填完整', result: '进入审批', next: '部门审核', exception: '退回', requirementIds: [reqId] }]
  task.rules = [{ id: 'rule1', name: '附件要求', condition: '有费用', action: '提供凭证', exception: '待补件', requirementIds: [reqId], sources: [] }]
  task.questions = [{ id: 'question1', number: 'Q-001', question: '是否支持代理提交？', reason: '待补充', options: [], answer: '', status: 'open', blocking: false, requirementIds: [reqId], sources: [] }]
  task.messages = [{ id: 'message1', role: 'user', text: '先整理报销功能', createdAt: now }]
  task.proposal = { id: 'proposal1', baseRevision: 1, summary: '新的建议待采用', createdAt: now, items: [{ id: 'candidate1', kind: 'overview', value: { ...task.overview, goal: '缩短处理时间' } }] }
  task.versions = [{ id: 'version1', number: 1, title: task.title, note: '已确认基线', createdAt: now, selectedIds: [reqId], data: { overview: task.overview, requirements: task.requirements, flows: [], rules: [], questions: [] }, materials: task.materials, settings: task.settings, markdown: '# 已确认版本' }]
  task.document = { markdown: '# 报销需求', dataRevision: 1, depth: 'standard', selectedIds: [reqId], createdAt: now }
  const api = server(task), before = structuredClone(task)
  await render({ taskId })
  await click('切换分析方式')
  expect(host.textContent).toContain('选择接下来如何分析')
  expect(host.textContent).toContain('报销需求分析')
  expect(button('选择常规模式')?.getAttribute('aria-pressed')).toBe('true')
  await click('需求结果'); await click('对话')
  expect(button('选择简易模式')).toBeTruthy()
  await remount({ taskId })
  expect(button('选择简易模式')).toBeTruthy()
  expect(api.commands).toEqual([])
  expect(api.task.updatedAt).toBe(now)
  await click('返回对话')
  expect(host.textContent).toContain('新的建议待采用')
  expect(host.querySelector<HTMLTextAreaElement>('[aria-label="需求分析输入"]')!.value).toBe(before.draft)
  await click('切换分析方式'); await click('选择简易模式')
  expect(api.commands).toEqual([{ type: 'save', mode: 'quick' }])
  expect(api.creates).toEqual([])
  for (const key of ['id', 'title', 'draft', 'overview', 'requirements', 'materials', 'messages', 'flows', 'rules', 'questions', 'document', 'proposal', 'versions'] as const) expect(api.task[key]).toEqual(before[key])
  await click('切换分析方式'); await click('选择简易模式')
  expect(api.commands).toHaveLength(1)
  expect(host.querySelector<HTMLTextAreaElement>('[aria-label="需求分析输入"]')!.value).toBe(before.draft)
})

it('allows opening the mode chooser during a running analysis while keeping both choices disabled and Stop available', async () => {
  const task = fixture(); task.run = { id: 'run1', operation: 'analyze', status: 'running', startedAt: now, model: 'test/model', instruction: '整理现有需求', baseRevision: 1 }
  const api = server(task); await render({ taskId })
  await click('切换分析方式')
  expect(button('选择简易模式')?.disabled).toBe(true)
  expect(button('选择常规模式')?.disabled).toBe(true)
  expect(button('停止')?.disabled).toBe(false)
  await click('选择简易模式')
  expect(api.commands).toEqual([])
  expect(api.task.run?.status).toBe('running')
  await click('停止')
  expect(api.commands).toEqual([{ type: 'run.stop' }])
  expect(api.task.run?.status).toBe('stopped')
  expect(button('选择简易模式')?.disabled).toBe(false)
  expect(api.creates).toEqual([])
})

it('persists a new nonempty draft once after typing settles, including its mode and idempotency token', async () => {
  vi.useFakeTimers()
  const api = server(), onDraftChange = vi.fn()
  await render({ draftKey: 'new-draft-a', onDraftChange })
  await click('选择简易模式')
  await fill('需求分析输入', '报销'); await elapse(500)
  await fill('需求分析输入', '报销应支持退回补充'); await elapse(500)
  expect(api.creates).toHaveLength(0)
  await elapse(1000)
  expect(api.creates).toHaveLength(1)
  expect(api.createBody).toMatchObject({ mode: 'quick', draft: '报销应支持退回补充', roleId: 'builtin-analyst', roleVersion: 2, requestId: expect.any(String) })
  expect(api.createBody.requestId).toMatch(/^[a-f0-9-]{36}$/i)
  expect(api.task.draft).toBe('报销应支持退回补充')
  expect(onDraftChange).toHaveBeenLastCalledWith('报销应支持退回补充')
  await elapse(5000)
  expect(api.creates).toHaveLength(1)
  expect(api.commands.filter(command => command.type === 'run')).toEqual([])
  expect(host.querySelector<HTMLTextAreaElement>('[aria-label="需求分析输入"]')!.value).toBe('报销应支持退回补充')
})

it('keeps a failed new draft editable and retries creation with the same request ID', async () => {
  vi.useFakeTimers()
  const api = server(fixture(), undefined, (_body, attempt) => attempt === 1 ? json({ error: '草稿保存暂时不可用' }, 503) : undefined)
  await render({ draftKey: 'retry-draft' })
  await fill('需求分析输入', '第一次输入保留'); await elapse(1500)
  expect(api.creates).toHaveLength(1)
  expect(host.querySelector('[role=alert]')?.textContent).toContain('草稿保存暂时不可用')
  expect(host.querySelector<HTMLTextAreaElement>('[aria-label="需求分析输入"]')!.value).toBe('第一次输入保留')
  await elapse(5000)
  expect(api.creates).toHaveLength(1)
  await fill('需求分析输入', '失败后继续补充的业务想法')
  await click('重试保存草稿')
  expect(api.creates).toHaveLength(2)
  expect(api.creates[1].requestId).toBe(api.creates[0].requestId)
  expect(api.task.draft).toBe('失败后继续补充的业务想法')
  expect(api.commands.filter(command => command.type === 'run')).toEqual([])
  expect(host.querySelector<HTMLTextAreaElement>('[aria-label="需求分析输入"]')!.value).toBe('失败后继续补充的业务想法')
})

it('creates only when material content is saved, keeping an opened or canceled material editor local', async () => {
  const api = server()
  await render({ draftKey: 'material-draft' })
  await click('添加需求资料')
  expect(host.querySelector('[role=dialog]')).not.toBeNull()
  await click('取消')
  expect(api.creates).toEqual([])
  await click('选择简易模式'); await click('＋ 粘贴资料')
  await fill('资料名称', '访谈原稿'); await fill('资料原文', '员工提交申请后，由部门负责人审批。')
  expect(api.creates).toEqual([])
  await click('保存修改')
  expect(api.creates).toHaveLength(1)
  expect(api.commands).toEqual([{ type: 'material.save', material: expect.objectContaining({ name: '访谈原稿', text: '员工提交申请后，由部门负责人审批。' }) }])
  expect(api.task.materials[0].name).toBe('访谈原稿')
})

it('creates the first manually saved requirement without starting an analysis', async () => {
  const api = server()
  await render({ draftKey: 'manual-requirement' })
  await click('需求结果'); await click('需求清单'); await click('＋ 新增需求')
  await fill('需求名称', '提交报销申请'); await fill('需求描述', '员工在线填写并提交报销')
  expect(api.creates).toEqual([])
  await click('保存修改')
  expect(api.creates).toHaveLength(1)
  expect(api.commands).toEqual([{ type: 'requirement.save', requirement: expect.objectContaining({ title: '提交报销申请' }) }])
  expect(api.task.requirements[0].title).toBe('提交报销申请')
})

it('isolates unsaved text and the selected view between two temporary conversation keys', async () => {
  vi.useFakeTimers()
  const api = server()
  await render({ draftKey: 'draft-a' })
  await click('选择简易模式'); await fill('需求分析输入', '甲会话未发送输入')
  await remount({ draftKey: 'draft-b' })
  expect(host.textContent).toContain('选择分析方式')
  expect(host.querySelector<HTMLTextAreaElement>('[aria-label="需求分析输入"]')!.value).toBe('')
  await fill('需求分析输入', '乙会话未发送输入')
  await remount({ draftKey: 'draft-a' })
  expect(host.querySelector<HTMLTextAreaElement>('[aria-label="需求分析输入"]')!.value).toBe('甲会话未发送输入')
  expect(button('切换分析方式')).toBeTruthy()
  expect(button('选择简易模式')).toBeUndefined()
  await remount({ draftKey: 'draft-b' })
  expect(host.querySelector<HTMLTextAreaElement>('[aria-label="需求分析输入"]')!.value).toBe('乙会话未发送输入')
  expect(button('选择简易模式')).toBeTruthy()
  expect(api.creates).toEqual([])
})

it('keeps the six workspace tabs keyboard accessible and edits a requirement with real context IDs', async () => {
  const api = server()
  await render({ taskId })
  const selectedTab = host.querySelector<HTMLButtonElement>('[role=tab][aria-selected=true]')!
  await act(async () => { selectedTab.focus(); selectedTab.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })) })
  expect(document.activeElement?.textContent).toBe('需求结果')
  expect(Array.from(host.querySelectorAll('[aria-label="需求工作区页面"] [role=tab]')).map(el => el.textContent)).toEqual(['概览', '资料', '需求清单', '流程与规则', '待确认', '需求文档'])
  await click('需求清单'); await click('REQ-001提交报销')
  await fill('需求名称', '在线提交报销'); await click('保存修改')
  expect(api.commands.at(-1)).toMatchObject({ type: 'requirement.save', requirement: { id: reqId, title: '在线提交报销' } })
  await click('讨论'); await fill('需求分析输入', '增加退回重填功能'); await click('发送需求分析消息')
  expect(api.commands.at(-1)).toMatchObject({ type: 'run', operation: 'revise', context: reqId, instruction: '增加退回重填功能' })
  expect(host.textContent).toContain('当前讨论：REQ-001 在线提交报销')
})

it('keeps automatic updates collapsed and offers the current result', async () => {
  const task=fixture();task.proposal={id:'p1',baseRevision:1,summary:'自动更新成功',createdAt:now,items:[]}
  server(task);await render({taskId})
  const summary=Array.from(host.querySelectorAll('summary')).find(s=>s.textContent?.includes('已自动整理'))!
  expect(summary.parentElement?.hasAttribute('open')).toBe(false)
  expect(button('采用选中建议')).toBeUndefined()
  await click('查看完整结果');expect(host.textContent).toContain('当前需求结果')
})

it('keeps unsaved edits on revision conflicts and requires comparing the newer object before overwriting', async () => {
  let once = true
  const api = server(fixture(), (command, task) => { if (command.type === 'requirement.save' && once) { once = false; task.requirements[0].description = '另一窗口已经修改'; task.revision += 1; return json({ error: '另一个窗口修改了该需求' }, 409) } })
  await render({ taskId }); await click('需求结果'); await click('需求清单'); await click('REQ-001提交报销')
  await fill('需求描述', '本地未保存的补充'); await click('保存修改')
  expect(host.textContent).toContain('另一个窗口修改了该需求')
  expect(host.querySelector<HTMLTextAreaElement>('[aria-label="需求描述"]')!.value).toBe('本地未保存的补充')
  await click('保存修改')
  expect(host.textContent).toContain('当前保存内容'); expect(host.textContent).toContain('另一窗口已经修改')
  expect(api.commands.filter(c => c.type === 'requirement.save')).toHaveLength(1)
  await click('采用本地修改并保存')
  expect(api.task.requirements[0].description).toBe('本地未保存的补充')
  expect(host.querySelector('[role=dialog]')).toBeNull()
})

it('preserves unsaved editor contents when reopening the analysis', async () => {
  server(); await render({ taskId }); await click('需求结果'); await click('需求清单'); await click('REQ-001提交报销'); await fill('需求名称', '待继续修改的名称')
  await act(async () => root!.unmount()); root = undefined
  await render({ taskId })
  expect(host.querySelector<HTMLInputElement>('[aria-label="需求名称"]')!.value).toBe('待继续修改的名称')
  await click('保存修改')
  expect(host.querySelector('[role=dialog]')).toBeNull()
})

it('uses the source revision retained before editing or removing a material', async () => {
  const task = fixture(); task.materials = [{ id: 'mat1', name: '当前资料', kind: 'text', text: '新版是三级审批', revision: 2, removed: true, history: [{ revision: 1, name: '访谈原稿', text: '旧版是两级审批' }] }]
  task.requirements[0].sources = [{ materialId: 'mat1', revision: 1, quote: '两级审批' }]
  expect(sourceText(task, task.requirements[0].sources[0])).toEqual({ title: '访谈原稿 · 修订 1 · 已移除', text: '旧版是两级审批' })
  server(task); await render({ taskId }); await click('需求结果'); await click('需求清单'); await click('↗ 依据 1')
  expect(host.querySelector('[role=dialog]')?.textContent).toContain('旧版是两级审批')
  expect(host.querySelector('[role=dialog]')?.textContent).not.toContain('新版是三级审批')
})

it('saves answers before proposing related edits and shows confirmation validation errors', async () => {
  const task = fixture(); task.questions = [{ id: 'q1', number: 'Q-001', question: '谁来审批？', reason: '审批人未明确', options: ['部门负责人', '财务'], answer: '', status: 'open', blocking: true, requirementIds: [reqId], sources: [] }]
  const api = server(task, c => c.type === 'requirement.status' ? json({ error: 'REQ-001 仍有关键问题待处理：Q-001' }, 400) : undefined)
  await render({ taskId }); await click('需求结果'); await click('待确认'); await click('部门负责人'); await click('保存回答')
  expect(api.commands.at(-1)).toMatchObject({ type: 'question.answer', id: 'q1', answer: '部门负责人' })
  await click('根据回答更新建议')
  expect(api.commands.at(-1)).toMatchObject({ type: 'run', operation: 'revise', context: 'q1' })
  await click('需求结果'); await click('需求清单'); await click('确认')
  expect(host.querySelector('[role=alert]')?.textContent).toContain('REQ-001 仍有关键问题待处理：Q-001')
})

it('preserves an unsubmitted question answer after reopening without treating it as a saved decision', async () => {
  const task = fixture(); task.questions = [{ id: 'q1', number: 'Q-001', question: '谁来审批？', reason: '', options: [], answer: '', status: 'open', blocking: true, requirementIds: [reqId], sources: [] }]
  const api = server(task); await render({ taskId }); await click('需求结果'); await click('待确认'); await fill('回答 Q-001', '需要向财务负责人核实')
  await act(async () => root!.unmount()); root = undefined
  await render({ taskId }); await click('需求结果'); await click('待确认')
  expect(host.querySelector<HTMLTextAreaElement>('[aria-label="回答 Q-001"]')!.value).toBe('需要向财务负责人核实')
  expect(api.task.questions[0].status).toBe('open'); expect(api.commands).toEqual([])
})

it('builds a document from selected items and renders user HTML as plain text', async () => {
  const task = fixture(); task.requirements[0].description = '<img src=x onerror=alert(1)>'; const api = server(task)
  await render({ taskId }); await click('需求结果'); await click('需求清单')
  await act(async () => host.querySelector<HTMLInputElement>('[aria-label="选择 REQ-001"]')!.click())
  await click('生成所选文档')
  expect(host.textContent).toContain('当前需求结果')
  expect(host.textContent).toContain('<img src=x onerror=alert(1)>'); expect(host.querySelector('img[src=x]')).toBeNull()
  const copy = vi.fn(async () => {}); Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: copy } })
  await click('复制'); expect(copy).toHaveBeenCalledWith(expect.stringContaining('REQ-001'))
  expect(api.commands.at(-1)).toMatchObject({ type: 'export', format: 'clipboard' })
})

it('reads history with pagination and keeps server errors for the user', async () => {
  const fetch = vi.fn(async (input: string | URL | Request) => String(input).includes('/tasks?') ? json({ items: [], total: 83 }) : json({ error: '记录不存在' }, 404)); vi.stubGlobal('fetch', fetch)
  expect(await listRequirementTasks({ offset: 40, limit: 40 })).toEqual({ items: [], total: 83 })
  expect(fetch).toHaveBeenCalledWith('/api/capabilities/requirements/tasks?offset=40&limit=40', expect.objectContaining({ credentials: 'same-origin' }))
  await expect(getRequirementTask('missing')).rejects.toMatchObject({ message: '记录不存在', status: 404 })
})

 it('edits custom sections with shared switches and keyboard sorting without dropping deselected content',async()=>{
 const task=fixture();task.sections=defaultRequirementSections();task.sections[0].content='已有问题';const api=server(task)
 await render({taskId});await click('需求结果');await click('编辑内容与栏目')
 await act(async()=>host.querySelector<HTMLInputElement>('[aria-label="选择栏目 当前问题"]')!.click())
 await click('＋ 新增栏目');await fill('栏目名称 7','业务边界');await fill('编辑 业务边界','只调整保存')
 const row=host.querySelector<HTMLElement>('[aria-label="调整顺序：业务边界"]')!
 await act(async()=>{row.focus();row.dispatchEvent(new KeyboardEvent('keydown',{key:' ',bubbles:true}))})
 await act(async()=>row.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true})))
 await act(async()=>row.dispatchEvent(new KeyboardEvent('keydown',{key:' ',bubbles:true})))
 await click('保存')
 expect(api.task.sections?.[5].title).toBe('业务边界');expect(api.task.sections?.[0]).toMatchObject({enabled:false,content:'已有问题'})
 expect(api.commands.at(-1)).toMatchObject({type:'sections.save',baseDataRevision:1});expect(host.textContent).toContain('只调整保存')
})
