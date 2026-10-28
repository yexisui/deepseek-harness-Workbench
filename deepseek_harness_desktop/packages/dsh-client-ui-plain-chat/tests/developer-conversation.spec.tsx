// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import { CodeAssistant } from '../../dsh-code-assistant/src/client/CodeAssistant.tsx'
import { questionSummaries } from '../../dsh-code-assistant/src/core/conversation.mjs'
import { projectKey } from '../../dsh-code-assistant/src/client/TaskHistory.tsx'
import { Modal } from '../src/client/PreviewModal.tsx'
vi.mock('../../dsh-code-assistant/src/client/Editor.tsx', () => ({ CodeEditor: ({ value, onChange }: any) => <textarea aria-label="测试编辑器" value={value} onChange={e => onChange(e.target.value)} /> }))
let host: HTMLDivElement, root: Root, calls: any[], tasks: any[], hidden: Set<string>, failRemove: boolean, failRestore: boolean, failOpen: boolean, removedProjects: Map<string, string>
const onTaskChange = vi.fn(), Toggle = ({ checked, onChange }: any) => <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
const flush = () => new Promise(resolve => setTimeout(resolve, 5))
const buttons = () => [...document.querySelectorAll<HTMLButtonElement>('button')]
const button = (name: string) => buttons().find(b => b.getAttribute('aria-label') === name || b.textContent === name)!
const dialog = () => document.querySelector<HTMLDialogElement>('dialog')!
async function click(name: string) { await act(async () => { expect(button(name), name).toBeTruthy(); button(name).click(); await flush() }) }
async function input(label: string, value: string) { await act(async () => { const field = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[aria-label="${label}"]`)!; const proto = field.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(field, value); field.dispatchEvent(new Event('input', { bubbles: true })); await flush() }) }
async function render() { await act(async () => { root.render(<CodeAssistant Modal={Modal} roleId="developer" draftKey="conversation-test" initialTaskId="one" Toggle={Toggle} loadModels={async () => []} onTaskChange={onTaskChange} />); await flush() }) }
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
  sessionStorage.clear(); localStorage.clear(); onTaskChange.mockClear()
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value() { this.setAttribute('open', '') } })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value() { this.removeAttribute('open') } })
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  calls = []; hidden = new Set(); removedProjects = new Map(); failRemove = false; failRestore = false; failOpen = false
  tasks = [
    { id: 'one', title: '解释项目', cwd: 'C:\\样例\\calculator', status: 'done' },
    { id: 'two', title: '运行测试', cwd: 'c:/样例/calculator/', status: 'done' },
    { id: 'three', title: '其他项目任务', cwd: 'D:\\样例\\calculator', status: 'done' },
    { id: 'four', title: '正在修复', cwd: 'C:\\样例\\calculator', status: 'running' },
    { id: 'old', title: '旧任务', status: 'idle' }
  ].map(t => ({ ...t, updatedAt: '2026-10-28T06:00:00.000Z', mode: 'read', model: '', messages: [], permissions: [], error: '' }))
  const ask = (id: string, text: string) => ({ info: { id, role: 'user', time: { created: 1000 } }, parts: [{ type: 'text', text }] })
  const reply = (id: string, parentID: string, parts: any[]) => ({ info: { id, role: 'assistant', parentID, time: { created: 2000, completed: 3000 } }, parts })
  tasks[0].messages = [ask('q1','这个项目做什么？'), reply('a1','q1',[{type:'text',text:'一个小计算器'}]), ask('q2','跑一下测试'),reply('a2','q2',[{type:'tool',tool:'bash',state:{status:'completed',input:{command:'python test.py'},metadata:{exit:1},output:'FAILED'}}]),ask('q3','修好再测'),reply('a3','q3',[{type:'text',text:'已修复\n```python\ndef add(a, b):\n    return a + b\n```'},{type:'tool',tool:'bash',state:{status:'completed',input:{command:'python test.py'},metadata:{exit:0},output:'OK'}}])]
  tasks[1].messages = [ask('q4','另一个对话的问题'), reply('a4','q4',[{type:'text',text:'另一段回复'}])]
  for (const task of tasks) task.questions = questionSummaries(task)
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: any) => {
    const parsed = new URL(url, 'http://localhost'), route = parsed.pathname.split('/code-assistant/')[1]!, data = init?.body ? JSON.parse(init.body) : null
    calls.push({ route, data, params: parsed.searchParams })
    let result: any = {}
    if (route === 'projects') result = []
    if (route === 'health') result = { installed: true }
    const key = (cwd?: string) => cwd ? projectKey(cwd) : ''
    const snapshot = () => ({
      tasks: tasks.filter(t => !hidden.has(t.id) && !removedProjects.has(key(t.cwd))),
      removedProjects: [...removedProjects].map(([k,cwd]) => ({ cwd, removedAt: '2026-10-28T07:00:00.000Z', count: tasks.filter(t => key(t.cwd) === k && !hidden.has(t.id)).length })),
      removedTasks: tasks.filter(t => hidden.has(t.id) && !removedProjects.has(key(t.cwd))).map(t => ({ ...t, removedAt: '2026-10-28T07:00:00.000Z' }))
    })
    if (route === 'history') result = snapshot()
    if (route === 'history/project/remove' || route === 'history/project/restore') {
      if ((route.endsWith('/remove') && failRemove) || (route.endsWith('/restore') && failRestore)) return new Response(JSON.stringify({ error: '保存失败，请重试' }), { status: 500 })
      route.endsWith('/remove') ? removedProjects.set(key(data.cwd), data.cwd) : removedProjects.delete(key(data.cwd))
      result = snapshot()
    }
    if (route === 'task') { if (failOpen && parsed.searchParams.get('id') !== 'one') return new Response(JSON.stringify({ error: '读取任务失败' }), { status: 500 }); result = tasks.find(t => t.id === parsed.searchParams.get('id')) }
    if (route === 'send') { const t = tasks.find(t => t.id === data.id); t.messages.push(ask('q5', data.message)); t.questions = questionSummaries(t); result = t }
    if (route === 'files') result = { files: ['notes.md'] }
    if (route === 'state') result = { git: true, branch: 'main', files: [] }
    if (route === 'file') result = { path: 'notes.md', text: 'saved', version: 'v1' }
    if (route === 'history/remove' || route === 'history/restore') {
      if ((route === 'history/remove' && failRemove) || (route === 'history/restore' && failRestore)) return new Response(JSON.stringify({ error: '保存失败，请重试' }), { status: 500 })
      route === 'history/remove' ? hidden.add(data.id) : hidden.delete(data.id)
      result = snapshot()
    }
    return new Response(JSON.stringify(result))
  }))
})
afterEach(async () => { if (host.querySelector('[aria-label="测试编辑器"]')) await input('测试编辑器', 'saved'); await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

it('navigates all questions and keeps earlier failed command output separate from the later success', async () => {
  await render()
  expect(host.textContent).toContain('问题目录 · 3'); expect(host.textContent).toContain('退出码 0')
  expect(host.querySelector('[data-question-id="q3"] pre code')?.textContent).toContain('return a + b')
  await click('问题目录 · 3'); await click('第 2 问：跑一下测试')
  expect(host.textContent).toContain('退出码 1'); expect(host.textContent).toContain('FAILED'); expect(host.querySelector('[data-question-id="q2"]')?.getAttribute('data-selected')).toBe('true'); expect(host.querySelector('[data-question-id="q3"]')?.textContent).toContain('退出码 0')
  await click('上一问'); expect(host.textContent).toContain('一个小计算器')
  await click('回到最新'); expect(host.textContent).toContain('退出码 0')
  await click('问题目录 · 3'); await input('搜索本次提问','测试'); expect(button('第 1 问：这个项目做什么？')).toBeUndefined(); expect(button('第 2 问：跑一下测试')).toBeTruthy()
  expect(calls.some(c=>['send','permission','save'].includes(c.route))).toBe(false)
})
it('clicking the current question again repositions it from both directory and history', async () => {
  await render(); await click('问题目录 · 3'); await click('第 2 问：跑一下测试')
  const section=host.querySelector<HTMLElement>('[data-question-id="q2"]')!, box=section.parentElement!
  vi.spyOn(box,'getBoundingClientRect').mockReturnValue({top:0} as DOMRect)
  vi.spyOn(section,'getBoundingClientRect').mockImplementation(()=>({top:-box.scrollTop} as DOMRect))
  box.scrollTop=250; await click('问题目录 · 3'); await click('第 2 问：跑一下测试'); expect(box.scrollTop).toBe(0)
  box.scrollTop=250; await click('任务记录'); await click('按问题'); await click('定位问题：跑一下测试'); expect(box.scrollTop).toBe(0)
})
it('history distinguishes conversations and questions and opens the exact question in the current conversation', async () => {
  await render(); await click('收起开发对话'); await click('任务记录')
  expect(dialog().textContent).toContain('3 条记录 · 4 个问题')
  await click('按问题'); expect(dialog().textContent).toContain('4 个问题')
  await input('搜索任务记录','跑一下'); await click('定位问题：跑一下测试')
  expect(document.querySelector('dialog')).toBeNull(); expect(host.querySelector('[aria-label="开发对话"]')?.hasAttribute('hidden')).toBe(false)
  expect(host.textContent).toContain('退出码 1'); expect(host.querySelector('[data-question-id="q2"]')?.getAttribute('data-selected')).toBe('true')
})
it('history jumps across conversations and protects unsaved editor changes on cancellation', async () => {
  await render(); await click('notes.md'); await input('测试编辑器','unsaved')
  const confirm=vi.spyOn(window,'confirm').mockReturnValue(false)
  await click('任务记录'); await click('按问题'); await click('定位问题：另一个对话的问题')
  expect(document.querySelector('dialog')).not.toBeNull(); expect((host.querySelector('[aria-label="测试编辑器"]') as HTMLTextAreaElement).value).toBe('unsaved')
  confirm.mockReturnValue(true); await click('定位问题：另一个对话的问题')
  expect(document.querySelector('dialog')).toBeNull(); expect(host.querySelector('[data-question-id="q4"]')?.getAttribute('data-selected')).toBe('true'); expect(host.textContent).toContain('另一段回复')
})
it('hiding both sidebars preserves editor and composer drafts and exposes only the restore rails', async () => {
  await render(); await click('notes.md'); await input('测试编辑器','unsaved'); await input('代码任务说明','草稿保留')
  await click('收起项目文件'); await click('收起开发对话')
  expect(host.querySelector('[aria-label="项目文件"]')?.hasAttribute('hidden')).toBe(true); expect(host.querySelector('[aria-label="开发对话"]')?.hasAttribute('hidden')).toBe(true)
  expect(button('展开项目文件').textContent).toContain('项目文件'); expect(button('展开开发对话').textContent).toContain('开发对话')
  await click('展开项目文件'); await click('展开开发对话')
  expect((host.querySelector('[aria-label="测试编辑器"]') as HTMLTextAreaElement).value).toBe('unsaved'); expect((host.querySelector('[aria-label="代码任务说明"]') as HTMLTextAreaElement).value).toBe('草稿保留')
})
it('resizes by keyboard, cancels pointer resizing and remembers widths after hide/restore', async () => {
  await render(); const split=button('调整文件栏宽度')
  await act(async()=>{split.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));await flush()})
  expect(split.getAttribute('aria-valuenow')).toBe('200')
  const pointer=(type:string,x:number)=>{const event=new MouseEvent(type,{clientX:x,button:0,bubbles:true});Object.defineProperty(event,'pointerId',{value:1});split.dispatchEvent(event)}
  await act(async()=>{pointer('pointerdown',200);pointer('pointermove',260);await flush()});expect(split.getAttribute('aria-valuenow')).toBe('260')
  await act(async()=>{split.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await flush()});expect(split.getAttribute('aria-valuenow')).toBe('200')
  await click('收起项目文件');await click('展开项目文件');expect(split.getAttribute('aria-valuenow')).toBe('200')
  expect(JSON.parse(localStorage.getItem('workbench-code-panels-v1')!).left).toBe(200)
})
it('continuing adds a question to the same conversation without creating another history record', async () => {
  await render(); await input('代码任务说明','再解释一下'); await click('发送')
  expect(host.textContent).toContain('问题目录 · 4'); expect(calls.filter(c=>c.route==='send')).toHaveLength(1); expect(calls.some(c=>c.route==='create')).toBe(false)
  expect(host.querySelector('[data-question-id="q5"]')?.getAttribute('data-selected')).toBe('true')
  await click('任务记录');expect(dialog().textContent).toContain('3 条记录 · 5 个问题')
})
it('renders unfinished code fences safely and retains unattached legacy messages', async () => {
  tasks[0].messages.push({info:{id:'legacy',role:'assistant',parentID:'missing'},parts:[{type:'text',text:'原始旧内容'}]})
  tasks[0].messages[5].parts=[{type:'text',text:'```html\n<script>window.__unsafe=true</script>'}]
  await render();expect(host.querySelector('[data-question-id="q3"] pre code')?.textContent).toContain('<script>');expect((window as any).__unsafe).toBeUndefined();expect(host.textContent).toContain('未关联到问题的历史消息（1）');expect(host.textContent).toContain('原始旧内容')
})
it('clipboard failure reports a message without breaking the conversation', async()=>{
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:vi.fn().mockRejectedValue(new Error('denied'))}})
  await render();await click('复制');expect(host.textContent).toContain('复制失败，请选择文本复制');expect(host.textContent).toContain('问题目录 · 3')
})


it('opens the directory on demand, closes on Escape/outside click and retains its search', async () => {
  await render(); expect(host.querySelector('[aria-label="搜索本次提问"]')).toBeNull()
  await click('问题目录 · 3'); await input('搜索本次提问','测试')
  expect(button('第 2 问：跑一下测试')).toBeTruthy(); expect(button('第 1 问：这个项目做什么？')).toBeUndefined()
  await act(async()=>{host.querySelector('[aria-label="搜索本次提问"]')!.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await flush()})
  expect(host.querySelector('[aria-label="搜索本次提问"]')).toBeNull(); expect(document.activeElement).toBe(button('问题目录 · 3'))
  await click('问题目录 · 3'); expect((host.querySelector('[aria-label="搜索本次提问"]') as HTMLInputElement).value).toBe('测试')
  await act(async()=>{host.querySelector('[aria-label="代码任务说明"]')!.dispatchEvent(new MouseEvent('pointerdown',{bubbles:true}));await flush()})
  expect(host.querySelector('[aria-label="搜索本次提问"]')).toBeNull()
})
it('focus reading preserves mounted editor, drafts and saved widths and exits through sidebar controls', async()=>{
  await render();await click('notes.md');await input('测试编辑器','unsaved');await input('代码任务说明','保留输入')
  const editor=host.querySelector('[aria-label="测试编辑器"]')!, layout=localStorage.getItem('workbench-code-panels-v1')
  await click('专注阅读');expect(host.querySelector('[data-reading="true"]')).toBeTruthy();expect(editor.closest('main')?.hidden).toBe(true)
  expect(host.querySelector('[aria-label="项目文件"]')?.hasAttribute('hidden')).toBe(true)
  await click('退出专注阅读并返回代码');expect(host.querySelector('[aria-label="测试编辑器"]')).toBe(editor);expect(editor.closest('main')?.hidden).toBe(false)
  expect((editor as HTMLTextAreaElement).value).toBe('unsaved');expect((host.querySelector('[aria-label="代码任务说明"]') as HTMLTextAreaElement).value).toBe('保留输入');expect(localStorage.getItem('workbench-code-panels-v1')).toBe(layout)
  await click('专注阅读');await click('展开项目文件');expect(host.querySelector('[data-reading="false"]')).toBeTruthy()
})
it('keeps all original rounds in one scroll area and combines a command and output in one console',async()=>{
  await render();const messages=host.querySelector('[aria-label="连续对话内容"]')!
  expect(messages.querySelectorAll('[data-question-id]')).toHaveLength(3);expect(messages.textContent).toContain('一个小计算器');expect(messages.textContent).toContain('FAILED');expect(messages.textContent).toContain('OK')
  const failed=messages.querySelector('[data-question-id="q2"]')!, command=failed.querySelector('pre')!, output=[...failed.querySelectorAll('pre')].find(el=>el.textContent==='FAILED')!
  expect(command.parentElement).toBe(output.parentElement);expect(command.parentElement?.querySelectorAll('button')).toHaveLength(1)
  await click('上一问');expect(messages.querySelectorAll('[data-question-id]')).toHaveLength(3)
})
it('keeps the model and approval control beside send without changing execution mode',async()=>{
  await render();const model=host.querySelector('[aria-label="代码助手模型"]')!, send=button('发送')
  expect(model.parentElement).toBe(send.parentElement);expect((host.querySelector('[aria-label="代码任务说明"]') as HTMLTextAreaElement).rows).toBe(2)
  await input('代码任务说明','解释代码');await click('发送');expect(calls.find(c=>c.route==='send').data.mode).toBe('read')
})
