// @vitest-environment jsdom
import React, { act, type ComponentType } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import { apply } from '../src/client/apply.tsx'
import { zh, type ChatKey } from '../src/client/locales.ts'
import { capabilityClient, editorDrafts } from '../src/client/capability-client.ts'
import { initialState, emptyRole } from '../../dsh-capabilities/src/core/model.ts'

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
    {props.renderSlot('sidebar.workspaces', { wide: true })}
    <button data-action="new" onClick={() => props.startSession()}>New</button>
    <button data-action="project-new" onClick={() => props.startSession('project-a')}>Project</button>
  </aside>
}
function WorkspaceBrowser(props: Props) { return <div>{props.t('group.ungrouped')}</div> }
function AgentPresetSection() { return <div data-existing-presets>Existing presets</div> }

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
    'settings.section': [{ component: AgentPresetSection as ComponentType<any> }],
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
    slots: { entries: (key: keyof typeof entries) => entries[key] ?? [], subscribe: vi.fn(() => () => {}), inject: (_key: string, setup: () => () => void) => disposers.push(setup()), register: vi.fn(() => () => {}) },
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

  beforeEach(async () => {
    editorDrafts.clear()
    const state = initialState()
    const definition = { ...emptyRole(), name: '网页助手', capabilities: [{ capabilityId: 'browser', version: 1, enabled: true }] }
    state.roles.push({ id: 'reader', enabled: true, draft: definition, versions: [{ ...definition, version: 1, preset: 'workbench-role-reader-v1', createdAt: state.updatedAt }] })
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ state, components: [], health: { state: 'disconnected', message: '浏览器待连接' }, tasks: [] }) })))
    vi.stubGlobal('EventSource', class extends EventTarget { close = vi.fn() })
    await capabilityClient.refresh()
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    sessionStorage.clear()
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
    HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
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
  async function renderWithRoles(props: Props = app.props) {
    const Conversation = app.entries['main.conversation'][0]!.component
    const Roles = app.entries['settings.section'][0]!.component
    // 设置弹窗打开时，实际输入框仍挂载；不能靠卸载输入框掩盖岗位切换问题。
    await act(async () => root.render(<><Conversation {...props}/><Roles {...app.props}/></>))
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

  it('starts a published role with its actual preset and retains the draft during selection', async () => {
    await render()
    await type('请读取网页')
    await click('button[aria-haspopup="dialog"]')
    await act(async () => { Array.from(document.querySelectorAll<HTMLButtonElement>('dialog button')).find(b => b.textContent?.includes('网页助手'))!.click() })
    expect(container.querySelector('textarea')!.value).toBe('请读取网页')
    await click('button[aria-label="发送消息"]')
    expect(app.remoteCreate).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ agentPreset: 'workbench-role-reader-v1' }))
  })

  it('selects the role card, clears the selection, and starts its published preset without losing the draft', async () => {
    await renderWithRoles()
    await type('请读取网页')
    const selector = 'button[aria-label="选定助手：网页助手"]'
    expect(container.textContent).not.toContain('用于新对话')
    await click(selector)
    expect(container.querySelector(selector)!.getAttribute('aria-pressed')).toBe('true')
    expect(container.querySelector('[data-role-id="reader"]')!.textContent).toContain('✓ 已选定')
    expect(container.querySelector('[data-current-assistant="true"]')!.getAttribute('aria-label')).toBe('打开岗位助手：网页助手')
    await act(async () => { Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent === '取消选定')!.click() })
    expect(container.querySelector(selector)!.getAttribute('aria-pressed')).toBe('false')
    expect(container.querySelector('button[aria-haspopup="dialog"]')!.textContent).toContain('普通聊天')
    await click(selector)
    expect(container.querySelector('textarea')!.value).toBe('请读取网页')
    expect(app.remoteCreate).not.toHaveBeenCalled()
    await click('button[aria-label="发送消息"]')
    expect(app.remoteCreate).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ agentPreset: 'workbench-role-reader-v1' }))
  })

  it('does not select a different role while editing or disabling it', async () => {
    await render(app.props, 'settings.section')
    const selected = 'button[aria-label="选定助手：需求分析助手"]'
    await click(selected)
    const customRole = container.querySelector('[data-role-id="reader"]')!
    await act(async () => { Array.from(customRole.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent?.includes('编辑岗位'))!.click() })
    expect(container.querySelector(selected)!.getAttribute('aria-pressed')).toBe('true')
    expect(customRole.querySelector('button[aria-pressed]')!.getAttribute('aria-pressed')).toBe('false')
    await act(async () => { document.querySelector('dialog')!.dispatchEvent(new Event('cancel', { cancelable: true })) })
    await act(async () => { Array.from(customRole.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent === '停用')!.click() })
    expect(container.querySelector(selected)!.getAttribute('aria-pressed')).toBe('true')
    expect(customRole.querySelector('button[aria-pressed]')!.getAttribute('aria-pressed')).toBe('false')
    expect(vi.mocked(fetch).mock.calls.some(([, options]) => options?.body && JSON.parse(String(options.body)).command?.type === 'role.toggle')).toBe(true)
    expect(app.remoteCreate).not.toHaveBeenCalled()
  })

  it('keeps draft and disabled role cards unavailable for selection', async () => {
    const state = capabilityClient.getSnapshot().data!.state
    const reader = state.roles.find(role => role.id === 'reader')!
    reader.enabled = false
    state.roles.push({ id: 'draft-role', enabled: true, draft: { ...emptyRole(), name: '未发布助手' }, versions: [] })
    await render(app.props, 'settings.section')
    for (const name of ['网页助手', '未发布助手']) {
      const selector = `button[aria-label="选定助手：${name}"]`
      expect(container.querySelector<HTMLButtonElement>(selector)!.disabled).toBe(true)
      await click(selector)
      expect(container.querySelector(selector)!.getAttribute('aria-pressed')).toBe('false')
    }
    expect(container.querySelector('button[aria-pressed="true"]')).toBeNull()
  })

  it('switches the failed creation to the newly selected card while retaining the unsent draft', async () => {
    app.remoteCreate.mockRejectedValueOnce(new Error('network'))
    await renderWithRoles()
    await type('保留这段草稿')
    await click('button[aria-label="发送消息"]')
    const original = app.remoteCreate.mock.calls[0]![0] as { sessionId: string; agentPreset: string }
    expect(original.agentPreset).toBe('workbench-chat')
    await click('button[aria-label="选定助手：网页助手"]')
    expect(container.querySelector('textarea')!.value).toBe('保留这段草稿')
    await click('button[aria-label="发送消息"]')
    const replacement = app.remoteCreate.mock.calls[1]![0] as { sessionId: string; agentPreset: string }
    expect(replacement.agentPreset).toBe('workbench-role-reader-v1')
    expect(replacement.sessionId).not.toBe(original.sessionId)
    expect(app.sessions.create).toHaveBeenCalledTimes(1)
  })

  it('retains the retry identity when the already selected card is clicked again', async () => {
    app.remoteCreate.mockRejectedValueOnce(new Error('network'))
    await renderWithRoles()
    await click('button[aria-label="选定助手：网页助手"]')
    await type('继续读取')
    await click('button[aria-label="发送消息"]')
    await click('button[aria-label="选定助手：网页助手"]')
    await click('button[aria-label="发送消息"]')
    expect(app.remoteCreate).toHaveBeenCalledTimes(2)
    expect(app.remoteCreate.mock.calls[1]![0]).toEqual(app.remoteCreate.mock.calls[0]![0])
  })

  it('keeps the official roster and opens the persisted role fields', async () => {
    await render(app.props, 'settings.section')
    expect(container.querySelector('[data-existing-presets]')).not.toBeNull()
    for (const name of ['需求分析助手', '市场部助手', '项目经理助手', '开发助手']) expect(container.textContent).toContain(name)
    const customRole = Array.from(container.querySelectorAll('article')).find(card => card.querySelector('h3')?.textContent === '网页助手')!
    await act(async () => { Array.from(customRole.querySelectorAll('button')).find(b => b.textContent?.includes('编辑岗位'))!.click() })
    const dialog = document.querySelector('dialog')!
    expect(dialog.querySelector<HTMLInputElement>('input[maxlength="80"]')!.value).toBe('网页助手')
    expect(dialog.querySelectorAll('[data-attached-capability]')).toHaveLength(1)
    expect(Array.from(dialog.querySelectorAll<HTMLButtonElement>('button')).find(b => b.textContent === '保存并发布')!.disabled).toBe(false)
    expect(app.remoteCreate).not.toHaveBeenCalled()
  })

  it('preserves an unsaved role composition while leaving and returning to the editor', async () => {
    await render(app.props, 'settings.section')
    const open = () => act(async () => { Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('创建岗位助手'))!.click() })
    await open()
    await act(async () => { document.querySelector<HTMLButtonElement>('dialog button[aria-label="添加 浏览器操作"]')!.click() })
    expect(document.querySelectorAll('[data-attached-capability="browser"]')).toHaveLength(1)
    await act(async () => { document.querySelector('dialog')!.dispatchEvent(new Event('cancel', { cancelable: true })) })
    await open()
    expect(document.querySelectorAll('[data-attached-capability="browser"]')).toHaveLength(1)
    expect(app.remoteCreate).not.toHaveBeenCalled()
    expect(vi.mocked(fetch).mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false)
  })

  it.each(['workbench-chat', 'workbench-role-reader-v1'])('keeps the toolbar linked to role selection over an existing %s session without changing that session', async preset => {
    const session = { title: '保留原来的对话', projectionValues: { agentPreset: preset }, metadata: { workspaceId: 'project-a' } }
    const preserved = structuredClone(session)
    app.list.byId.older = session
    app.list.current = 'older'
    const sessionInput = app.addBinding('older', '原会话的输入草稿')
    await renderWithRoles({ ...app.props, sessionId: 'older' })
    const input = await type('正在编辑，不要清空')
    const toolbar = () => container.querySelector<HTMLButtonElement>('[data-current-assistant="true"]')!

    for (const [name, icon, color] of [
      ['需求分析助手', 'analyst', '#4F73E8'],
      ['市场部助手', 'marketing', '#E58A32'],
      ['项目经理助手', 'manager', '#9A62D8'],
      ['开发助手', 'developer', '#22A58B'],
    ]) {
      await click(`button[aria-label="选定助手：${name}"]`)
      expect(toolbar().getAttribute('aria-label')).toBe(`打开岗位助手：${name}`)
      expect(toolbar().textContent).toContain(name)
      expect(toolbar().getAttribute('data-role-icon')).toBe(icon)
      expect(toolbar().style.getPropertyValue('--role-color')).toBe(color)
      expect(toolbar().textContent).not.toContain('v1')
    }

    await act(async () => { Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent === '取消选定')!.click() })
    expect(toolbar().getAttribute('aria-label')).toBe('打开岗位助手：普通聊天')
    expect(toolbar().getAttribute('data-role-icon')).toBe('chat')
    expect(toolbar().style.getPropertyValue('--role-color')).toBe('#78869f')
    expect(container.querySelector('textarea')).toBe(input)
    expect(input.value).toBe('正在编辑，不要清空')
    expect(sessionInput.state.getSnapshot().draft).toBe('原会话的输入草稿')
    expect(sessionInput.setDraft).not.toHaveBeenCalled()
    expect(sessionInput.submit).not.toHaveBeenCalled()
    expect(app.list.byId.older).toEqual(preserved)
    expect(app.list.current).toBe('older')
    expect(app.remoteCreate).not.toHaveBeenCalled()
    expect(app.sessions.create).not.toHaveBeenCalled()
    expect(app.sessions.open).not.toHaveBeenCalled()
    expect(app.sessions.clear).not.toHaveBeenCalled()
    expect(vi.mocked(fetch).mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false)
  })

  it('refreshes the selected custom role name and color in the toolbar without altering the old session preset', async () => {
    const state = capabilityClient.getSnapshot().data!.state
    const reader = state.roles.find(role => role.id === 'reader')!
    reader.draft = { ...reader.draft, name: '客户资料助手', color: '#123456' }
    app.list.byId.older = { projectionValues: { agentPreset: 'workbench-role-reader-v1' } }
    await renderWithRoles({ ...app.props, sessionId: 'older' })
    await click('button[aria-label="选定助手：客户资料助手"]')
    const toolbar = () => container.querySelector<HTMLButtonElement>('[data-current-assistant="true"]')!
    expect(toolbar().getAttribute('aria-label')).toBe('打开岗位助手：客户资料助手')
    expect(toolbar().getAttribute('data-role-icon')).toBe('analyst')
    expect(toolbar().style.getPropertyValue('--role-color')).toBe('#123456')

    // 服务端返回编辑后的岗位外观时，入口无需换会话或刷新页面即可同步。
    reader.draft = { ...reader.draft, name: '市场资料助手', color: '#654321' }
    await act(async () => { await capabilityClient.refresh() })
    expect(toolbar().getAttribute('aria-label')).toBe('打开岗位助手：市场资料助手')
    expect(toolbar().style.getPropertyValue('--role-color')).toBe('#654321')
    expect(app.list.byId.older.projectionValues.agentPreset).toBe('workbench-role-reader-v1')
    expect(reader.versions[0]!.name).toBe('网页助手')
    expect(app.remoteCreate).not.toHaveBeenCalled()
    expect(app.sessions.create).not.toHaveBeenCalled()
    expect(vi.mocked(fetch).mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false)
  })
})
