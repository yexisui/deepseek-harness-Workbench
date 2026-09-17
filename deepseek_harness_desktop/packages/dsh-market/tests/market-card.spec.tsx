/** @vitest-environment jsdom */

/**
 * Local Workshop interaction contract: inventory, local file transfer,
 * inspection, explicit replacement, executable-resource consent and cleanup.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import React, { useSyncExternalStore, type ComponentProps } from 'react'
import type { SettingsScope, SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'

vi.mock('@deepseek-ai/dsh-client-store', () => ({
  createSnapshotStore: (init: unknown) => {
    let value = init
    const listeners = new Set<() => void>()
    return {
      getSnapshot: () => value,
      set: (next: unknown) => { value = next; for (const listener of listeners) listener() },
      update: (mutator: (draft: never) => void) => { mutator(value as never); for (const listener of listeners) listener() },
      subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    }
  },
}))

vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => {
  const create = (React.createElement as (...args: unknown[]) => unknown).bind(React)
  return {
    Button: (props: Record<string, unknown>) =>
      create('button', { disabled: props['disabled'], onClick: props['onClick'], className: props['className'] }, props['children']),
    Modal: (props: Record<string, unknown>) =>
      props['open'] === true ? create('div', { role: 'dialog' }, props['title'], props['children']) : null,
  }
})

import {
  MarketCard,
  MarketCardController,
  type MarketCardProps,
  type MarketSettings,
} from '../src/client/MarketCard.tsx'
import { zh } from '../src/client/locales.ts'

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

const t: MarketCardProps['t'] = (key, params) => {
  const text = (zh as Record<string, string>)[key] ?? key
  if (!params) return text
  return text.replace(/\{(\w+)\}/g, (match, name: string) => String(params[name] ?? match))
}

class FakeScope implements SettingsScope<MarketSettings> {
  value: MarketSettings
  base: MarketSettings
  user: Partial<MarketSettings> = {}
  writable = true
  private listeners = new Set<() => void>()
  set = vi.fn(async (field: string, value: unknown) => {
    (this.user as Record<string, unknown>)[field] = value
    this.reflect()
  })
  unset = vi.fn(async (field: string) => {
    delete (this.user as Record<string, unknown>)[field]
    this.reflect()
  })
  constructor(value: MarketSettings) {
    this.value = value
    this.base = value
  }
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }
  async mutate(): Promise<void> {
    return undefined
  }
  getSnapshot(): SettingsScopeSnapshot<MarketSettings> {
    return {
      status: 'ready',
      writable: this.writable,
      value: this.value,
      base: this.base,
      user: this.user,
      revision: 1,
      mode: 'host',
    }
  }
  private reflect(): void {
    this.value = { ...this.base, ...this.user }
    for (const listener of this.listeners) listener()
  }
}

function cardProps(
  scope: SettingsScope<MarketSettings>,
  overrides: Partial<MarketCardProps> = {},
): ComponentProps<typeof MarketCard> {
  const controller = new MarketCardController(scope)
  const face = controller.inject()
  const { hooks, ...actions } = face
  const useMarketCard = <S,>(selector: (snapshot: ReturnType<typeof hooks.marketCard.getSnapshot>) => S) =>
    useSyncExternalStore(
      hooks.marketCard.subscribe,
      () => selector(hooks.marketCard.getSnapshot()),
    )
  // The workshop panel slot is normally injected by the framework; the card
  // test renders the shell, so a stub keeps the preset tab renderable.
  return { t, useMarketCard, renderSlot: () => null, ...actions, ...overrides } as unknown as ComponentProps<typeof MarketCard>
}

import type { LocalPreview, LocalResource } from '../src/core/local-types.ts'
import { localWorkshopApi, type LocalWorkshopApi } from '../src/client/local-workshop.ts'

const SKIN: LocalResource = { kind: 'skin', id: 'local-skin', name: 'My local skin', version: '1.0.0', source: 'local', status: 'available', executable: false, managed: true }
const PREVIEW: LocalPreview = { kind: 'skin', id: SKIN.id, name: SKIN.name, version: SKIN.version, fileCount: 3, totalBytes: 1200, executable: false, conflict: false }
function fakeApi(resources: LocalResource[] = [SKIN]): LocalWorkshopApi {
  return {
    list: vi.fn(async () => resources), start: vi.fn(async () => 'upload-1'), upload: vi.fn(async () => {}),
    inspect: vi.fn(async () => PREVIEW), commit: vi.fn(async () => SKIN), discard: vi.fn(async () => {}),
    action: vi.fn(async () => ({ message: 'Completed' })), job: vi.fn(async () => ({ phase: 'done' })),
  }
}
function mount(api = fakeApi(), scope = new FakeScope({})) {
  return { api, ...render(<MarketCard {...cardProps(scope, { api })} />) }
}
async function selectZip() {
  const file = new File(['data'], 'skin.zip', { type: 'application/zip' })
  fireEvent.change(screen.getByLabelText('导入 ZIP'), { target: { files: [file] } })
  await screen.findByRole('dialog')
  return file
}

describe('local Workshop', () => {
  it('renders only local inventory with the shared settings card and four tabs', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const { container } = mount()
    await screen.findByText(SKIN.name)
    expect(screen.getAllByRole('tab')).toHaveLength(4)
    expect(screen.getByText('本地导入')).toBeTruthy()
    expect(screen.getByText('v1.0.0')).toBeTruthy()
    expect(screen.queryByRole('link')).toBeNull()
    expect(container.querySelector('img')).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
    expect(screen.queryByText('赞')).toBeNull()
    expect(screen.getByText('导入并管理自己的皮肤、宠物、插件和预设。')).toBeTruthy()
  })

  it('searches local names and switches tabs with local counts', async () => {
    const pet: LocalResource = { ...SKIN, kind: 'pet', id: 'pet', name: 'Custom pet', source: 'existing', managed: false }
    mount(fakeApi([SKIN, pet]))
    await screen.findByText(SKIN.name)
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'unmatched' } })
    expect(screen.getByText('没有匹配的条目')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: /宠物/ }))
    expect(screen.getByText('Custom pet')).toBeTruthy()
    expect(screen.getByText('已有资源')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '移除' })).toBeNull()
    expect(screen.getByRole('searchbox').getAttribute('value')).toBe('')
  })

  it('supports tab keyboard navigation and empty states', async () => {
    mount(fakeApi([]))
    await screen.findByText('暂无本地资源')
    fireEvent.keyDown(screen.getByRole('tab', { name: /皮肤/ }), { key: 'End' })
    expect(screen.getByRole('tab', { name: /预设/ }).getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: /预设/ }))
  })

  it('uploads ZIP and requires preview confirmation before saving', async () => {
    const { api } = mount()
    await screen.findByText(SKIN.name)
    const file = await selectZip()
    expect(api.start).toHaveBeenCalledWith('skin', 'zip', expect.any(AbortSignal))
    expect(api.upload).toHaveBeenCalledWith('upload-1', 'archive.zip', file, expect.any(AbortSignal))
    expect(api.commit).not.toHaveBeenCalled()
    expect((screen.getByRole('button', { name: '选择文件夹' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: '确认导入' }))
    await waitFor(() => expect(api.commit).toHaveBeenCalledWith('upload-1', false))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(api.list).toHaveBeenCalledTimes(2)
    expect(api.action).not.toHaveBeenCalled()
  })

  it('retains relative paths when a folder is selected', async () => {
    const { api } = mount()
    const file = new File(['{}'], 'skin.json')
    Object.defineProperty(file, 'webkitRelativePath', { value: 'my-skin/skin.json' })
    const input = screen.getByLabelText('选择文件夹')
    expect(input.hasAttribute('webkitdirectory')).toBe(true)
    fireEvent.change(input, { target: { files: [file] } })
    await screen.findByRole('dialog')
    expect(api.start).toHaveBeenCalledWith('skin', 'folder', expect.any(AbortSignal))
    expect(api.upload).toHaveBeenCalledWith('upload-1', 'my-skin/skin.json', file, expect.any(AbortSignal))
  })

  it('tells the user to restart before selecting an imported pet', async () => {
    const pet: LocalResource = { ...SKIN, kind: 'pet', name: 'My pet' }
    const api = fakeApi([pet])
    vi.mocked(api.inspect).mockResolvedValue({ ...PREVIEW, kind: 'pet', name: pet.name })
    vi.mocked(api.commit).mockResolvedValue(pet)
    mount(api)
    fireEvent.click(screen.getByRole('tab', { name: /宠物/ }))
    await screen.findByText('导入后请重启工作台，再到左侧「宠物」中选择并启用。')
    await selectZip()
    fireEvent.click(screen.getByRole('button', { name: '确认导入' }))
    await screen.findByText('已导入「My pet」。请重启工作台，再到左侧「宠物」中选择并启用。')
  })

  it('asks explicitly before replacing a conflicting resource', async () => {
    const api = fakeApi()
    vi.mocked(api.inspect).mockResolvedValue({ ...PREVIEW, conflict: true })
    mount(api)
    await selectZip()
    expect(screen.getByText(/先备份旧版本/)).toBeTruthy()
    expect(api.commit).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '备份并替换' }))
    await waitFor(() => expect(api.commit).toHaveBeenCalledWith('upload-1', true))
  })

  it('cancels a preview and deletes staging files without committing', async () => {
    const { api } = mount()
    await selectZip()
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    await waitFor(() => expect(api.discard).toHaveBeenCalledWith('upload-1'))
    expect(api.commit).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('cleans staging when the settings panel unmounts', async () => {
    const { api, unmount } = mount()
    await selectZip()
    unmount()
    await waitFor(() => expect(api.discard).toHaveBeenCalledWith('upload-1'))
  })

  it('does not delete staging while a confirmed import is committing', async () => {
    const api = fakeApi()
    let complete!: (resource: LocalResource) => void
    vi.mocked(api.commit).mockImplementation(() => new Promise((resolve) => { complete = resolve }))
    const { unmount } = mount(api)
    await selectZip()
    fireEvent.click(screen.getByRole('button', { name: '确认导入' }))
    expect(api.commit).toHaveBeenCalledTimes(1)
    unmount()
    expect(api.discard).not.toHaveBeenCalled()
    complete(SKIN)
  })

  it('shows validation failures, cleans staging and supports retry', async () => {
    const api = fakeApi()
    vi.mocked(api.inspect).mockRejectedValueOnce(new Error('Missing skin.json'))
    mount(api)
    fireEvent.change(screen.getByLabelText('导入 ZIP'), { target: { files: [new File(['bad'], 'bad.zip')] } })
    await screen.findByText('Missing skin.json')
    await waitFor(() => expect(api.discard).toHaveBeenCalledWith('upload-1'))
    fireEvent.click(screen.getByRole('button', { name: '重试' }))
    await screen.findByRole('dialog')
    expect(api.start).toHaveBeenCalledTimes(2)
  })

  it('keeps failed commit reviewable and permits retry', async () => {
    const api = fakeApi()
    vi.mocked(api.commit).mockRejectedValueOnce(new Error('Disk full'))
    mount(api)
    await selectZip()
    fireEvent.click(screen.getByRole('button', { name: '确认导入' }))
    await screen.findByText('Disk full')
    expect(screen.getByRole('dialog')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '确认导入' }))
    await waitFor(() => expect(api.commit).toHaveBeenCalledTimes(2))
  })

  it('does not expose active or unmanaged resource removal', async () => {
    mount(fakeApi([{ ...SKIN, status: 'active' }, { ...SKIN, id: 'bundled', name: 'Bundled', source: 'existing', managed: false }]))
    await screen.findByText(SKIN.name)
    expect(screen.queryByRole('button', { name: '移除' })).toBeNull()
  })

  it('confirms removal and refreshes inventory after success', async () => {
    const { api } = mount()
    await screen.findByText(SKIN.name)
    fireEvent.click(screen.getByRole('button', { name: '移除' }))
    expect(api.action).not.toHaveBeenCalled()
    const dialog = screen.getByRole('dialog')
    fireEvent.click(dialog.querySelectorAll('button')[1])
    await waitFor(() => expect(api.action).toHaveBeenCalledWith('skin', SKIN.id, 'remove', true))
    await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2))
  })

  it('requires code trust for plugin installation and waits for the installer job', async () => {
    const plugin: LocalResource = { ...SKIN, kind: 'plugin', executable: true }
    const api = fakeApi([plugin])
    vi.mocked(api.action).mockResolvedValue({ jobId: 'job-1', requiresRestart: true })
    mount(api)
    await waitFor(() => expect(api.list).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('tab', { name: /插件/ }))
    fireEvent.click(await screen.findByRole('button', { name: '安装' }))
    expect(screen.getByText(/安装插件可能运行安装脚本/)).toBeTruthy()
    expect(api.action).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '确认信任并继续' }))
    await waitFor(() => expect(api.action).toHaveBeenCalledWith('plugin', SKIN.id, 'install', true))
    expect(api.job).toHaveBeenCalledWith('job-1', expect.any(AbortSignal))
    await screen.findByText('操作已完成，需要重新启动工作台后生效。')
  })

  it('shows plugin installer job failure without claiming success', async () => {
    const api = fakeApi([{ ...SKIN, kind: 'plugin', executable: true }])
    vi.mocked(api.action).mockResolvedValue({ jobId: 'job-1', requiresRestart: true })
    vi.mocked(api.job).mockResolvedValue({ phase: 'error', error: 'Install failed' })
    mount(api)
    fireEvent.click(screen.getByRole('tab', { name: /插件/ }))
    fireEvent.click(await screen.findByRole('button', { name: '安装' }))
    fireEvent.click(screen.getByRole('button', { name: '确认信任并继续' }))
    await screen.findByText('Install failed')
    expect(screen.queryByText('操作已完成，需要重新启动工作台后生效。')).toBeNull()
  })

  it('requires confirmation before enabling an executable preset', async () => {
    const api = fakeApi([{ ...SKIN, kind: 'preset', executable: true }])
    mount(api)
    fireEvent.click(screen.getByRole('tab', { name: /预设/ }))
    fireEvent.click(await screen.findByRole('button', { name: '启用' }))
    expect(screen.getByText(/启用预设后/)).toBeTruthy()
    expect(api.action).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '确认信任并继续' }))
    await waitFor(() => expect(api.action).toHaveBeenCalledWith('preset', SKIN.id, 'enable', true))
  })

  it('distinguishes installed disabled plugins from imported plugin packages', async () => {
    const api = fakeApi([{ ...SKIN, kind: 'plugin', executable: true, installed: true, enabled: false }])
    mount(api)
    fireEvent.click(screen.getByRole('tab', { name: /插件/ }))
    await screen.findByText('已停用')
    expect(screen.getByRole('button', { name: '启用' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: '安装' })).toBeNull()
    expect(screen.queryByRole('button', { name: '移除' })).toBeNull()
  })

  it('leaves existing executable resources to their owning settings pages', async () => {
    const api = fakeApi([
      { ...SKIN, executable: true, managed: false, source: 'existing' },
      { ...SKIN, kind: 'plugin', executable: true, installed: true, enabled: true, managed: false, source: 'existing' },
    ])
    mount(api)
    await screen.findByText(SKIN.name)
    expect(screen.queryByRole('button', { name: '信任皮肤脚本' })).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: /插件/ }))
    expect(screen.getByText('已有插件可在左侧「插件」的插件管理中调整。')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '停用' })).toBeNull()
    expect(screen.queryByRole('button', { name: '移除' })).toBeNull()
  })

  it('keeps import controls read-only when the settings scope is read-only', async () => {
    const scope = new FakeScope({})
    scope.writable = false
    mount(fakeApi(), scope)
    await screen.findByText(SKIN.name)
    expect((screen.getByRole('button', { name: '导入 ZIP' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: '移除' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('does not load resources when the Workshop switch is disabled', () => {
    const { api } = mount(fakeApi(), new FakeScope({ enabled: false }))
    expect(api.list).not.toHaveBeenCalled()
    expect(screen.queryByRole('tab')).toBeNull()
  })

  it('retries inventory failure against the local host', async () => {
    const api = fakeApi()
    vi.mocked(api.list).mockRejectedValueOnce(new Error('Host offline'))
    mount(api)
    await screen.findByText('读取本地资源失败：Host offline')
    fireEvent.click(screen.getByRole('button', { name: '重试' }))
    await screen.findByText(SKIN.name)
  })
})

describe('local Workshop transport', () => {
  it('uses only same-origin routes and preserves binary file paths', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ ok: true, resources: [], uploadId: 'id', preview: PREVIEW, resource: SKIN, job: { phase: 'done' } }), { headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', fetch)
    await localWorkshopApi.list()
    await localWorkshopApi.start('skin', 'folder')
    await localWorkshopApi.upload('id', 'skin/assets/bg image.png', new File(['png'], 'bg image.png'))
    await localWorkshopApi.inspect('id')
    await localWorkshopApi.commit('id', true)
    await localWorkshopApi.discard('id')
    await localWorkshopApi.action('plugin', 'sample', 'install', true)
    await localWorkshopApi.job('job1')
    for (const call of fetch.mock.calls as unknown as Array<[string, RequestInit]>) {
      expect(call[0].startsWith('/api/')).toBe(true)
      expect(call[1].credentials).toBe('same-origin')
    }
    const uploadCall = fetch.mock.calls[2] as unknown as [string, RequestInit]
    expect(new URL(uploadCall[0], 'http://localhost').searchParams.get('path')).toBe('skin/assets/bg image.png')
    expect(uploadCall[1].method).toBe('PUT')
  })

  it('surfaces host validation messages for failed responses', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: false, error: 'unsafe-path', message: 'Invalid path' }), { status: 400 })))
    await expect(localWorkshopApi.inspect('bad')).rejects.toThrow('Invalid path')
  })
})
