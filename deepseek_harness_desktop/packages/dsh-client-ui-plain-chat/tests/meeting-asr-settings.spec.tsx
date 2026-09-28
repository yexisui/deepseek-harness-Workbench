// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { MeetingAsrSettings } from '../src/client/MeetingAsrSettings.tsx'

afterEach(() => { vi.unstubAllGlobals(); document.body.innerHTML = '' })

it('masks a saved key, reveals only on demand, and omits unchanged key when saving', async () => {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  const requests: Array<{ path: string; body: Record<string, unknown> }> = []
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const path = String(input), body = JSON.parse(String(init?.body)) as Record<string, unknown>
    requests.push({ path, body })
    return new Response(JSON.stringify(path.endsWith('/reveal') ? { apiKey: 'saved-secret' } : { ready: true }), { status: 200 })
  }))
  const host = document.createElement('div'); document.body.append(host)
  const root = createRoot(host)
  const status = { ready: true, message: '已配置', endpoint: 'https://asr.example/v1/audio/transcriptions', asrModel: 'speech', format: 'verbose_json' as const, maxMb: 25, hasKey: true, keySource: 'saved' as const, configSource: 'saved' as const, revision: 3, editable: true }
  await act(async () => root.render(<MeetingAsrSettings status={status} refresh={async () => {}}/>))
  expect(host.textContent).toContain('********')
  expect(host.textContent).not.toContain('saved-secret')
  await act(async () => host.querySelector<HTMLButtonElement>('button')!.click())
  const input = host.querySelector<HTMLInputElement>('input[aria-label="语音识别 API Key"]')!
  expect(input.type).toBe('password')
  expect(input.placeholder).toBe('********')
  expect(input.value).toBe('')
  await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="显示 API Key"]')!.click())
  expect(input.type).toBe('text')
  expect(input.value).toBe('saved-secret')
  await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="隐藏 API Key"]')!.click())
  expect(input.type).toBe('password')
  expect(input.value).toBe('')
  await act(async () => Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent === '保存配置')!.click())
  expect(requests.at(-1)?.body.apiKey).toBeUndefined()
  await act(async () => host.querySelector<HTMLButtonElement>('button')!.click())
  const replacement = host.querySelector<HTMLInputElement>('input[aria-label="语音识别 API Key"]')!
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(replacement, 'new-secret'); replacement.dispatchEvent(new Event('input', { bubbles: true })) })
  expect(replacement.type).toBe('password')
  await act(async () => Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent === '保存配置')!.click())
  expect(requests.at(-1)?.body.apiKey).toBe('new-secret')
  await act(async () => root.unmount())
})
