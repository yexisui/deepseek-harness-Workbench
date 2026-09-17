import { Readable } from 'node:stream'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { makeGatewayRoutes } from '../src/host/routes.ts'
import type { CliGateway } from '../src/host/gateway.ts'
import type { ProfileFacts } from '../src/host/profile.ts'

afterEach(() => vi.unstubAllGlobals())
function request(remote = false): IncomingMessage {
  const req = Readable.from([Buffer.from('{"id":"example-plugin"}')]) as unknown as IncomingMessage
  req.socket = { remoteAddress: remote ? '192.168.1.2' : '127.0.0.1' } as IncomingMessage['socket']
  req.headers = { host: '127.0.0.1:3082' }
  req.method = 'POST'
  return req
}

describe('removed plugin update endpoints', () => {
  it.each(['/update', '/check-updates'])('rejects %s without registry access, version probes or a CLI job', async endpoint => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const update = vi.fn(), migrate = vi.fn(), cliAvailable = vi.fn()
    const routes = makeGatewayRoutes({ facts: {} as ProfileFacts, gateway: { update, migrate } as unknown as CliGateway, cliAvailable })
    const handler = routes.find(route => route.path === '/api/plugin-manager' + endpoint)!.handler
    let status = 0, body = ''
    const res = { writeHead(code: number) { status = code }, end(text: string) { body = text } } as unknown as ServerResponse
    await handler(request(), res)
    expect(status).toBe(410)
    expect(JSON.parse(body).error).toContain('updates are disabled')
    expect(fetch).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
    expect(migrate).not.toHaveBeenCalled()
    expect(cliAvailable).not.toHaveBeenCalled()
    await handler(request(true), res)
    expect(status).toBe(403)
  })
})
