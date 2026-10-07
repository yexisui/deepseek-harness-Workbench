// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { MeetingAsrSettings } from '../src/client/MeetingAsrSettings.tsx'
afterEach(() => { vi.unstubAllGlobals(); document.body.innerHTML = '' })
it('selects a managed model; checking does not save; saving sends a reference without credentials', async () => {
  ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
  const calls: { path: string; body: any }[] = []
  vi.stubGlobal('fetch', vi.fn(async (path: string, init?: RequestInit) => {
    calls.push({ path, body: init?.body ? JSON.parse(String(init.body)) : null })
    return new Response(JSON.stringify(path.endsWith('/models') ? { models: [{ id: 'p/speech', name: 'Speech', provider: 'P', selectable: true }] } : path.endsWith('/check-model') ? { text: 'Hello speech test', timestamps: false, speakers: false } : {}))
  }))
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host)
  await act(async () => root.render(<MeetingAsrSettings status={{ ready: true, message: '', modelRef: 'p/speech', editable: true, revision: 2 }} refresh={async () => {}}/>))
  const click = async (text: string) => act(async () => Array.from(host.querySelectorAll('button')).find(b => b.textContent === text)!.click())
  await click('选择模型')
  expect(host.querySelector('input[type=password]')).toBeNull()
  await click('检测转写')
  expect(calls.filter(c => c.path.endsWith('/config'))).toHaveLength(0)
  expect(host.textContent).toContain('转写检测通过')
  await click('保存选择')
  expect(calls.at(-1)?.body).toEqual({ revision: 2, modelRef: 'p/speech', format: 'json', maxMb: 25 })
  await act(async () => root.unmount())
})
