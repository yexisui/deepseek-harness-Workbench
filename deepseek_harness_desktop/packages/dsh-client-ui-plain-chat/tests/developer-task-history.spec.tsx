// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import { CodeAssistant } from '../../dsh-code-assistant/src/client/CodeAssistant.tsx'
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
async function render() { await act(async () => { root.render(<CodeAssistant Modal={Modal} roleId="developer" draftKey="history-test" initialTaskId="one" Toggle={Toggle} loadModels={async () => []} onTaskChange={onTaskChange} />); await flush() }) }
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
  sessionStorage.clear(); onTaskChange.mockClear()
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

it('defaults to the current project, normalizes Windows paths and separates equal names in different folders', async () => {
  await render(); await click('任务记录')
  expect(dialog().textContent).toContain('3 条记录')
  expect(dialog().textContent).toContain('运行测试')
  expect(dialog().textContent).not.toContain('其他项目任务')
  expect(button('项目：C:\\样例\\calculator').getAttribute('aria-pressed')).toBe('true')
  await click('项目：D:\\样例\\calculator')
  expect(dialog().textContent).toContain('1 条记录'); expect(dialog().textContent).toContain('其他项目任务')
  await click('未关联项目'); expect(dialog().textContent).toContain('旧任务')
})
it('searches within the selected project and clears the query when changing project', async () => {
  await render(); await click('任务记录'); await input('搜索任务记录', '测试')
  expect(dialog().textContent).toContain('1 条记录'); expect(dialog().textContent).not.toContain('解释项目')
  await input('搜索任务记录', '找不到'); expect(dialog().textContent).toContain('没有找到匹配的任务')
  await click('项目：D:\\样例\\calculator'); expect((document.querySelector('[aria-label="搜索任务记录"]') as HTMLInputElement).value).toBe('')
  expect(dialog().textContent).toContain('其他项目任务')
})
it('cancels removal, then hides a record and undoes it without touching the current editor or conversation', async () => {
  await render(); await click('notes.md'); await input('测试编辑器', 'keep my edits'); await input('代码任务说明', 'keep my draft')
  await click('任务记录'); await click('移除任务记录：解释项目'); await click('取消')
  expect(calls.some(c => c.route === 'history/remove')).toBe(false)
  await click('移除任务记录：解释项目'); await click('移除记录')
  expect(hidden.has('one')).toBe(true); expect(dialog().textContent).toContain('2 条记录')
  expect(calls.find(c => c.route === 'history/remove').data).toEqual({ id: 'one', roleId: 'developer' })
  expect((host.querySelector('[aria-label="测试编辑器"]') as HTMLTextAreaElement).value).toBe('keep my edits')
  expect((host.querySelector('[aria-label="代码任务说明"]') as HTMLTextAreaElement).value).toBe('keep my draft')
  expect(onTaskChange).toHaveBeenLastCalledWith({ id: 'one', title: '解释项目' })
  await click('撤销移除'); expect(hidden.has('one')).toBe(false); expect(dialog().textContent).toContain('3 条记录')
  expect(calls.some(c => ['send', 'permission', 'save'].includes(c.route))).toBe(false)
})
it('keeps an empty selected project and hides the record after closing and reopening history', async () => {
  await render(); await click('任务记录'); await click('项目：D:\\样例\\calculator'); await click('移除任务记录：其他项目任务'); await click('移除记录')
  expect(dialog().textContent).toContain('这个项目还没有任务记录')
  expect(button('项目：D:\\样例\\calculator').getAttribute('aria-pressed')).toBe('true')
  await click('关闭任务记录'); await click('任务记录')
  expect(button('移除任务记录：其他项目任务')).toBeUndefined()
  expect(button('撤销移除')).toBeTruthy(); await click('撤销移除'); expect(hidden.has('three')).toBe(false)
})
it('reports failed removal and restore without losing the available retry', async () => {
  await render(); await click('任务记录'); failRemove = true
  await click('移除任务记录：解释项目'); await click('移除记录')
  expect(document.querySelectorAll('dialog').length).toBe(2)
  expect(document.body.textContent).toContain('保存失败，请重试'); expect(hidden.size).toBe(0)
  failRemove = false; await click('移除记录'); failRestore = true; await click('撤销移除')
  expect(dialog().textContent).toContain('保存失败，请重试'); expect(hidden.has('one')).toBe(true)
  failRestore = false; await click('撤销移除'); expect(hidden.size).toBe(0)
})
it('prevents running-record removal and task switching while the current task is running', async () => {
  tasks[0].status = 'running'; await render(); await click('任务记录')
  expect(button('移除任务记录：解释项目').disabled).toBe(true)
  expect(button('移除任务记录：正在修复').disabled).toBe(true)
  expect(button('打开任务：运行测试').disabled).toBe(true)
  expect(button('打开任务：解释项目').disabled).toBe(false)
})
it('preserves unsaved edits when switching is cancelled, then opens the selected task after confirmation', async () => {
  await render(); await click('notes.md'); await input('测试编辑器', 'unsaved')
  await click('任务记录'); const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  await click('打开任务：运行测试')
  expect(confirm).toHaveBeenCalledOnce(); expect(dialog()).toBeTruthy()
  expect((host.querySelector('[aria-label="测试编辑器"]') as HTMLTextAreaElement).value).toBe('unsaved')
  confirm.mockReturnValue(true); await click('打开任务：运行测试')
  expect(document.querySelector('dialog')).toBeNull(); expect(onTaskChange).toHaveBeenLastCalledWith({ id: 'two', title: '运行测试' })
})
it('shows an opening error inside the dialog and Escape closes only that dialog', async () => {
  await render(); await click('任务记录'); failOpen = true; await click('打开任务：运行测试')
  expect(dialog().textContent).toContain('读取任务失败')
  await act(async () => { dialog().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await flush() })
  expect(document.querySelector('dialog')).toBeNull(); expect(onTaskChange).toHaveBeenLastCalledWith({ id: 'one', title: '解释项目' })
})

it('moves the current project to trash, preserves drafts and restores it after reopening', async () => {
  tasks[3].status = 'done'
  await render(); await click('notes.md'); await input('测试编辑器', 'keep my edits'); await input('代码任务说明', 'keep my draft')
  await click('任务记录'); await click('移除项目：C:\\样例\\calculator'); await click('取消')
  expect(removedProjects.size).toBe(0)
  await click('移除项目：C:\\样例\\calculator'); await click('移除项目')
  expect(button('项目：C:\\样例\\calculator')).toBeUndefined()
  expect(removedProjects.size).toBe(1); expect(dialog().textContent).toContain('2 条记录')
  expect((host.querySelector('[aria-label="测试编辑器"]') as HTMLTextAreaElement).value).toBe('keep my edits')
  expect((host.querySelector('[aria-label="代码任务说明"]') as HTMLTextAreaElement).value).toBe('keep my draft')
  await click('关闭任务记录'); await click('任务记录')
  expect(button('项目：C:\\样例\\calculator')).toBeUndefined()
  await click('回收站'); expect(dialog().textContent).toContain('3 条任务随项目恢复')
  await click('恢复项目：C:\\样例\\calculator'); expect(removedProjects.size).toBe(0)
  expect(dialog().textContent).toContain('回收站是空的')
  await click('返回任务记录'); expect(button('项目：C:\\样例\\calculator')).toBeTruthy()
  expect(calls.some(c => ['send', 'permission', 'save', 'project/remove'].includes(c.route))).toBe(false)
})
it('restores a project separately from an individually removed record and supports trash search', async () => {
  tasks[3].status = 'done'
  await render(); await click('任务记录'); await click('移除任务记录：解释项目'); await click('移除记录')
  await click('移除项目：C:\\样例\\calculator'); await click('移除项目'); await click('回收站')
  expect(dialog().textContent).toContain('2 条任务随项目恢复')
  expect(button('恢复任务：解释项目')).toBeUndefined()
  await input('搜索回收站', '不存在'); expect(dialog().textContent).toContain('没有找到匹配的项目或任务')
  await input('搜索回收站', '')
  await click('恢复项目：C:\\样例\\calculator'); expect(hidden.has('one')).toBe(true)
  expect(button('恢复任务：解释项目')).toBeTruthy()
  await click('关闭任务记录'); await click('任务记录'); await click('回收站')
  await click('恢复任务：解释项目'); expect(hidden.size).toBe(0)
})
it('blocks running project removal and retries project removal and restoration failures', async () => {
  await render(); await click('任务记录'); expect(button('移除项目：C:\\样例\\calculator').disabled).toBe(true)
  failRemove = true; await click('移除项目：D:\\样例\\calculator'); await click('移除项目')
  expect(removedProjects.size).toBe(0); expect(document.querySelectorAll('dialog').length).toBe(2)
  failRemove = false; await click('移除项目'); await click('回收站'); failRestore = true
  await click('恢复项目：D:\\样例\\calculator'); expect(removedProjects.size).toBe(1)
  expect(dialog().textContent).toContain('保存失败，请重试')
  failRestore = false; await click('恢复项目：D:\\样例\\calculator'); expect(removedProjects.size).toBe(0)
})
