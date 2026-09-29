import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CapabilityStore } from '../src/host/store.ts'
import { actionsOf, emptyRole, initialState, latest, type Command } from '../src/core/model.ts'
import { allowedActions } from '../src/core/policy.ts'
import { addAssociation, compositionIds, missingDependencies, moveAssociation, removeAssociation } from '../src/core/composition.ts'
import { definition, issues } from '../src/core/validation.ts'

const session = '@deepseek-ai/dsh-session'
const sample = () => initialState().capabilities[0]!.draft
const stores: CapabilityStore[] = []
afterEach(async () => { for (const store of stores.splice(0)) await store.close() })
async function setup() { const store = new CapabilityStore(await mkdtemp(join(tmpdir(), 'composition-'))); await store.init(); stores.push(store); return store }
const send = (s: CapabilityStore, command: Command) => s.command(s.snapshot().revision, command)

describe('component associations', () => {
  it('preserves legacy definitions, derives and deduplicates required support without migration', () => {
    const value = sample(); expect(definition(value)).toEqual(value)
    expect(compositionIds(value)).toHaveLength(6)
    expect(new Set(compositionIds(value)).size).toBe(6)
    expect(addAssociation(value, 'browserskill')).toBe(value)
    expect(issues(value)).toEqual([])
  })
  it('removes required associations explicitly, keeps business settings, and repairs without implicit re-add', () => {
    const value = sample(), removed = removeAssociation(value, session)
    expect(removed.components).toEqual(value.components)
    expect(missingDependencies(removed)).toEqual([session])
    expect(compositionIds(removed)).not.toContain(session)
    expect(missingDependencies(addAssociation(removed, 'browserskill'))).toEqual([session])
    expect(issues(removed)[0]).toContain('补回后才能发布')
    expect(actionsOf(removed)).toEqual([])
    expect(issues(addAssociation(removed, session))).toEqual([])
    expect(actionsOf(addAssociation(removed, session))).toEqual(actionsOf(value))
  })
  it('detaches business components with unused references while retaining metadata', () => {
    const removed = removeAssociation(removeAssociation(sample(), session), 'browserskill')
    expect(removed.components).toEqual([]); expect(removed.excludedDependencies).toEqual([])
    expect(removed.name).toBe(sample().name)
    expect(compositionIds(addAssociation(removed, 'browserskill'))).toHaveLength(6)
  })
  it('rejects forged, repeated and environment associations at the API boundary', () => {
    for (const extra of [{ excludedDependencies: ['bsk'] }, { excludedDependencies: ['unknown'] }, { excludedDependencies: [session, session] }, { componentOrder: ['browserskill', 'browserskill'] }, { componentOrder: ['not-adapted'] }]) expect(() => definition({ ...sample(), ...extra })).toThrow()
    expect(() => definition({ ...sample(), components: [], excludedDependencies: [session] })).toThrow()
  })
  it('saves incomplete drafts and ordering across restart, preserves published authority and other abilities, then repairs and publishes', async () => {
    let store = await setup()
    const roleResult = await send(store, { type: 'role.save', definition: { ...emptyRole(), name: '采集岗位', capabilities: [{ capabilityId: 'browser', version: 1, enabled: true }] }, publish: true })
    const before = store.snapshot(), role = before.roles.find(r => r.id === roleResult.id)!, old = latest(role.versions)!
    const draft = moveAssociation(removeAssociation(before.capabilities[0]!.draft, session), '@deepseek-ai/dsh-skill', 'browserskill')
    await send(store, { type: 'capability.save', id: 'browser', definition: draft, publish: false })
    const saved = store.snapshot()
    expect(saved.capabilities[0]!.versions).toEqual(before.capabilities[0]!.versions)
    expect(saved.roles).toEqual(before.roles)
    expect(saved.capabilities.slice(1)).toEqual(before.capabilities.slice(1))
    expect(allowedActions(saved, role.id, old)).toEqual(allowedActions(before, role.id, old))
    await expect(send(store, { type: 'capability.save', id: 'browser', definition: draft, publish: true })).rejects.toThrow('缺少必需组件')
    expect(store.snapshot()).toEqual(saved)
    const directory = store.directory; await store.close(); stores.splice(stores.indexOf(store), 1)
    store = new CapabilityStore(directory); await store.init(); stores.push(store)
    expect(store.snapshot().capabilities[0]!.draft).toEqual(draft)
    const copy = await send(store, { type: 'capability.copy', id: 'browser' })
    expect(copy.state.capabilities.find(c => c.id === copy.id)!.draft.excludedDependencies).toEqual([session])
    await send(store, { type: 'capability.save', id: 'browser', definition: addAssociation(draft, session), publish: true })
    expect(latest(store.snapshot().capabilities[0]!.versions)!.version).toBe(2)
    expect(compositionIds(latest(store.snapshot().capabilities[0]!.versions)!)[0]).toBe('@deepseek-ai/dsh-skill')
    await send(store, { type: 'capability.save', id: 'browser', definition: before.capabilities[0]!.versions[0]!, publish: false })
    expect(missingDependencies(store.snapshot().capabilities[0]!.draft)).toEqual([])
  })
  it('denies execution from an incomplete published snapshot even if state came from an older importer', () => {
    const state = initialState(), version = state.capabilities[0]!.versions[0]!
    version.excludedDependencies = [session]
    const role = state.roles[0]!
    role.versions[0]!.capabilities = [{ capabilityId: 'browser', version: 1, enabled: true }]
    expect(allowedActions(state, role.id, role.versions[0]!)).toEqual([])
  })
  it('does not bypass meeting built-in constraints or optimistic revisions', async () => {
    const store = await setup(), old = store.snapshot().revision
    await send(store, { type: 'capability.save', id: 'browser', definition: removeAssociation(sample(), session), publish: false })
    await expect(store.command(old, { type: 'capability.save', id: 'browser', definition: sample(), publish: false })).rejects.toThrow('其他页面')
    const meeting = store.snapshot().capabilities.find(c => c.id === 'meeting-transcription')!
    await send(store, { type: 'capability.save', id: meeting.id, definition: { ...meeting.draft, components: [] }, publish: false })
    await expect(send(store, { type: 'capability.save', id: meeting.id, definition: { ...meeting.draft, components: [] }, publish: true })).rejects.toThrow('缺少必需组件')
  })
})
