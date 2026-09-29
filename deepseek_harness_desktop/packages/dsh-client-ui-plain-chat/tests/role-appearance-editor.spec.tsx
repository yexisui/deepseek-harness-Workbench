// @vitest-environment jsdom
import React, { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyRole, type RoleDefinition } from '../../dsh-capabilities/src/core/model.ts'
import { RoleAppearanceEditor } from '../src/client/RoleAppearanceEditor.tsx'
import { capabilityClient } from '../src/client/capability-client.ts'
import { loadRoleIconFile, loadSavedRoleIcon, renderRoleIcon } from '../src/client/appearance-image.ts'

vi.mock('../src/client/appearance-image.ts', async importOriginal => ({
  ...(await importOriginal<typeof import('../src/client/appearance-image.ts')>()),
  loadRoleIconFile: vi.fn(), loadSavedRoleIcon: vi.fn(), renderRoleIcon: vi.fn(),
}))

describe('role appearance editor', () => {
  let container: HTMLDivElement, root: Root, draft: RoleDefinition
  const busy = vi.fn(), patches = vi.fn()
  beforeEach(() => {
    ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div'); document.body.append(container); root = createRoot(container)
    draft = { ...emptyRole(), name: '需求助手', duties: '保留的岗位职责', color: '#123456', icon: { kind: 'builtin', id: 'book' } }
    busy.mockClear(); patches.mockClear()
    vi.mocked(loadRoleIconFile).mockReset().mockResolvedValue({ naturalWidth: 1024, naturalHeight: 512 } as HTMLImageElement)
    vi.mocked(loadSavedRoleIcon).mockReset().mockResolvedValue({ naturalWidth: 256, naturalHeight: 256 } as HTMLImageElement)
    vi.mocked(renderRoleIcon).mockReset().mockReturnValue('data:image/png;base64,preview')
  })
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks() })
  function Host() {
    const [value, setValue] = useState(draft)
    const [initial] = useState({ color: value.color, icon: value.icon })
    draft = value
    return <RoleAppearanceEditor roleId="builtin-analyst" value={value} initialAppearance={initial} onBusyChange={busy} onChange={patch => { patches(patch); setValue(previous => ({ ...previous, ...patch })) }}/>
  }
  const render = () => act(async () => root.render(<Host/>))
  const button = (label: string) => Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(node => node.textContent?.trim() === label || node.getAttribute('aria-label') === label)!
  const click = (label: string) => act(async () => button(label).click())
  const input = (label: string, value: string) => act(async () => {
    const node = container.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(node, value)
    node.dispatchEvent(new Event('input', { bubbles: true }))
    node.dispatchEvent(new Event('change', { bubbles: true }))
  })
  const chooseFile = () => act(async () => {
    const node = container.querySelector<HTMLInputElement>('input[type="file"]')!
    Object.defineProperty(node, 'files', { configurable: true, value: [new File(['png'], 'icon.png', { type: 'image/png' })] })
    node.dispatchEvent(new Event('change', { bubbles: true }))
  })

  it('starts collapsed with a live color and icon summary, and previews all three entry points', async () => {
    await render()
    expect(container.querySelector('details')!.open).toBe(false)
    expect(container.querySelector('summary [data-role-appearance-icon]')!.getAttribute('data-role-appearance-icon')).toBe('book')
    expect(container.querySelector('[aria-label="六角颜色盘"]')!.querySelectorAll('button')).toHaveLength(37)
    expect(container.querySelector('[role="tabpanel"]')!.querySelectorAll('button')).toHaveLength(13)
    const previews = container.querySelector('[aria-label="外观即时预览"]')!
    expect(previews.textContent).toContain('岗位卡片')
    expect(previews.textContent).toContain('左上角入口')
    expect(previews.textContent).toContain('新对话选项')
    expect(previews.querySelectorAll('[data-role-appearance-icon="book"]')).toHaveLength(3)
    await click('图标：开发编程'); await click('主题色 #4263ba')
    expect(draft.icon).toEqual({ kind: 'builtin', id: 'developer' })
    expect(draft.color).toBe('#4263ba')
    expect(previews.querySelectorAll('[data-role-appearance-icon="developer"]')).toHaveLength(3)
  })

  it('restores or undoes only appearance and blocks incomplete HEX input', async () => {
    await render(); await click('图标：开发编程'); await click('恢复默认外观')
    expect(draft.icon).toEqual({ kind: 'builtin', id: 'analyst' })
    expect(draft.color.toLowerCase()).toBe('#4f73e8')
    expect(draft.duties).toBe('保留的岗位职责')
    await click('撤销本次外观修改')
    expect(draft.icon).toEqual({ kind: 'builtin', id: 'book' })
    expect(draft.color).toBe('#123456')
    expect(patches.mock.calls.every(([patch]) => Object.keys(patch).sort().join(',') === 'color,icon')).toBe(true)
    await input('HEX 色值', '#zz')
    expect(draft.color).toBe('#123456'); expect(busy).toHaveBeenLastCalledWith(true)
    await input('HEX 色值', '#fed')
    expect(draft.color).toBe('#ffeedd'); expect(busy).toHaveBeenLastCalledWith(false)
  })

  it('keeps PNG adjustments local until upload succeeds, then supports further adjustment', async () => {
    const upload = vi.spyOn(capabilityClient, 'uploadRoleIcon').mockResolvedValue('a'.repeat(64))
    await render(); await click('自定义 PNG'); await chooseFile()
    expect(busy).toHaveBeenLastCalledWith(true)
    expect(draft.icon).toEqual({ kind: 'builtin', id: 'book' })
    expect(upload).not.toHaveBeenCalled()
    await input('PNG 缩放', '150'); await input('PNG 水平位置', '10')
    expect(renderRoleIcon).toHaveBeenLastCalledWith(expect.anything(), { scale: 1.5, x: 10, y: 0 })
    await click('应用图片')
    expect(upload).toHaveBeenCalledWith('data:image/png;base64,preview')
    expect(draft.icon).toEqual({ kind: 'png', assetId: 'a'.repeat(64) })
    expect(busy).toHaveBeenLastCalledWith(false)
    await input('PNG 垂直位置', '15'); expect(busy).toHaveBeenLastCalledWith(true)
    await click('恢复居中')
    expect(renderRoleIcon).toHaveBeenLastCalledWith(expect.anything(), { scale: 1, x: 0, y: 0 })
  })

  it('ignores old image reads after choosing a recommended icon', async () => {
    let resolve!: (image: HTMLImageElement) => void
    vi.mocked(loadRoleIconFile).mockReturnValue(new Promise(done => { resolve = done }))
    await render(); await click('自定义 PNG'); await chooseFile()
    expect(busy).toHaveBeenLastCalledWith(true)
    await click('推荐图标'); await click('图标：开发编程')
    await act(async () => resolve({ naturalWidth: 256, naturalHeight: 256 } as HTMLImageElement))
    expect(draft.icon).toEqual({ kind: 'builtin', id: 'developer' })
    expect(busy).toHaveBeenLastCalledWith(false)
    expect(renderRoleIcon).not.toHaveBeenCalled()
  })

  it('can reopen a saved PNG for adjustment while leaving the old asset intact until applied', async () => {
    draft.icon = { kind: 'png', assetId: 'd'.repeat(64) }
    const upload = vi.spyOn(capabilityClient, 'uploadRoleIcon').mockResolvedValue('e'.repeat(64))
    await render(); await click('调整当前图片')
    expect(loadSavedRoleIcon).toHaveBeenCalledWith('d'.repeat(64))
    expect(draft.icon).toEqual({ kind: 'png', assetId: 'd'.repeat(64) })
    await input('PNG 缩放', '120'); await click('应用图片')
    expect(upload).toHaveBeenCalledOnce()
    expect(draft.icon).toEqual({ kind: 'png', assetId: 'e'.repeat(64) })
  })

  it('ignores stale upload responses after icon switching, and keeps retry available after a failure', async () => {
    let resolve!: (asset: string) => void
    const upload = vi.spyOn(capabilityClient, 'uploadRoleIcon').mockReturnValue(new Promise(done => { resolve = done }))
    await render(); await click('自定义 PNG'); await chooseFile(); await click('应用图片')
    await click('推荐图标'); await click('图标：业务工作')
    await act(async () => resolve('b'.repeat(64)))
    expect(draft.icon).toEqual({ kind: 'builtin', id: 'briefcase' })
    upload.mockRejectedValueOnce(new Error('磁盘空间不足'))
    await click('自定义 PNG'); await chooseFile(); await click('应用图片')
    expect(container.querySelector('[role="alert"]')!.textContent).toContain('磁盘空间不足')
    expect(busy).toHaveBeenLastCalledWith(true)
    expect(button('应用图片').disabled).toBe(false)
    expect(draft.icon).toEqual({ kind: 'builtin', id: 'briefcase' })
  })

  it('shows read failures without changing the existing icon and ignores completion after unmount', async () => {
    vi.mocked(loadRoleIconFile).mockRejectedValueOnce(new Error('PNG 文件不完整'))
    await render(); await click('自定义 PNG'); await chooseFile()
    expect(container.querySelector('[role="alert"]')!.textContent).toContain('PNG 文件不完整')
    expect(busy).toHaveBeenLastCalledWith(false)
    let resolve!: (asset: string) => void
    vi.spyOn(capabilityClient, 'uploadRoleIcon').mockReturnValue(new Promise(done => { resolve = done }))
    await chooseFile(); await click('应用图片')
    await act(async () => root.render(null))
    await act(async () => resolve('c'.repeat(64)))
    expect(patches).not.toHaveBeenCalled()
    expect(busy).toHaveBeenLastCalledWith(false)
  })
})
