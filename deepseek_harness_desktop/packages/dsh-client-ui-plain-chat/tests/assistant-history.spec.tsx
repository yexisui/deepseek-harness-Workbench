// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { AssistantHistory } from '../src/client/AssistantHistory.tsx'
import { capabilityClient } from '../src/client/capability-client.ts'
import { emptyRole, initialState } from '../../dsh-capabilities/src/core/model.ts'
let root: Root, container: HTMLDivElement
beforeEach(async () => {
  localStorage.clear(); sessionStorage.clear()
  const state = initialState(), definition = { ...emptyRole(), name: '测试会议助手' }
  state.roles.push({ id: 'test-meeting', enabled: true, draft: definition, versions: [{ ...definition, preset: 'workbench-role-test-meeting-v1', version: 1, createdAt: state.updatedAt }] })
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ state, components: [], health: {}, tasks: [] }) })))
  await capabilityClient.refresh()
  ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals() })
function setup() {
  const open = vi.fn(), onOpen = vi.fn(), onNew = vi.fn(), rename = vi.fn(async () => {}), archive = vi.fn(async () => {}), fork = vi.fn()
  const list = { phase: 'ready', current: undefined, ids: ['native', 'free'], byId: { native: { title: '原生助手对话', updatedAt: 200, projectionValues: { agentPreset: 'workbench-role-test-meeting-v1' } }, free: { title: '普通聊天', updatedAt: 250, projectionValues: { agentPreset: 'workbench-chat' } } } }
  const workspaces = { items: [{ title: '项目甲', sessionIds: ['native', 'free'] }], archivedSessionIds: [] }
  const Original = (props: any) => <div data-original>{props.useSessions((s: any) => s.ids).map((id: string) => <span data-native={id} key={id}>{list.byId[id as keyof typeof list.byId].title}</span>)}</div>
  const props = { Original, browser: { wide: true, useSessions: (fn: any) => fn(list), useWorkspaces: (fn: any) => fn(workspaces), t: (key: string) => key, open, renameSession: rename, archiveSession: archive, forkSession: fork }, rows: [{ id: 'local', title: '录音摘要', role: 'test-meeting', kind: 'demo' as const, draft: '', updatedAt: 100, createdAt: 1 }], activeId: null, onOpen, onNew, onRename: vi.fn(async () => {}), onRemove: vi.fn(), onFork: vi.fn(async () => {}), ready: true }
  return { props, open, onOpen, onNew, rename, archive, fork }
}
const click = async (selector: string) => { const button = container.querySelector<HTMLButtonElement>(selector); expect(button).toBeTruthy(); await act(async () => button!.click()) }
const input = async (text: string) => { await act(async () => { const field = container.querySelector<HTMLInputElement>('input[aria-label="搜索对话"]')!; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, text); field.dispatchEvent(new Event('input', { bubbles: true })) }) }
it('groups local and native assistant conversations once, searches across both zones and restores collapse', async () => {
  const app = setup(); await act(async () => root.render(<AssistantHistory {...app.props}/>))
  expect(container.querySelector('[data-original] [data-native="native"]')).toBeNull()
  expect(container.querySelector('[data-original] [data-native="free"]')).toBeTruthy()
  expect(container.querySelectorAll('[data-assistant-group="test-meeting"] [data-conversation-id]').length).toBe(2)
  await click('[data-assistant-group="test-meeting"] button[aria-expanded="true"]')
  await input('项目甲')
  expect(container.querySelectorAll('[aria-label="对话搜索结果"] [data-conversation-id]').length).toBe(2)
  await click('[aria-label="对话搜索结果"] [data-conversation-id="session:native"] button')
  expect(app.open).toHaveBeenCalledWith('native')
  await click('button[aria-label="清空搜索"]')
  expect(container.querySelector('[data-assistant-group="test-meeting"] button[aria-expanded="false"]')).toBeTruthy()
  await click('button[aria-label="新建测试会议助手对话"]'); expect(app.onNew).toHaveBeenCalledWith('test-meeting')
})
it('switches sort modes and directions, persists them, and keeps native menu actions', async () => {
  const app = setup(); await act(async () => root.render(<AssistantHistory {...app.props}/>))
  const ids = () => Array.from(container.querySelectorAll('[data-assistant-group="test-meeting"] [data-conversation-id]')).map(el => el.getAttribute('data-conversation-id'))
  expect(ids()).toEqual(['session:native', 'local'])
  await click('button[aria-label="排序方向：降序"]'); expect(ids()).toEqual(['local', 'session:native'])
  await click('button[aria-label="排序方式：时间"]')
  expect(JSON.parse(localStorage.getItem('workbench-sidebar-preferences-v1')!)).toMatchObject({ sort: 'number', direction: 'asc' })
  await click('button[aria-label="会话操作：原生助手对话"]')
  expect(Array.from(document.querySelectorAll('[role="menuitem"]')).map(el => el.textContent)).toEqual(['重命名', '分叉', '归档'])
  await act(async () => { const button = Array.from(document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')).find(el => el.textContent === '归档'); button!.click() })
  expect(app.archive).toHaveBeenCalledWith('native')
})

it('keeps prefixes and full timestamps in both sort modes, search and after remount', async () => {
  const app = setup(), time = new Date(new Date().getFullYear(), 9, 23, 14, 35).getTime()
  app.props.rows[0].updatedAt = time
  await act(async () => root.render(<AssistantHistory {...app.props}/>))
  const local = () => container.querySelector('[data-assistant-group] [data-conversation-id="local"] button')!
  expect(local().textContent).toBe('1.录音摘要10/23 14:35')
  expect(local().querySelector('small')?.parentElement?.textContent).toContain('录音摘要')
  await click('button[aria-label="排序方式：时间"]')
  expect(local().textContent).toBe('1.录音摘要10/23 14:35')
  await input('录音摘要')
  expect(container.querySelector('[aria-label="对话搜索结果"] [data-conversation-id="local"] button')?.textContent).toBe('1.录音摘要测试会议助手 · 10/23 14:35')
  await act(async () => root.unmount()); root = createRoot(container)
  await act(async () => root.render(<AssistantHistory {...app.props}/>))
  expect(local().textContent).toBe('1.录音摘要10/23 14:35')
})
it('waits for complete history before reconciling deleted numbers and ignores search filtering', async () => {
  const app = setup(), numberKey = 'workbench-sidebar-numbers-v1'
  const original = { 'test-meeting': { local: 1, 'session:native': 3, deleted: 4 } }
  localStorage.setItem(numberKey, JSON.stringify(original))
  await act(async () => root.render(<AssistantHistory {...app.props} ready={false}/>))
  expect(JSON.parse(localStorage.getItem(numberKey)!)).toEqual(original)
  await act(async () => root.render(<AssistantHistory {...app.props}/>))
  expect(JSON.parse(localStorage.getItem(numberKey)!)['test-meeting']).toEqual({ local: 1, 'session:native': 3 })
  await input('录音摘要')
  await act(async () => root.render(<AssistantHistory {...app.props} rows={[...app.props.rows, { ...app.props.rows[0], id: 'new', title: '新记录', createdAt: 2 }]}/>))
  expect(JSON.parse(localStorage.getItem(numberKey)!)['test-meeting']).toEqual({ local: 1, 'session:native': 3, new: 4 })
})
it('counts archived native sessions as existing records when allocating the next number', async () => {
  const app = setup(), numberKey = 'workbench-sidebar-numbers-v1'
  localStorage.setItem(numberKey, JSON.stringify({ 'test-meeting': { local: 1, 'session:native': 4 } }))
  app.props.browser.useWorkspaces = fn => fn({ items: [], archivedSessionIds: ['native'] })
  await act(async () => root.render(<AssistantHistory {...app.props} rows={[...app.props.rows, { ...app.props.rows[0], id: 'new', title: '新记录', createdAt: 2 }]}/>))
  expect(container.querySelector('[data-assistant-group] [data-conversation-id="session:native"]')).toBeNull()
  expect(JSON.parse(localStorage.getItem(numberKey)!)['test-meeting']).toEqual({ local: 1, 'session:native': 4, new: 5 })
})

it('archives special records without deleting them, retains numbering and restores after reload', async () => {
  const app=setup();await act(async()=>root.render(<AssistantHistory {...app.props}/>))
  const numbers=localStorage.getItem('workbench-sidebar-numbers-v1')
  await click('button[aria-label="会话操作：录音摘要"]')
  const menu=Array.from(document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'))
  expect(menu.map(b=>b.textContent?.trim())).toEqual(['重命名','分叉','归档'])
  expect(menu[1]!.disabled).toBe(false)
  await act(async()=>menu[2]!.click())
  expect(container.querySelector('[data-conversation-id="local"]')).toBeNull()
  expect(app.props.onRemove).not.toHaveBeenCalled()
  expect(localStorage.getItem('workbench-sidebar-numbers-v1')).toBe(numbers)
  await act(async()=>root.render(<AssistantHistory key="reload" {...app.props}/>))
  expect(container.querySelector('[data-conversation-id="local"]')).toBeNull()
  await act(async()=>Array.from(container.querySelectorAll('button')).find(b=>b.textContent?.startsWith('已归档的专用记录'))!.click())
  await act(async()=>Array.from(document.querySelectorAll('dialog button')).find(b=>b.textContent==='恢复')!.dispatchEvent(new MouseEvent('click',{bubbles:true})))
  expect(container.querySelector('[data-conversation-id="local"]')).toBeTruthy()
})

it('delegates every specialized conversation fork without changing the source',async()=>{const app=setup();await act(async()=>root.render(<AssistantHistory {...app.props}/>));await click('button[aria-label="会话操作：录音摘要"]');const fork=Array.from(document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')).find(b=>b.textContent?.trim()==='分叉')!;await act(async()=>fork.click());expect(app.props.onFork).toHaveBeenCalledWith('local');expect(app.props.onRemove).not.toHaveBeenCalled();expect(container.querySelector('[data-conversation-id="local"]')).toBeTruthy()})
