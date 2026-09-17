/** @vitest-environment jsdom */

/**
 * Presets panel contract: catalog rows join the host state by id, install and
 * enable/disable call the host routes, executable content is gated behind the
 * confirmation modal, and the gateway-unavailable path degrades to a note.
 * The host routes themselves are covered by tests/routes.spec.ts.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import React from 'react'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => {
  const create = (React.createElement as (...args: unknown[]) => unknown).bind(React)
  return {
    Button: (props: Record<string, unknown>) =>
      create('button', { disabled: props['disabled'], onClick: props['onClick'], className: props['className'] }, props['children']),
    Modal: (props: Record<string, unknown>) =>
      props['open'] === true ? create('div', { role: 'dialog' }, props['title'], props['children']) : null,
  }
})

import { PresetPanel, compareVersions, hasUpdate, type PresetPanelProps, type PresetStateRow } from '../src/client/PresetPanel.tsx'
import { zh } from '../src/client/locales.ts'

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

const t = ((key: keyof typeof zh, params?: Record<string, unknown>): string => {
  let text: string = zh[key]
  for (const [name, value] of Object.entries(params ?? {})) text = text.replaceAll('{' + name + '}', String(value))
  return text
}) as PresetPanelProps['t']

const PROFILE = { plugins: ['@deepseek-ai/dsh-persona'], relativeNames: [], inlineExpressions: 0, codeFiles: [], codeExecution: 'none', rows: 1 }

const RECORD = { id: 'demo', name: '演示预设', nameEn: 'Demo preset', author: 'tester', version: '1.1.0', description: '一句话说明。', rank: 1 }

function stateResponse(presets: unknown[]): Response {
  return new Response(JSON.stringify({ ok: true, defaultId: 'ptc', occupied: [], rosterAvailable: true, presets }), { status: 200 })
}

function stubFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>): ReturnType<typeof vi.fn> {
  const mock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => Promise.resolve(handler(String(input), init)))
  vi.stubGlobal('fetch', mock)
  return mock
}

function panelProps(overrides: Partial<PresetPanelProps> = {}): PresetPanelProps {
  return {
    t,
    items: [RECORD],
    catalogState: 'ready',
    gateway: true,
    installs: { demo: 4 },
    ...overrides,
  } as unknown as PresetPanelProps
}

describe('PresetPanel', () => {
  it('lists catalog rows with their install state and install counts', async () => {
    stubFetch((url) => {
      if (url.includes('/api/preset-center/state')) {
        return stateResponse([{ id: 'demo', installed: true, enabled: false, managed: true, assetVersion: '1.0.0', integrity: 'valid', conflict: false, dir: '/tmp/demo', profile: PROFILE }])
      }
      return new Response('{}', { status: 404 })
    })
    render(<PresetPanel {...panelProps()} />)
    expect(screen.getByText(/演示预设/)).toBeTruthy()
    expect(screen.getByText('安装 4')).toBeTruthy()
    await waitFor(() => expect(screen.getByText(zh['state.installed'])).toBeTruthy())
    expect(screen.getByText(zh['state.newVersion'].replace('{version}', '1.1.0'))).toBeTruthy()
    expect(screen.getByText(zh['code.none'])).toBeTruthy()
  })

  it('installs a not-installed preset through the store gateway and reports the install', async () => {
    stubFetch((url) => url.includes('/api/preset-center/state') ? stateResponse([]) : new Response('{}', { status: 404 }))
    const install = vi.fn(async () => ({ dest: '/home/.dsh/agent-presets/demo' }))
    const reportInstall = vi.fn(async () => 5)
    render(<PresetPanel {...panelProps({ install, reportInstall })} />)
    fireEvent.click(await screen.findByRole('button', { name: zh['action.install'] }))
    await waitFor(() => expect(install).toHaveBeenCalledWith('demo', false))
    await waitFor(() => expect(reportInstall).toHaveBeenCalledWith('demo'))
  })

  it('asks for confirmation before enabling executable content and then enables it', async () => {
    const profile = { plugins: ['@deepseek-ai/dsh-persona'], relativeNames: ['./hook.mjs'], inlineExpressions: 2, codeFiles: ['hook.mjs'], codeExecution: 'local', rows: 2 }
    const enableBodies: unknown[] = []
    stubFetch((url, init) => {
      if (url.includes('/api/preset-center/state')) {
        return stateResponse([{ id: 'demo', installed: true, enabled: false, managed: true, integrity: 'valid', conflict: false, dir: '/tmp/demo', profile }])
      }
      if (url.includes('/api/preset-center/enable')) {
        const body = JSON.parse(String(init?.body ?? '{}')) as { confirm?: boolean }
        enableBodies.push(body)
        return body.confirm === true
          ? new Response(JSON.stringify({ ok: true }), { status: 200 })
          : new Response(JSON.stringify({ ok: false, error: 'confirmation-required', profile }), { status: 409 })
      }
      return new Response('{}', { status: 404 })
    })
    render(<PresetPanel {...panelProps()} />)
    fireEvent.click(await screen.findByRole('button', { name: zh['action.enable'] }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy())
    expect(screen.getByText(/权限等同 shell 访问/)).toBeTruthy()
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: zh['action.enable'] }))
    await waitFor(() => expect(enableBodies).toHaveLength(2))
    expect(enableBodies[1]).toEqual({ id: 'demo', confirm: true })
  })

  it('disables an enabled preset and reports a protected default', async () => {
    let defaultId: string | null = null
    stubFetch((url) => {
      if (url.includes('/api/preset-center/state')) {
        return new Response(JSON.stringify({
          ok: true, defaultId, occupied: [], rosterAvailable: true,
          presets: [{ id: 'demo', installed: false, enabled: true, managed: true, integrity: 'valid', conflict: false, dir: '/tmp/demo', profile: PROFILE }],
        }), { status: 200 })
      }
      if (url.includes('/api/preset-center/disable')) {
        return defaultId === null
          ? new Response(JSON.stringify({ ok: true }), { status: 200 })
          : new Response(JSON.stringify({ ok: false, error: 'default-preset' }), { status: 409 })
      }
      return new Response('{}', { status: 404 })
    })
    render(<PresetPanel {...panelProps()} />)
    fireEvent.click(await screen.findByRole('button', { name: zh['action.disable'] }))
    await waitFor(() => expect(screen.getByText(zh['note.disabled'])).toBeTruthy())

    defaultId = 'demo'
    cleanup()
    render(<PresetPanel {...panelProps()} />)
    fireEvent.click(await screen.findByRole('button', { name: zh['action.disable'] }))
    await waitFor(() => expect(screen.getByText(zh['note.defaultPreset'])).toBeTruthy())
  })

  it('shows the empty-catalog note and degrades when the gateway is unavailable', async () => {
    stubFetch(() => new Response(JSON.stringify({ ok: true, presets: [] }), { status: 200 }))
    render(<PresetPanel {...panelProps({ items: [], gateway: false })} />)
    expect(screen.getByText(zh['note.remoteInstall'])).toBeTruthy()
    await waitFor(() => expect(screen.getByText(zh['note.emptyCatalog'])).toBeTruthy())
    expect(screen.queryByRole('button', { name: zh['action.install'] })).toBeNull()
  })

  it('marks an id another root supplies as un-installable', async () => {
    stubFetch((url) => url.includes('/api/preset-center/state')
      ? new Response(JSON.stringify({ ok: true, defaultId: 'ptc', occupied: ['demo'], rosterAvailable: true, presets: [] }), { status: 200 })
      : new Response('{}', { status: 404 }))
    render(<PresetPanel {...panelProps()} />)
    await waitFor(() => expect(screen.getByText(zh['state.shadowed'])).toBeTruthy())
    expect((screen.getByRole('button', { name: zh['action.install'] }) as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('hasUpdate and compareVersions', () => {
  it('correctly compares semantic versions', () => {
    expect(compareVersions('1.0.0', '1.0.1')).toBe(-1)
    expect(compareVersions('1.1.0', '1.0.9')).toBe(1)
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0)
    expect(compareVersions('0.3.2', '0.3.10')).toBe(-1)
    expect(compareVersions('0.3.10', '0.3.2')).toBe(1)
    expect(compareVersions('1.0.0-rc.1', '1.0.0')).toBe(-1)
    expect(compareVersions('1.0.0', '1.0.0-rc.1')).toBe(1)
    expect(compareVersions('1.0.0-rc.1', '1.0.0-rc.2')).toBe(-1)
  })

  it('only signals hasUpdate when the catalog version is strictly newer than installed', () => {
    const record = { ...RECORD, version: '1.2.0' }
    // Installed older version (1.1.0) -> has update
    expect(hasUpdate(record, { id: 'demo', installed: true, enabled: false, assetVersion: '1.1.0' } as unknown as PresetStateRow)).toBe(true)
    // Installed same version (1.2.0) -> no update
    expect(hasUpdate(record, { id: 'demo', installed: true, enabled: false, assetVersion: '1.2.0' } as unknown as PresetStateRow)).toBe(false)
    // Local ahead of catalog (e.g. dev build 1.3.0 vs catalog 1.2.0) -> no update (must NOT downgrade)
    expect(hasUpdate(record, { id: 'demo', installed: true, enabled: false, assetVersion: '1.3.0' } as unknown as PresetStateRow)).toBe(false)
    // Not installed and not enabled -> no update
    expect(hasUpdate(record, { id: 'demo', installed: false, enabled: false, assetVersion: '1.1.0' } as unknown as PresetStateRow)).toBe(false)
  })
})
