import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CapabilityStore } from '../src/host/store.ts'
import { allowedActions, callViolation, roleForPreset, wasRevoked } from '../src/core/policy.ts'
import { emptyRole, latest, references } from '../src/core/model.ts'
import { writePresets } from '../src/host/presets.ts'
const stores: CapabilityStore[] = []
afterEach(async () => { for (const store of stores.splice(0)) await store.close() })
async function setup() { const store = new CapabilityStore(await mkdtemp(join(tmpdir(), 'dsh-capabilities-'))); await store.init(); stores.push(store); return store }
async function role(store: CapabilityStore) { return store.command(store.snapshot().revision, { type: 'role.save', definition: { ...emptyRole(), name: '网页助手', capabilities: [{ capabilityId: 'browser', version: 1, enabled: true }] }, publish: true }) }
describe('durable capability definitions', () => {
  it('restores definitions, drafts and immutable role versions after restart', async () => {
    const store = await setup(), result = await role(store), original = store.snapshot()
    await writePresets(store.directory, original)
    const preset = latest(original.roles[0]!.versions)!.preset
    const source = await readFile(join(store.directory, '.agent-presets', preset, 'agent.cordis.yml'), 'utf8')
    expect(JSON.parse(source)[1].name).toBe('@linxin666/dsh-capabilities/policy')
    await store.command(result.state.revision, { type: 'role.save', id: result.id, definition: { ...original.roles[0]!.draft, name: '下一版' }, publish: true })
    expect(store.snapshot().roles[0]!.versions[0]!.name).toBe('网页助手')
    await store.close(); const reopened = new CapabilityStore(store.directory); await reopened.init(); stores.push(reopened)
    expect(reopened.snapshot().roles[0]!.versions).toHaveLength(2)
    expect(roleForPreset(reopened.snapshot(), preset)?.version.name).toBe('网页助手')
  })
  it('rejects racing stale writes without losing either existing configuration or the successful write', async () => {
    const store = await setup(), rev = store.snapshot().revision
    const values = await Promise.allSettled([store.command(rev, { type: 'capability.pin', id: 'browser', pinned: false }), store.command(rev, { type: 'capability.toggle', id: 'browser', enabled: false })])
    expect(values.map(v => v.status)).toEqual(['fulfilled', 'rejected'])
    expect(store.snapshot().capabilities[0]!.enabled).toBe(true)
    expect(store.snapshot().revision).toBe(1)
  })
  it('keeps unavailable drafts but rejects unadapted plugins, nested composition and expanded role overrides', async () => {
    const store = await setup(), base = store.snapshot().capabilities[0]!.draft
    await store.command(0, { type: 'capability.save', definition: { ...base, components: [] }, publish: false })
    await expect(store.command(1, { type: 'capability.save', definition: { ...base, components: [{ componentId: 'random-plugin', actions: ['read'] }] }, publish: false })).rejects.toThrow('尚未适配')
    await expect(store.command(1, { type: 'role.save', definition: { ...emptyRole(), name: 'bad', capabilities: [{ capabilityId: 'browser', version: 1, enabled: true, actions: ['submit'] }] }, publish: true })).rejects.toThrow('缩小权限')
  })
  it('copies only a draft and never overwrites the original or silently adopts a new version', async () => {
    const store = await setup(); await role(store)
    const before = store.snapshot(), copy = await store.command(before.revision, { type: 'capability.copy', id: 'browser' })
    expect(copy.state.capabilities.find(c => c.id === copy.id)!.versions).toEqual([])
    await store.command(copy.state.revision, { type: 'capability.save', id: 'browser', definition: { ...before.capabilities[0]!.draft, name: 'Browser v2' }, publish: true })
    expect(latest(store.snapshot().roles[0]!.versions)!.capabilities[0]!.version).toBe(1)
    expect(references(store.snapshot(), 'browserskill').roles).toHaveLength(1)
  })
  it('rejects a second writer and never replaces a corrupt store with empty defaults', async () => {
    const store = await setup(), second = new CapabilityStore(store.directory)
    await expect(second.init()).rejects.toThrow('锁定')
    await store.close(); await writeFile(join(store.directory, 'state.json'), '{invalid')
    await expect(second.init()).rejects.toThrow()
    expect(await readFile(join(store.directory, 'state.json'), 'utf8')).toBe('{invalid')
  })
})
describe('monotonic role authorization', () => {
  it('keeps unloaded historical sessions revoked after disable and re-enable while allowing a new conversation', async () => {
    const store = await setup(), result = await role(store), snapshot = result.state.roles[0]!.versions[0]!
    await store.command(1, { type: 'capability.toggle', id: 'browser', enabled: false })
    await store.command(2, { type: 'capability.toggle', id: 'browser', enabled: true })
    const revokedAt = store.snapshot().revokedAt!['capability:browser']!
    expect(wasRevoked(store.snapshot(), result.id, snapshot, revokedAt - 100)).toBe(true)
    expect(wasRevoked(store.snapshot(), result.id, snapshot, revokedAt + 100)).toBe(false)
  })
  it('persists explicit stops and never restores permissions to old snapshots after a revoke and re-grant', async () => {
    const store = await setup(), result = await role(store), snapshot = result.state.roles[0]!.versions[0]!, base = result.state.capabilities[0]!.draft
    await store.revokeSession('qa-stopped')
    await store.command(1, { type: 'capability.save', id: 'browser', definition: { ...base, components: [{ componentId: 'browserskill', actions: ['read'] }] }, publish: true })
    await store.command(2, { type: 'capability.save', id: 'browser', definition: base, publish: true })
    expect(allowedActions(store.snapshot(), result.id, snapshot)).toEqual(['read'])
    await store.close()
    const restored = new CapabilityStore(store.directory); await restored.init(); stores.push(restored)
    expect(restored.snapshot().stoppedSessions).toContain('qa-stopped')
    expect(allowedActions(restored.snapshot(), result.id, snapshot)).toEqual(['read'])
  })
  it('revokes existing sessions immediately and does not grant newly published actions to old roles', async () => {
    const store = await setup(), result = await role(store), old = result.state.roles[0]!.versions[0]!
    const base = result.state.capabilities[0]!.draft
    await store.command(1, { type: 'capability.save', id: 'browser', definition: { ...base, components: [{ componentId: 'browserskill', actions: ['read'] }] }, publish: true })
    expect(allowedActions(store.snapshot(), result.id, old)).toEqual(['read'])
    await store.command(2, { type: 'capability.toggle', id: 'browser', enabled: false })
    expect(allowedActions(store.snapshot(), result.id, old)).toEqual([])
    expect(store.snapshot().roles[0]!.versions).toHaveLength(1)
  })
  it('refuses cross-session targets, implicit current session, hidden write actions, tab overrides and URL execution', () => {
    const allowed = ['navigate', 'read', 'screenshot'] as const
    for (const [name, args] of [
      ['browser_page', { action: 'navigate', session: 'foreign', url: 'https://example.com' }],
      ['browser_inspect', { action: 'observe' }], ['browser_interact', { action: 'fill', session: 'own' }],
      ['browser_inspect', { action: 'html', session: 'own', tabId: 3 }],
      ['browser_page', { action: 'navigate', session: 'own', url: 'javascript:alert(1)' }],
    ] as const) expect(callViolation(name, args, [...allowed], ['own'])).toBeTruthy()
    expect(callViolation('browser_inspect', { action: 'observe', session: 'own' }, ['read'], ['own'])).toBeUndefined()
    expect(callViolation('browser_session', { action: 'start', url: 'https://example.com' }, ['read'], [])).toBeTruthy()
  })
})
