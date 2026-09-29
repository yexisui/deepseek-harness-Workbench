// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { RequirementsAssistant } from '../src/client/RequirementsAssistant.tsx'
import { defaultRequirementSettings, emptyRequirement, emptyRequirementOverview, requirementMarkdown, type RequirementCommand, type RequirementTask } from '../../dsh-capabilities/src/core/requirements-model.ts'
import { getRequirementTask, listRequirementTasks, sourceText } from '../src/client/requirements-client.ts'

let root: Root | undefined
let host: HTMLDivElement
const taskId = '10000000-0000-4000-8000-000000000001'
const reqId = '10000000-0000-4000-8000-000000000002'
const now = '2026-09-29T08:00:00.000Z'
function fixture(): RequirementTask { return { schema: 1, id: taskId, revision: 1, dataRevision: 1, title: '报销需求分析', mode: 'guided', roleId: 'builtin-analyst', roleVersion: 2, capabilityId: 'requirements-analysis', capabilityVersion: 1, authorityAt: 1, roleGuidance: { name: '需求分析助手', duties: '', requirements: '', format: '' }, createdAt: now, updatedAt: now, settings: defaultRequirementSettings(), draft: '', overview: emptyRequirementOverview(), requirements: [{ ...emptyRequirement(), id: reqId, number: 'REQ-001', title: '提交报销', description: '员工在线提交申请', acceptance: '填写必填字段后可提交' }], flows: [], rules: [], questions: [], materials: [], messages: [], events: [], versions: [] } }
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }) }
function server(initial = fixture(), onCommand?: (command: RequirementCommand, task: RequirementTask) => Response | void) {
  let task = structuredClone(initial)
  const commands: RequirementCommand[] = []
  let createBody: Record<string, unknown> = {}
  const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    if (url.includes('/config?')) return json({ ready: true, message: '需求分析能力可用', modelConfigured: true, defaults: { depth: 'standard', questionStyle: 'short', model: '' }, revision: 1, maxTextChars: 100000 })
    if (url.endsWith(`/task/${taskId}`)) return json(task)
    if (url.endsWith('/create')) { createBody = JSON.parse(String(init?.body)); task = { ...task, requirements: [], title: String(createBody.title), mode: createBody.mode as 'guided' | 'quick' }; return json(task) }
    if (url.endsWith('/command')) {
      const body = JSON.parse(String(init?.body)) as { id: string; revision: number; command: RequirementCommand }
      commands.push(body.command)
      if (body.revision !== task.revision) return json({ error: '分析记录已更新' }, 409)
      const override = onCommand?.(body.command, task); if (override) return override
      const c = body.command
      if (c.type === 'save') { if (c.draft !== undefined) task.draft = c.draft; if (c.settings) task.settings = c.settings; if (c.overview) task.overview = c.overview }
      if (c.type === 'run') { task.draft = ''; task.messages.push({ id: 'm1', role: 'user', text: c.instruction, createdAt: now, context: c.context }); task.run = { id: c.requestId, operation: c.operation, status: 'ready', startedAt: now, model: c.model || 'default', instruction: c.instruction, baseRevision: task.dataRevision } }
      if (c.type === 'requirement.save') { const r = task.requirements.find(r => r.id === c.requirement.id); if (r) Object.assign(r, c.requirement) }
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
  return { commands, fetch, get task() { return task }, get createBody() { return createBody } }
}
async function render(props: Partial<React.ComponentProps<typeof RequirementsAssistant>> = {}) {
  root = createRoot(host)
  await act(async () => { root!.render(<RequirementsAssistant roleId="builtin-analyst" roleVersion={2} {...props}/>); await Promise.resolve() })
}
async function click(label: string, scope: Element = host) {
  const element = Array.from(scope.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent?.trim() === label || button.getAttribute('aria-label') === label)
  expect(element, `button ${label}`).toBeTruthy()
  await act(async () => { element!.click(); await Promise.resolve() })
}
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
  expect(api.createBody).toMatchObject({ roleId: 'builtin-analyst', roleVersion: 2, mode: 'guided' })
  expect(api.commands).toContainEqual(expect.objectContaining({ type: 'run', operation: 'clarify', instruction: '希望员工在线报销' }))
  expect(onCommit).toHaveBeenCalledWith(expect.objectContaining({ id: taskId }))
  expect(host.querySelector<HTMLTextAreaElement>('[aria-label="需求分析输入"]')!.value).toBe('')
})

it('keeps the six workspace tabs keyboard accessible and edits a requirement with real context IDs', async () => {
  const api = server()
  await render({ taskId })
  const selectedTab = host.querySelector<HTMLButtonElement>('[role=tab][aria-selected=true]')!
  await act(async () => { selectedTab.focus(); selectedTab.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })) })
  expect(document.activeElement?.textContent).toBe('需求工作区')
  expect(Array.from(host.querySelectorAll('[aria-label="需求工作区页面"] [role=tab]')).map(el => el.textContent)).toEqual(['概览', '资料', '需求清单', '流程与规则', '待确认', '需求文档'])
  await click('需求清单'); await click('REQ-001提交报销')
  await fill('需求名称', '在线提交报销'); await click('保存修改')
  expect(api.commands.at(-1)).toMatchObject({ type: 'requirement.save', requirement: { id: reqId, title: '在线提交报销' } })
  await click('讨论'); await fill('需求分析输入', '增加退回重填功能'); await click('发送需求分析消息')
  expect(api.commands.at(-1)).toMatchObject({ type: 'run', operation: 'revise', context: reqId, instruction: '增加退回重填功能' })
  expect(host.textContent).toContain('当前讨论：REQ-001 在线提交报销')
})

it('shows changed and cleared fields before applying selected suggestions in a single command', async () => {
  const task = fixture(); task.requirements[0].module = '旧模块'
  task.proposal = { id: 'p1', baseRevision: 1, summary: '两项修改待核对', createdAt: now, items: [{ id: 'i1', kind: 'requirement', targetId: reqId, value: { ...task.requirements[0], module: '', title: '新的需求名称' } }, { id: 'i2', kind: 'overview', value: { ...task.overview, goal: '提高效率' } }] }
  const api = server(task); await render({ taskId })
  expect(host.textContent).toContain('原：旧模块'); expect(host.textContent).toContain('清空此字段')
  await act(async () => host.querySelector<HTMLInputElement>('[aria-label="选择建议 i2"]')!.click())
  await click('采用选中建议')
  expect(api.commands).toEqual([{ type: 'proposal.apply', proposalId: 'p1', ids: ['i1'] }])
  expect(host.textContent).toContain('1 项待核对')
  expect(host.textContent).toContain('业务内容仍需在需求清单中逐项确认')
})

it('keeps unsaved edits on revision conflicts and requires comparing the newer object before overwriting', async () => {
  let once = true
  const api = server(fixture(), (command, task) => { if (command.type === 'requirement.save' && once) { once = false; task.requirements[0].description = '另一窗口已经修改'; task.revision += 1; return json({ error: '另一个窗口修改了该需求' }, 409) } })
  await render({ taskId }); await click('需求工作区'); await click('需求清单'); await click('REQ-001提交报销')
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
  server(); await render({ taskId }); await click('需求工作区'); await click('需求清单'); await click('REQ-001提交报销'); await fill('需求名称', '待继续修改的名称')
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
  server(task); await render({ taskId }); await click('需求工作区'); await click('需求清单'); await click('↗ 依据 1')
  expect(host.querySelector('[role=dialog]')?.textContent).toContain('旧版是两级审批')
  expect(host.querySelector('[role=dialog]')?.textContent).not.toContain('新版是三级审批')
})

it('saves answers before proposing related edits and shows confirmation validation errors', async () => {
  const task = fixture(); task.questions = [{ id: 'q1', number: 'Q-001', question: '谁来审批？', reason: '审批人未明确', options: ['部门负责人', '财务'], answer: '', status: 'open', blocking: true, requirementIds: [reqId], sources: [] }]
  const api = server(task, c => c.type === 'requirement.status' ? json({ error: 'REQ-001 仍有关键问题待处理：Q-001' }, 400) : undefined)
  await render({ taskId }); await click('需求工作区'); await click('待确认'); await click('部门负责人'); await click('保存回答')
  expect(api.commands.at(-1)).toMatchObject({ type: 'question.answer', id: 'q1', answer: '部门负责人' })
  await click('根据回答更新建议')
  expect(api.commands.at(-1)).toMatchObject({ type: 'run', operation: 'revise', context: 'q1' })
  await click('需求工作区'); await click('需求清单'); await click('确认')
  expect(host.querySelector('[role=alert]')?.textContent).toContain('REQ-001 仍有关键问题待处理：Q-001')
})

it('preserves an unsubmitted question answer after reopening without treating it as a saved decision', async () => {
  const task = fixture(); task.questions = [{ id: 'q1', number: 'Q-001', question: '谁来审批？', reason: '', options: [], answer: '', status: 'open', blocking: true, requirementIds: [reqId], sources: [] }]
  const api = server(task); await render({ taskId }); await click('需求工作区'); await click('待确认'); await fill('回答 Q-001', '需要向财务负责人核实')
  await act(async () => root!.unmount()); root = undefined
  await render({ taskId }); await click('需求工作区'); await click('待确认')
  expect(host.querySelector<HTMLTextAreaElement>('[aria-label="回答 Q-001"]')!.value).toBe('需要向财务负责人核实')
  expect(api.task.questions[0].status).toBe('open'); expect(api.commands).toEqual([])
})

it('builds a document from selected items and renders user HTML as plain text', async () => {
  const task = fixture(); task.requirements[0].description = '<img src=x onerror=alert(1)>'; const api = server(task)
  await render({ taskId }); await click('需求工作区'); await click('需求清单')
  await act(async () => host.querySelector<HTMLInputElement>('[aria-label="选择 REQ-001"]')!.click())
  await click('生成所选文档'); await fill('文档模板', 'detailed'); await click('更新文档预览')
  expect(api.commands.at(-1)).toEqual({ type: 'document.generate', depth: 'detailed', selectedIds: [reqId] })
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
