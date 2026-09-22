// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CapabilityStore } from '../../dsh-capabilities/src/host/store.ts'
import { components, emptyRole, latest, type Command, type Snapshot, type Task } from '../../dsh-capabilities/src/core/model.ts'
import { ManagedCenter } from '../src/client/ManagedCenter.tsx'
import { ManagedRoleEditor } from '../src/client/ManagedRoles.tsx'
import { capabilityClient, editorDrafts } from '../src/client/capability-client.ts'

describe('managed capability card actions', () => {
  let container: HTMLDivElement, root: Root, store: CapabilityStore, secondId: string
  let tasks: Task[], commands: Command[], nextCommandError: string | undefined
  let pendingCommand: Promise<string> | undefined
  const send = (command: Command) => store.command(store.snapshot().revision, command)
  const snapshot = (): Snapshot => ({ state: store.snapshot(), components, tasks, health: { checkedAt: null, installed: true, loaded: true, state: 'ready', message: '浏览器已连接', browsers: [] } })

  beforeEach(async () => {
    ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
    store = new CapabilityStore(await mkdtemp(join(tmpdir(), 'dsh-capability-cards-')))
    await store.init()
    const definition = { ...store.snapshot().capabilities[0]!.draft, name: '自定义采集' }
    secondId = (await send({ type: 'capability.save', definition, publish: true })).id
    tasks = []; commands = []; nextCommandError = undefined; pendingCommand = undefined
    editorDrafts.clear(); sessionStorage.clear()
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
    HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
    vi.stubGlobal('fetch', vi.fn(async (url: string, options?: RequestInit) => {
      if (url.endsWith('/state')) return { ok: true, json: async () => snapshot() }
      if (url.endsWith('/command')) {
        const { revision, command } = JSON.parse(String(options?.body))
        commands.push(command)
        if (nextCommandError) { const error = nextCommandError; nextCommandError = undefined; return { ok: false, json: async () => ({ error }) } }
        try { const result = await store.command(revision, command); return { ok: true, json: async () => ({ id: result.id }) } }
        catch (error) { return { ok: false, json: async () => ({ error: (error as Error).message }) } }
      }
      throw new Error(`Unexpected capability endpoint: ${url}`)
    }))
    const command = capabilityClient.command
    vi.spyOn(capabilityClient, 'command').mockImplementation((...args) => { pendingCommand = command(...args); return pendingCommand })
    await capabilityClient.refresh()
    container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  })
  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove(); await store.close(); editorDrafts.clear(); sessionStorage.clear()
    vi.restoreAllMocks(); vi.unstubAllGlobals()
  })

  const buttons = (scope: ParentNode = document) => Array.from(scope.querySelectorAll<HTMLButtonElement>('button'))
  const button = (label: string, scope: ParentNode = document) => buttons(scope).find(node => node.getAttribute('aria-label') === label || node.textContent?.trim() === label)
  const settleCommand = async () => { await pendingCommand?.catch(() => {}) }
  const click = async (label: string, scope: ParentNode = document) => act(async () => {
    const target = button(label, scope); expect(target, label).toBeTruthy()
    pendingCommand = undefined; target!.click(); await settleCommand()
  })
  const render = async () => act(async () => root.render(<ManagedCenter/>))
  const cardIds = () => Array.from(container.querySelectorAll('[data-managed-capability]')).map(card => card.getAttribute('data-managed-capability'))
  async function makeRole(name: string) {
    return send({ type: 'role.save', definition: { ...emptyRole(), name, capabilities: [{ capabilityId: 'browser', version: 1, enabled: true }] }, publish: true })
  }

  it('shows current references and historical live sessions, and cancellation leaves the store untouched', async () => {
    await makeRole('当前采集岗位')
    const historical = await makeRole('历史采集岗位'), role = historical.state.roles.find(r => r.id === historical.id)!
    await send({ type: 'role.save', id: role.id, definition: { ...role.draft, capabilities: [] }, publish: true })
    tasks = [
      { sessionId: 'old-live', roleId: role.id, roleVersion: 1, name: '旧版采集', status: 'running', browserSessions: ['owned'] },
      { sessionId: 'old-stopped', roleId: role.id, roleVersion: 1, name: '已停止', status: 'stopped', browserSessions: [] },
    ]
    await capabilityClient.refresh(); await render()
    const before = store.snapshot()
    await click('移除能力：浏览器操作')
    const dialog = document.querySelector('dialog')!
    expect(dialog.textContent).toContain('1 个岗位引用 · 1 个活动会话')
    expect(dialog.textContent).toContain('当前采集岗位')
    expect(dialog.textContent).toContain('恢复后需要手动启用')
    await click('取消', dialog)
    expect(document.querySelector('dialog')).toBeNull()
    expect(commands).toEqual([])
    expect(store.snapshot()).toEqual(before)
    expect(cardIds()).toContain('browser')
  })

  it('keeps the card and confirmation open on failure so removal can be retried', async () => {
    await render(); await click('移除能力：自定义采集')
    nextCommandError = '保存失败，请重试'
    await click('确认移除', document.querySelector('dialog')!)
    expect(document.querySelector('dialog [role="alert"]')?.textContent).toBe('保存失败，请重试')
    expect(cardIds()).toContain(secondId)
    expect(store.snapshot().capabilities.find(c => c.id === secondId)!.removedAt).toBeUndefined()
    await click('确认移除', document.querySelector('dialog')!)
    expect(document.querySelector('dialog')).toBeNull()
    expect(cardIds()).not.toContain(secondId)
    expect(store.snapshot().capabilities.find(c => c.id === secondId)!.removedAt).toBeTruthy()
  })

  it('moves removed capabilities into a recoverable list and restores them without enabling or discarding history', async () => {
    await render()
    const before = store.snapshot().capabilities.find(c => c.id === secondId)!
    await click('移除能力：自定义采集'); await click('确认移除', document.querySelector('dialog')!)
    expect(cardIds()).toEqual(['browser'])
    await click('已移除 1')
    expect(cardIds()).toEqual([secondId])
    const removedCard = container.querySelector(`[data-managed-capability="${secondId}"]`)!
    expect(removedCard.textContent).toContain('已移除')
    expect(button('置顶能力：自定义采集', removedCard)).toBeUndefined()
    expect(button('移除能力：自定义采集', removedCard)).toBeUndefined()
    await click('恢复能力：自定义采集', removedCard)
    const restored = store.snapshot().capabilities.find(c => c.id === secondId)!
    expect(restored.removedAt).toBeUndefined(); expect(restored.enabled).toBe(false)
    expect(restored.draft).toEqual(before.draft); expect(restored.versions).toEqual(before.versions)
    expect(container.textContent).toContain('能力已恢复，当前保持停用')
    expect(container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked).toBe(false)
    await click('← 全部能力')
    expect(cardIds()).toContain(secondId)
    expect(container.querySelector(`[data-managed-capability="${secondId}"]`)!.textContent).toContain('已停用')
  })

  it('uses an accessible SVG pushpin and updates ordering and pinned filtering', async () => {
    await render()
    const pinned = button('取消置顶：浏览器操作')!
    expect(pinned.getAttribute('aria-pressed')).toBe('true')
    expect(pinned.querySelector('svg')).not.toBeNull()
    expect(pinned.textContent).not.toMatch(/[★☆]/)
    expect(button('置顶能力：自定义采集')!.getAttribute('aria-pressed')).toBe('false')
    await click('取消置顶：浏览器操作'); await click('置顶能力：自定义采集')
    expect(cardIds()).toEqual([secondId, 'browser'])
    expect(button('取消置顶：自定义采集')!.getAttribute('aria-pressed')).toBe('true')
    await click('置顶')
    expect(cardIds()).toEqual([secondId])
    await click('取消置顶：自定义采集')
    expect(cardIds()).toEqual([])
    expect(container.textContent).toContain('暂无置顶能力')
  })

  it('requires reference review again when another write changes the pending removal revision', async () => {
    await render(); await click('移除能力：浏览器操作')
    await act(async () => { await makeRole('新加入的引用岗位'); await capabilityClient.refresh() })
    const dialog = document.querySelector('dialog')!
    expect(dialog.textContent).toContain('新加入的引用岗位')
    expect(button('确认移除', dialog)!.disabled).toBe(true)
    expect(commands).toEqual([])
    await click('已核对，更新操作基准', dialog)
    expect(button('确认移除', dialog)!.disabled).toBe(false)
    await click('确认移除', dialog)
    expect(store.snapshot().capabilities[0]!.removedAt).toBeTruthy()
  })

  it('excludes removed capabilities from the role library while preserving and allowing detachment of existing bindings', async () => {
    const saved = await makeRole('保留配置的岗位')
    await send({ type: 'capability.remove', id: 'browser' }); await capabilityClient.refresh()
    await act(async () => root.render(<ManagedRoleEditor id={saved.id} onClose={() => {}}/>))
    const dialog = document.querySelector('dialog')!, library = dialog.querySelector('section[aria-label="能力配件库"]')!
    expect(button('添加 浏览器操作', library)).toBeUndefined()
    expect(button('添加 自定义采集', library)).toBeTruthy()
    expect(dialog.querySelector('[data-attached-capability="browser"]')!.textContent).toContain('能力已移除')
    expect(dialog.textContent).toContain('此能力已移除，当前不可执行')
    await click('移除 浏览器操作', dialog)
    expect(dialog.querySelector('[data-attached-capability="browser"]')).toBeNull()
    await click('保存草稿', dialog)
    const role = store.snapshot().roles.find(r => r.id === saved.id)!
    expect(role.draft.capabilities).toEqual([])
    expect(latest(role.versions)!.capabilities).toHaveLength(1)
    expect(store.snapshot().capabilities[0]!.removedAt).toBeTruthy()
  })
})
