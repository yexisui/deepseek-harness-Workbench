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
      if (url.endsWith('/meeting/config')) return { ok: true, json: async () => ({ ready: false, state: 'unconfigured', message: '请配置语音识别接口', provider: '自定义语音识别接口' }) }
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
  const checkbox = (label: string) => Array.from(container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')).find(node => node.getAttribute('aria-label') === label)!
  const select = async (label: string) => act(async () => { expect(checkbox(label), label).toBeTruthy(); checkbox(label).click() })
  const search = async (value: string) => act(async () => {
    const input = container.querySelector<HTMLInputElement>('input[aria-label="搜索能力"]')!
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  async function openRecycleBin(ids = ['browser', secondId]) {
    for (const id of ids) await send({ type: 'capability.remove', id })
    await capabilityClient.refresh(); await render();  await click(`回收站 ${ids.length}`)
  }
  async function makeRole(name: string) {
    return send({ type: 'role.save', definition: { ...emptyRole(), name, capabilities: [{ capabilityId: 'browser', version: 1, enabled: true }] }, publish: true })
  }

  it('manages meeting transcription through the shared card, filters, and a dedicated detail page', async () => {
    await render()
    const card = container.querySelector('[data-managed-capability="meeting-transcription"]')!
    expect(card.textContent).toContain('会议录音转写')
    expect(card.textContent).toContain('待配置')
    expect(button('收藏能力：会议录音转写', card)).toBeTruthy()
    await click('管理能力：会议录音转写', card)
    expect(container.querySelector('[data-meeting-capability-detail]')).not.toBeNull()
    expect(container.textContent).toContain('请配置语音识别接口')
    await click('设置')
    expect(container.textContent).toContain('纪要生成模型仍在会议对话中选择')
    await click('← 全部能力')
    await click('收藏能力：会议录音转写')
    await click('收藏')
    expect(cardIds()).toEqual(['browser', 'meeting-transcription'])
    await click('筛选'); await act(async () => { const label = Array.from(container.querySelectorAll('label')).find(n => n.textContent === '需要配置或连接')!; label.querySelector('input')!.click() })
    expect(cardIds()).toContain('meeting-transcription')
  })

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
    await click('管理能力：浏览器操作'); await click('移除能力：浏览器操作')
    const dialog = document.querySelector('dialog')!
    expect(dialog.textContent).toContain('1 个岗位引用 · 1 个活动会话')
    expect(dialog.textContent).toContain('当前采集岗位')
    expect(dialog.textContent).toContain('恢复后需要手动启用')
    await click('取消', dialog)
    expect(document.querySelector('dialog')).toBeNull()
    expect(commands).toEqual([])
    expect(store.snapshot()).toEqual(before)
    await click('← 全部能力'); expect(cardIds()).toContain('browser')
  })

  it('keeps the card and confirmation open on failure so removal can be retried', async () => {
    await render(); await click('管理能力：自定义采集'); await click('移除能力：自定义采集')
    nextCommandError = '保存失败，请重试'
    await click('确认移除', document.querySelector('dialog')!)
    expect(document.querySelector('dialog [role="alert"]')?.textContent).toBe('保存失败，请重试')
    expect(button('移除能力：自定义采集')).toBeTruthy()
    expect(store.snapshot().capabilities.find(c => c.id === secondId)!.removedAt).toBeUndefined()
    await click('确认移除', document.querySelector('dialog')!)
    expect(document.querySelector('dialog')).toBeNull()
    expect(cardIds()).not.toContain(secondId)
    expect(store.snapshot().capabilities.find(c => c.id === secondId)!.removedAt).toBeTruthy()
  })

  it('allows safely closing a removal dialog when another page has already permanently deleted the capability', async () => {
    await render(); await click('管理能力：自定义采集'); await click('移除能力：自定义采集')
    await act(async () => {
      await send({ type: 'capability.remove', id: secondId })
      await send({ type: 'capability.purge', ids: [secondId] })
      await capabilityClient.refresh()
    })
    const before = store.snapshot(), dialog = document.querySelector('dialog')!
    expect(dialog.textContent).toContain('此能力已被其他页面永久删除。关闭后可继续管理其他能力。')
    expect(button('确认移除', dialog)).toBeUndefined()
    expect(cardIds()).toEqual(['browser', 'meeting-transcription', 'requirements-analysis', 'developer-workspace'])
    await click('关闭', dialog)
    expect(document.querySelector('dialog')).toBeNull()
    expect(commands).toEqual([])
    expect(store.snapshot()).toEqual(before)
    expect(cardIds()).toEqual(['browser', 'meeting-transcription', 'requirements-analysis', 'developer-workspace'])
  })

  it('moves removed capabilities into a recoverable list and restores them without enabling or discarding history', async () => {
    await render()
    const before = store.snapshot().capabilities.find(c => c.id === secondId)!
    await click('管理能力：自定义采集'); await click('移除能力：自定义采集'); await click('确认移除', document.querySelector('dialog')!)
    expect(cardIds()).toEqual(['browser', 'meeting-transcription', 'requirements-analysis', 'developer-workspace'])
     await click('回收站 1')
    expect(cardIds()).toEqual([secondId])
    const removedCard = container.querySelector(`[data-managed-capability="${secondId}"]`)!
    expect(removedCard.textContent).toContain('已移除')
    expect(button('收藏能力：自定义采集', removedCard)).toBeUndefined()
    expect(button('移除能力：自定义采集', removedCard)).toBeUndefined()
    await click('恢复能力：自定义采集', removedCard)
    const restored = store.snapshot().capabilities.find(c => c.id === secondId)!
    expect(restored.removedAt).toBeUndefined(); expect(restored.enabled).toBe(false)
    expect(restored.draft).toEqual(before.draft); expect(restored.versions).toEqual(before.versions)
    expect(container.textContent).toContain('已恢复 1 项能力，当前保持停用')
    expect(container.textContent).toContain('回收站为空')
    expect(cardIds()).toEqual([])
    expect(container.querySelector('h2')!.textContent).toBe('能力回收站')
    await click('← 返回能力列表')
    expect(cardIds()).toContain(secondId)
    expect(container.querySelector(`[data-managed-capability="${secondId}"]`)!.textContent).toContain('已停用')
  })

  it('uses an accessible SVG pushpin and updates ordering and pinned filtering', async () => {
    await render()
    const pinned = button('取消收藏：浏览器操作')!
    expect(pinned.getAttribute('aria-pressed')).toBe('true')
    expect(pinned.querySelector('svg')).not.toBeNull()
    expect(pinned.textContent).not.toMatch(/[★☆]/)
    expect(button('收藏能力：自定义采集')!.getAttribute('aria-pressed')).toBe('false')
    await click('取消收藏：浏览器操作'); await click('收藏能力：自定义采集')
    expect(cardIds()).toEqual([secondId, 'browser', 'meeting-transcription', 'requirements-analysis', 'developer-workspace'])
    expect(button('取消收藏：自定义采集')!.getAttribute('aria-pressed')).toBe('true')
    await click('收藏')
    expect(cardIds()).toEqual([secondId])
    await click('取消收藏：自定义采集')
    expect(cardIds()).toEqual([])
    expect(container.textContent).toContain('暂无收藏能力')
  })

  it('requires reference review again when another write changes the pending removal revision', async () => {
    await render(); await click('管理能力：浏览器操作'); await click('移除能力：浏览器操作')
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

  it('supports card selection, an indeterminate select-all, and clears selections when the search changes', async () => {
    await openRecycleBin()
    expect(button('恢复选中')!.disabled).toBe(true)
    await select('选择能力：浏览器操作')
    expect(checkbox('选择能力：浏览器操作').checked).toBe(true)
    expect(checkbox('选择能力：浏览器操作').parentElement!.querySelector('svg')).not.toBeNull()
    expect(container.querySelector('[data-managed-capability="browser"]')!.getAttribute('data-selected')).toBe('true')
    expect(checkbox('全选回收站能力').indeterminate).toBe(true)
    expect(checkbox('全选回收站能力').checked).toBe(false)
    await select('全选回收站能力')
    expect(checkbox('全选回收站能力').indeterminate).toBe(false)
    expect(checkbox('全选回收站能力').checked).toBe(true)
    await act(async () => container.querySelector<HTMLElement>('[data-managed-capability="browser"] h3')!.click())
    expect(checkbox('选择能力：浏览器操作').checked).toBe(false)
    expect(checkbox('选择能力：自定义采集').checked).toBe(true)
    expect(checkbox('全选回收站能力').indeterminate).toBe(true)
    await search('自定义')
    expect(cardIds()).toEqual([secondId])
    expect(checkbox('选择能力：自定义采集').checked).toBe(false)
    expect(container.textContent).toContain('已选 0 / 1 项')
    await select('全选当前搜索结果')
    expect(checkbox('选择能力：自定义采集').checked).toBe(true)
    await search('不存在的搜索结果')
    expect(checkbox('全选当前搜索结果').disabled).toBe(true)
    expect(button('恢复选中')!.disabled).toBe(true)
    expect(container.textContent).toContain('回收站中没有匹配的能力')
    await search('')
    expect(checkbox('选择能力：自定义采集').checked).toBe(false)
    expect(checkbox('选择能力：浏览器操作').checked).toBe(false)
    expect(commands).toEqual([])
  })

  it('restores selected capabilities atomically without enabling them or discarding version history', async () => {
    await openRecycleBin()
    const before = store.snapshot()
    await select('全选回收站能力'); await click('恢复选中')
    expect(commands).toHaveLength(1)
    expect(commands[0]).toMatchObject({ type: 'capability.restoreMany', ids: expect.arrayContaining(['browser', secondId]) })
    const after = store.snapshot()
    expect(after.revision).toBe(before.revision + 1)
    expect(after.roles).toEqual(before.roles)
    expect(after.revokedAt).toEqual(before.revokedAt)
    for (const cap of after.capabilities.filter(cap => ['browser', secondId].includes(cap.id))) {
      expect(cap.removedAt).toBeUndefined(); expect(cap.enabled).toBe(false); expect(cap.pinned).toBe(false)
      expect(cap.versions).toEqual(before.capabilities.find(value => value.id === cap.id)!.versions)
    }
    expect(container.textContent).toContain('已恢复 2 项能力，当前保持停用')
    expect(container.textContent).toContain('回收站为空')
    await click('← 返回能力列表')
    expect(cardIds()).toEqual(['browser', 'meeting-transcription', 'requirements-analysis', 'developer-workspace', secondId])
    expect(container.querySelector(`[data-managed-capability="${secondId}"]`)!.textContent).toContain('已停用')
  })

  it('keeps selection and data intact when deletion is canceled and card actions do not toggle selection', async () => {
    await openRecycleBin()
    await select('选择能力：浏览器操作')
    const before = store.snapshot()
    await click('永久删除能力：自定义采集')
    const dialog = document.querySelector('dialog')!
    expect(dialog.textContent).toContain('自定义采集')
    expect(checkbox('选择能力：浏览器操作').checked).toBe(true)
    expect(checkbox('选择能力：自定义采集').checked).toBe(false)
    await click('取消', dialog)
    expect(document.querySelector('dialog')).toBeNull()
    expect(store.snapshot()).toEqual(before)
    expect(commands).toEqual([])
    await click('删除选中')
    expect(document.querySelector('dialog')!.textContent).toContain('浏览器操作')
    expect(document.querySelector('dialog')!.textContent).not.toContain('自定义采集')
    await click('取消', document.querySelector('dialog')!)
    expect(checkbox('选择能力：浏览器操作').checked).toBe(true)
    expect(commands).toEqual([])
  })

  it('clears eligible items across the full recycle bin while preserving referenced capabilities outside the search', async () => {
    await makeRole('必须保留的岗位')
    await openRecycleBin()
    const before = store.snapshot()
    await search('自定义')
    expect(cardIds()).toEqual([secondId])
    await click('清空回收站')
    const dialog = document.querySelector('dialog')!
    expect(dialog.textContent).toContain('包含搜索结果之外的项目')
    expect(dialog.textContent).toContain('可永久删除 1 项，保留 1 项')
    expect(dialog.textContent).toContain('必须保留的岗位')
    expect(dialog.textContent).toContain('浏览器操作')
    expect(dialog.textContent).toContain('无法通过回收站恢复')
    await click('永久删除 1 项', dialog)
    expect(commands).toEqual([{ type: 'capability.purge', ids: [secondId] }])
    expect(store.snapshot().capabilities).toEqual(before.capabilities.filter(cap => cap.id !== secondId))
    expect(store.snapshot().roles).toEqual(before.roles)
    expect(container.textContent).toContain('1 项因岗位或历史版本引用而保留')
    expect(cardIds()).toEqual([])
    await search('')
    expect(cardIds()).toEqual(['browser'])
  })

  it('protects capabilities referenced only by an old role version and disables permanent deletion', async () => {
    const result = await makeRole('历史配置岗位'), role = result.state.roles.find(role => role.id === result.id)!
    await send({ type: 'role.save', id: role.id, definition: { ...role.draft, capabilities: [] }, publish: true })
    await openRecycleBin(['browser'])
    const before = store.snapshot()
    await select('选择能力：浏览器操作'); await click('删除选中')
    const dialog = document.querySelector('dialog')!
    expect(dialog.textContent).toContain('历史配置岗位')
    expect(dialog.textContent).toContain('仅从当前岗位拆下也不会删除历史版本中的引用')
    expect(button('永久删除 0 项', dialog)!.disabled).toBe(true)
    expect(commands).toEqual([])
    await click('取消', dialog)
    expect(store.snapshot()).toEqual(before)
    expect(checkbox('选择能力：浏览器操作').checked).toBe(true)
  })

  it('preserves selection and the deletion dialog after a failed write and allows a scoped retry', async () => {
    await openRecycleBin()
    await select('选择能力：自定义采集'); await click('删除选中')
    const before = store.snapshot()
    nextCommandError = '无法写入能力配置，请重试'
    await click('永久删除 1 项', document.querySelector('dialog')!)
    expect(document.querySelector('dialog [role="alert"]')!.textContent).toBe('无法写入能力配置，请重试')
    expect(checkbox('选择能力：自定义采集').checked).toBe(true)
    expect(store.snapshot()).toEqual(before)
    await click('永久删除 1 项', document.querySelector('dialog')!)
    expect(document.querySelector('dialog')).toBeNull()
    expect(cardIds()).toEqual(['browser'])
    expect(store.snapshot().capabilities.some(cap => cap.id === secondId)).toBe(false)
    expect(commands).toEqual([{ type: 'capability.purge', ids: [secondId] }, { type: 'capability.purge', ids: [secondId] }])
  })

  it('keeps selection after a failed batch restore and leaves unselected capabilities in the recycle bin', async () => {
    await openRecycleBin()
    await select('选择能力：自定义采集')
    const before = store.snapshot()
    nextCommandError = '恢复失败，请重试'
    await click('恢复选中')
    expect(container.querySelector('[role="alert"]')!.textContent).toBe('恢复失败，请重试')
    expect(checkbox('选择能力：自定义采集').checked).toBe(true)
    expect(store.snapshot()).toEqual(before)
    await click('恢复选中')
    expect(cardIds()).toEqual(['browser'])
    expect(checkbox('选择能力：浏览器操作').checked).toBe(false)
    expect(store.snapshot().capabilities.find(cap => cap.id === secondId)!.enabled).toBe(false)
    expect(store.snapshot().capabilities.find(cap => cap.id === 'browser')!.removedAt).toBeTruthy()
  })

  it('requires review after a revision conflict and never expands the original clear-bin scope to later removals', async () => {
    await openRecycleBin()
    await select('选择能力：浏览器操作'); await click('清空回收站')
    const definition = { ...store.snapshot().capabilities[0]!.draft, name: '稍后移除的能力' }
    const later = await send({ type: 'capability.save', definition, publish: false })
    await send({ type: 'capability.remove', id: later.id })
    const before = store.snapshot()
    await click('永久删除 2 项', document.querySelector('dialog')!)
    expect(document.querySelector('dialog [role="alert"]')!.textContent).toContain('配置已被其他页面更新')
    expect(store.snapshot()).toEqual(before)
    expect(checkbox('选择能力：浏览器操作').checked).toBe(true)
    await act(async () => capabilityClient.refresh())
    const dialog = document.querySelector('dialog')!
    expect(button('永久删除 2 项', dialog)!.disabled).toBe(true)
    expect(dialog.textContent).toContain('配置已有更新')
    expect(dialog.textContent).not.toContain('稍后移除的能力')
    await click('已核对，更新操作基准', dialog)
    expect(button('永久删除 2 项', dialog)!.disabled).toBe(false)
    await click('永久删除 2 项', dialog)
    expect(store.snapshot().capabilities.map(cap => cap.id)).toEqual(['meeting-transcription', 'requirements-analysis', 'developer-workspace', later.id])
    expect(cardIds()).toEqual([later.id])
    expect(commands).toHaveLength(2)
    for (const command of commands) expect(command).toMatchObject({ type: 'capability.purge', ids: expect.arrayContaining(['browser', secondId]) })
  })
})
