// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { NativeConversationRemoval, REMOVE_SESSION_EVENT } from '../src/client/NativeConversationRemoval.tsx'

let root: Root
let container: HTMLDivElement
const current = { current: 'session-hello' }
const sessions = { list: { getSnapshot: () => current }, clear: vi.fn(() => { current.current = '' }), refresh: vi.fn(async () => {}) }

beforeEach(async () => {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  current.current = 'session-hello'
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () => root.render(<NativeConversationRemoval sessions={sessions}/>))
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  sessions.clear.mockClear()
  sessions.refresh.mockClear()
  vi.unstubAllGlobals()
})

async function open() {
  await act(async () => window.dispatchEvent(new CustomEvent(REMOVE_SESSION_EVENT, { detail: { id: 'session-hello', title: '你好' } })))
}

it('requires a second confirmation and removes a formal session through the archive API', async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ rows: [{ id: 'session-hello', childIds: [] }] }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [{ id: 'session-hello', status: 'ok' }] }) })
  vi.stubGlobal('fetch', fetchMock)
  await open()
  await act(async () => { await Promise.resolve(); await Promise.resolve() })
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain('你好')
  expect(fetchMock).toHaveBeenCalledTimes(1)
  await act(async () => document.querySelector<HTMLButtonElement>('button[class*="danger"]')!.click())
  expect(fetchMock).toHaveBeenCalledTimes(2)
  expect(fetchMock.mock.calls[1]![0]).toBe('/api/dsh-session-archive/delete')
  expect(JSON.parse(fetchMock.mock.calls[1]![1].body)).toEqual({ ids: ['session-hello'], expectedTotal: 1 })
  expect(sessions.clear).toHaveBeenCalledTimes(1)
  expect(sessions.refresh).toHaveBeenCalledTimes(1)
  expect(document.querySelector('[role="dialog"]')).toBeNull()
})

it('keeps the dialog open and reports a protected session instead of claiming success', async () => {
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ rows: [{ id: 'session-hello', childIds: [] }] }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [{ id: 'session-hello', status: 'skipped', reason: 'attached' }] }) }))
  await open()
  await act(async () => { await Promise.resolve(); await Promise.resolve() })
  await act(async () => document.querySelector<HTMLButtonElement>('button[class*="danger"]')!.click())
  expect(document.querySelector('[role="alert"]')?.textContent).toContain('占用')
  expect(sessions.clear).not.toHaveBeenCalled()
})
