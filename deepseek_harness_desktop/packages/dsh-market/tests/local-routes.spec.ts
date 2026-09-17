import { createServer, request, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { once } from 'node:events'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { makeLocalWorkshopRoutes } from '../src/local-routes.ts'

let home: string
let server: Server
let origin: string
beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'dsh-local-routes-'))
  const routes = makeLocalWorkshopRoutes({ dshHome: home })
  server = createServer((req, res) => {
    const pathname = (req.url ?? '').split('?')[0]
    const route = routes.find(route => route.kind === 'exact' && route.path === pathname)
    if (route) { void route.handler(req, res); return }
    res.writeHead(404); res.end()
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  origin = 'http://127.0.0.1:' + (server.address() as AddressInfo).port
})
afterEach(async () => {
  server.closeAllConnections()
  await new Promise<void>(resolve => server.close(() => resolve()))
  rmSync(home, { recursive: true, force: true })
})

async function post(name: string, body: unknown): Promise<Response> {
  return await fetch(origin + '/api/workshop/' + name, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
}

describe('local Workshop guarded HTTP protocol', () => {
  it('uploads folder bytes, inspects, commits and returns the installed inventory', async () => {
    const start = await post('upload/start', { kind: 'skin', format: 'folder' })
    expect(start.status).toBe(200)
    const { uploadId } = await start.json() as { uploadId: string }
    const files = {
      'theme/skin.json': JSON.stringify({ skinManifestVersion: 2, id: 'own-theme', name: 'Own theme', nameEn: 'Own theme', author: 'Workshop tests', version: '1.0.0', contributes: { stylesheet: 'skin.css' } }),
      'theme/skin.css': 'body { color: blue; }',
    }
    for (const [path, content] of Object.entries(files)) {
      const response = await fetch(origin + '/api/workshop/upload/file?uploadId=' + uploadId + '&path=' + encodeURIComponent(path), { method: 'PUT', body: content })
      expect(response.status).toBe(200)
    }
    const inspection = await post('upload/inspect', { uploadId })
    expect(await inspection.json()).toMatchObject({ ok: true, preview: { id: 'own-theme', fileCount: 2, conflict: false } })
    const commit = await post('upload/commit', { uploadId })
    expect(await commit.json()).toMatchObject({ ok: true, resource: { id: 'own-theme', source: 'local', managed: true } })
    const list = await fetch(origin + '/api/workshop/resources')
    expect(list.headers.get('cache-control')).toBe('no-store')
    expect(await list.json()).toMatchObject({ ok: true, resources: [{ id: 'own-theme', status: 'available' }] })
  })

  it.each(['resources', 'upload/start', 'upload/file', 'upload/inspect', 'upload/commit', 'upload/discard'])('fences every endpoint against cross-origin requests: %s', async route => {
    const method = route === 'resources' ? 'GET' : route === 'upload/file' ? 'PUT' : 'POST'
    const response = await fetch(origin + '/api/workshop/' + route, { method, headers: { origin: 'https://unrelated.example' } })
    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ ok: false, error: 'loopback-only' })
  })

  it('rejects hostile Host and sec-fetch-site headers', async () => {
    for (const headers of [{ host: 'evil.example' }, { 'sec-fetch-site': 'cross-site' }]) {
      const status = await new Promise<number | undefined>((resolve, reject) => {
        const req = request(origin + '/api/workshop/resources', { headers }, res => { res.resume(); resolve(res.statusCode) })
        req.on('error', reject)
        req.end()
      })
      expect(status).toBe(403)
    }
  })

  it('validates method and JSON/category before creating uploads', async () => {
    expect((await fetch(origin + '/api/workshop/upload/start')).status).toBe(405)
    expect((await post('upload/start', { kind: 'unknown', format: 'folder' })).status).toBe(400)
    expect((await post('upload/start', ['skin', 'folder'])).status).toBe(400)
    const malformed = await fetch(origin + '/api/workshop/upload/start', { method: 'POST', body: '{bad' })
    expect(malformed.status).toBe(400)
  })

  it('rejects filesystem path uploads and makes discarded sessions unusable', async () => {
    const { uploadId } = await (await post('upload/start', { kind: 'skin', format: 'folder' })).json() as { uploadId: string }
    const bad = await fetch(origin + '/api/workshop/upload/file?uploadId=' + uploadId + '&path=..%2Foutside', { method: 'PUT', body: 'bad' })
    expect(bad.status).toBe(400)
    expect((await post('upload/discard', { uploadId })).status).toBe(200)
    expect((await post('upload/inspect', { uploadId })).status).toBe(404)
  })
})
