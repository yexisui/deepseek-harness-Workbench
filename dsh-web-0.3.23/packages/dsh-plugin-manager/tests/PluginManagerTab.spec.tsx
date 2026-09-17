/** @vitest-environment jsdom */

/**
 * Lightweight mount-level smoke tests for the plugin-manager tab: the local-only
 * degradation, the plugin list rendering, the install-failure repair seed
 * (which must carry the install's own error, not a later unrelated one), and
 * the install-time conflict ledger with its undo affordance. The official UI
 * primitives are stubbed; the injected face is a vi.fn() harness.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import type { ComponentProps } from 'react'

// The official primitives are a closure-factory client bundle (not importable
// under vitest); stub the two members the tab consumes.
vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => {
  const create = (React.createElement as (...args: unknown[]) => unknown).bind(React)
  return {
    Button: (props: Record<string, unknown>) =>
      create('button', { disabled: props['disabled'], onClick: props['onClick'], className: props['className'] }, props['children']),
    Modal: (props: Record<string, unknown>) =>
      props['open'] === true ? create('div', { role: 'dialog' }, props['title'], props['children']) : null,
  }
})

import { PluginManagerTab, type PluginManagerTabInjected } from '../src/client/PluginManagerTab.tsx'
import { en, type PluginManagerKey } from '../src/client/locales.ts'
import type { InstallProgressItem, InstalledPluginItem, PluginControlItem } from '../src/core/protocol.ts'

afterEach(cleanup)

/** English translate stub with {param} interpolation. */
const t: ComponentProps<typeof PluginManagerTab>['t'] = (key, params) => {
  const text = (en as Record<string, string>)[key as PluginManagerKey] ?? String(key)
  if (params === undefined) return text
  return text.replace(/\{(\w+)\}/g, (match, name: string) => String(params[name] ?? match))
}

const plugin: InstalledPluginItem = {
  id: 'p1', name: 'p1', version: '1.0.0', source: { kind: 'npm', spec: '@scope/p1' }, installedAt: '2026-08-18T00:00:00.000Z', enabled: true,
}

const product = (state: PluginControlItem['state']): PluginControlItem => ({
  id: 'web-ui', name: 'dsh-web', repository: 'https://github.com/zhu1090093659/dsh-web', state,
})

/** Minimal injected-face harness; every member is a spy the test overrides. */
function face(overrides: Partial<PluginManagerTabInjected> = {}): PluginManagerTabInjected {
  return {
    isLoopback: true,
    list: vi.fn(async () => [plugin]),
    install: vi.fn(async () => plugin),
    update: vi.fn(async () => plugin),
    uninstall: vi.fn(async () => []),
    setEnabled: vi.fn(async (id, enabled) => ({ ...plugin, id, enabled })),
    checkUpdates: vi.fn(async () => []),
    status: vi.fn(async (): Promise<InstallProgressItem> => ({ kind: 'idle', stage: 'fetch' })),
    failures: vi.fn(async () => ({ items: [], pluginRoot: '/plugins', safeMode: false })),
    setSafeMode: vi.fn(async () => {}),
    repairPlugin: vi.fn(async () => {}),
    controlsList: vi.fn(async () => []),
    controlsSetEnabled: vi.fn(async () => []),
    ...overrides,
  }
}

function renderTab(injected: PluginManagerTabInjected): void {
  render(<PluginManagerTab {...injected as unknown as ComponentProps<typeof PluginManagerTab>} t={t} />)
}

describe('PluginManagerTab aggregate children', () => {
  const aggregatePlugin: InstalledPluginItem = {
    id: '@linxin666/dsh-web-all', name: 'web-all', version: '0.3.18',
    source: { kind: 'npm', spec: '@linxin666/dsh-web-all' }, installedAt: '', enabled: false,
    children: [
      { id: 'web-ui-pet', name: '@linxin666/dsh-pet', enabled: true },
      { id: 'web-ui-plugin-manager', name: '@linxin666/dsh-client-ui-plugin-manager', enabled: true, locked: true },
    ],
  }

  /** The disclosure toggle of one aggregate row (the child list is collapsed by default). */
  const toggle = (name: string): HTMLElement => screen.getByRole('button', { name: `Show child plugins of ${name}` })

  it('collapses the child rows behind an enablement summary by default', async () => {
    renderTab(face({ list: vi.fn(async () => [aggregatePlugin]) }))
    expect(await screen.findByText('web-all')).toBeTruthy()
    expect(screen.getByText('2/2 child plugins on')).toBeTruthy()
    expect(screen.queryByText('@linxin666/dsh-pet')).toBeNull()
    expect(screen.queryByText('Core row')).toBeNull()
    expect(toggle('web-all').getAttribute('aria-expanded')).toBe('false')
  })

  it('expands child rows with individual switches, a mixed parent state, and a locked hint', async () => {
    renderTab(face({ list: vi.fn(async () => [aggregatePlugin]) }))
    expect(await screen.findByText('web-all')).toBeTruthy()
    expect(screen.getByText('Partially on')).toBeTruthy()
    fireEvent.click(toggle('web-all'))
    expect(await screen.findByText('@linxin666/dsh-pet')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Hide child plugins of web-all' }).getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('switch', { name: 'Turn off @linxin666/dsh-pet' })).toBeTruthy()
    expect(screen.queryByRole('switch', { name: /dsh-client-ui-plugin-manager/ })).toBeNull()
    expect(screen.getByText('Core row')).toBeTruthy()
    expect(screen.getByText(/Bundle child plugins toggle individually/)).toBeTruthy()
  })

  it('collapses the child list again on a second click', async () => {
    renderTab(face({ list: vi.fn(async () => [aggregatePlugin]) }))
    expect(await screen.findByText('web-all')).toBeTruthy()
    fireEvent.click(toggle('web-all'))
    expect(await screen.findByText('@linxin666/dsh-pet')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Hide child plugins of web-all' }))
    await waitFor(() => expect(screen.queryByText('@linxin666/dsh-pet')).toBeNull())
  })

  it('toggles a child row by entry id and refreshes the summary from the returned parent row', async () => {
    const refreshed: InstalledPluginItem = {
      ...aggregatePlugin,
      children: [
        { id: 'web-ui-pet', name: '@linxin666/dsh-pet', enabled: false },
        { id: 'web-ui-plugin-manager', name: '@linxin666/dsh-client-ui-plugin-manager', enabled: true, locked: true },
      ],
    }
    const setEnabled = vi.fn(async () => refreshed)
    renderTab(face({ list: vi.fn(async () => [aggregatePlugin]), setEnabled }))
    expect(await screen.findByText('web-all')).toBeTruthy()
    fireEvent.click(toggle('web-all'))
    fireEvent.click(await screen.findByRole('switch', { name: 'Turn off @linxin666/dsh-pet' }))
    await waitFor(() => expect(setEnabled).toHaveBeenCalledWith('web-ui-pet', false))
    expect(await screen.findByRole('switch', { name: 'Turn on @linxin666/dsh-pet' })).toBeTruthy()
    expect(screen.getByText('1/2 child plugins on')).toBeTruthy()
  })

  it('expands each aggregate row independently', async () => {
    const second: InstalledPluginItem = {
      id: '@linxin666/dsh-other-all', name: 'other-all', version: '0.1.0',
      source: { kind: 'npm', spec: '@linxin666/dsh-other-all' }, installedAt: '', enabled: true,
      children: [{ id: 'web-ui-other', name: '@linxin666/dsh-other', enabled: true }],
    }
    renderTab(face({ list: vi.fn(async () => [aggregatePlugin, second]) }))
    expect(await screen.findByText('other-all')).toBeTruthy()
    fireEvent.click(toggle('other-all'))
    expect(await screen.findByText('@linxin666/dsh-other')).toBeTruthy()
    expect(screen.queryByText('@linxin666/dsh-pet')).toBeNull()
    expect(screen.getByText('1/1 child plugins on')).toBeTruthy()
  })
})


describe('PluginManagerTab', () => {
  it('renders the local-only notice and nothing else when not loopback', async () => {
    renderTab(face({ isLoopback: false }))
    expect(screen.getByText(t('localOnlyTitle'))).toBeTruthy()
    expect(screen.queryByRole('switch')).toBeNull()
  })

  it('renders the plugin list with the next-start switch', async () => {
    renderTab(face())
    expect(await screen.findByText('p1')).toBeTruthy()
    expect(screen.getByText('Installed 1.0.0')).toBeTruthy()
    expect(screen.getByRole('switch', { name: 'Turn off p1' }).getAttribute('aria-checked')).toBe('true')
  })

  it('seeds the repair conversation with the install error, not a later unrelated error', async () => {
    const injected = face({
      install: vi.fn(async () => { throw new Error('ENOENT: install exploded') }),
      setEnabled: vi.fn(async () => { throw new Error('toggle exploded') }),
    })
    renderTab(injected)

    await screen.findByText('p1')
    fireEvent.change(screen.getByPlaceholderText(t('installPlaceholder')), { target: { value: '@scope/new' } })
    fireEvent.click(screen.getByRole('button', { name: t('install') }))
    expect(await screen.findByText(/ENOENT: install exploded/)).toBeTruthy()

    // A later, unrelated failure overwrites the error row text...
    fireEvent.click(screen.getByRole('switch', { name: 'Turn off p1' }))
    expect(await screen.findByText(/toggle exploded/)).toBeTruthy()

    // ...but the repair seed still carries the install error, not the toggle error.
    fireEvent.click(screen.getByRole('button', { name: t('repair') }))
    await waitFor(() => {
      expect(injected.repairPlugin).toHaveBeenCalledTimes(1)
    })
    const [, message] = vi.mocked(injected.repairPlugin).mock.calls[0] as [string, string]
    expect(message).toContain('@scope/new')
    expect(message).toContain('ENOENT: install exploded')
    expect(message).not.toContain('toggle exploded')
  })

  it('shows the conflict ledger after an install disabled a product, and undoes it', async () => {
    let controlsCalls = 0
    const injected = face({
      controlsList: vi.fn(async () => {
        controlsCalls += 1
        return controlsCalls <= 1 ? [product('enabled')] : [product('disabled')]
      }),
      controlsSetEnabled: vi.fn(async () => [product('enabled')]),
    })
    renderTab(injected)

    await screen.findByText('p1')
    fireEvent.change(screen.getByPlaceholderText(t('installPlaceholder')), { target: { value: '@scope/new' } })
    fireEvent.click(screen.getByRole('button', { name: t('install') }))

    expect(await screen.findByText(t('conflictDisabled', { name: 'dsh-web' }))).toBeTruthy()

    // Every conflict row offers the repair handoff with a seeded conflict message.
    fireEvent.click(screen.getByRole('button', { name: t('repair') }))
    await waitFor(() => {
      expect(injected.repairPlugin).toHaveBeenCalledTimes(1)
    })
    const [, conflictMessage] = vi.mocked(injected.repairPlugin).mock.calls[0] as [string, string]
    expect(conflictMessage).toContain('dsh-web (web-ui)')
    expect(conflictMessage).toContain(t('repairConflictTitle'))

    fireEvent.click(screen.getByRole('button', { name: t('undoConflict') }))
    await waitFor(() => {
      expect(injected.controlsSetEnabled).toHaveBeenCalledWith('web-ui', true)
    })
    await waitFor(() => {
      expect(screen.queryByText(t('conflictDisabled', { name: 'dsh-web' }))).toBeNull()
    })
  })

  describe('DSH compatibility gating', () => {
    it('disables update and shows the requirement hint when the update is incompatible', async () => {
      const injected = face({
        checkUpdates: vi.fn(async () => [{
          id: 'p1', current: '1.0.0', latest: '1.1.0', requiresDsh: '>=0.1.0-rc.8', compatible: false,
        }]),
      })
      renderTab(injected)

      await screen.findByText('p1')
      fireEvent.click(screen.getByRole('button', { name: t('checkUpdates') }))
      expect(await screen.findByText(t('updateBlockedDsh', { min: '0.1.0-rc.8' }))).toBeTruthy()
      const updateButton = screen.getByRole('button', { name: t('update') })
      expect((updateButton as HTMLButtonElement).disabled).toBe(true)
    })

    it('keeps update enabled and shows the requirement note when compatible', async () => {
      const injected = face({
        checkUpdates: vi.fn(async () => [{
          id: 'p1', current: '1.0.0', latest: '1.1.0', requiresDsh: '>=0.1.0-rc.8', compatible: true,
        }]),
      })
      renderTab(injected)

      await screen.findByText('p1')
      fireEvent.click(screen.getByRole('button', { name: t('checkUpdates') }))
      expect(await screen.findByText(t('updateRequiresDsh', { min: '0.1.0-rc.8' }))).toBeTruthy()
      const updateButton = screen.getByRole('button', { name: t('update') })
      expect((updateButton as HTMLButtonElement).disabled).toBe(false)
    })

    it('keeps the update flow unchanged (fail open) when compatibility is unknown', async () => {
      const injected = face({
        checkUpdates: vi.fn(async () => [{ id: 'p1', current: '1.0.0', latest: '1.1.0' }]),
        update: vi.fn(async () => plugin),
      })
      renderTab(injected)

      await screen.findByText('p1')
      fireEvent.click(screen.getByRole('button', { name: t('checkUpdates') }))
      expect(await screen.findByText(t('latest', { version: '1.1.0' }))).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: t('update') }))
      await waitFor(() => {
        expect(injected.update).toHaveBeenCalledWith('p1')
      })
    })
  })
})
