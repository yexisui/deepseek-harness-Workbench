import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CapabilityStore } from '../src/host/store.ts'
import { allowedActions, wasRevoked } from '../src/core/policy.ts'
import { emptyRole, latest, references, type Command } from '../src/core/model.ts'
import { writePresets } from '../src/host/presets.ts'

const stores: CapabilityStore[] = []
afterEach(async () => { for (const store of stores.splice(0)) await store.close() })
async function setup() {
  const store = new CapabilityStore(await mkdtemp(join(tmpdir(), 'dsh-capability-removal-')))
  await store.init(); stores.push(store); return store
}
const send = (store: CapabilityStore, command: Command) => store.command(store.snapshot().revision, command)
const binding = { capabilityId: 'browser', version: 1, enabled: true }
async function createRole(store: CapabilityStore) {
  return send(store, { type: 'role.save', definition: { ...emptyRole(), name: '有浏览器的岗位', capabilities: [binding] }, publish: true })
}

describe('recoverable capability removal', () => {
  it('persists removal without changing definitions, role references or immutable preset files', async () => {
    const store = await setup(), savedRole = await createRole(store), original = store.snapshot()
    const role = original.roles.find(r => r.id === savedRole.id)!, preset = latest(role.versions)!.preset
    await writePresets(store.directory, original)
    const path = join(store.directory, '.agent-presets', preset, 'agent.cordis.yml')
    const originalPreset = await readFile(path, 'utf8')
    await send(store, { type: 'capability.remove', id: 'browser' })
    const removed = store.snapshot(), cap = removed.capabilities[0]!
    expect(cap).toMatchObject({ id: 'browser', enabled: false, pinned: false, removedAt: expect.any(String) })
    expect(cap.draft).toEqual(original.capabilities[0]!.draft)
    expect(cap.versions).toEqual(original.capabilities[0]!.versions)
    expect(removed.roles).toEqual(original.roles)
    expect(references(removed, 'browserskill').roles.map(r => r.id)).toContain(savedRole.id)
    await writePresets(store.directory, removed)
    expect(await readFile(path, 'utf8')).toBe(originalPreset)
    await store.close()
    const reopened = new CapabilityStore(store.directory); await reopened.init(); stores.push(reopened)
    expect(reopened.snapshot()).toEqual(removed)
  })

  it('restores configuration as disabled and retains old session revocations across restart and re-enable', async () => {
    const store = await setup(), savedRole = await createRole(store)
    const snapshot = latest(savedRole.state.roles.find(r => r.id === savedRole.id)!.versions)!
    await send(store, { type: 'capability.remove', id: 'browser' })
    const removed = store.snapshot(), revokedAt = removed.revokedAt!['capability:browser']!
    expect(allowedActions(removed, savedRole.id, snapshot)).toEqual([])
    // The marker itself denies authorization even if a caller supplies an inconsistent in-memory state.
    removed.capabilities[0]!.enabled = true
    expect(allowedActions(removed, savedRole.id, snapshot)).toEqual([])
    await send(store, { type: 'capability.restore', id: 'browser' })
    const restored = store.snapshot()
    expect(restored.capabilities[0]!.removedAt).toBeUndefined()
    expect(restored.capabilities[0]!.enabled).toBe(false)
    expect(restored.capabilities[0]!.pinned).toBe(false)
    expect(allowedActions(restored, savedRole.id, snapshot)).toEqual([])
    expect(restored.revokedAt!['capability:browser']).toBe(revokedAt)
    await store.close()
    const reopened = new CapabilityStore(store.directory); await reopened.init(); stores.push(reopened)
    expect(reopened.snapshot()).toEqual(restored)
    await send(reopened, { type: 'capability.toggle', id: 'browser', enabled: true })
    expect(allowedActions(reopened.snapshot(), savedRole.id, snapshot)).toEqual(['navigate', 'read', 'screenshot'])
    expect(wasRevoked(reopened.snapshot(), savedRole.id, snapshot, revokedAt - 100)).toBe(true)
    expect(wasRevoked(reopened.snapshot(), savedRole.id, snapshot, revokedAt + 100)).toBe(false)
  })

  it('rejects edits, copy, pin and toggles while removed without modifying stored state', async () => {
    const store = await setup()
    await send(store, { type: 'capability.remove', id: 'browser' })
    const before = store.snapshot()
    const commands: Command[] = [
      { type: 'capability.save', id: 'browser', definition: { ...before.capabilities[0]!.draft, name: '覆盖编辑' }, publish: true },
      { type: 'capability.copy', id: 'browser' },
      { type: 'capability.toggle', id: 'browser', enabled: true },
      { type: 'capability.toggle', id: 'browser', enabled: false },
      { type: 'capability.pin', id: 'browser', pinned: true },
    ]
    for (const command of commands) {
      await expect(send(store, command)).rejects.toThrow('先恢复')
      expect(store.snapshot()).toEqual(before)
    }
    await expect(send(store, { type: 'capability.remove', id: 'browser' })).rejects.toThrow('已移除')
    await expect(send(store, { type: 'capability.restore', id: 'missing' })).rejects.toThrow('不存在')
    await send(store, { type: 'capability.restore', id: 'browser' })
    await expect(send(store, { type: 'capability.restore', id: 'browser' })).rejects.toThrow('无需恢复')
    await expect(send(store, { type: 'capability.remove', id: 'missing' })).rejects.toThrow('不存在')
  })

  it('blocks new removed bindings while allowing existing roles to retain or detach them', async () => {
    const store = await setup(), savedRole = await createRole(store)
    await send(store, { type: 'capability.remove', id: 'browser' })
    await expect(createRole(store)).rejects.toThrow('不能添加已移除')
    const existing = store.snapshot().roles.find(r => r.id === savedRole.id)!
    await send(store, { type: 'role.save', id: existing.id, definition: { ...existing.draft, name: '仍可编辑原有岗位' }, publish: true })
    const unchangedBinding = latest(store.snapshot().roles.find(r => r.id === existing.id)!.versions)!.capabilities
    expect(unchangedBinding).toEqual([binding])
    await send(store, { type: 'role.save', id: existing.id, definition: { ...existing.draft, capabilities: [] }, publish: true })
    await expect(send(store, { type: 'role.save', id: existing.id, definition: existing.draft, publish: false })).rejects.toThrow('不能添加已移除')
    expect(store.snapshot().roles.find(r => r.id === existing.id)!.versions[0]!.capabilities).toEqual([binding])
  })

  it.each(['not-a-date', 123, null, ''])('rejects malformed persisted removal marker %j without replacing the file', async marker => {
    const store = await setup(), state = store.snapshot()
    await store.close()
    const corrupt = { ...state, capabilities: state.capabilities.map(cap => ({ ...cap, enabled: false, pinned: false, removedAt: marker })) }
    const path = join(store.directory, 'state.json'), raw = JSON.stringify(corrupt)
    await writeFile(path, raw)
    const reopened = new CapabilityStore(store.directory)
    await expect(reopened.init()).rejects.toThrow('Invalid removed capability data')
    expect(await readFile(path, 'utf8')).toBe(raw)
  })

  it('rejects enabled removed capabilities from disk', async () => {
    const store = await setup(), state = store.snapshot()
    await store.close()
    state.capabilities[0]!.removedAt = new Date().toISOString()
    const path = join(store.directory, 'state.json')
    await writeFile(path, JSON.stringify(state))
    await expect(new CapabilityStore(store.directory).init()).rejects.toThrow('Invalid removed capability data')
  })
})
