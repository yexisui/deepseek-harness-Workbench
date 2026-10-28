// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import { CodeAssistant } from '../../dsh-code-assistant/src/client/CodeAssistant.tsx'
vi.mock('../../dsh-code-assistant/src/client/Editor.tsx', () => ({ CodeEditor: ({ value, onChange }: any) => <textarea aria-label="测试编辑器" value={value} onChange={e => onChange(e.target.value)} /> }))
let host: HTMLDivElement, root: Root, calls: any[], project: string, task: any, projects: any[], picked: string | null
const onTaskChange = vi.fn(), openFolder = vi.fn(), choose = vi.fn(async () => picked)
const Toggle = ({ checked, onChange }: any) => <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
const flush = () => new Promise(resolve => setTimeout(resolve, 5))
const button = (name: string) => [...host.querySelectorAll<HTMLButtonElement>('button')].find(b => b.getAttribute('aria-label') === name || b.textContent === name)!
async function click(name: string) { await act(async () => { button(name).click(); await flush() }) }
async function render(initialTaskId?: string) { await act(async () => { root.render(<CodeAssistant roleId="developer" draftKey="test" initialTaskId={initialTaskId} Toggle={Toggle} Modal={({ children }) => <div>{children}</div>} loadModels={async () => []} onTaskChange={onTaskChange} />); await flush() }) }
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
  sessionStorage.clear(); onTaskChange.mockClear(); openFolder.mockClear(); choose.mockClear()
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  project = 'C:\\测试项目'; picked = null; projects = [{ path: 'C:\\已有项目', name: '已有项目' }]; calls = []
  task = { id: 'task-1', cwd: project, title: '测试任务', mode: 'read', model: '', status: 'idle', messages: [], permissions: [], error: '' }
  ;(window as any).desktop = { selectProjectDirectory: choose, openCodeProjectDirectory: openFolder }
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: any) => {
    const route = url.split('/code-assistant/')[1]!.split('?')[0], data = init?.body ? JSON.parse(init.body) : null
    calls.push({ route, data })
    const result = route === 'projects' ? projects : route === 'health' ? { installed: true } : route === 'history' ? { tasks: [{ id: task.id, title: task.title }], removedProjects: [], removedTasks: [] } : route === 'project' ? (projects = [...projects.filter(p => p.path !== data.path), { path: data.path, name: '测试项目' }]) : route === 'project/remove' ? (projects = projects.filter(p => p.path !== data.path)) : route === 'create' || route === 'task' ? task : route === 'files' ? { files: ['notes.md'] } : route === 'state' ? { git: true, branch: 'main', files: [] } : route === 'file' ? { path: 'notes.md', text: 'saved', version: 'v1' } : {}
    return new Response(JSON.stringify(result))
  }))
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); delete (window as any).desktop; vi.restoreAllMocks(); vi.unstubAllGlobals() })
it('keeps a new task empty, cancels selection, then opens chosen project and folder and removes it', async () => {
  await render(); expect(button('选择本地项目文件夹')).toBeTruthy(); expect(calls.some(c => c.route === 'create')).toBe(false)
  await click('选择本地项目文件夹'); expect(choose).toHaveBeenCalledOnce(); expect(calls.some(c => c.route === 'project')).toBe(false)
  picked = project; await click('选择本地项目文件夹')
  expect(button('打开当前项目文件夹').textContent).toBe(project); expect(host.textContent).toContain('notes.md')
  expect(calls.find(c => c.route === 'create').data.cwd).toBe(project)
  await click('打开当前项目文件夹'); expect(openFolder).toHaveBeenCalledWith(project)
  await click('移除当前项目'); expect(button('选择本地项目文件夹')).toBeTruthy(); expect(host.textContent).not.toContain('notes.md')
  expect(onTaskChange).toHaveBeenLastCalledWith(null); expect(calls.some(c => c.route === 'project/remove')).toBe(true)
  expect(calls.some(c => c.route === 'send' || c.route === 'permission')).toBe(false)
})
it('retains unsaved editor content when removing a project is cancelled', async () => {
  await render(task.id); await click('notes.md')
  await act(async () => { const input = host.querySelector<HTMLTextAreaElement>('[aria-label="测试编辑器"]')!; Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, 'unsaved'); input.dispatchEvent(new Event('input', { bubbles: true })) })
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  await click('移除当前项目'); expect(confirm).toHaveBeenCalledOnce(); expect(calls.some(c => c.route === 'project/remove')).toBe(false)
  expect(host.querySelector<HTMLTextAreaElement>('[aria-label="测试编辑器"]')!.value).toBe('unsaved')
  confirm.mockReturnValue(true); await click('移除当前项目'); expect(button('选择本地项目文件夹')).toBeTruthy()
})
it('blocks removing a running project but still allows opening its folder', async () => {
  task.status = 'running'; await render(task.id)
  expect(button('移除当前项目').disabled).toBe(true)
  await click('打开当前项目文件夹'); expect(openFolder).toHaveBeenCalledWith(project)
})
