// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { DeveloperAssistant } from '../src/client/DeveloperAssistant.tsx'
import { createDeveloperHistory, usesDeveloper } from '../src/client/developer-client.ts'
import { initialState } from '../../dsh-capabilities/src/core/model.ts'
let root: Root, host: HTMLDivElement
const writes: { route: string; body: unknown }[] = []
const cwd = 'C:/qa/project'
beforeEach(() => {
  sessionStorage.clear(); writes.length = 0
  ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  vi.stubGlobal('EventSource', class { addEventListener() {} close() {} })
  vi.stubGlobal('fetch', vi.fn(async (input: string, options?: RequestInit) => {
    const url = new URL(input, 'http://localhost'), route = url.pathname.split('/').at(-1)!
    if (options?.method === 'POST') writes.push({ route, body: JSON.parse(String(options.body)) })
    const data: Record<string, unknown> = {
      projects: [{ path: cwd, name: 'project' }], files: { files: ['main.ts'], excluded: [] },
      state: { root: cwd, git: true, branch: 'main', head: 'a'.repeat(40), index: 'b'.repeat(64), fingerprint: 'c'.repeat(64), files: [], operation: false },
      file: { path: 'main.ts', text: 'const original = 1\n', version: 'd'.repeat(64), size: 19 },
      diff: { path: 'main.ts', before: { path: 'main.ts', text: 'const original = 1\n', version: 'a'.repeat(40), size: 19 }, after: { path: 'main.ts', text: 'const original = 1\n', version: 'd'.repeat(64), size: 19 }, patch: '', label: '暂存区 → 工作目录' },
      project: { revision: 0, commands: [], editor: 'none', candidates: [] }, graph: { root: cwd, branch: 'main', commits: [], hasMore: false }, branches: { branches: [] }, worktrees: { worktrees: [], tasks: [] }, tasks: { items: [], total: 0 },
    }
    return new Response(JSON.stringify(data[route] ?? {}), { headers: { 'content-type': 'application/json' } })
  }))
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals() })
async function render() { await act(async () => { root.render(<DeveloperAssistant roleId="builtin-developer" roleVersion={1} draftKey="new" loadModels={async () => []} onCommit={() => {}}/>); await Promise.resolve() }) }
async function click(text: string) { const button = Array.from(host.querySelectorAll('button')).find(b => b.textContent === text)!; expect(button).toBeTruthy(); await act(async () => button.click()) }
async function chooseProject() { const select = host.querySelector<HTMLSelectElement>('[aria-label="已有项目"]')!; await act(async () => { select.value = cwd; select.dispatchEvent(new Event('change', { bubbles: true })) }) }
it('routes exact published developer bindings and does not grant browser actions', () => {
  const state = initialState(), role = state.roles.find(r => r.id === 'builtin-developer')!
  expect(usesDeveloper(state, role.versions[0])).toBe(true)
  expect(usesDeveloper(state, { ...role.versions[0]!, capabilities: [] })).toBe(false)
})
it('browses without creating a task and preserves unsent input across all main tabs', async () => {
  await render(); await chooseProject()
  const input = host.querySelector<HTMLTextAreaElement>('[aria-label="开发消息"]')!
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, '保留这份草稿'); input.dispatchEvent(new Event('input', { bubbles: true })) })
  for (const label of ['变更', '版本', '运行', '开发']) await click(label)
  expect(host.querySelector<HTMLTextAreaElement>('[aria-label="开发消息"]')!.value).toBe('保留这份草稿')
  expect(writes).toEqual([])
})
it('adds exact file evidence without sending and supports keyboard tab navigation', async () => {
  await render(); await chooseProject(); await click('main.ts'); await click('添加到对话')
  expect(host.textContent).toContain('main.ts:1–2 ×'); expect(writes).toEqual([])
  const first = host.querySelector<HTMLElement>('[role="tab"]')!
  await act(async () => first.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowRight' })))
  expect(host.querySelector('[role="tab"][aria-selected="true"]')!.textContent).toBe('变更')
})
it('loads server history without manufacturing records', async () => {
  const history = createDeveloperHistory(); await history.load()
  expect(history.getSnapshot().items).toEqual([]); expect(history.getSnapshot().activeId).toBeNull(); expect(writes).toEqual([])
})
