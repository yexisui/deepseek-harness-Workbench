import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CapabilityStore } from '../src/host/store.ts'
import { capabilityDeletionReferences, emptyRole, latest, type Command } from '../src/core/model.ts'
import { wasRevoked } from '../src/core/policy.ts'
import { writePresets } from '../src/host/presets.ts'

const stores: CapabilityStore[] = []
afterEach(async () => { for (const store of stores.splice(0)) await store.close() })
async function setup() {
  const store = new CapabilityStore(await mkdtemp(join(tmpdir(), 'dsh-recycle-bin-')))
  await store.init(); stores.push(store); return store
}
const send = (store: CapabilityStore, command: Command) => store.command(store.snapshot().revision, command)
const stateFile = (store: CapabilityStore) => readFile(join(store.directory, 'state.json'), 'utf8')
async function addCapability(store: CapabilityStore, publish = false) {
  const definition = { ...store.snapshot().capabilities[0]!.draft, name: '回收站测试能力' }
  return (await send(store, { type: 'capability.save', definition, publish })).id
}
async function remove(store: CapabilityStore, ids: string[]) {
  for (const id of ids) await send(store, { type: 'capability.remove', id })
}
async function addRole(store: CapabilityStore, publish = true) {
  return (await send(store, { type: 'role.save', definition: { ...emptyRole(), name: '引用能力的岗位', capabilities: [{ capabilityId: 'browser', version: 1, enabled: false }] }, publish })).id
}

describe('capability recycle bin', () => {
  it('counts each role once across drafts and every immutable version, including disabled bindings', async () => {
    const store = await setup(), historicalId = await addRole(store), draftId = await addRole(store, false)
    const role = store.snapshot().roles.find(role => role.id === historicalId)!
    await send(store, { type: 'role.save', id: role.id, definition: { ...role.draft, capabilities: [] }, publish: true })
    await send(store, { type: 'role.toggle', id: role.id, enabled: false })
    const before = store.snapshot()
    expect(capabilityDeletionReferences(before, 'browser').map(role => role.id)).toEqual([historicalId, draftId])
    expect(capabilityDeletionReferences(before, 'nonexistent')).toEqual([])
    expect(store.snapshot()).toEqual(before)
  })

  it('restores a batch in one revision while keeping it disabled and preserving prior session revocations', async () => {
    const store = await setup(), roleId = await addRole(store), copyId = await addCapability(store)
    await send(store, { type: 'capability.pin', id: copyId, pinned: true })
    await remove(store, ['browser', copyId])
    const removed = store.snapshot(), oldRole = latest(removed.roles.find(role => role.id === roleId)!.versions)!
    const result = await send(store, { type: 'capability.restoreMany', ids: ['browser', copyId] })
    expect(result.id).toBe('browser')
    expect(result.state.revision).toBe(removed.revision + 1)
    for (const cap of result.state.capabilities.filter(cap => ['browser', copyId].includes(cap.id))) {
      expect(cap.removedAt).toBeUndefined()
      expect(cap.enabled).toBe(false)
      expect(cap.pinned).toBe(false)
      const original = removed.capabilities.find(value => value.id === cap.id)!
      expect(cap.draft).toEqual(original.draft)
      expect(cap.versions).toEqual(original.versions)
    }
    expect(result.state.roles).toEqual(removed.roles)
    expect(result.state.revokedAt).toEqual(removed.revokedAt)
    // A disabled role binding still retains its configuration, but revocation must survive re-enabling it later.
    const enabledSnapshot = { ...oldRole, capabilities: oldRole.capabilities.map(binding => ({ ...binding, enabled: true })) }
    expect(wasRevoked(result.state, roleId, enabledSnapshot, removed.revokedAt!['capability:browser']! - 1)).toBe(true)
    await store.close()
    const reopened = new CapabilityStore(store.directory); await reopened.init(); stores.push(reopened)
    expect(reopened.snapshot()).toEqual(result.state)
  })

  it.each(['capability.restoreMany', 'capability.purge'] as const)('validates an entire %s batch before touching memory or disk', async type => {
    const store = await setup(), copyId = await addCapability(store)
    await remove(store, [copyId])
    const before = store.snapshot(), persisted = await stateFile(store)
    for (const ids of [[], [copyId, copyId], [copyId, 'invalid/id'], [copyId, 'missing'], [copyId, 'browser']]) {
      await expect(send(store, { type, ids })).rejects.toThrow()
      expect(store.snapshot()).toEqual(before)
      expect(await stateFile(store)).toBe(persisted)
    }
    await expect(store.command(before.revision, { type, ids: 'browser' })).rejects.toThrow('列表无效')
    expect(store.snapshot()).toEqual(before)
  })

  it('protects a draft-only reference and atomically rejects permanent deletion of a mixed batch', async () => {
    const store = await setup(), draftId = await addRole(store, false), freeId = await addCapability(store)
    await remove(store, ['browser', freeId])
    const before = store.snapshot(), persisted = await stateFile(store)
    expect(capabilityDeletionReferences(before, 'browser').map(role => role.id)).toEqual([draftId])
    await expect(send(store, { type: 'capability.purge', ids: [freeId, 'browser'] })).rejects.toThrow('岗位草稿或历史版本引用')
    expect(store.snapshot()).toEqual(before)
    expect(await stateFile(store)).toBe(persisted)
  })

  it('protects historical references after detachment from the current draft and version', async () => {
    const store = await setup(), roleId = await addRole(store), freeId = await addCapability(store)
    const role = store.snapshot().roles.find(role => role.id === roleId)!
    await send(store, { type: 'role.save', id: roleId, definition: { ...role.draft, capabilities: [] }, publish: true })
    await remove(store, ['browser', freeId])
    const before = store.snapshot()
    await writePresets(store.directory, before)
    const presetPath = join(store.directory, '.agent-presets', role.versions[0]!.preset, 'agent.cordis.yml')
    const preset = await readFile(presetPath, 'utf8')
    await expect(send(store, { type: 'capability.purge', ids: [freeId, 'browser'] })).rejects.toThrow('历史版本引用')
    expect(store.snapshot()).toEqual(before)
    await writePresets(store.directory, store.snapshot())
    expect(await readFile(presetPath, 'utf8')).toBe(preset)
  })

  it('permanently deletes unreferenced drafts and published capabilities durably without changing role presets', async () => {
    const store = await setup(), roleId = await addRole(store), draftId = await addCapability(store), publishedId = await addCapability(store, true)
    await remove(store, [draftId, publishedId])
    const before = store.snapshot(), role = before.roles.find(role => role.id === roleId)!
    await writePresets(store.directory, before)
    const paths = role.versions.map(version => join(store.directory, '.agent-presets', version.preset, 'agent.cordis.yml'))
    const originalPresets = await Promise.all(paths.map(path => readFile(path, 'utf8')))
    const result = await send(store, { type: 'capability.purge', ids: [draftId, publishedId] })
    expect(result.state.revision).toBe(before.revision + 1)
    expect(result.state.capabilities).toEqual(before.capabilities.filter(cap => cap.id !== draftId && cap.id !== publishedId))
    expect(result.state.roles).toEqual(before.roles)
    expect(result.state.revokedAt).toEqual(before.revokedAt)
    await writePresets(store.directory, result.state)
    expect(await Promise.all(paths.map(path => readFile(path, 'utf8')))).toEqual(originalPresets)
    await store.close()
    const reopened = new CapabilityStore(store.directory); await reopened.init(); stores.push(reopened)
    expect(reopened.snapshot()).toEqual(result.state)
    await expect(send(reopened, { type: 'capability.restoreMany', ids: [draftId] })).rejects.toThrow('不存在')
    await writePresets(store.directory, reopened.snapshot())
    expect(await Promise.all(paths.map(path => readFile(path, 'utf8')))).toEqual(originalPresets)
  })

  it('applies optimistic revisions to competing batch commands without losing the successful result', async () => {
    const store = await setup(), copyId = await addCapability(store)
    await remove(store, ['browser', copyId])
    const before = store.snapshot()
    const results = await Promise.allSettled([
      store.command(before.revision, { type: 'capability.restoreMany', ids: ['browser'] }),
      store.command(before.revision, { type: 'capability.purge', ids: [copyId] }),
    ])
    expect(results[0]!.status).toBe('fulfilled')
    expect(results[1]!.status).toBe('rejected')
    if (results[1]!.status === 'rejected') expect(results[1]!.reason.status).toBe(409)
    expect(store.snapshot().capabilities.find(cap => cap.id === 'browser')!.removedAt).toBeUndefined()
    expect(store.snapshot().capabilities.find(cap => cap.id === copyId)!.removedAt).toBeTruthy()
    expect(store.snapshot().revision).toBe(before.revision + 1)
  })
})
