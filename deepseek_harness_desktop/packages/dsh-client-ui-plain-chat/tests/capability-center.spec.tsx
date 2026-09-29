// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CapabilityCenterPage, RoleAssistantsSection } from '../src/client/RoleAssistants.tsx'
import { CapabilityPreviewContext, createCapabilityPreview } from '../src/client/capability-preview.tsx'
import { registerCapabilityCenter } from '../src/client/capability-settings.tsx'
import { zh, type ChatKey } from '../src/client/locales.ts'

const t = (key: ChatKey) => zh[key]
describe('capability center preview', () => {
  let container: HTMLDivElement
  let root: Root
  let store: ReturnType<typeof createCapabilityPreview>
  beforeEach(() => {
    ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div'); document.body.append(container); root = createRoot(container)
    store = createCapabilityPreview()
    HTMLDialogElement.prototype.showModal = function () { this.open = true }
    HTMLDialogElement.prototype.close = function () { this.open = false }
  })
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks() })
  const buttons = (scope: ParentNode = document) => Array.from(scope.querySelectorAll<HTMLButtonElement>('button'))
  const click = async (label: string, scope: ParentNode = document) => act(async () => {
    const button = buttons(scope).find(node => node.getAttribute('aria-label') === label || node.textContent?.trim() === label)
    expect(button, label).toBeTruthy(); button!.click()
  })
  const input = async (node: HTMLInputElement | HTMLTextAreaElement, value: string) => act(async () => {
    Object.getOwnPropertyDescriptor(node.tagName === 'INPUT' ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype, 'value')!.set!.call(node, value)
    node.dispatchEvent(new Event('input', { bubbles: true }))
  })
  const render = async (roles = false) => act(async () => root.render(<CapabilityPreviewContext.Provider value={store}>{roles ? <RoleAssistantsSection t={t} /> : <CapabilityCenterPage t={t} />}</CapabilityPreviewContext.Provider>))

  it('contributes a settings page adjacent to presets and unregisters cleanly', () => {
    const unregister = vi.fn()
    let dispose: (() => void) | undefined
    const register = vi.fn((_options: { name: string; id: string; order: number }) => unregister)
    registerCapabilityCenter({ inject: (_name, setup) => { dispose = setup() }, register }, () => '能力中心', () => null)
    expect(register.mock.calls[0]?.[0]).toMatchObject({ name: 'settings.section', id: 'capability-center', order: 21 })
    dispose!(); expect(unregister).toHaveBeenCalledOnce()
  })

  it('filters, pins and edits shared drafts while remaining disconnected and resetting in a fresh store', async () => {
    await render()
    expect(container.querySelectorAll('[data-center-capability]')).toHaveLength(6)
    await click('设为常用：文档处理')
    await click('常用 2')
    expect(container.querySelectorAll('[data-center-capability]')).toHaveLength(2)
    await input(container.querySelector('input')!, 'BrowserSkill')
    expect(container.querySelectorAll('[data-center-capability]')).toHaveLength(1)
    await click('配置能力：浏览器操作')
    expect(buttons(container).find(node => node.textContent === '连接功能待接入')!.disabled).toBe(true)
    await click('使用说明')
    await input(container.querySelector('textarea')!, 'Only inspect project pages')
    await click('默认配置')
    await input(container.querySelector('textarea')!, 'example.com')
    await click('← 返回能力列表')
    await click('配置能力：浏览器操作')
    await click('使用说明')
    expect(container.querySelector('textarea')!.value).toBe('Only inspect project pages')
    expect(store.getSnapshot().browser.options.sites).toBe('example.com')
    expect(createCapabilityPreview().getSnapshot().browser.options.sites).toBe('')
    expect(createCapabilityPreview().getSnapshot().browser.instructions).toBeNull()
  })

  it('keeps the role name, attached capabilities and role settings across center overlays and Escape', async () => {
    await render(true)
    await act(async () => buttons().find(button => button.textContent?.includes('创建岗位助手'))!.click())
    const roleDialog = document.querySelector('dialog')!
    const name = roleDialog.querySelector<HTMLInputElement>('input[placeholder="例如：需求分析助手"]')!
    await input(name, 'Retained role draft')
    await click('添加：浏览器操作')
    await click('配件设置：浏览器操作')
    await input(roleDialog.querySelector<HTMLTextAreaElement>('textarea[placeholder*="example.com"]')!, 'role.example')
    await click('在能力中心编辑 ↗')
    const centerDialog = Array.from(document.querySelectorAll('dialog')).at(-1)!
    await click('默认配置', centerDialog)
    await input(centerDialog.querySelector('textarea')!, 'default.example')
    const shellEscape = vi.fn()
    document.addEventListener('keydown', shellEscape)
    try {
      await act(async () => centerDialog.querySelector('textarea')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })))
      expect(shellEscape).not.toHaveBeenCalled()
    } finally { document.removeEventListener('keydown', shellEscape) }
    expect(document.querySelectorAll('dialog')).toHaveLength(1)
    expect(name.value).toBe('Retained role draft')
    expect(roleDialog.querySelectorAll('[data-attached-capability]')).toHaveLength(1)
    expect(roleDialog.querySelector<HTMLTextAreaElement>('textarea[placeholder*="example.com"]')!.value).toBe('role.example')
    expect(store.getSnapshot().browser.options.sites).toBe('default.example')
    await click('在能力中心编辑 ↗')
    await click('使用岗位', Array.from(document.querySelectorAll('dialog')).at(-1)!)
    await click('返回当前岗位 →', Array.from(document.querySelectorAll('dialog')).at(-1)!)
    expect(document.querySelectorAll('dialog')).toHaveLength(1)
    expect(name.value).toBe('Retained role draft')
  })

  it('opens example roles and returns to the same capability detail without losing edits', async () => {
    await render()
    await click('查看使用岗位：浏览器操作')
    await act(async () => buttons(container).find(button => button.textContent === '预览岗位 →')!.click())
    expect(document.querySelectorAll('dialog')).toHaveLength(1)
    await click('关闭', document.querySelector('dialog')!)
    expect(document.querySelectorAll('dialog')).toHaveLength(0)
    expect(container.textContent).toContain('市场部助手')
    expect(container.querySelector('[data-capability-center]')).not.toBeNull()
  })
})
