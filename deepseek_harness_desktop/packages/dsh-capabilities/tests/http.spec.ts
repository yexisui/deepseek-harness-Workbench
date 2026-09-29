import { describe, it, expect } from 'vitest'
import { fence } from '../src/host/http.ts'
import type { IncomingMessage } from 'node:http'
describe('local capability mutation fence', () => {
  const req = (headers: Record<string, string | undefined>, method = 'POST') => ({ method, headers: { host: '127.0.0.1:3888', 'content-type': 'application/json', ...headers } }) as IncomingMessage
  it('rejects cross-origin, null-origin, form posts and rebound hostnames', () => {
    for (const headers of [{ origin: 'https://example.com' }, { origin: 'null' }, { 'content-type': 'text/plain' }, { host: 'evil.example' }, { 'sec-fetch-site': 'cross-site' }]) expect(() => fence(req(headers))).toThrow()
    expect(() => fence(req({ origin: 'http://127.0.0.1:3888' }))).not.toThrow()
  })
})
