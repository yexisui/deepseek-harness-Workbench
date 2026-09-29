import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Readable } from 'node:stream'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'

const mocks = vi.hoisted(() => ({
  store: { init: vi.fn(), close: vi.fn(), snapshot: vi.fn(), command: vi.fn(), icons: { upload: vi.fn(), read: vi.fn() } },
  runtime: { init: vi.fn(), dispose: vi.fn(), tasks: vi.fn(), dependencies: vi.fn(), check: vi.fn(), connect: vi.fn(), stop: vi.fn(), health: { state: 'unknown' } },
  writePresets: vi.fn(), requestRejection: vi.fn(),
}))
vi.mock('../src/host/store.ts', () => ({ CapabilityStore: class { constructor() { return mocks.store } } }))
vi.mock('../src/host/runtime.ts', () => ({ CapabilityRuntime: class { constructor() { return mocks.runtime } } }))
vi.mock('../src/host/presets.ts', () => ({ writePresets: mocks.writePresets }))
vi.mock('../../../shared/host/dsh-home.ts', () => ({ dshHome: () => `${process.env.TEMP}/dsh-route-auth-test` }))
import { apply, inject } from '../src/index.ts'

type Handler = (request: IncomingMessage, response: ServerResponse) => Promise<unknown>
let handler: Handler
beforeEach(async () => {
  vi.resetAllMocks()
  mocks.store.snapshot.mockReturnValue({ revision: 10 })
  mocks.runtime.tasks.mockReturnValue([]); mocks.runtime.dependencies.mockReturnValue([])
  const ctx = {
    webServer: { register: vi.fn((route: { handler: Handler }) => { handler = route.handler; return () => {} }) },
    connection: { requestRejection: mocks.requestRejection }, inject: vi.fn(), provide: vi.fn(), effect: (effect: () => unknown) => effect(),
  } as unknown as Context
  await apply(ctx)
  mocks.store.snapshot.mockClear(); mocks.writePresets.mockClear()
})
function request(path: string, method = 'GET', body = '{}', headers: Record<string, string | undefined> = {}) {
  let reads = 0
  const req = new Readable({ read() { reads++; this.push(body); this.push(null) } }) as IncomingMessage
  req.method = method; req.url = path
  req.headers = { host: '127.0.0.1:3888', origin: 'http://127.0.0.1:3888', 'content-type': 'application/json', ...headers }
  return { req, reads: () => reads }
}
function response() { return { writeHead: vi.fn(), end: vi.fn() } as unknown as ServerResponse }

describe('capability named-route authentication', () => {
  it('requires the existing connection service and refuses GET/POST before reading or mutating data', async () => {
    expect(inject).toContain('connection')
    for (const rejection of [401, 403]) {
      mocks.requestRejection.mockReturnValue(rejection)
      for (const [path, method] of [['/api/capabilities/state', 'GET'], [`/api/capabilities/icons/${'a'.repeat(64)}`, 'GET'], ['/api/capabilities/icons', 'POST'], ['/api/capabilities/command', 'POST'], ['/api/capabilities/connect', 'POST'], ['/api/capabilities/stop', 'POST']]) {
        const input = request(path!, method, 'malformed JSON must never be read'), res = response()
        await handler(input.req, res)
        expect(res.writeHead).toHaveBeenCalledWith(rejection, expect.objectContaining({ 'cache-control': 'no-store' }))
        expect(input.reads()).toBe(0)
      }
    }
    expect(mocks.store.snapshot).not.toHaveBeenCalled(); expect(mocks.store.command).not.toHaveBeenCalled()
    expect(mocks.store.icons.upload).not.toHaveBeenCalled(); expect(mocks.store.icons.read).not.toHaveBeenCalled()
    expect(mocks.writePresets).not.toHaveBeenCalled(); expect(mocks.runtime.connect).not.toHaveBeenCalled(); expect(mocks.runtime.stop).not.toHaveBeenCalled()
  })

  it('allows authenticated state and image GET requests through the same check', async () => {
    const state = request('/api/capabilities/state'), stateResponse = response()
    await handler(state.req, stateResponse)
    expect(mocks.requestRejection).toHaveBeenCalledWith(state.req)
    expect(mocks.store.snapshot).toHaveBeenCalledOnce()
    expect(stateResponse.writeHead).toHaveBeenCalledWith(200, expect.any(Object))
    const id = 'a'.repeat(64), bytes = Buffer.from('validated PNG asset')
    mocks.store.icons.read.mockResolvedValue(bytes)
    const image = request(`/api/capabilities/icons/${id}`), imageResponse = response()
    await handler(image.req, imageResponse)
    expect(mocks.requestRejection).toHaveBeenLastCalledWith(image.req)
    expect(mocks.store.icons.read).toHaveBeenCalledWith(id)
    expect(imageResponse.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({ 'content-type': 'image/png', 'x-content-type-options': 'nosniff' }))
    expect(imageResponse.end).toHaveBeenCalledWith(bytes)
  })

  it('allows authenticated icon uploads and commands after JSON validation', async () => {
    const id = 'b'.repeat(64), dataUrl = 'data:image/png;base64,upload-fixture'
    mocks.store.icons.upload.mockResolvedValue({ id })
    const upload = request('/api/capabilities/icons', 'POST', JSON.stringify({ dataUrl })), uploaded = response()
    await handler(upload.req, uploaded)
    expect(mocks.requestRejection).toHaveBeenCalledWith(upload.req)
    expect(mocks.store.icons.upload).toHaveBeenCalledWith(dataUrl)
    expect(uploaded.end).toHaveBeenCalledWith(JSON.stringify({ id }))
    const command = { type: 'role.toggle', id: 'builtin-analyst', enabled: true }, result = { state: { revision: 11 }, id: command.id }
    mocks.store.command.mockResolvedValue(result)
    const save = request('/api/capabilities/command', 'POST', JSON.stringify({ revision: 10, command })), saved = response()
    await handler(save.req, saved)
    expect(mocks.store.command).toHaveBeenCalledWith(10, command)
    expect(mocks.writePresets).toHaveBeenCalledWith(`${process.env.TEMP}/dsh-route-auth-test`, result.state)
    expect(saved.end).toHaveBeenCalledWith(JSON.stringify(result))
  })

  it('retains the stricter loopback, same-origin and JSON fence even with an authenticated session', async () => {
    for (const headers of [{ host: 'example.com' }, { origin: 'https://other.example' }, { 'sec-fetch-site': 'cross-site' }, { 'content-type': 'text/plain' }]) {
      const input = request('/api/capabilities/icons', 'POST', '{}', headers), res = response()
      await handler(input.req, res)
      expect(res.writeHead).toHaveBeenCalledWith(headers['content-type'] ? 415 : 403, expect.any(Object))
      expect(input.reads()).toBe(0)
    }
    expect(mocks.requestRejection).not.toHaveBeenCalled()
    expect(mocks.store.icons.upload).not.toHaveBeenCalled()
  })
})
