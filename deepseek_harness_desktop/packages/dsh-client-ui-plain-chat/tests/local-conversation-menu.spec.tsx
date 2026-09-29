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
