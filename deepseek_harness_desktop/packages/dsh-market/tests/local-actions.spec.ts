import { createHash } from 'node:crypto'
import { once } from 'node:events'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeLocalActionRoutes } from '../src/local-actions.ts'
import { localResourceDir } from '../src/core/local-import.ts'
import type { LocalKind } from '../src/core/local-types.ts'
import { makePresetCenterRoutes } from '../../dsh-preset-center/src/routes.ts'
import { readPresetState } from '../../dsh-preset-center/src/core/library.ts'
import { verifyLocalSkinHooks } from '../../skins/skin-center/src/provenance.ts'
import { LOCAL_IMPORT_RECORD, localTrustPath } from '../../../shared/host/local-resource-trust.ts'
import { registerWorkshopServiceRoutes, type WorkshopServiceRoute } from '../../../shared/host/workshop-services.ts'

let home: string
let server: Server
let base: string
let dispose: () => void
let rosterDefault = 'standard'
let installed: Array<{ id: string; enabled: boolean }> = []
let calls: Array<{ path: string; body?: Record<string, unknown> }> = []
let jobPhase = 'running'

function resource(kind: LocalKind, id: string, files: Record<string, string>): string {
  const dir = localResourceDir(home, kind, id)
  mkdirSync(dir, { recursive: true })
  const hashes: Record<string, string> = {}
  for (const [rel, data] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true })
    writeFileSync(join(dir, rel), data)
    hashes[rel] = createHash('sha256').update(data).digest('hex')
  }
  writeFileSync(join(dir, LOCAL_IMPORT_RECORD), JSON.stringify({ version: 1, source: 'local-import', kind, id, name: id, importedAt: '2026-09-17T00:00:00Z', files: hashes }))
  return dir
}

function fakePluginRoute(path: string, fn: (body: Record<string, unknown>) => unknown): WorkshopServiceRoute {
  return { kind: 'exact', path, handler: async (req, res) => {
    const parts = []
    for await (const part of req) parts.push(part)
    const body = parts.length ? JSON.parse(Buffer.concat(parts).toString()) as Record<string, unknown> : {}
    calls.push({ path, body })
    res.writeHead(200)
    res.end(JSON.stringify(fn(body)))
  } }
}

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'workshop-actions-'))
  installed = []
  calls = []
  rosterDefault = 'standard'
  jobPhase = 'running'
  const roster = {
    get defaultId() { return rosterDefault },
    list: vi.fn(async () => [{ id: 'standard', path: join(home, 'official', 'standard') }]),
  }
  const managerRoutes = [
    ...makePresetCenterRoutes({ dshHome: home, roster: () => roster as never }),
    fakePluginRoute('/api/plugin-manager/list', () => ({ plugins: installed })),
    fakePluginRoute('/api/plugin-manager/install', () => ({ jobId: 'test-install-job' })),
    fakePluginRoute('/api/plugin-manager/status', () => ({ job: { phase: jobPhase } })),
    fakePluginRoute('/api/plugin-manager/set-enabled', () => ({ plugin: installed[0] })),
  ]
  dispose = registerWorkshopServiceRoutes(home, managerRoutes)
  const routes = makeLocalActionRoutes({ dshHome: home })
  server = createServer((req, res) => { void routes[0].handler(req, res) })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/workshop/action`
})

afterEach(async () => {
  dispose()
  await new Promise<void>(resolve => server.close(() => resolve()))
  rmSync(home, { recursive: true, force: true })
})

async function action(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  const response = await fetch(base, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', ...headers } })
  return { status: response.status, body: await response.json() as Record<string, unknown> }
}

describe('local Workshop lifecycle', () => {
  it('refuses cross-origin calls, unsafe ids, and unmanaged resources', async () => {
    expect((await action({ kind: 'skin', id: 'demo', action: 'remove' }, { origin: 'https://elsewhere.example' })).status).toBe(403)
    expect((await action({ kind: 'skin', id: '../elsewhere', action: 'remove' })).status).toBe(400)
    expect((await action({ kind: 'skin', id: 'demo', action: 'remove' })).body.error).toBe('not-managed')
    expect((await action({ kind: 'plugin', id: '@deepseek-ai/dsh', action: 'install', confirmCode: true })).body.error).toBe('protected-resource')
  })

  it('requires script consent and binds skin trust to every file of this import', async () => {
    const dir = resource('skin', 'demo', { 'skin.json': '{}', 'hooks.mjs': 'export const onActivate = () => {}', 'skin.css': 'body {}' })
    expect(verifyLocalSkinHooks(dir, 'demo')).toBe(false)
    expect((await action({ kind: 'skin', id: 'demo', action: 'trust' })).body.error).toBe('confirmation-required')
    expect((await action({ kind: 'skin', id: 'demo', action: 'trust', confirmCode: true })).status).toBe(200)
    expect(existsSync(localTrustPath(home, 'skin', 'demo'))).toBe(true)
    expect(verifyLocalSkinHooks(dir, 'demo')).toBe(true)
    writeFileSync(join(dir, 'skin.css'), 'body { opacity: 0 }')
    expect(verifyLocalSkinHooks(dir, 'demo')).toBe(false)
    expect((await action({ kind: 'skin', id: 'demo', action: 'trust', confirmCode: true })).body.error).toBe('resource-modified')
  })

  it('does not trust unrecorded executable additions or bundled trust JSON', async () => {
    const dir = resource('skin', 'demo', { 'skin.json': '{}', 'hooks.mjs': '', 'consent.json': '{"trusted":true}' })
    expect(verifyLocalSkinHooks(dir, 'demo')).toBe(false)
    await action({ kind: 'skin', id: 'demo', action: 'trust', confirmCode: true })
    writeFileSync(join(dir, '.injected.js'), 'unexpected()')
    expect(verifyLocalSkinHooks(dir, 'demo')).toBe(false)
    expect((await action({ kind: 'skin', id: 'demo', action: 'remove' })).body.error).toBe('resource-modified')
  })

  it('backs up inactive resources and refuses to remove active skins or pets', async () => {
    const dir = resource('skin', 'demo', { 'skin.json': '{}' })
    writeFileSync(join(home, 'skin-center-active.json'), JSON.stringify({ active: 'demo' }))
    expect((await action({ kind: 'skin', id: 'demo', action: 'remove' })).body.error).toBe('resource-active')
    writeFileSync(join(home, 'skin-center-active.json'), JSON.stringify({ active: null }))
    expect((await action({ kind: 'skin', id: 'demo', action: 'remove' })).status).toBe(200)
    expect(existsSync(dir)).toBe(false)
    const backups = readdirSync(join(home, 'workshop', 'backups'))
    expect(readFileSync(join(home, 'workshop', 'backups', backups[0], 'skin.json'), 'utf8')).toBe('{}')
    resource('pet', 'demo', { 'pet.json': '{}' })
    writeFileSync(join(home, 'pet.json'), JSON.stringify({ petId: 'demo' }))
    expect((await action({ kind: 'pet', id: 'demo', action: 'remove' })).body.error).toBe('resource-active')
  })

  it('uses preset roster guards and moves local presets through the existing library', async () => {
    resource('preset', 'demo', { 'preset.yml': 'name: demo\n', 'agent.cordis.yml': '[]\n' })
    expect(readPresetState(home, 'demo').managed).toBe(true)
    expect((await action({ kind: 'preset', id: 'demo', action: 'enable' })).body.error).toBe('confirmation-required')
    expect((await action({ kind: 'preset', id: 'demo', action: 'enable', confirmCode: true })).status).toBe(200)
    expect(readPresetState(home, 'demo').enabled).toBe(true)
    expect((await action({ kind: 'preset', id: 'demo', action: 'remove' })).body.error).toBe('resource-active')
    rosterDefault = 'demo'
    expect((await action({ kind: 'preset', id: 'demo', action: 'disable' })).body.error).toBe('default-preset')
    rosterDefault = 'standard'
    expect((await action({ kind: 'preset', id: 'demo', action: 'disable' })).status).toBe(200)
    expect(readPresetState(home, 'demo').installed).toBe(true)
    expect((await action({ kind: 'preset', id: 'demo', action: 'remove' })).status).toBe(200)
  })

  it('refuses changed presets and occupied official preset identities', async () => {
    const dir = resource('preset', 'demo', { 'preset.yml': 'name: demo\n', 'agent.cordis.yml': '[]\n' })
    writeFileSync(join(dir, 'agent.cordis.yml'), '- name: ./run.js\n')
    expect((await action({ kind: 'preset', id: 'demo', action: 'enable', confirmCode: true })).body.error).toBe('resource-modified')
    resource('preset', 'standard', { 'preset.yml': 'name: standard\n', 'agent.cordis.yml': '[]\n' })
    expect((await action({ kind: 'preset', id: 'standard', action: 'enable', confirmCode: true })).body.error).toBe('shadowed')
  })

  it('passes only a host-owned snapshot to the shared installer and returns its real job id', async () => {
    const dir = resource('plugin', '@mine/demo', { 'package.json': '{"name":"@mine/demo"}', 'lib/index.js': 'export const name = "demo"' })
    expect((await action({ kind: 'plugin', id: '@mine/demo', action: 'install' })).body.error).toBe('confirmation-required')
    expect(calls.some(call => call.path.endsWith('/install'))).toBe(false)
    const result = await action({ kind: 'plugin', id: '@mine/demo', action: 'install', confirmCode: true, path: 'C:/arbitrary' })
    expect(result.body).toMatchObject({ ok: true, jobId: 'test-install-job', requiresRestart: true })
    const spec = calls.find(call => call.path.endsWith('/install'))?.body?.spec as string
    expect(spec.startsWith(`file:${join(home, 'workshop', 'install-snapshots')}`)).toBe(true)
    expect(readFileSync(join(spec.slice(5), 'lib/index.js'), 'utf8')).toBe('export const name = "demo"')
    writeFileSync(join(dir, 'lib/index.js'), 'changed library')
    expect(readFileSync(join(spec.slice(5), 'lib/index.js'), 'utf8')).toBe('export const name = "demo"')
  })

  it('refuses reinstall and imported-copy removal while the plugin is installed', async () => {
    resource('plugin', 'my-plugin', { 'package.json': '{"name":"my-plugin"}', 'lib/index.js': '' })
    installed = [{ id: 'my-plugin', enabled: false }]
    expect((await action({ kind: 'plugin', id: 'my-plugin', action: 'install', confirmCode: true })).body.error).toBe('already-installed')
    expect((await action({ kind: 'plugin', id: 'my-plugin', action: 'remove' })).body.error).toBe('resource-installed')
  })

  it('blocks changes while a plugin job is queued, then delegates enabled state to the same manager', async () => {
    resource('plugin', 'my-plugin', { 'package.json': '{"name":"my-plugin"}', 'lib/index.js': '' })
    await action({ kind: 'plugin', id: 'my-plugin', action: 'install', confirmCode: true })
    expect((await action({ kind: 'plugin', id: 'my-plugin', action: 'remove' })).body.error).toBe('resource-busy')
    expect((await action({ kind: 'plugin', id: 'my-plugin', action: 'install', confirmCode: true })).body.error).toBe('resource-busy')
    jobPhase = 'done'
    installed = [{ id: 'my-plugin', enabled: true }]
    expect((await action({ kind: 'plugin', id: 'my-plugin', action: 'disable' })).body).toMatchObject({ ok: true, requiresRestart: true })
    expect(calls.find(call => call.path.endsWith('/set-enabled'))?.body).toEqual({ id: 'my-plugin', enabled: false })
  })

  it('refuses unsafe paths hidden in an ownership record', async () => {
    const dir = resource('skin', 'demo', { 'skin.json': '{}' })
    const file = join(dir, LOCAL_IMPORT_RECORD)
    const record = JSON.parse(readFileSync(file, 'utf8'))
    record.files['../outside.js'] = '0'.repeat(64)
    writeFileSync(file, JSON.stringify(record))
    expect((await action({ kind: 'skin', id: 'demo', action: 'trust', confirmCode: true })).body.error).toBe('not-managed')
    expect(verifyLocalSkinHooks(dir, 'demo')).toBe(false)
  })
})
