// @vitest-environment jsdom
import React, { act, type ComponentType } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import { apply } from '../src/client/apply.tsx'
import { zh, type ChatKey } from '../src/client/locales.ts'
import { capabilityClient, editorDrafts } from '../src/client/capability-client.ts'
import { initialState, emptyRole } from '../../dsh-capabilities/src/core/model.ts'
import { defaultRequirementSettings, emptyRequirementOverview, type RequirementTask } from '../../dsh-capabilities/src/core/requirements-model.ts'
import { defaults as jevDefaults, descriptor as jevDescriptor, type JevStatus } from '../../dsh-jev-mode/src/core/contract.ts'
import { jevClient } from '../../dsh-jev-mode/src/ui/client.ts'

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
function WorkspaceBrowser(props: Props) {
  const ungrouped = props.t('group.ungrouped')
  const [expanded, setExpanded] = React.useState(true)
  return <div role="tree"><div data-chat-group="true"><div role="treeitem" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{ungrouped}
    <button data-action="ungrouped-new" aria-label={props.t('actions.newSession.aria', { name: ungrouped })} onClick={() => {}} />
    </div><button data-action="open-existing" aria-label="打开已有对话" onClick={() => props.open?.('older')}/></div>
    <div><button data-action="workspace-group-new" aria-label="new in project" onClick={() => props.startSession('project-a')} /></div>
  </div>
}
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
  const listListeners = new Set<() => void>()
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
    open: vi.fn((id: string) => { list.current = id; listListeners.forEach(fn => fn()) }),
    clear: vi.fn(() => { list.current = undefined; listListeners.forEach(fn => fn()) }),
    list: { getSnapshot: () => list, subscribe: (fn: () => void) => { listListeners.add(fn); return () => { listListeners.delete(fn) } } },
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
  const openExisting = vi.fn((id: string) => sessions.open(id))
  const props = {
    sessionId: undefined as string | undefined,
    owner: { disabled: true, blocked: { reason: 'Choose workspace' }, onRequestWorkspace: vi.fn(), placeholder: 'Choose workspace' },
    useSessions: (select: (value: typeof list) => unknown) => select(list),
    useComposerBlock: (select: (value: unknown) => unknown) => select(undefined),
    renderSlot: originalRenderSlot,
    selectWorkspace,
    startSession: originalStartSession,
    open: openExisting,
    t: (key: string) => key,
  }
  return {
    entries, list, props, sessions, remoteCreate, selectPanel, inputs, bindings, addBinding,
    originalRenderSlot, selectWorkspace, originalStartSession, openExisting,
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
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL | Request) => {
      if (String(url).includes('/meeting/jobs?')) return { ok: true, json: async () => ({ items: [], total: 0, unreadableCount: 0 }) }
      if (String(url).includes('/requirements/tasks?')) return { ok: true, json: async () => ({ items: [], total: 0 }) }
      if (String(url).includes('/requirements/config')) return { ok: true, json: async () => ({ ready: true, modelConfigured: true, defaults: { depth: 'standard', questionStyle: 'short', model: '' }, revision: 0, maxTextChars: 60000 }) }
      return { ok: true, json: async () => ({ state, components: [], health: { state: 'disconnected', message: '浏览器待连接' }, tasks: [] }) }
    }))
    vi.stubGlobal('EventSource', class extends EventTarget { close = vi.fn() })
    await capabilityClient.refresh()
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    sessionStorage.clear()
    localStorage.clear()
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
    localStorage.clear()
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
  async function renderWithSidebarAndRoles(props: Props = app.props) {
    const Conversation = app.entries['main.conversation'][0]!.component
    const Sidebar = app.entries.sidebar[0]!.component
    const Browser = app.entries['sidebar.workspaces'][0]!.component
    const Roles = app.entries['settings.section'][0]!.component
    await act(async () => root.render(<><Conversation {...props}/><Sidebar {...props}/><Browser {...props}/><Roles {...props}/></>))
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
    expect(container.textContent).toContain('自由聊天')
    expect(app.remoteCreate).not.toHaveBeenCalled()
  })

  it('keeps the global JEV switch and decision model across actual role selection and new chat', async () => {
    const original=globalThis.fetch
    let saved:JevStatus={state:'off',message:'fixture',connection:{state:'ready',message:'已验证'},config:{schema:1,revision:0,value:{...jevDefaults,model:'intranet/decision'}},descriptor:jevDescriptor,traces:[]}
    vi.stubGlobal('fetch',vi.fn(async(url:any,options:any)=>{
      if(String(url).startsWith('/api/jev-mode/')){
        if(options?.method==='POST'){const body=JSON.parse(options.body);saved={...saved,state:body.value.enabled?'ready':'off',config:{...saved.config,revision:saved.config.revision+1,value:body.value}}}
        return {ok:true,json:async()=>saved}
      }
      return original(url,options)
    }))
    await jevClient.refresh();await renderWithSidebarAndRoles()
    await click('[role="switch"][aria-label="JEV 模式"]')
    expect(container.querySelector('[role="switch"]')?.getAttribute('aria-checked')).toBe('true')
    await click('[data-role-id="reader"] button[aria-pressed]')
    expect(container.querySelector('[role="switch"]')?.getAttribute('aria-checked')).toBe('true')
    await click('[data-action="new"]')
    expect(container.querySelector('[role="switch"]')?.getAttribute('aria-checked')).toBe('true')
    expect(saved.config.value.model).toBe('intranet/decision')
    await click('[role="switch"][aria-label="JEV 模式"]')
    expect(saved.config.value.enabled).toBe(false)
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

  it('recovers a persisted meeting into an empty sidebar after refreshing server history', async () => {
    await render(app.props, 'sidebar.workspaces')
    const original = vi.mocked(fetch).getMockImplementation()!
    vi.mocked(fetch).mockImplementation(async (url, init) => String(url).includes('/meeting/jobs?') ? ({ ok:true, json:async()=>({ items:[{ id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', title:'从服务端恢复的会议', mode:'guided', audience:'', focus:'', summaryModel:'', status:'ready', updatedAt:new Date().toISOString(), createdAt:new Date().toISOString(), roleVersion:1 }], total:1 }) } as Response) : original(url, init))
    await act(async () => { window.dispatchEvent(new Event('focus')) })
    expect(container.textContent).toContain('从服务端恢复的会议')
    expect(container.textContent).toContain('会议')
    expect(container.textContent).not.toContain('重试读取会议记录')
    expect(JSON.parse(localStorage.getItem('workbench-meeting-demos-v1')!)).toHaveLength(1)
  })

  it('makes the chat-group plus start a fresh free-chat draft without changing real workspace plus', async () => {
    await renderWithSidebarAndRoles()
    await click('button[aria-label="选定助手：会议纪要助手"]')
    expect(container.querySelector('[data-meeting-demo="true"]')).not.toBeNull()
    await click('[data-action="ungrouped-new"]')
    expect(container.querySelector('[data-local-conversations="true"]')).not.toBeNull()
    expect(container.querySelector('[data-chat-group] [aria-current="page"]')!.textContent).toContain('新对话')
    expect(container.querySelector('[data-meeting-demo="true"]')).toBeNull()
    expect(container.querySelector('[data-current-assistant="true"]')!.getAttribute('aria-label')).toBe('打开岗位助手：自由聊天')
    expect(container.querySelector('[data-dsh-part="composer"]')).not.toBeNull()
    expect(app.sessions.clear).toHaveBeenCalledTimes(1)
    expect(app.remoteCreate).not.toHaveBeenCalled()
    await click('[data-action="workspace-group-new"]')
    expect(app.originalStartSession).toHaveBeenCalledExactlyOnceWith('project-a')
    expect(app.sessions.clear).toHaveBeenCalledTimes(1)
    await click('button[aria-label="选定助手：会议纪要助手"]')
    await click('[data-action="new"]')
    expect(container.querySelector('[data-current-assistant="true"]')!.getAttribute('aria-label')).toBe('打开岗位助手：自由聊天')
    expect(app.sessions.clear).toHaveBeenCalledTimes(2)
    expect(container.querySelectorAll('[data-chat-group] [aria-label^="打开本地会话"]')).toHaveLength(1)
  })

  it('removes an untouched temporary row when opening another conversation', async () => {
    await renderWithSidebarAndRoles()
    await click('[data-action="ungrouped-new"]')
    expect(container.querySelector('[data-chat-group] [aria-label="打开本地会话：新对话"]')).not.toBeNull()
    await click('[data-action="open-existing"]')
    expect(container.querySelector('[data-local-conversations="true"]')).toBeNull()
    expect(app.openExisting).toHaveBeenCalledExactlyOnceWith('older')
    expect(app.remoteCreate).not.toHaveBeenCalled()
  })

  it('expands a collapsed chat group when its plus creates a temporary row', async () => {
    await renderWithSidebarAndRoles()
    await click('[data-chat-group] [role="treeitem"]')
    expect(container.querySelector('[data-chat-group] [role="treeitem"]')!.getAttribute('aria-expanded')).toBe('false')
    await click('[data-action="ungrouped-new"]')
    expect(container.querySelector('[data-chat-group] [role="treeitem"]')!.getAttribute('aria-expanded')).toBe('true')
    expect(container.querySelector('[data-chat-group] [aria-current="page"]')!.textContent).toContain('新对话')
  })

  it('keeps unsent text as a local draft and restores it when reopened', async () => {
    await renderWithSidebarAndRoles()
    await click('[data-action="ungrouped-new"]')
    await type('明天讨论项目计划')
    expect(container.querySelector('[data-chat-group] [aria-current="page"]')!.textContent).toContain('明天讨论项目计划')
    await click('[data-action="open-existing"]')
    expect(container.querySelector('[data-chat-group] [aria-label^="打开本地会话"]')!.textContent).toContain('草稿')
    await click('[data-chat-group] [aria-label^="打开本地会话"]')
    await renderWithSidebarAndRoles(app.props)
    expect(container.querySelector('textarea')!.value).toBe('明天讨论项目计划')
    expect(container.querySelector('[data-current-assistant="true"]')!.getAttribute('aria-label')).toBe('打开岗位助手：自由聊天')
  })

  it('replaces the temporary row with a real session when a message is sent', async () => {
    await renderWithSidebarAndRoles()
    await click('[data-action="ungrouped-new"]')
    await type('讨论下一步计划')
    expect(container.querySelector('[data-chat-group] [aria-label^="打开本地会话"]')).not.toBeNull()
    await click('button[aria-label="发送消息"]')
    expect(app.sessions.create).toHaveBeenCalledTimes(1)
    expect(app.sessions.open).toHaveBeenCalledTimes(1)
    expect(container.querySelector('[data-chat-group] [aria-label^="打开本地会话"]')).toBeNull()
  })

  it('keeps a started meeting demo in the sidebar and restores its route', async () => {
    await renderWithSidebarAndRoles()
    await click('button[aria-label="选定助手：会议纪要助手"]')
    await act(async () => { Array.from(container.querySelectorAll<HTMLButtonElement>('[data-meeting-demo] button')).find(button => button.textContent?.includes('快速生成'))!.click() })
    expect(container.querySelector('[data-chat-group] [aria-current="page"]')!.textContent).toContain('会议纪要 · 快速生成')
    await click('[data-action="open-existing"]')
    expect(container.querySelector('[data-chat-group] [aria-label^="打开本地会话"]')!.querySelector('small')!.textContent).toBe('会议')
    await renderWithSidebarAndRoles({ ...app.props, sessionId: 'older' })
    await click('[data-chat-group] [aria-label^="打开本地会话"]')
    await renderWithSidebarAndRoles(app.props)
    expect(container.querySelector('[data-meeting-demo="true"]')).not.toBeNull()
    expect(container.textContent).toContain('已选择 快速生成')
    expect(container.textContent).toContain('添加会议录音')
    expect(localStorage.getItem('workbench-meeting-demos-v1')).toContain('会议纪要 · 快速生成')
  })

  it('starts a separate draft when changing assistants from a saved meeting demo', async () => {
    await renderWithSidebarAndRoles()
    await click('button[aria-label="选定助手：会议纪要助手"]')
    await act(async () => { Array.from(container.querySelectorAll<HTMLButtonElement>('[data-meeting-demo] button')).find(button => button.textContent?.includes('引导整理'))!.click() })
    await click('button[aria-label="选定助手：自由聊天"]')
    expect(container.querySelector('[data-meeting-demo="true"]')).toBeNull()
    expect(container.querySelector('[data-current-assistant="true"]')!.getAttribute('aria-label')).toBe('打开岗位助手：自由聊天')
    expect(container.querySelectorAll('[data-chat-group] [aria-label^="打开本地会话"]')).toHaveLength(2)
    expect(container.textContent).toContain('会议纪要 · 引导整理')
  })

  it('shows each existing conversation’s saved role after switching drafts and returning', async () => {
    app.list.byId.readerSession = { projectionValues: { agentPreset: 'workbench-role-reader-v1' } }
    await renderWithSidebarAndRoles({ ...app.props, sessionId: 'readerSession' })
    expect(container.querySelector('[data-current-assistant="true"]')!.getAttribute('aria-label')).toBe('打开岗位助手：网页助手')
    await click('button[aria-label="选定助手：会议纪要助手"]')
    expect(container.querySelector('[data-current-assistant="true"]')!.getAttribute('aria-label')).toBe('打开岗位助手：网页助手')
    await click('[data-action="ungrouped-new"]')
    expect(container.querySelector('[data-current-assistant="true"]')!.getAttribute('aria-label')).toBe('打开岗位助手：网页助手')
    await renderWithSidebarAndRoles(app.props)
    expect(container.querySelector('[data-current-assistant="true"]')!.getAttribute('aria-label')).toBe('打开岗位助手：自由聊天')
    await renderWithSidebarAndRoles({ ...app.props, sessionId: 'readerSession' })
    expect(container.querySelector('[data-current-assistant="true"]')!.getAttribute('aria-label')).toBe('打开岗位助手：网页助手')
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

  it('defaults to the first free-chat card, switches roles and returns without losing the draft', async () => {
    await renderWithRoles()
    await type('请读取网页')
    const selector = 'button[aria-label="选定助手：网页助手"]'
    const chatSelector = 'button[aria-label="选定助手：自由聊天"]'
    const chatCard = container.querySelector('[data-role-id="chat"]')!
    expect(container.querySelector('[data-role-id]')).toBe(chatCard)
    expect(chatCard.querySelector(chatSelector)!.getAttribute('aria-pressed')).toBe('true')
    expect(chatCard.textContent).not.toContain('编辑岗位')
    expect(chatCard.textContent).not.toContain('停用')
    expect(container.querySelector('[data-current-assistant="true"]')!.getAttribute('aria-label')).toBe('打开岗位助手：自由聊天')
    expect(container.textContent).not.toContain('用于新对话')
    await click(selector)
    expect(container.querySelector(selector)!.getAttribute('aria-pressed')).toBe('true')
    expect(container.querySelector(chatSelector)!.getAttribute('aria-pressed')).toBe('false')
    expect(container.querySelector('[data-role-id="reader"]')!.textContent).toContain('✓ 已选定')
    expect(container.querySelector('[data-current-assistant="true"]')!.getAttribute('aria-label')).toBe('打开岗位助手：网页助手')
    await act(async () => { Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent === '返回自由聊天')!.click() })
    expect(container.querySelector(selector)!.getAttribute('aria-pressed')).toBe('false')
    expect(container.querySelector(chatSelector)!.getAttribute('aria-pressed')).toBe('true')
    expect(container.querySelector('button[aria-haspopup="dialog"]')!.textContent).toContain('自由聊天')
    expect(container.querySelector('[role="status"]')!.textContent).toContain('已选定：自由聊天')
    await click(selector)
    expect(container.querySelector('textarea')!.value).toBe('请读取网页')
    expect(sessionStorage.getItem('workbench-chat-draft')).toBe('请读取网页')
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
    expect(vi.mocked(fetch).mock.calls.some(([, options]) => options?.body && JSON.parse(String(options.body)).command?.type === 'role.toggle')).toBe(false)
    expect(document.querySelector('dialog')!.textContent).toContain('历史任务')
    await act(async () => { Array.from(document.querySelectorAll<HTMLButtonElement>('dialog button')).find(b => b.textContent === '确认停用')!.click() })
    expect(vi.mocked(fetch).mock.calls.some(([, options]) => options?.body && JSON.parse(String(options.body)).command?.type === 'role.toggle')).toBe(true)
    expect(app.remoteCreate).not.toHaveBeenCalled()
  })

  it('manages the meeting assistant through the same role editor and toggle controls', async () => {
    await renderWithRoles()
    const card = container.querySelector('[data-role-id="meeting-minutes-demo"]')!
    expect(card.textContent).toContain('编辑岗位')
    expect(card.textContent).toContain('停用')
    expect(card.textContent).toContain('正在检测录音转写')
    await act(async () => { Array.from(card.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent?.includes('编辑岗位'))!.click() })
    expect(document.querySelector('dialog')?.textContent).toContain('已关联“会议录音转写”能力')
    expect(document.querySelector('[data-attached-capability="meeting-transcription"]')).not.toBeNull()
    expect(document.querySelector('button[aria-label="移除 会议录音转写"]')).toBeNull()
    await act(async () => { Array.from(document.querySelectorAll<HTMLButtonElement>('dialog button')).find(button => button.textContent === '保存草稿')!.click() })
    expect(vi.mocked(fetch).mock.calls.some(([, options]) => options?.body && JSON.parse(String(options.body)).command?.id === 'meeting-minutes-demo' && JSON.parse(String(options.body)).command?.type === 'role.save')).toBe(true)
    await act(async () => { Array.from(card.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent === '停用')!.click() })
    await act(async () => { Array.from(document.querySelectorAll<HTMLButtonElement>('dialog button')).find(b => b.textContent === '确认停用')!.click() })
    expect(vi.mocked(fetch).mock.calls.some(([, options]) => options?.body && JSON.parse(String(options.body)).command?.id === 'meeting-minutes-demo' && JSON.parse(String(options.body)).command?.type === 'role.toggle')).toBe(true)
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
    expect(container.querySelectorAll('[data-role-id] button[aria-pressed="true"]')).toHaveLength(1)
    expect(container.querySelector('button[aria-label="选定助手：自由聊天"]')!.getAttribute('aria-pressed')).toBe('true')
  })

  it.each(['empty', 'loading'] as const)('starts free chat when the managed role list is %s', async availability => {
    const current = capabilityClient.getSnapshot()
    const data = availability === 'loading' ? null : { ...current.data!, state: { ...current.data!.state, roles: [] } }
    const snapshot = vi.spyOn(capabilityClient, 'getSnapshot').mockReturnValue({ ...current, data })
    const refresh = vi.spyOn(capabilityClient, 'refresh').mockResolvedValue(undefined)
    try {
      await renderWithRoles()
      const card = container.querySelector('[data-role-id="chat"]')!
      const select = card.querySelector<HTMLButtonElement>('button[aria-label="选定助手：自由聊天"]')!
      expect(container.querySelectorAll('[data-role-id]')).toHaveLength(1)
      expect(select.disabled).toBe(false)
      expect(select.getAttribute('aria-pressed')).toBe('true')
      await click('button[aria-label="选定助手：自由聊天"]')
      await type('先聊一聊这个想法')
      await click('button[aria-label="发送消息"]')
      expect(app.remoteCreate).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ agentPreset: 'workbench-chat' }))
      expect(app.sessions.create).toHaveBeenCalledTimes(1)
      expect(vi.mocked(fetch).mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false)
    } finally {
      snapshot.mockRestore()
      refresh.mockRestore()
    }
  })

  it('opens the meeting demo in a new conversation without creating a session or changing ordinary chat', async () => {
    await renderWithRoles()
    await click('button[aria-label="选定助手：会议纪要助手"]')
    expect(container.querySelector('[data-current-assistant="true"]')!.getAttribute('aria-label')).toBe('打开岗位助手：会议纪要助手')
    expect(container.querySelector('[data-meeting-demo="true"]')).not.toBeNull()
    expect(container.textContent).toContain('快速生成')
    expect(container.textContent).toContain('引导整理')
    expect(app.remoteCreate).not.toHaveBeenCalled()
    await click('button[aria-label="选定助手：自由聊天"]')
    expect(container.querySelector('[data-meeting-demo="true"]')).toBeNull()
    expect(container.querySelector('[data-dsh-part="composer"]')).not.toBeNull()
    expect(app.remoteCreate).not.toHaveBeenCalled()
  })

  it('keeps mode selection in the same sidebar row and promotes it only when meaningful content is saved', async () => {
    const original = vi.mocked(fetch).getMockImplementation()!
    let created: RequirementTask | undefined
    vi.mocked(fetch).mockImplementation(async (url, options) => {
      if (String(url).endsWith('/requirements/create')) {
        const body = JSON.parse(String(options?.body)), now = new Date().toISOString()
        created = { schema: 1, id: body.requestId, revision: 0, dataRevision: 0, title: body.title, mode: body.mode, roleId: body.roleId, roleVersion: body.roleVersion, capabilityId: 'requirements-analysis', capabilityVersion: 1, authorityAt: Date.now(), roleGuidance: { name: '需求分析助手', duties: '', requirements: '', format: '' }, createdAt: now, updatedAt: now, settings: defaultRequirementSettings(), overview: emptyRequirementOverview(), draft: body.draft ?? '', requirements: [], materials: [], questions: [], flows: [], rules: [], messages: [], events: [], versions: [] }
        return { ok: true, json: async () => created } as Response
      }
      if (String(url).endsWith('/requirements/command')) {
        const { command } = JSON.parse(String(options?.body))
        if (command.type === 'material.save') created!.materials.push({ ...command.material, id: 'material-1', revision: 1, history: [] })
        if (command.type === 'save') Object.assign(created!, command.draft === undefined ? {} : { draft: command.draft }, command.mode === undefined ? {} : { mode: command.mode })
        created!.revision++
        return { ok: true, json: async () => structuredClone(created) } as Response
      }
      if (String(url).includes('/requirements/task/')) return { ok: true, json: async () => created } as Response
      return original(url, options)
    })
    await renderWithSidebarAndRoles()
    await type('保留原来写下的业务想法')
    await click('button[aria-label="选定助手：需求分析助手"]')
    expect(container.querySelector('[data-requirements-assistant]')).not.toBeNull()
    expect(container.querySelector<HTMLTextAreaElement>('[data-requirements-assistant] textarea')!.value).toBe('保留原来写下的业务想法')
    const currentRow = () => container.querySelector('[data-local-conversations]')!
    const rowLabels = () => Array.from(currentRow().querySelectorAll('[aria-label^="打开本地会话："]')).map(element => element.getAttribute('aria-label'))
    const before = rowLabels()
    await click('button[aria-label="选择简易模式"]')
    expect(created).toBeUndefined()
    const button = (name: string) => Array.from(container.querySelectorAll<HTMLButtonElement>('[data-requirements-assistant] button')).find(element => element.textContent?.trim() === name)!
    await act(async () => { button('切换分析方式').click() })
    expect(container.querySelector('button[aria-label="选择简易模式"]')).not.toBeNull()
    expect(rowLabels()).toEqual(before)
    expect(container.querySelector<HTMLTextAreaElement>('[aria-label="需求分析输入"]')!.value).toBe('保留原来写下的业务想法')
    await click('button[aria-label="选择简易模式"]')
    await click('button[aria-label="添加需求资料"]')
    expect(document.querySelector('[role="dialog"][aria-label="资料内容"]')).not.toBeNull()
    expect(created).toBeUndefined()
    for (const [label, value] of [['资料名称', '预约说明'], ['资料原文', '员工可以预约会议室']]) {
      await act(async () => {
        const input = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[aria-label="${label}"]`)!
        Object.getOwnPropertyDescriptor(input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value')!.set!.call(input, value)
        input.dispatchEvent(new Event('input', { bubbles: true }))
      })
    }
    await act(async () => { button('保存修改').click() })
    expect(created!.materials).toHaveLength(1)
    expect(document.querySelector('[role="dialog"][aria-label="资料内容"]')).toBeNull()
    expect(rowLabels()).toHaveLength(1)
    expect(currentRow().textContent).toContain('需求')
    expect(app.remoteCreate).not.toHaveBeenCalled()
    await act(async () => { button('切换分析方式').click() })
    const existingId = created!.id
    expect(container.textContent).toContain('已有资料和结果已保留')
    await click('button[aria-label="选择常规模式"]')
    expect(created!.id).toBe(existingId)
    expect(created!.materials).toHaveLength(1)
    expect(vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith('/requirements/create'))).toHaveLength(1)
    await click('[data-action="new"]')
    expect(container.querySelector('[data-requirements-assistant]')).toBeNull()
    await click('[data-chat-group] [aria-label="打开本地会话：保留原来写下的业务想法"]')
    expect(container.querySelector('[data-requirements-assistant]')).not.toBeNull()
    expect(container.textContent).toContain('需求结果')
  })

  it('keeps an unsaved requirement draft in its own local row when leaving before autosave', async () => {
    await renderWithSidebarAndRoles()
    await click('button[aria-label="选定助手：需求分析助手"]')
    await click('button[aria-label="选择常规模式"]')
    await type('第一份尚未发送的需求草稿')
    await click('[data-action="new"]')
    await click('button[aria-label="选定助手：需求分析助手"]')
    expect(container.querySelector<HTMLTextAreaElement>('[aria-label="需求分析输入"]')!.value).toBe('')
    await click('[data-chat-group] [aria-label="打开本地会话：第一份尚未发送的需求草稿"]')
    expect(container.querySelector<HTMLTextAreaElement>('[aria-label="需求分析输入"]')!.value).toBe('第一份尚未发送的需求草稿')
    expect(container.querySelector('button[aria-label="选择常规模式"]')).toBeNull()
    expect(vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith('/requirements/create'))).toHaveLength(0)
  })

  it('adds a late saved requirement to history without selecting it or retaining its old temporary row', async () => {
    vi.useFakeTimers()
    try {
      const original = vi.mocked(fetch).getMockImplementation()!, response = deferred<Response>()
      let created: RequirementTask | undefined
      vi.mocked(fetch).mockImplementation(async (url, options) => {
        if (!String(url).endsWith('/requirements/create')) return original(url, options)
        const body = JSON.parse(String(options?.body)), now = new Date().toISOString()
        created = { schema: 1, id: body.requestId, revision: 0, dataRevision: 0, title: body.title, mode: body.mode, roleId: body.roleId, roleVersion: body.roleVersion, capabilityId: 'requirements-analysis', capabilityVersion: 1, authorityAt: Date.now(), roleGuidance: { name: '需求分析助手', duties: '', requirements: '', format: '' }, createdAt: now, updatedAt: now, settings: defaultRequirementSettings(), overview: emptyRequirementOverview(), draft: body.draft, requirements: [], materials: [], questions: [], flows: [], rules: [], messages: [], events: [], versions: [] }
        return response.promise
      })
      await renderWithSidebarAndRoles()
      await click('button[aria-label="选定助手：需求分析助手"]')
      await type('后台保存的第一份需求')
      await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
      expect(created).toBeDefined()
      await click('[data-action="new"]')
      await type('另一个会话正在编辑')
      await act(async () => { response.resolve({ ok: true, json: async () => created } as Response); await Promise.resolve() })
      expect(container.querySelector('[data-requirements-assistant]')).toBeNull()
      expect(container.querySelector<HTMLTextAreaElement>('textarea')!.value).toBe('另一个会话正在编辑')
      const rows = container.querySelectorAll('[data-local-conversations] [aria-label^="打开本地会话："]')
      expect(rows).toHaveLength(2)
      expect(Array.from(rows).filter(row => row.getAttribute('aria-label') === '打开本地会话：后台保存的第一份需求')).toHaveLength(1)
      expect(sessionStorage.getItem('workbench-requirements-active-v1')).toBeNull()
    } finally { vi.useRealTimers() }
  })

  it('shows a clear configuration state instead of a sample transcript', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn((input: string | URL | Request, init?: RequestInit) => String(input).includes('/meeting/config')
      ? Promise.resolve(new Response(JSON.stringify({ ready: false, message: '未配置 DASHSCOPE_API_KEY', maxBytes: 100_000_000, provider: '阿里云百炼' }), { headers: { 'content-type': 'application/json' } }))
      : originalFetch(input, init)) as typeof fetch
    try {
      await renderWithRoles()
      await click('button[aria-label="选定助手：会议纪要助手"]')
      await act(async () => { Array.from(container.querySelectorAll<HTMLButtonElement>('[data-meeting-demo] button')).find(button => button.textContent?.includes('快速生成'))!.click() })
      expect(container.textContent).toContain('未配置 DASHSCOPE_API_KEY')
      expect(container.querySelector<HTMLButtonElement>('button[aria-label="添加录音"]')?.disabled).toBe(true)
      expect(container.textContent).not.toContain('固定样例')
      expect(app.remoteCreate).not.toHaveBeenCalled()
    } finally { globalThis.fetch = originalFetch }
  })

  it('keeps the guided route in the existing conversation before upload', async () => {
    await renderWithRoles()
    await click('button[aria-label="选定助手：会议纪要助手"]')
    const clickText = async (text: string) => act(async () => { Array.from(container.querySelectorAll<HTMLButtonElement>('[data-meeting-demo] button')).find(button => button.textContent?.includes(text))!.click() })
    await clickText('引导整理')
    await clickText('团队同步')
    await clickText('结论与待办')
    expect(container.textContent).toContain('添加会议录音')
    expect(container.querySelector('[data-meeting-demo="true"]')).not.toBeNull()
    expect(app.remoteCreate).not.toHaveBeenCalled()
  })

  it.each([
    ['自由聊天', 'workbench-chat', '网页助手', 'workbench-role-reader-v1'],
    ['网页助手', 'workbench-role-reader-v1', '自由聊天', 'workbench-chat'],
  ])('replaces a failed %s (%s) creation after switching cards while retaining the draft', async (initialName, initialPreset, nextName, nextPreset) => {
    app.remoteCreate.mockRejectedValueOnce(new Error('network'))
    await renderWithRoles()
    await click(`button[aria-label="选定助手：${initialName}"]`)
    await type('保留这段草稿')
    await click('button[aria-label="发送消息"]')
    const original = app.remoteCreate.mock.calls[0]![0] as { sessionId: string; agentPreset: string }
    expect(original.agentPreset).toBe(initialPreset)
    await click(`button[aria-label="选定助手：${nextName}"]`)
    expect(container.querySelector('textarea')!.value).toBe('保留这段草稿')
    expect(sessionStorage.getItem('workbench-chat-draft')).toBe('保留这段草稿')
    await click('button[aria-label="发送消息"]')
    const replacement = app.remoteCreate.mock.calls[1]![0] as { sessionId: string; agentPreset: string }
    expect(replacement.agentPreset).toBe(nextPreset)
    expect(replacement.sessionId).not.toBe(original.sessionId)
    expect(app.sessions.create).toHaveBeenCalledTimes(1)
  })

  it.each(['自由聊天', '网页助手'])('retains the retry identity when the already selected %s card is clicked again', async name => {
    app.remoteCreate.mockRejectedValueOnce(new Error('network'))
    await renderWithRoles()
    await click(`button[aria-label="选定助手：${name}"]`)
    await type('继续读取')
    await click('button[aria-label="发送消息"]')
    await click(`button[aria-label="选定助手：${name}"]`)
    await click('button[aria-label="发送消息"]')
    expect(app.remoteCreate).toHaveBeenCalledTimes(2)
    expect(app.remoteCreate.mock.calls[1]![0]).toEqual(app.remoteCreate.mock.calls[0]![0])
  })

  it('keeps the official roster and opens the persisted role fields', async () => {
    await render(app.props, 'settings.section')
    expect(container.querySelector('[data-existing-presets]')).not.toBeNull()
    expect(container.querySelector('details summary')!.textContent).toBe('高级预设')
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

  it.each(['workbench-chat', 'workbench-role-reader-v1'])('keeps the toolbar on the saved %s session role while configuring a new draft', async preset => {
    const session = { title: '保留原来的对话', projectionValues: { agentPreset: preset }, metadata: { workspaceId: 'project-a' } }
    const preserved = structuredClone(session)
    app.list.byId.older = session
    app.list.current = 'older'
    const sessionInput = app.addBinding('older', '原会话的输入草稿')
    await renderWithRoles({ ...app.props, sessionId: 'older' })
    const input = await type('正在编辑，不要清空')
    const toolbar = () => container.querySelector<HTMLButtonElement>('[data-current-assistant="true"]')!
    const savedAppearance = { label: toolbar().getAttribute('aria-label'), icon: toolbar().getAttribute('data-role-icon'), color: toolbar().style.getPropertyValue('--role-color') }

    for (const [name, icon, color] of [
      ['需求分析助手', 'analyst', '#4F73E8'],
      ['市场部助手', 'marketing', '#E58A32'],
      ['项目经理助手', 'manager', '#9A62D8'],
      ['开发助手', 'developer', '#22A58B'],
    ]) {
      await click(`button[aria-label="选定助手：${name}"]`)
      expect(toolbar().getAttribute('aria-label')).toBe(savedAppearance.label)
      expect(toolbar().getAttribute('data-role-icon')).toBe(savedAppearance.icon)
      expect(toolbar().style.getPropertyValue('--role-color')).toBe(savedAppearance.color)
      expect(container.querySelector(`button[aria-label="选定助手：${name}"]`)!.getAttribute('aria-pressed')).toBe('true')
      const card = container.querySelector(`[data-role-id="builtin-${icon}"]`)!
      expect(card.querySelector('[data-role-appearance-icon]')!.getAttribute('data-role-appearance-icon')).toBe(icon)
      expect((card as HTMLElement).style.getPropertyValue('--role-color')).toBe(color)
      expect(toolbar().textContent).not.toContain('v1')
    }

    await click('button[aria-label="选定助手：自由聊天"]')
    expect(toolbar().getAttribute('aria-label')).toBe(savedAppearance.label)
    expect(toolbar().getAttribute('data-role-icon')).toBe(savedAppearance.icon)
    expect(toolbar().style.getPropertyValue('--role-color')).toBe(savedAppearance.color)
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

  it('keeps unpublished edits off all selection surfaces until publication, preserving old conversations', async () => {
    const state = capabilityClient.getSnapshot().data!.state
    const reader = state.roles.find(role => role.id === 'reader')!
    reader.draft = { ...reader.draft, name: '客户资料助手', color: '#123456' }
    app.list.byId.older = { projectionValues: { agentPreset: 'workbench-role-reader-v1' } }
    await renderWithRoles({ ...app.props, sessionId: 'older' })
    await click('button[aria-label="选定助手：网页助手"]')
    expect(container.querySelector('[data-role-id="reader"]')!.textContent).toContain('有未发布修改')
    const toolbar = () => container.querySelector<HTMLButtonElement>('[data-current-assistant="true"]')!
    expect(toolbar().getAttribute('aria-label')).toBe('打开岗位助手：网页助手')
    expect(toolbar().getAttribute('data-role-icon')).toBe('analyst')
    expect(toolbar().style.getPropertyValue('--role-color')).toBe(reader.versions[0]!.color)

    // Saving drafts alone must not change the next conversation or an existing session.
    reader.draft = { ...reader.draft, name: '市场资料助手', color: '#654321' }
    await act(async () => { await capabilityClient.refresh() })
    expect(toolbar().getAttribute('aria-label')).toBe('打开岗位助手：网页助手')
    expect(toolbar().style.getPropertyValue('--role-color')).toBe(reader.versions[0]!.color)
    await renderWithRoles(app.props)
    expect(toolbar().getAttribute('aria-label')).toBe('打开岗位助手：网页助手')
    reader.versions.push({ ...structuredClone(reader.draft), version: 2, preset: 'workbench-role-reader-v2', createdAt: state.updatedAt })
    await act(async () => { await capabilityClient.refresh() })
    expect(toolbar().getAttribute('aria-label')).toBe('打开岗位助手：市场资料助手')
    expect(toolbar().style.getPropertyValue('--role-color')).toBe('#654321')
    expect(app.list.byId.older.projectionValues.agentPreset).toBe('workbench-role-reader-v1')
    expect(reader.versions[0]!.name).toBe('网页助手')
    expect(app.remoteCreate).not.toHaveBeenCalled()
    expect(app.sessions.create).not.toHaveBeenCalled()
    expect(vi.mocked(fetch).mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false)
  })

  it.each([
    { kind: 'builtin', id: 'developer' },
    { kind: 'png', assetId: 'a'.repeat(64) },
  ] as const)('links a saved $kind icon across the role card, toolbar and new-chat picker', async icon => {
    const state = capabilityClient.getSnapshot().data!.state
    const reader = state.roles.find(role => role.id === 'reader')!
    const published = structuredClone(reader.versions)
    reader.draft = { ...reader.draft, color: '#19647E', icon }
    reader.versions.push({ ...structuredClone(reader.draft), version: 2, preset: 'workbench-role-reader-v2', createdAt: state.updatedAt })
    app.list.byId.older = { projectionValues: { agentPreset: 'workbench-role-reader-v1' }, title: '保留历史会话' }
    const older = structuredClone(app.list.byId.older)
    await renderWithRoles()
    const input = await type('保留新的输入草稿')
    await click('button[aria-label="选定助手：网页助手"]')
    await click('button[aria-haspopup="dialog"]')
    const option = Array.from(document.querySelectorAll<HTMLButtonElement>('dialog button')).find(button => button.querySelector('strong')?.textContent === '网页助手')!
    const surfaces = [
      container.querySelector('[data-role-id="reader"]')!,
      container.querySelector('[data-current-assistant="true"]')!,
      container.querySelector('button[aria-haspopup="dialog"]')!,
      option,
    ]
    for (const surface of surfaces) {
      const marker = surface.querySelector('[data-role-appearance-icon]')!
      expect(marker.getAttribute('data-role-appearance-icon')).toBe(icon.kind === 'png' ? 'png' : icon.id)
      if (icon.kind === 'png') expect(marker.querySelector('img')!.getAttribute('src')).toBe(`/api/capabilities/icons/${icon.assetId}`)
    }
    expect(surfaces[1]!.getAttribute('data-role-icon')).toBe(icon.kind === 'png' ? 'png' : icon.id)
    expect((surfaces[1] as HTMLElement).style.getPropertyValue('--role-color')).toBe('#19647E')
    await act(async () => { option.click() })
    expect(container.querySelector('textarea')).toBe(input)
    expect(input.value).toBe('保留新的输入草稿')
    expect(sessionStorage.getItem('workbench-chat-draft')).toBe(input.value)
    expect(app.list.byId.older).toEqual(older)
    expect(reader.versions.slice(0, 1)).toEqual(published)
    expect(app.remoteCreate).not.toHaveBeenCalled()
    expect(vi.mocked(fetch).mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false)
    await click('button[aria-label="发送消息"]')
    expect(app.remoteCreate).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ agentPreset: 'workbench-role-reader-v2' }))
  })

  it('falls back from a missing PNG and retries a repaired same-hash snapshot without retrying unrelated renders', async () => {
    const state = capabilityClient.getSnapshot().data!.state
    const reader = state.roles.find(role => role.id === 'reader')!
    reader.draft = { ...reader.draft, icon: { kind: 'png', assetId: 'a'.repeat(64) } }
    reader.versions.push({ ...structuredClone(reader.draft), version: 2, preset: 'workbench-role-reader-v2', createdAt: state.updatedAt })
    await renderWithRoles()
    await type('图片加载失败也保留草稿')
    await click('button[aria-label="选定助手：网页助手"]')
    await click('button[aria-haspopup="dialog"]')
    const surfaces = () => [
      container.querySelector('[data-role-id="reader"]')!,
      container.querySelector('[data-current-assistant="true"]')!,
      container.querySelector('button[aria-haspopup="dialog"]')!,
      Array.from(document.querySelectorAll<HTMLButtonElement>('dialog button')).find(button => button.querySelector('strong')?.textContent === '网页助手')!,
    ]
    await act(async () => { for (const surface of surfaces()) surface.querySelector('img')!.dispatchEvent(new Event('error')) })
    for (const surface of surfaces()) {
      expect(surface.querySelector('img')).toBeNull()
      expect(surface.querySelector('[data-role-appearance-icon]')!.getAttribute('data-role-appearance-icon')).toBe('analyst')
    }
    // Editing another field keeps the same icon snapshot and must not start a render/error loop.
    reader.draft = { ...reader.draft, color: '#376BA9' }
    await act(async () => { await capabilityClient.refresh() })
    for (const surface of surfaces()) expect(surface.querySelector('img')).toBeNull()

    // Repairing and publishing identical PNG content returns the same hash in a new server snapshot.
    reader.draft = { ...reader.draft, icon: { kind: 'png', assetId: 'a'.repeat(64) } }
    reader.versions.push({ ...structuredClone(reader.draft), version: 3, preset: 'workbench-role-reader-v3', createdAt: state.updatedAt })
    await act(async () => { await capabilityClient.refresh() })
    for (const surface of surfaces()) {
      expect(surface.querySelector('[data-role-appearance-icon]')!.getAttribute('data-role-appearance-icon')).toBe('png')
      expect(surface.querySelector('img')!.getAttribute('src')).toBe(`/api/capabilities/icons/${'a'.repeat(64)}`)
    }
    await act(async () => { for (const surface of surfaces()) surface.querySelector('img')!.dispatchEvent(new Event('error')) })
    reader.draft = { ...reader.draft, icon: { kind: 'png', assetId: 'b'.repeat(64) } }
    reader.versions.push({ ...structuredClone(reader.draft), version: 4, preset: 'workbench-role-reader-v4', createdAt: state.updatedAt })
    await act(async () => { await capabilityClient.refresh() })
    for (const surface of surfaces()) {
      expect(surface.querySelector('[data-role-appearance-icon]')!.getAttribute('data-role-appearance-icon')).toBe('png')
      expect(surface.querySelector('img')!.getAttribute('src')).toBe(`/api/capabilities/icons/${'b'.repeat(64)}`)
    }
    expect(container.querySelector('button[aria-label="选定助手：网页助手"]')!.getAttribute('aria-pressed')).toBe('true')
    expect(container.querySelector('textarea')!.value).toBe('图片加载失败也保留草稿')
    expect(app.remoteCreate).not.toHaveBeenCalled()
    expect(vi.mocked(fetch).mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false)
  })

  it('keeps cached appearance edits local until saving and never changes the selected role or old session', async () => {
    const state = capabilityClient.getSnapshot().data!.state
    const reader = state.roles.find(role => role.id === 'reader')!
    const published = structuredClone(reader.versions)
    const cachedDraft = { ...structuredClone(reader.draft), color: '#8C3F81', icon: { kind: 'builtin', id: 'developer' } as const }
    editorDrafts.set('role:reader', { value: cachedDraft, revision: state.revision })
    app.list.byId.older = { title: '现有对话', projectionValues: { agentPreset: 'workbench-role-reader-v1' } }
    app.list.current = 'older'
    const older = structuredClone(app.list.byId.older)
    const sessionInput = app.addBinding('older', '会话已有草稿')
    const command = vi.spyOn(capabilityClient, 'command').mockImplementation(async (request, revision) => {
      expect(request).toEqual({ type: 'role.save', id: 'reader', definition: cachedDraft, publish: false })
      expect(revision).toBe(state.revision)
      if (request.type !== 'role.save') throw new Error('Unexpected command')
      reader.draft = structuredClone(request.definition)
      await capabilityClient.refresh()
      return reader.id
    })
    try {
      await renderWithRoles({ ...app.props, sessionId: 'older' })
      const input = await type('仍在编辑的输入')
      await click('button[aria-label="选定助手：需求分析助手"]')
      const open = () => act(async () => {
        Array.from(container.querySelectorAll<HTMLButtonElement>('[data-role-id="reader"] button')).find(button => button.textContent?.includes('编辑岗位'))!.click()
      })
      await open()
      await act(async () => { document.querySelector('dialog')!.dispatchEvent(new Event('cancel', { cancelable: true })) })
      expect(container.querySelector('[data-role-id="reader"] [data-role-appearance-icon]')!.getAttribute('data-role-appearance-icon')).toBe('analyst')
      expect(container.querySelector('button[aria-label="选定助手：需求分析助手"]')!.getAttribute('aria-pressed')).toBe('true')
      expect(editorDrafts.get('role:reader')!.value).toEqual(cachedDraft)
      await open()
      await act(async () => { Array.from(document.querySelectorAll<HTMLButtonElement>('dialog button')).find(button => button.textContent === '保存草稿')!.click() })
      expect(command).toHaveBeenCalledTimes(1)
      expect(editorDrafts.has('role:reader')).toBe(false)
      expect(container.querySelector('[data-role-id="reader"] [data-role-appearance-icon]')!.getAttribute('data-role-appearance-icon')).toBe('analyst')
      expect(container.querySelector('[data-role-id="reader"]')!.textContent).toContain('有未发布修改')
      expect(reader.draft).toEqual(cachedDraft)
      expect(container.querySelector('[data-current-assistant="true"]')!.getAttribute('data-role-icon')).toBe('analyst')
      expect(container.querySelector('button[aria-label="选定助手：需求分析助手"]')!.getAttribute('aria-pressed')).toBe('true')
      expect(reader.versions).toEqual(published)
      expect(app.list.byId.older).toEqual(older)
      expect(app.list.current).toBe('older')
      expect(sessionInput.state.getSnapshot().draft).toBe('会话已有草稿')
      expect(sessionInput.setDraft).not.toHaveBeenCalled()
      expect(sessionInput.submit).not.toHaveBeenCalled()
      expect(container.querySelector('textarea')).toBe(input)
      expect(input.value).toBe('仍在编辑的输入')
      expect(app.remoteCreate).not.toHaveBeenCalled()
      expect(app.sessions.create).not.toHaveBeenCalled()
      expect(app.sessions.open).not.toHaveBeenCalled()
      expect(app.sessions.clear).not.toHaveBeenCalled()
    } finally { command.mockRestore() }
  })
})
