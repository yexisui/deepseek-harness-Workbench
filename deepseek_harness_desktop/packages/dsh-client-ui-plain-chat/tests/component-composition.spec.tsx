// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { CapabilityStore } from '../../dsh-capabilities/src/host/store.ts'
import { components, type Snapshot } from '../../dsh-capabilities/src/core/model.ts'
import { compositionIds } from '../../dsh-capabilities/src/core/composition.ts'
import { ManagedCenter } from '../src/client/ManagedCenter.tsx'
import { capabilityClient, editorDrafts } from '../src/client/capability-client.ts'
import { MEETING_CAPABILITY_ID } from '../../dsh-capabilities/src/core/default-roles.ts'

describe('editable component relationships', () => {
  let store: CapabilityStore, root: Root, container: HTMLDivElement, error: string | undefined, currentService: boolean
  let serviceVersion: 1 | 2
  const session = '@deepseek-ai/dsh-session'
  const snapshot = (): Snapshot => ({ compositionVersion: currentService ? serviceVersion : undefined, state: store.snapshot(), components, tasks: [], dependencies: components[0]!.dependencies.map(id => ({ id, installed: true, loaded: true, version: '0.1.5', pendingRestart: false })), health: { checkedAt: null, installed: true, loaded: true, state: 'disconnected', message: '浏览器未连接', browsers: [] } })
  beforeEach(async () => {
    ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
    editorDrafts.clear(); sessionStorage.clear(); error = undefined; currentService = true
    serviceVersion = 2
    store = new CapabilityStore(await mkdtemp(join(tmpdir(), 'composition-ui-'))); await store.init()
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
    HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
    Element.prototype.animate = vi.fn(() => ({ cancel: vi.fn() })) as any
    vi.stubGlobal('fetch', vi.fn(async (url: string, options?: RequestInit) => {
      if (url.endsWith('/state')) return { ok: true, json: async () => snapshot() }
      if (url.endsWith('/meeting/config')) return { ok: true, json: async () => ({ ready: false, state: 'unconfigured', message: '请配置识别接口', editable: true, hasKey: true, keySource: 'saved', configSource: 'saved', revision: 1 }) }
      if (url.endsWith('/requirements/config')) return { ok: true, json: async () => ({ ready: true, modelConfigured: true, message: '模型已配置，实际调用待验证', revision: 0, maxTextChars: 160000, defaults: { depth: 'standard', questionStyle: 'short', model: '' } }) }
      if (url.endsWith('/command')) {
        const { revision, command } = JSON.parse(String(options?.body))
        if (error) return { ok: false, json: async () => ({ error }) }
        try { const result = await store.command(revision, command); return { ok: true, json: async () => ({ id: result.id }) } }
        catch (e) { return { ok: false, json: async () => ({ error: (e as Error).message }) } }
      }
      throw Error('Unexpected endpoint: ' + url)
    }))
    await capabilityClient.refresh()
    container = document.createElement('div'); document.body.append(container); root = createRoot(container)
    await act(async () => root.render(<ManagedCenter initialId="browser"/>))
  })
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); await store.close(); editorDrafts.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); delete (Element.prototype as any).animate })
  const button = (label: string, scope: ParentNode = document) => Array.from(scope.querySelectorAll<HTMLButtonElement>('button')).find(b => b.getAttribute('aria-label') === label || b.textContent?.trim() === label)!
  const click = async (label: string, scope: ParentNode = document) => act(async () => { expect(button(label, scope), label).toBeTruthy(); button(label, scope).click(); await new Promise(resolve => setTimeout(resolve, 25)) })
  const rowIds = () => Array.from(document.querySelectorAll('[data-composition-row]')).map(row => row.getAttribute('data-composition-row'))
  const draft = () => editorDrafts.get('capability:browser')!.value as Snapshot['state']['capabilities'][number]['draft']
  const pointer = async (target: EventTarget, type: string, x: number, y: number) => act(async () => {
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y })
    Object.defineProperty(event, 'pointerId', { value: 1 }); target.dispatchEvent(event)
  })
  const openMeeting = async (key = 'meeting') => act(async () => root.render(<ManagedCenter key={key} initialId={MEETING_CAPABILITY_ID}/>))
  const meetingDraft = () => editorDrafts.get(`capability:${MEETING_CAPABILITY_ID}`)!.value as Snapshot['state']['capabilities'][number]['draft']

  it('uses the same editor and configuration roundtrip for requirement service while isolating published authority', async () => {
    await act(async () => root.render(<ManagedCenter key="requirements" initialId="requirements-analysis"/>))
    await click('组件')
    expect(container.querySelector('[data-component-environment="requirements"]')).not.toBeNull()
    expect(container.textContent).not.toContain('浏览器未连接')
    await click('移除关联：需求分析服务'); await click('移除关联')
    await click('保存')
    expect(store.snapshot().capabilities.find(c => c.id === 'requirements-analysis')!.draft.components).toHaveLength(0)
    expect(store.snapshot().capabilities.find(c => c.id === 'requirements-analysis')!.versions.at(-1)!.components).toHaveLength(0)
    await act(async () => root.render(<ManagedCenter key="requirements-reopen" initialId="requirements-analysis"/>))
    await click('组件'); expect(container.textContent).toContain('当前缺少 1 个必需组件')
    await click('编辑组件组合')
    expect(button('检查并发布')).toBeUndefined(); expect(button('保存').disabled).toBe(false)
    await click('添加 需求分析服务')
    expect(document.querySelectorAll('[data-composition-row="requirements-service"]')).toHaveLength(1)
    await click('配置服务', document.querySelector('dialog')!)
    expect(container.textContent).toContain('默认整理深度')
    await click('← 返回组件组合')
    expect(document.querySelectorAll('[data-composition-row="requirements-service"]')).toHaveLength(1)
    expect(button('检查并发布')).toBeUndefined(); expect(button('保存').disabled).toBe(false)
  })

  it('uses the shared component list for meeting service, with real details and required removal confirmation', async () => {
    await openMeeting(); await click('组件')
    expect(container.querySelectorAll('[data-association]')).toHaveLength(1)
    expect(container.textContent).toContain('内置会议服务')
    expect(container.textContent).toContain('请配置识别接口')
    expect(container.textContent).not.toContain('浏览器未连接')
    expect(container.querySelector('[data-component-environment="browser"]')).toBeNull()
    expect(button('移除关联：会议录音转写').querySelector('svg')).not.toBeNull()
    await click('查看详情'); expect(document.querySelector('dialog')!.textContent).toContain('兼容音频转写接口')
    await click('关闭组件详情')
    await click('移除关联：会议录音转写')
    expect(document.querySelector('dialog')!.textContent).toContain('移除后对应功能将不可用')
    expect(document.querySelector('dialog')!.textContent).toContain('录音、转写及纪要')
    await click('取消'); expect(editorDrafts.size).toBe(0)
    await click('移除关联：会议录音转写'); await click('移除关联')
    expect(container.textContent).toContain('当前缺少 1 个必需组件')
    await click('撤销移除'); expect(container.querySelectorAll('[data-association]')).toHaveLength(1)
  })

  it('preserves an incomplete saved meeting draft on reopen and repairs by pointer drag without duplicate additions', async () => {
    await openMeeting(); await click('组件')
    const published = structuredClone(store.snapshot().capabilities.find(c => c.id === MEETING_CAPABILITY_ID)!.versions)
    await click('移除关联：会议录音转写'); await click('移除关联'); await click('保存')
    expect(store.snapshot().capabilities.find(c => c.id === MEETING_CAPABILITY_ID)!.draft.components).toEqual([])
    expect(store.snapshot().capabilities.find(c => c.id === MEETING_CAPABILITY_ID)!.versions.slice(0,-1)).toEqual(published)
    await openMeeting('meeting-reopened'); await click('组件'); await click('编辑组件组合')
    expect(rowIds()).toEqual([]); expect(button('检查并发布')).toBeUndefined(); expect(button('保存').disabled).toBe(false)
    const zone = document.querySelector('[aria-label="拖入配件"]')!
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => zone })
    const card = button('添加 会议录音转写').closest('article')!
    await pointer(card, 'pointerdown', 0, 0); await pointer(window, 'pointermove', 80, 80); await pointer(window, 'pointerup', 80, 80)
    expect(rowIds()).toEqual(['meeting-asr']); expect(button('检查并发布')).toBeUndefined(); expect(button('保存').disabled).toBe(false)
    expect(Element.prototype.animate).toHaveBeenCalled()
    await pointer(card, 'pointerdown', 0, 0); await pointer(window, 'pointermove', 80, 80); await pointer(window, 'pointerup', 80, 80)
    expect(rowIds()).toEqual(['meeting-asr'])
    await click('保存')
    expect(document.body.textContent).not.toContain('停止正在使用它的浏览器任务')

    expect(store.snapshot().capabilities.find(c => c.id === MEETING_CAPABILITY_ID)!.versions).toHaveLength(3)
  })

  it('keeps composition edits when configuring the service and guards unsaved service settings on return', async () => {
    await openMeeting(); await click('组件'); await click('编辑组件组合')
    const action = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')).find(input => input.parentElement?.textContent === '转写录音')!
    await act(async () => action.click())
    expect(meetingDraft().components[0]!.actions).toEqual([])
    expect(button('检查并发布')).toBeUndefined(); expect(button('保存').disabled).toBe(false)
    await click('配置服务', document.querySelector('dialog')!)
    expect(document.querySelector('dialog')).toBeNull()
    expect(container.textContent).toContain('由模型模块统一管理')
    await click('选择模型')
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    await click('← 返回组件组合'); expect(document.querySelector('dialog')).toBeNull()
    expect(confirm).toHaveBeenCalled()
    confirm.mockReturnValue(true); await click('← 返回组件组合')
    expect(meetingDraft().components[0]!.actions).toEqual([])
    expect(button('检查并发布')).toBeUndefined(); expect(button('保存').disabled).toBe(false)
    const writes = vi.mocked(fetch).mock.calls.filter(([url, options]) => String(url).endsWith('/meeting/config') && options?.method === 'POST')
    expect(writes).toEqual([])
    await click('保存', document.querySelector('dialog')!)
    expect(store.snapshot().capabilities.find(c => c.id === MEETING_CAPABILITY_ID)!.draft.components[0]!.actions).toEqual([])
    expect(store.snapshot().capabilities.find(c => c.id === MEETING_CAPABILITY_ID)!.versions[0]!.components[0]!.actions).toEqual(['transcribe'])
  })

  it('guards meeting edits against the previous composition service while leaving browser management available', async () => {
    serviceVersion = 1; await act(async () => capabilityClient.refresh())
    await click('组件'); expect(button('编辑组件组合').disabled).toBe(false)
    await openMeeting(); await click('组件')
    expect(button('编辑组件组合').disabled).toBe(true)
    expect(button('移除关联：会议录音转写').closest('fieldset')!.disabled).toBe(true)
    await click('编辑能力'); expect(button('保存', document.querySelector('dialog')!)).toBeUndefined()
    serviceVersion = 2; await act(async () => capabilityClient.refresh())
    expect(button('保存', document.querySelector('dialog')!)).toBeDefined()
    expect(button('移除 会议录音转写')).toBeDefined()
  })

  it('prevents an old running service from silently discarding new composition fields', async () => {
    currentService = false; await act(async () => capabilityClient.refresh()); await click('组件')
    expect(container.textContent).toContain('组件组合服务待更新')
    expect(button('移除关联：session').closest('fieldset')!.disabled).toBe(true)
    expect(button('编辑组件组合').disabled).toBe(true)
    await click('编辑能力'); expect(document.querySelector('dialog')!.textContent).toContain('正常重启工作台')
    expect(button('保存', document.querySelector('dialog')!)).toBeUndefined()
    expect(editorDrafts.size).toBe(0)
  })

  it('shows trash icons for every required dependency; cancel, confirm and undo never mutate published state', async () => {
    await click('组件')
    expect(container.querySelectorAll('[data-association]')).toHaveLength(6)
    for (const name of ['浏览器操作', 'tools', 'agent', 'session', 'skill', 'attachment']) expect(button(`移除关联：${name}`).querySelector('svg')).not.toBeNull()
    const before = store.snapshot()
    await click('移除关联：session'); expect(document.querySelector('dialog')!.textContent).toContain('移除后对应功能将不可用')
    await click('取消'); expect(editorDrafts.size).toBe(0)
    await click('移除关联：session'); await click('移除关联')
    expect(container.textContent).toContain('当前缺少 1 个必需组件')
    expect(container.querySelector(`[data-association="${session}"]`)).toBeNull()
    expect(store.snapshot()).toEqual(before)
    await click('撤销移除'); expect(container.querySelector(`[data-association="${session}"]`)).not.toBeNull()
    expect(store.snapshot()).toEqual(before)
  })
  it('shares a pending draft between relation and editor, saves incomplete state, and repairs via drag without changing business settings', async () => {
    await click('组件'); await click('移除关联：session'); await click('移除关联'); await click('编辑组件组合')
    expect(button('检查并发布')).toBeUndefined(); expect(button('保存').disabled).toBe(false)
    expect(rowIds()).not.toContain(session)
    await click('保存', document.querySelector('dialog')!)
    expect(store.snapshot().capabilities[0]!.draft.excludedDependencies).toEqual([session])
    expect(store.snapshot().capabilities[0]!.versions).toHaveLength(2)
    expect(container.textContent).toContain('当前缺少 1 个必需组件')
    await click('编辑组件组合')
    const library = button('添加 session').closest('article')!
    const zone = document.querySelector('[aria-label="拖入配件"]')!
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: vi.fn(() => zone) })
    await pointer(library, 'pointerdown', 20, 20); await pointer(window, 'pointermove', 90, 90); await pointer(window, 'pointerup', 90, 90)
    expect(rowIds()).toContain(session); expect(button('检查并发布')).toBeUndefined(); expect(button('保存').disabled).toBe(false)
    expect(Element.prototype.animate).toHaveBeenCalled()
    expect(draft().components).toEqual(store.snapshot().capabilities[0]!.draft.components)
    await click('关闭编辑器')
    expect(container.querySelectorAll('[aria-label="关联组件组合"]')).toHaveLength(1); expect(container.textContent).not.toContain('当前缺少')
    await click('保存')
    expect(store.snapshot().capabilities[0]!.draft.excludedDependencies).toEqual([])
    expect(store.snapshot().capabilities[0]!.versions).toHaveLength(3)
  })
  it('supports keyboard and pointer sorting, cancels outside drops, and persists the display order', async () => {
    await click('组件'); await click('编辑组件组合')
    const sortable = (name: string) => document.querySelector<HTMLElement>(`[aria-label="调整顺序：${name}"]`)!
    for (const key of [' ', 'ArrowUp', ' ']) await act(async () => sortable('tools').dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })))
    expect(rowIds()[0]).toBe('@deepseek-ai/dsh-tools')
    const target = document.querySelector('[data-composition-row="@deepseek-ai/dsh-tools"]')!
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: vi.fn(() => target) })
    await pointer(sortable('session').querySelector('strong')!, 'pointerdown', 10, 10); await pointer(window, 'pointermove', 80, 80); await pointer(window, 'pointerup', 80, 80)
    expect(rowIds()[0]).toBe(session)
    const order = [...rowIds()]
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => document.body })
    await pointer(sortable('attachment'), 'pointerdown', 10, 10); await pointer(window, 'pointermove', 80, 80); await pointer(window, 'pointerup', 80, 80)
    expect(rowIds()).toEqual(order)
    await click('保存', document.querySelector('dialog')!)
    expect(compositionIds(store.snapshot().capabilities[0]!.draft)).toEqual(order)
    await click('编辑组件组合'); expect(rowIds()).toEqual(order)
  })
  it('keeps failed saves and conflicting drafts available, and discards only with confirmation', async () => {
    await click('组件'); await click('移除关联：session'); await click('移除关联')
    error = '保存失败，请重试'; await click('保存')
    expect(container.textContent).toContain('保存失败，请重试'); expect(draft().excludedDependencies).toEqual([session])
    expect(store.snapshot().capabilities[0]!.draft.excludedDependencies).toBeUndefined()
    error = undefined
    await store.command(store.snapshot().revision, { type: 'capability.pin', id: 'browser', pinned: false })
    await act(async () => capabilityClient.refresh())
    await click('保存'); expect(container.textContent).toContain('其他页面')
    await click('放弃修改'); await click('继续编辑'); expect(draft().excludedDependencies).toEqual([session])
    await click('放弃修改'); await click('放弃修改', document.querySelector('dialog')!)
    expect(editorDrafts.size).toBe(0); expect(container.querySelectorAll('[data-association]')).toHaveLength(6)
  })
  it('requires confirmation before business removal and restores its actions on undo', async () => {
    await click('组件'); await click('编辑组件组合'); const original = structuredClone(store.snapshot().capabilities[0]!.draft.components)
    await click('移除 浏览器操作'); await click('移除关联')
    expect(rowIds()).toHaveLength(0); expect(button('检查并发布')).toBeUndefined(); expect(button('保存').disabled).toBe(false)
    await click('撤销移除'); expect(draft().components).toEqual(original); expect(rowIds()).toHaveLength(6)
    // A duplicate drag cannot silently repair a deliberately removed dependency.
    await click('移除 session'); await click('移除关联')
    const zone = document.querySelector('[aria-label="拖入配件"]')!
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => zone })
    const business = button('添加 浏览器操作').closest('article')!
    await pointer(business, 'pointerdown', 0, 0); await pointer(window, 'pointermove', 80, 80); await pointer(window, 'pointerup', 80, 80)
    expect(rowIds()).toHaveLength(5); expect(draft().excludedDependencies).toEqual([session])
  })
})
