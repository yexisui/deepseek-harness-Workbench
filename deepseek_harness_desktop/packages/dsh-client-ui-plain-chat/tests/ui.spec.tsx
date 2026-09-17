// @vitest-environment jsdom
import React, { act, type ComponentType } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import { apply } from '../src/client/apply.tsx'
import { zh, type ChatKey } from '../src/client/locales.ts'

type Props = Record<string, any>
type Binding = { sessionId: string; ctx: object }

function ConversationRoot(props: Props) {
  return <section>
    <button data-action="workspace" onClick={() => void props.selectWorkspace('project-a')}>{props.t('hero.chooseWorkspace')}</button>
    {props.renderSlot('conversation.hero.agentPreset', {})}
    {props.renderSlot('conversation.composer.bar', props.owner)}
  </section>
}
function SidebarRoot(props: Props) {
  return <aside>
    <button data-action="new" onClick={() => props.startSession()}>New</button>
    <button data-action="project-new" onClick={() => props.startSession('project-a')}>Project</button>
  </aside>
}
function WorkspaceBrowser(props: Props) { return <div>{props.t('group.ungrouped')}</div> }

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}

function harness() {
  const entries = {
    'main.conversation': [{ component: ConversationRoot as ComponentType<any> }],
    sidebar: [{ component: SidebarRoot as ComponentType<any> }],
    'sidebar.workspaces': [{ component: WorkspaceBrowser as ComponentType<any> }],
  }
  const disposers: (() => void)[] = []
  const bindings = new Map<string, Binding>()
  const inputs = new Map<object, ReturnType<typeof makeInput>>()
  const list = { current: undefined as string | undefined, byId: {} as Record<string, any> }
  function makeInput(initial = '') {
    let draft = initial
    return {
      setDraft: vi.fn((text: string) => { draft = text }),
      submit: vi.fn(),
      state: { getSnapshot: () => ({ draft }) },
    }
  }
  function addBinding(id: string, initial = '') {
    const binding = { sessionId: id, ctx: {} }
    bindings.set(id, binding)
    const input = makeInput(initial)
    inputs.set(binding.ctx, input)
    return input
  }
  const remoteCreate = vi.fn(async (_request: unknown) => ({ ok: true }))
  const sessions = {
    create: vi.fn(async ({ sessionId }: { sessionId: string }) => { addBinding(sessionId); return sessionId }),
    binding: vi.fn((id: string) => bindings.get(id)),
    open: vi.fn((id: string) => { list.current = id }),
    clear: vi.fn(() => { list.current = undefined }),
    list: { getSnapshot: () => list },
  }
  const selectPanel = vi.fn()
  const ctx = {
    slots: { entries: (key: keyof typeof entries) => entries[key] ?? [], subscribe: vi.fn(() => () => {}) },
    effect: (setup: () => unknown) => { const dispose = setup(); if (typeof dispose === 'function') disposers.push(dispose as () => void) },
    locale: { register: vi.fn(() => () => {}), bind: () => (key: ChatKey) => zh[key] },
    remote: { session: { create: remoteCreate } },
    sessions,
    conversation: { input: { for: (scope: object) => inputs.get(scope) } },
    layout: { selectPanel },
    get: (service: string) => service === 'layout' ? { selectPanel } : undefined,
  }
  apply(ctx as unknown as Context)
  const originalRenderSlot = vi.fn((key: string, owner: Props) => key === 'conversation.composer.bar'
    ? <textarea data-project-composer="true" disabled={owner.disabled} placeholder={owner.placeholder} />
    : <span>Project mode</span>)
  const selectWorkspace = vi.fn(async (_id: string) => { list.current = 'project-session' })
  const originalStartSession = vi.fn()
  const props = {
    sessionId: undefined as string | undefined,
    owner: { disabled: true, blocked: { reason: 'Choose workspace' }, onRequestWorkspace: vi.fn(), placeholder: 'Choose workspace' },
    useSessions: (select: (value: typeof list) => unknown) => select(list),
    useComposerBlock: (select: (value: unknown) => unknown) => select(undefined),
    renderSlot: originalRenderSlot,
    selectWorkspace,
    startSession: originalStartSession,
    t: (key: string) => key,
  }
  return {
    entries, list, props, sessions, remoteCreate, selectPanel, inputs, bindings, addBinding,
    originalRenderSlot, selectWorkspace, originalStartSession,
    dispose: () => { for (const dispose of disposers.reverse()) dispose() },
  }
}

describe('ordinary chat UI integration', () => {
  let container: HTMLDivElement
  let root: Root
  let app: ReturnType<typeof harness>

  beforeEach(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    sessionStorage.clear()
    document.head.innerHTML = '<meta name="dsh-plain-chat-root" content="C:\\workbench\\chat-data">'
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    app = harness()
  })
  afterEach(async () => {
    await act(async () => root.unmount())
    app?.dispose()
    container.remove()
    document.head.innerHTML = ''
    sessionStorage.clear()
  })
  async function render(props: Props = app.props, key: keyof typeof app.entries = 'main.conversation') {
    const Component = app.entries[key][0]!.component
    await act(async () => root.render(<Component {...props} />))
  }
  async function type(text: string) {
    const input = container.querySelector('textarea')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, text)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    return input
  }
  async function click(selector: string) {
    await act(async () => container.querySelector<HTMLButtonElement>(selector)!.click())
  }

  it('accepts a draft before any workspace or session exists', async () => {
    await render()
    const input = await type('你好，我想讨论一个想法')
    expect(input.disabled).toBe(false)
    expect(input.readOnly).toBe(false)
    expect(input.value).toBe('你好，我想讨论一个想法')
    expect(sessionStorage.getItem('workbench-chat-draft')).toBe(input.value)
    expect(container.textContent).toContain('选择工作区（可选）')
    expect(container.textContent).toContain('普通聊天')
    expect(app.remoteCreate).not.toHaveBeenCalled()
  })

  it('deduplicates rapid sends and creates the explicit chat preset before submitting', async () => {
    const creation = deferred<{ ok: boolean }>()
    app.remoteCreate.mockImplementation(() => creation.promise)
    await render()
    await type('Hello')
    await act(async () => {
      const send = container.querySelector<HTMLButtonElement>('button[aria-label="发送消息"]')!
      send.click(); send.click()
    })
    expect(app.remoteCreate).toHaveBeenCalledTimes(1)
    const request = app.remoteCreate.mock.calls[0]![0] as { sessionId: string; cwd: string; agentPreset: string }
    expect(request).toMatchObject({ cwd: 'C:\\workbench\\chat-data', agentPreset: 'workbench-chat' })
    expect(request).not.toHaveProperty('workspaceId')
    expect(app.sessions.create).not.toHaveBeenCalled()
    await act(async () => { creation.resolve({ ok: true }); await creation.promise })
    expect(app.sessions.create).toHaveBeenCalledExactlyOnceWith({ sessionId: request.sessionId, cwd: request.cwd })
    const input = app.inputs.get(app.bindings.get(request.sessionId)!.ctx)!
    expect(input.setDraft).toHaveBeenCalledExactlyOnceWith('Hello')
    expect(input.submit).toHaveBeenCalledTimes(1)
    expect(app.sessions.open).toHaveBeenCalledExactlyOnceWith(request.sessionId)
    expect(sessionStorage.getItem('workbench-chat-draft') ?? '').toBe('')
  })

  it('hands the draft to a selected project and cancels an outstanding chat delivery', async () => {
    const creation = deferred<{ ok: boolean }>()
    app.remoteCreate.mockImplementation(() => creation.promise)
    const projectInput = app.addBinding('project-session')
    await render()
    await type('Please inspect this project')
    await click('button[aria-label="发送消息"]')
    await click('[data-action="workspace"]')
    expect(app.selectWorkspace).toHaveBeenCalledExactlyOnceWith('project-a')
    expect(projectInput.setDraft).toHaveBeenCalledExactlyOnceWith('Please inspect this project')
    await act(async () => { creation.resolve({ ok: true }); await creation.promise })
    expect(app.sessions.create).not.toHaveBeenCalled()
    expect(projectInput.submit).not.toHaveBeenCalled()
    await render({ ...app.props, sessionId: 'project-session', owner: { disabled: false, placeholder: 'Project draft' } })
    expect(container.querySelector('[data-project-composer]')).not.toBeNull()
    expect(container.querySelector('[data-dsh-plugin="plain-chat"]')).toBeNull()
    expect(app.originalRenderSlot).toHaveBeenLastCalledWith('conversation.composer.bar', { disabled: false, placeholder: 'Project draft' })
  })

  it('removes only the workspace gate while preserving a business composer block', async () => {
    app.list.byId.chat = { projectionValues: { agentPreset: 'workbench-chat' } }
    const block = { reason: 'Model unavailable', kind: 'model' }
    await render({ ...app.props, sessionId: 'chat', useComposerBlock: (select: (value: unknown) => unknown) => select(block) })
    expect(app.originalRenderSlot).toHaveBeenLastCalledWith('conversation.composer.bar', expect.objectContaining({
      disabled: false, blocked: block, placeholder: block.reason, onRequestWorkspace: undefined,
    }))
  })

  it('clears top-level new chat but delegates a workspace-specific new session', async () => {
    sessionStorage.setItem('workbench-chat-draft', 'old draft')
    await render(app.props, 'sidebar')
    await click('[data-action="project-new"]')
    expect(app.originalStartSession).toHaveBeenCalledExactlyOnceWith('project-a')
    expect(app.sessions.clear).not.toHaveBeenCalled()
    await click('[data-action="new"]')
    expect(app.sessions.clear).toHaveBeenCalledTimes(1)
    expect(app.selectPanel).toHaveBeenCalledWith(null)
    expect(sessionStorage.getItem('workbench-chat-draft')).toBeNull()
    expect(app.originalStartSession).toHaveBeenCalledTimes(1)
  })

  it('keeps Chinese composition Enter and Shift+Enter for the editor, not send', async () => {
    await render()
    const input = await type('中文草稿')
    for (const options of [{ isComposing: true }, { keyCode: 229 }, { shiftKey: true }]) {
      const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, ...options })
      await act(async () => { input.dispatchEvent(event) })
      expect(event.defaultPrevented).toBe(false)
    }
    expect(app.remoteCreate).not.toHaveBeenCalled()
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    await act(async () => { input.dispatchEvent(enter) })
    expect(enter.defaultPrevented).toBe(true)
    expect(app.remoteCreate).toHaveBeenCalledTimes(1)
  })

  it('labels ungrouped history as ordinary chats', async () => {
    await render(app.props, 'sidebar.workspaces')
    expect(container.textContent).toBe('聊天')
  })
})
