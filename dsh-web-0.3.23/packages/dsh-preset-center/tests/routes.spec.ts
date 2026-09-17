/**
 * Preset-center gateway contract over a real loopback server: state, the
 * enable confirmation gate, the reserved-id and default-preset refusals, and
 * the broken-preset rollback.
 */

import { createHash } from 'node:crypto'
import { createServer, type Server } from 'node:http'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { AgentPresets } from '@deepseek-ai/dsh-agent-presets'
import { makePresetCenterRoutes } from '../src/routes.ts'
import { ENABLED_DIR, LIBRARY_DIR, PROVENANCE_FILENAME } from '../src/core/paths.ts'

let home: string
let server: Server
let port: number
let rosterRows: { id: string; trust: 'system' | 'user'; path: string; broken?: string }[]
let defaultId: string
let rosterAvailable: boolean

/** Write one workshop-installed preset into the library. */
function writeLibraryPreset(id: string, composition = '- id: persona\n  name: "@deepseek-ai/dsh-persona"\n'): void {
  const dir = join(home, LIBRARY_DIR, id)
  mkdirSync(dir, { recursive: true })
  const files: Record<string, string> = { 'agent.cordis.yml': composition, 'preset.yml': 'name: ' + id + '\n' }
  const hashes: Record<string, string> = {}
  for (const [rel, text] of Object.entries(files)) {
    writeFileSync(join(dir, rel), text)
    hashes[rel] = createHash('sha256').update(text).digest('hex')
  }
  writeFileSync(join(dir, PROVENANCE_FILENAME), JSON.stringify({
    version: 1, source: 'https://dsh-market.com', kind: 'preset', id,
    installedAt: '2026-09-09T00:00:00.000Z', assetVersion: '1.0.0', files: hashes,
  }, null, 2) + '\n')
}

const fakeRoster = (): AgentPresets => ({
  list: async () => rosterAvailable ? rosterRows : Promise.reject(new Error('unavailable')),
  defaultId,
}) as unknown as AgentPresets

async function call(path: string, init?: RequestInit): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch('http://127.0.0.1:' + port + path, init)
  const body = await res.json().catch(() => ({})) as Record<string, unknown>
  return { status: res.status, body }
}

function post(path: string, payload: unknown): Promise<{ status: number; body: Record<string, unknown> }> {
  return call(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
}

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'dsh-preset-center-routes-'))
  rosterRows = [{ id: 'ptc', trust: 'system', path: '/harness/presets/ptc' }]
  defaultId = 'ptc'
  rosterAvailable = true
  const routes = makePresetCenterRoutes({ dshHome: home, roster: fakeRoster })
  server = createServer((req, res) => {
    const pathname = (req.url ?? '/').split('?')[0]!
    for (const route of routes) {
      if (route.kind === 'exact' && pathname === route.path) {
        void route.handler(req, res)
        return
      }
    }
    res.writeHead(404)
    res.end()
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  port = (server.address() as AddressInfo).port
})

afterEach(async () => {
  server.close()
  await once(server, 'close')
  rmSync(home, { recursive: true, force: true })
})

describe('preset-center routes', () => {
  it('reports library state, the roster default and occupied ids', async () => {
    writeLibraryPreset('demo')
    const { status, body } = await call('/api/preset-center/state')
    expect(status).toBe(200)
    expect(body.defaultId).toBe('ptc')
    expect(body.occupied).toEqual(['ptc'])
    expect(body.rosterAvailable).toBe(true)
    const presets = body.presets as { id: string; installed: boolean; enabled: boolean; profile: { codeExecution: string } }[]
    expect(presets).toHaveLength(1)
    expect(presets[0]).toMatchObject({ id: 'demo', installed: true, enabled: false })
    expect(presets[0]!.profile.codeExecution).toBe('none')
  })

  it('requires an explicit confirmation before enabling executable content', async () => {
    writeLibraryPreset('demo', '- id: hook\n  name: ./hook.mjs\n')
    writeFileSync(join(home, LIBRARY_DIR, 'demo', 'hook.mjs'), 'export const x = 1\n')
    const refused = await post('/api/preset-center/enable', { id: 'demo' })
    expect(refused.status).toBe(409)
    expect(refused.body.error).toBe('confirmation-required')
    expect(existsSync(join(home, ENABLED_DIR, 'demo'))).toBe(false)

    const allowed = await post('/api/preset-center/enable', { id: 'demo', confirm: true })
    expect(allowed.status).toBe(200)
    expect(existsSync(join(home, ENABLED_DIR, 'demo', 'agent.cordis.yml'))).toBe(true)
  })

  it('enables a clean preset without a confirmation and disables it again', async () => {
    writeLibraryPreset('demo')
    const enabled = await post('/api/preset-center/enable', { id: 'demo' })
    expect(enabled.status).toBe(200)
    expect((enabled.body.state as { enabled: boolean }).enabled).toBe(true)

    const disabled = await post('/api/preset-center/disable', { id: 'demo' })
    expect(disabled.status).toBe(200)
    expect(existsSync(join(home, LIBRARY_DIR, 'demo', 'agent.cordis.yml'))).toBe(true)
  })

  it('refuses to enable an id another root already supplies', async () => {
    writeLibraryPreset('ptc')
    const { status, body } = await post('/api/preset-center/enable', { id: 'ptc' })
    expect(status).toBe(409)
    expect(body.error).toBe('shadowed')
    expect(existsSync(join(home, ENABLED_DIR, 'ptc'))).toBe(false)
  })

  it('refuses to disable or uninstall the current default preset', async () => {
    writeLibraryPreset('demo')
    await post('/api/preset-center/enable', { id: 'demo' })
    defaultId = 'demo'
    const disabled = await post('/api/preset-center/disable', { id: 'demo' })
    expect(disabled.status).toBe(409)
    expect(disabled.body.error).toBe('default-preset')
    const removed = await post('/api/preset-center/uninstall', { id: 'demo' })
    expect(removed.status).toBe(409)
    expect(existsSync(join(home, ENABLED_DIR, 'demo'))).toBe(true)
  })

  it('rolls an enable back when the roster reports the preset broken', async () => {
    writeLibraryPreset('demo')
    rosterRows = [...rosterRows, { id: 'demo', trust: 'user', path: join(home, ENABLED_DIR, 'demo'), broken: 'row names a missing module' }]
    const { status, body } = await post('/api/preset-center/enable', { id: 'demo' })
    expect(status).toBe(409)
    expect(body.error).toBe('broken')
    expect(body.message).toContain('missing module')
    expect(existsSync(join(home, ENABLED_DIR, 'demo'))).toBe(false)
    expect(existsSync(join(home, LIBRARY_DIR, 'demo', 'agent.cordis.yml'))).toBe(true)
  })

  it('answers 503 when the roster service is unavailable', async () => {
    writeLibraryPreset('demo')
    rosterAvailable = false
    const { status, body } = await post('/api/preset-center/enable', { id: 'demo' })
    expect(status).toBe(503)
    expect(body.error).toBe('roster-unavailable')
  })

  it('rejects unknown ids and non-GET/POST methods', async () => {
    expect((await post('/api/preset-center/enable', { id: 'Bad_Id' })).body.error).toBe('invalid-id')
    expect((await post('/api/preset-center/disable', {})).body.error).toBe('invalid-id')
    expect((await post('/api/preset-center/state', {})).status).toBe(405)
    expect((await call('/api/preset-center/nope')).status).toBe(404)
  })

  it('serves the composition text and the profile', async () => {
    writeLibraryPreset('demo')
    const { status, body } = await call('/api/preset-center/composition?id=demo')
    expect(status).toBe(200)
    expect(String(body.text)).toContain('@deepseek-ai/dsh-persona')
    expect((body.profile as { plugins: string[] }).plugins).toEqual(['@deepseek-ai/dsh-persona'])
    expect((await call('/api/preset-center/composition?id=ghost')).status).toBe(404)
  })
})
