// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { LocalConversationRows } from '../src/client/LocalConversationRows.tsx'

let host: HTMLDivElement
let root: ReturnType<typeof createRoot>
const onOpen = vi.fn()
const onRemove = vi.fn()

beforeEach(async () => {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  host = document.createElement('div')
  host.innerHTML = '<div><div role="treeitem" aria-expanded="true"><button aria-label="聊天中新建会话">+</button></div></div>'
  document.body.append(host)
  root = createRoot(document.createElement('div'))
  await act(async () => root.render(<LocalConversationRows
    host={host} label="聊天中新建会话"
    rows={[{ id: 'draft-1', role: 'chat', kind: 'draft', title: '新对话', draft: '', updatedAt: 1 }]}
    activeId="draft-1" onOpen={onOpen} onRemove={onRemove}
  />))
})

afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  onOpen.mockClear()
  onRemove.mockClear()
})

it('opens a conversation menu before removing the row', async () => {
  const trigger = document.querySelector<HTMLButtonElement>('button[aria-label="会话操作：新对话"]')!
  expect(trigger).toBeTruthy()
  expect(document.querySelector('[role="menu"]')).toBeNull()
  await act(async () => trigger.click())
  expect(onRemove).not.toHaveBeenCalled()
  expect(trigger.getAttribute('aria-expanded')).toBe('true')
  const remove = document.querySelector<HTMLButtonElement>('[role="menuitem"]')!
  expect(remove.textContent).toContain('移除对话')
  await act(async () => remove.click())
  expect(onRemove).toHaveBeenCalledExactlyOnceWith('draft-1')
  expect(document.querySelector('[role="menu"]')).toBeNull()
})

it('dismisses the menu with Escape without removing the row', async () => {
  const trigger = document.querySelector<HTMLButtonElement>('button[aria-label="会话操作：新对话"]')!
  await act(async () => trigger.click())
  await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  expect(document.querySelector('[role="menu"]')).toBeNull()
  expect(onRemove).not.toHaveBeenCalled()
  expect(document.activeElement).toBe(trigger)
})

it('renders the first saved requirement when the native history has no chat group', async () => {
  await act(async () => {
    host.querySelector('[role="treeitem"]')!.parentElement!.remove()
    const empty = document.createElement('div'); empty.textContent = '暂无会话'; host.appendChild(empty)
    root.render(<LocalConversationRows host={host} label="聊天中新建会话"
      rows={[{ id: 'requirements-1', role: 'builtin-analyst', kind: 'requirements', title: '报销需求', draft: '', updatedAt: 1 }]}
      activeId="requirements-1" onOpen={onOpen} onRemove={onRemove}/>)
  })
  const rows = host.querySelector<HTMLElement>('[data-local-conversation-placement="standalone"]')!
  expect(rows).not.toBeNull()
  expect(rows.hidden).toBe(false)
  expect(rows.textContent).toContain('报销需求')
  const open = rows.querySelector<HTMLButtonElement>('button[aria-label="打开本地会话：报销需求"]')!
  expect(open.getAttribute('aria-current')).toBe('page')
  await act(async () => open.click())
  expect(onOpen).toHaveBeenCalledExactlyOnceWith('requirements-1')
})

it('moves saved rows into a newly available native group and restores them if the group disappears', async () => {
  await act(async () => { host.querySelector('[role="treeitem"]')!.parentElement!.remove() })
  const rows = host.querySelector<HTMLElement>('[data-local-conversation-host]')!
  expect(rows.dataset.localConversationPlacement).toBe('standalone')
  const group = document.createElement('div')
  group.innerHTML = '<div role="treeitem" aria-expanded="false"><button aria-label="聊天中新建会话">+</button></div>'
  await act(async () => { host.insertBefore(group, rows) })
  expect(host.querySelectorAll('[data-local-conversation-host]')).toHaveLength(1)
  expect(rows.parentElement).toBe(group)
  expect(rows.hidden).toBe(true)
  await act(async () => { group.firstElementChild!.setAttribute('aria-expanded', 'true') })
  expect(rows.hidden).toBe(false)
  await act(async () => { group.remove() })
  expect(rows.parentElement).toBe(host)
  expect(rows.hidden).toBe(false)
  expect(rows.textContent).toContain('新对话')
})

it('places saved records at the top of the native flex history tree and restores only its empty placeholder', async () => {
  await act(async () => {
    host.innerHTML = '<div class="bhn1Oq_treeBody bhn1Oq_wide"><div class="bhn1Oq_list" role="tree" aria-label="会话"><div class="bhn1Oq_empty" style="display:flex">暂无会话</div></div><span class="bhn1Oq_fade"></span></div>'
  })
  const tree = host.querySelector<HTMLElement>('[role="tree"]')!
  const placeholder = tree.querySelector<HTMLElement>('.bhn1Oq_empty')!
  expect(tree.firstElementChild?.getAttribute('data-local-conversation-host')).toBe('true')
  expect(tree.textContent).toContain('新对话')
  expect(tree.hidden).toBe(false)
  expect(placeholder.hidden).toBe(true)
  expect(placeholder.style.display).toBe('none')
  await act(async () => root.render(<LocalConversationRows host={host} label="聊天中新建会话" rows={[]} activeId={null} onOpen={onOpen} onRemove={onRemove}/>))
  expect(tree.querySelector('[data-local-conversations]')).toBeNull()
  expect(tree.hidden).toBe(false)
  expect(placeholder.hidden).toBe(false)
  expect(placeholder.style.display).toBe('flex')
})

it('renames from a shared dialog, trims the name, and keeps failures editable', async () => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
  const rename = vi.fn().mockRejectedValueOnce(new Error('保存失败')).mockResolvedValueOnce(undefined)
  await act(async () => root.render(<LocalConversationRows host={host} label="聊天中新建会话" rows={[{ id:'draft-1', role:'chat', kind:'draft', title:'原名称', draft:'', updatedAt:1 }]} activeId="draft-1" onOpen={onOpen} onRemove={onRemove} onRename={rename}/>))
  await act(async () => document.querySelector<HTMLButtonElement>('button[aria-label="会话操作：原名称"]')!.click())
  const menu = Array.from(document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'))
  expect(menu.map(b => b.textContent?.trim())).toEqual(['重命名','移除对话'])
  await act(async () => menu[0]!.click())
  const input = document.querySelector<HTMLInputElement>('dialog input')!
  expect(input.value).toBe('原名称'); expect(document.activeElement).toBe(input)
  const change = async (value:string) => act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,value); input.dispatchEvent(new Event('input',{bubbles:true})) })
  await change('   ')
  expect(document.querySelector<HTMLButtonElement>('dialog button[type="submit"]')!.disabled).toBe(true)
  await change('  新名称  ')
  await act(async () => document.querySelector('dialog form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})))
  expect(document.querySelector('[role="alert"]')?.textContent).toBe('保存失败')
  expect(input.value).toBe('  新名称  ')
  await act(async () => document.querySelector('dialog form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})))
  expect(rename).toHaveBeenLastCalledWith('draft-1','新名称'); expect(document.querySelector('dialog')).toBeNull()
  expect(onOpen).not.toHaveBeenCalled(); expect(onRemove).not.toHaveBeenCalled()
})

it('cancels renaming with Escape without saving', async () => {
  const rename = vi.fn()
  await act(async () => root.render(<LocalConversationRows host={host} label="聊天中新建会话" rows={[{id:'a',role:'chat',kind:'draft',title:'保留名称',draft:'',updatedAt:1}]} activeId="a" onOpen={onOpen} onRemove={onRemove} onRename={rename}/>))
  await act(async () => document.querySelector<HTMLButtonElement>('button[aria-label="会话操作：保留名称"]')!.click())
  await act(async () => document.querySelector<HTMLButtonElement>('[role="menuitem"]')!.click())
  await act(async () => document.querySelector('dialog input')!.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})))
  expect(document.querySelector('dialog')).toBeNull(); expect(rename).not.toHaveBeenCalled()
})
