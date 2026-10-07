// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
const source = readFileSync(resolve(__dirname, '../../../scripts/lib/ModelKeyInput.js'), 'utf8')
const KeyInput = new Function('react', source + '; return WorkbenchModelKeyInput;')(React)
afterEach(() => { vi.unstubAllGlobals(); document.body.innerHTML = '' })
it('reveals on click, clears on hide, and never commits a viewed secret as an edit', async () => {
  ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
  const changed = vi.fn(), fetched = vi.fn(async () => new Response(JSON.stringify({ apiKey: 'stored-test-key' })))
  vi.stubGlobal('fetch', fetched)
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host)
  await act(async () => root.render(<KeyInput value="" savedProvider="gateway" savedKey onChange={changed}/>))
  expect(host.querySelector('input')!.type).toBe('password')
  expect(host.querySelector('input')!.placeholder).toBe('********')
  expect(fetched).not.toHaveBeenCalled()
  await act(async () => host.querySelector('button')!.click())
  expect(host.querySelector('input')!.value).toBe('stored-test-key')
  expect(host.querySelector('input')!.type).toBe('text')
  expect(changed).not.toHaveBeenCalled()
  await act(async () => host.querySelector('button')!.click())
  expect(host.querySelector('input')!.value).toBe('')
  expect(host.querySelector('input')!.type).toBe('password')
  await act(async () => root.unmount())
})
it('toggles a newly typed key locally without requesting any stored secret', async () => {
  ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
  const fetched = vi.fn(); vi.stubGlobal('fetch', fetched)
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host)
  await act(async () => root.render(<KeyInput value="new-key" onChange={() => {}}/>))
  await act(async () => host.querySelector('button')!.click())
  expect(host.querySelector('input')!.value).toBe('new-key')
  expect(host.querySelector('input')!.type).toBe('text')
  expect(fetched).not.toHaveBeenCalled()
  await act(async () => root.unmount())
})
