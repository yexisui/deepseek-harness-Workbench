// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { UnifiedCenter, centerArea, settingsSectionForLink } from '../src/client/UnifiedCenter.tsx'
import { SettingsSectionContent } from '../src/client/SettingsSectionContent.tsx'
import { withAppearanceNavigation } from '../src/client/AppearanceNavigation.tsx'
import { capabilityClient, openCapabilityLink, editorDrafts, lastCapabilityLink } from '../src/client/capability-client.ts'
import { captureNavigation } from '../../dsh-plugin-manager/src/client/workbench-navigation.ts'
import { InventoryTree, readPluginInventory } from '../../dsh-plugin-manager/src/client/InventoryTree.tsx'
import { initialState, components, type Snapshot } from '../../dsh-capabilities/src/core/model.ts'
import { emptyRegistry } from '../../dsh-capabilities/src/core/component-registry.ts'
import { initialClassification } from '../../dsh-plugin-manager/src/core/classification.ts'

let host: HTMLDivElement, root: Root
const buttons = () => Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
async function click(text: string) {
  await act(async () => {
    const button = buttons().find(item => item.textContent?.trim() === text || item.getAttribute('aria-label') === text)
    expect(button, text).toBeTruthy(); button!.click()
    await new Promise(resolve => setTimeout(resolve, 20))
  })
}
async function fill(element: HTMLInputElement, text: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(element, text)
    element.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
async function mount() { await act(async () => { root.render(<SettingsSectionContent.Provider value={() => <InventoryTree list={readPluginInventory}/>}><UnifiedCenter/></SettingsSectionContent.Provider>); await new Promise(resolve => setTimeout(resolve, 20)) }) }
beforeEach(async () => {
  ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
  sessionStorage.clear(); localStorage.clear(); editorDrafts.clear()
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
  const data: Snapshot = { compositionVersion: 2, state: initialState(), components, registry: emptyRegistry(), tasks: [], componentActivities: [], health: { checkedAt: null, installed: true, loaded: true, state: 'unknown', message: '未检测', browsers: [] } }
  vi.stubGlobal('fetch', vi.fn(async (url: string, options?: RequestInit) => {
    if (options?.method === 'POST') throw Error('Navigation must not mutate business data')
    let value: unknown = {}
    if (url.endsWith('/state')) value = data
    else if (url.endsWith('/meeting/config')) value = { ready: false, message: '待配置' }
    else if (url.endsWith('/requirements/config')) value = { ready: true, defaults: { depth: 'standard', questionStyle: 'short', model: '' } }
    else if (url.endsWith('/classification')) value = { classification: initialClassification([]) }
    else if (url.endsWith('/inventory')) value = { entries: [], agentPresets: [] }
    else if (url.endsWith('/pending')) value = { entries: [], origins: [] }
    else if (url.includes('/developer/projects')) value = []
    return { ok: true, json: async () => value }
  }))
  await capabilityClient.refresh()
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); editorDrafts.clear() })

it('maps old component links into the capability center and retains independent plugin navigation', () => {
  expect(settingsSectionForLink({ section: 'component-center', componentId: 'developer-files' })).toBe('capability-center')
  expect(settingsSectionForLink({ section: 'plugins' })).toBe('plugins')
  expect(settingsSectionForLink({ section: 'plugins', origin: { section: 'capability-center', label: '能力中心', frames: [] } })).toBe('capability-center')
  expect(centerArea({ section: 'component-center' })).toBe('components')
})

it('opens the component library from the same center and restores the ability search on return', async () => {
  await mount()
  await fill(host.querySelector<HTMLInputElement>('[aria-label="搜索能力"]')!, '开发')
   await click('组件库')
  expect(host.querySelector('h2')?.textContent).toBe('组件库')
  expect(host.querySelectorAll('[role="listitem"]')).toHaveLength(6)
  await click('← 返回能力中心')
  expect(host.querySelector<HTMLInputElement>('[aria-label="搜索能力"]')?.value).toBe('开发')
  expect(lastCapabilityLink()).toBeUndefined()
})

it('resolves a legacy component deep link and keeps its selected object', async () => {
  sessionStorage.setItem('workbench-capability-link', JSON.stringify({ section: 'component-center', componentId: 'developer-git', tab: 'actions' }))
  await mount()
  expect(host.querySelector('[data-center-detail]')?.textContent).toContain('Git 变更与版本')
  expect(lastCapabilityLink()).toBeUndefined()
})

it('opens the full registered plugin page and returns to the ability list', async () => {
  await mount();  await click('插件管理')
  expect(host.querySelector('[data-center-plugins]')).toBeTruthy()
  expect(host.querySelector('[aria-label="搜索插件"]')).toBeTruthy()
  expect(buttons().some(button => button.textContent === '管理分类')).toBe(true)
  await click('← 返回能力中心')
  expect(host.querySelector('[data-capability-center]')).toBeTruthy()
  expect(lastCapabilityLink()).toBeUndefined()
})

it('restores a component column after plugin navigation within the center', async () => {
  await mount();  await click('组件库'); await click('Git 变更与版本'); await click('使用关系')
  await act(async () => { openCapabilityLink({ section: 'plugins', componentId: 'developer-git' }); await new Promise(resolve => setTimeout(resolve, 20)) })
  expect(host.querySelector('[data-center-plugins]')).toBeTruthy()
  await click('← 返回组件库')
  expect(host.querySelector('[data-center-detail]')?.textContent).toContain('Git 变更与版本')
  expect(buttons().find(button => button.textContent === '使用关系')?.getAttribute('aria-pressed')).toBe('true')
})

it('keeps unsaved component information when departure is declined', async () => {
  await mount();  await click('组件库'); await click('项目文件与开发对话'); await click('整理信息')
  const field = Array.from(document.querySelectorAll('label')).find(label => label.textContent?.startsWith('组件名称'))!.querySelector('input')!
  await fill(field, '仍在编辑')
  vi.spyOn(window, 'confirm').mockReturnValue(false)
  await act(async () => { expect(openCapabilityLink({ section: 'plugins' })).toBe(false) })
  expect(field.value).toBe('仍在编辑'); expect(host.querySelector('[data-center-plugins]')).toBeNull()
})

it('does not turn a plugin return into a different center area', async () => {
  await mount();  await click('插件管理')
  const location = captureNavigation()!
  expect(location.section).toBe('capability-center')
  expect(centerArea({ section: 'capability-center', restore: location })).toBe('plugins')
})

it('returns through a capability and plugins to the original component column', async () => {
  await mount();  await click('组件库'); await click('项目文件与开发对话'); await click('使用关系'); await click('查看能力 ↗')
  expect(host.querySelector('[data-workflow-capability-detail]')?.getAttribute('data-workflow-capability-detail')).toBe('developer-workspace')
  await act(async () => { openCapabilityLink({ section: 'plugins' }); await new Promise(resolve => setTimeout(resolve, 20)) })
  await click('← 返回能力中心')
  expect(host.querySelector('[data-workflow-capability-detail]')?.getAttribute('data-workflow-capability-detail')).toBe('developer-workspace')
  await click('← 返回组件库')
  expect(buttons().find(button => button.textContent === '使用关系')?.getAttribute('aria-pressed')).toBe('true')
})

it('restores the open ability editor and its draft after visiting internal plugins', async () => {
  sessionStorage.setItem('workbench-capability-link', JSON.stringify({ section: 'capability-center', capabilityId: 'browser', edit: true }))
  await mount()
  const field = Array.from(document.querySelectorAll('label')).find(label => label.textContent?.startsWith('能力名称'))!.querySelector('input')!
  await fill(field, '未保存的浏览器能力')
  await click('管理组件库 ↗'); await click('插件与依赖'); await click('查看插件管理 ↗')
  expect(host.querySelector('[data-center-plugins]')).toBeTruthy()
  await click('← 返回组件库')
  expect(Array.from(document.querySelectorAll('input')).some(input => input.value === '未保存的浏览器能力')).toBe(true)
  expect(document.querySelectorAll('dialog').length).toBe(2)
  expect(lastCapabilityLink()).toBeUndefined()
})

it('uses the settings shell outlet with the original plugin section and close owner', async () => {
  const close = vi.fn()
  const renderSlot = vi.fn((_key: string, _owner: unknown, options: { only: string }) => <p>原插件页面：{options.only}</p>)
  function SettingsPanel(_props: any) { return <UnifiedCenter/> }
  function SettingsRoot() { return <SettingsPanel onClose={close}/> }
  const Settings = withAppearanceNavigation(SettingsRoot, () => '外观')
  sessionStorage.setItem('workbench-capability-link', JSON.stringify({ section: 'plugins', origin: { section: 'capability-center', label: '能力中心', frames: [] } }))
  await act(async () => root.render(<Settings renderSlot={renderSlot}/>))
  expect(renderSlot).toHaveBeenCalledWith('settings.section', { close }, { only: 'plugins' })
  expect(host.textContent).toContain('原插件页面：plugins')
})
