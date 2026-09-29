import { afterEach, expect, it, vi } from 'vitest'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CapabilityStore } from '../src/host/store.ts'
import { MeetingService } from '../src/host/meeting.ts'
import { MEETING_CAPABILITY_ID as id, MEETING_ROLE_ID } from '../src/core/default-roles.ts'
import { addAssociation, availableComponents, compositionSupported, missingAssociations, removeAssociation } from '../src/core/composition.ts'
import { issues } from '../src/core/validation.ts'
import { initialState, type Command, type Snapshot } from '../src/core/model.ts'
const stores: CapabilityStore[] = []
afterEach(async () => { vi.unstubAllEnvs(); for (const store of stores.splice(0)) await store.close() })
async function setup() { const root = await mkdtemp(join(tmpdir(), 'meeting-composition-')); const store = new CapabilityStore(root); await store.init(); stores.push(store); return { root, store } }
const send = (store: CapabilityStore, command: Command) => store.command(store.snapshot().revision, command)

it('persists a missing-component draft across restart without altering published authority, jobs or settings', async () => {
  const { root, store } = await setup(), before = store.snapshot(), original = before.capabilities.find(c => c.id === id)!
  const settings = { endpoint: 'http://127.0.0.1:9000/audio/transcriptions', model: 'test-asr', apiKey: 'fixture-key' }
  const meeting = new MeetingService(join(root, 'meetings'), async () => '{}', () => store.snapshot().roles.find(r => r.id === MEETING_ROLE_ID), () => store.snapshot(), () => settings)
  await meeting.init()
  const job = await meeting.create({ fileName: 'existing.wav' })
  const jobBefore = await readFile(join(root, 'meetings', job.id + '.json'), 'utf8')
  const incomplete = removeAssociation(original.draft, 'meeting-asr')
  await send(store, { type: 'capability.save', id, definition: incomplete, publish: false })
  expect(missingAssociations(incomplete, id)).toEqual(['meeting-asr'])
  expect(meeting.availability().ready).toBe(true)
  await expect(meeting.create({ fileName: 'next.wav' })).resolves.toMatchObject({ status: 'uploading' })
  expect(await readFile(join(root, 'meetings', job.id + '.json'), 'utf8')).toBe(jobBefore)
  expect(settings).toEqual({ endpoint: 'http://127.0.0.1:9000/audio/transcriptions', model: 'test-asr', apiKey: 'fixture-key' })
  expect(store.snapshot().roles).toEqual(before.roles)
  expect(store.snapshot().capabilities.find(c => c.id === id)!.versions).toEqual(original.versions)
  await expect(send(store, { type: 'capability.save', id, definition: incomplete, publish: true })).rejects.toThrow('缺少必需组件')
  await store.close()
  const reopened = new CapabilityStore(root); await reopened.init(); stores.push(reopened)
  const loaded = reopened.snapshot().capabilities.find(c => c.id === id)!
  expect(loaded.draft.components).toEqual([])
  expect(loaded.versions).toEqual(original.versions)
  const repaired = addAssociation(loaded.draft, 'meeting-asr')
  expect(addAssociation(repaired, 'meeting-asr')).toEqual(repaired)
  await send(reopened, { type: 'capability.save', id, definition: repaired, publish: true })
  expect(reopened.snapshot().capabilities.find(c => c.id === id)!.versions).toHaveLength(2)
  expect(reopened.snapshot().roles).toEqual(before.roles)
})

it('allows missing actions in drafts but rejects incomplete publication and unsupported mixed workflows', async () => {
  const { store } = await setup(), original = store.snapshot().capabilities.find(c => c.id === id)!.draft
  const noActions = { ...original, components: [{ componentId: 'meeting-asr', actions: [] }] }
  await send(store, { type: 'capability.save', id, definition: noActions, publish: false })
  expect(issues(noActions, id)).toContain('至少选择一个业务动作')
  await expect(send(store, { type: 'capability.save', id, definition: noActions, publish: true })).rejects.toThrow('至少选择一个业务动作')
  for (const publish of [false, true]) {
    await expect(send(store, { type: 'capability.save', id: 'browser', definition: original, publish })).rejects.toThrow('不支持当前能力')
    await expect(send(store, { type: 'capability.save', id, definition: addAssociation(original, 'browserskill'), publish })).rejects.toThrow('不支持当前能力')
  }
  await expect(send(store, { type: 'capability.copy', id })).rejects.toThrow('不能复制')
})

it('declares supported component libraries and service protocol without weakening the legacy browser guard', () => {
  expect(availableComponents(id).map(c => c.id)).toEqual(['meeting-asr'])
  expect(availableComponents().map(c => c.id)).toEqual(['browserskill'])
  const data = { state: initialState(), compositionVersion: 1 } as Snapshot
  expect(compositionSupported(data, 'browser')).toBe(true)
  expect(compositionSupported(data, id)).toBe(false)
  expect(compositionSupported({ ...data, compositionVersion: 2 }, id)).toBe(true)
  expect(compositionSupported({ ...data, compositionVersion: undefined }, 'browser')).toBe(false)
})
