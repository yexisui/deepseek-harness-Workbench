/** Legacy public settings must stay inert while LAN pairing remains available. */
import type { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apply, Config } from '../src/index.ts'
import { PairingService } from '../src/pairing.ts'

vi.mock('../src/pairing-access.ts', () => ({ RemoteWebUiPairing: class {} }))
vi.mock('../src/lan.ts', () => ({ lanIPv4Addresses: () => ['192.168.1.5'] }))
vi.mock('../src/posture.ts', async (original) => ({
  ...await original<typeof import('../src/posture.ts')>(),
  probePosture: vi.fn(async () => ({ checkedAt: 1, hosts: [] })),
}))

const disposers: (() => void)[] = []
afterEach(() => {
  for (const dispose of disposers.splice(0).reverse()) dispose()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

function mount(host: string) {
  const routes: { path: string }[] = []
  let onChange: (() => void) | undefined
  let persisted: Config = {}
  const ctx = {
    webServer: {
      host, port: 3080,
      register: (route: { path: string }) => { routes.push(route); return () => {} },
      registerUpgrade: () => () => {},
    },
    connection: {},
    get: () => undefined,
    on: () => () => {},
    effect: (effect: () => unknown) => {
      const dispose = effect()
      if (typeof dispose === 'function') disposers.push(dispose as () => void)
      return dispose
    },
    inject: (_services: string[], callback: (value: unknown) => void) => callback({
      settings: {
        installSection: (_ctx: unknown, _ns: unknown, _schema: unknown, _base: unknown, options: {
          setSource(source: () => Config): void
          onChange(): void
        }) => {
          onChange = options.onChange
          options.setSource(() => persisted)
        },
      },
    }),
  }
  const legacy = {
    enabled: true,
    autoTunnel: true,
    relay: true,
    tunnelToken: 'legacy-token',
    publicBaseUrl: 'https://legacy.example.com',
  }
  expect(() => Config(legacy)).not.toThrow()
  vi.stubEnv('DSH_REMOTE_PUBLIC_BASE_URL', legacy.publicBaseUrl)
  const lan = vi.spyOn(PairingService.prototype, 'setLanBases')
  apply(ctx as unknown as Context, legacy as Config)
  persisted = { ...legacy, maxDevices: 3 } as Config
  onChange?.()
  const service = lan.mock.contexts[0] as PairingService
  // Keep this fixture memory-only; accepting a device must not touch user data.
  service.config = { ...service.config, devicesFile: undefined }
  return { routes, service }
}

describe('intranet host', () => {
  it('ignores legacy public settings on mount and live settings reload, with no update endpoints or public fetches', async () => {
    vi.useFakeTimers()
    const outbound = vi.fn(() => { throw new Error('unexpected network request') })
    vi.stubGlobal('fetch', outbound)
    const { routes, service } = mount('0.0.0.0')
    await vi.advanceTimersByTimeAsync(60_000)
    expect(outbound).not.toHaveBeenCalled()
    expect(service.publicBaseUrl).toBeUndefined()
    expect(service.snapshot()).not.toHaveProperty('tunnel')
    expect(service.snapshot()).not.toHaveProperty('relay')
    expect(routes.some(route => route.path.startsWith('/api/update'))).toBe(false)
    expect(routes.some(route => route.path === '/api/pair/issue')).toBe(true)
    expect(service.lanAddresses).toEqual(['192.168.1.5'])
    const issued = service.issue()
    expect(service.accept(issued.token).ok).toBe(true)
    expect(service.snapshot().deviceCount).toBe(1)
    service.stop()
    expect(service.snapshot().deviceCount).toBe(0)
  })

  it('keeps loopback-only deployments unavailable for remote pairing despite legacy public settings', () => {
    vi.useFakeTimers()
    const outbound = vi.fn()
    vi.stubGlobal('fetch', outbound)
    const { service } = mount('127.0.0.1')
    expect(service.snapshot().phase).toBe('lan-required')
    expect(() => service.issue()).toThrow()
    expect(outbound).not.toHaveBeenCalled()
  })
})
