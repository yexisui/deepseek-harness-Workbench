import { afterEach, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { initialState } from '../src/core/model.ts'
import { MEETING_CAPABILITY_ID, MEETING_ROLE_ID } from '../src/core/default-roles.ts'
import { allowedActions, browserActions, callViolation } from '../src/core/policy.ts'
import { CapabilityStore } from '../src/host/store.ts'
import { MeetingService } from '../src/host/meeting.ts'

const stores: CapabilityStore[] = []
afterEach(async () => { vi.unstubAllEnvs(); for (const store of stores.splice(0)) await store.close() })

it('migrates the existing meeting assistant without rewriting old versions and enforces capability disable', async () => {
  vi.stubEnv('MEETING_ASR_URL', 'http://127.0.0.1:9000/v1/audio/transcriptions')
  vi.stubEnv('MEETING_ASR_MODEL', 'speech-test')
  const directory = await mkdtemp(join(tmpdir(), 'dsh-meeting-capability-'))
  const old = initialState()
  delete old.meetingCapabilityVersion
  old.capabilities = old.capabilities.filter(cap => cap.id !== MEETING_CAPABILITY_ID)
  const oldRole = old.roles.find(role => role.id === MEETING_ROLE_ID)!
  oldRole.draft.capabilities = []
  oldRole.versions[0]!.capabilities = []
  await writeFile(join(directory, 'state.json'), JSON.stringify(old))

  const store = new CapabilityStore(directory); await store.init(); stores.push(store)
  const state = store.snapshot(), role = state.roles.find(item => item.id === MEETING_ROLE_ID)!
  expect(state.meetingCapabilityVersion).toBe(1)
  expect(state.capabilities.find(cap => cap.id === MEETING_CAPABILITY_ID)?.versions[0]?.components[0]?.actions).toEqual(['transcribe'])
  expect(role.versions).toHaveLength(2)
  expect(role.versions[0]!.capabilities).toEqual([])
  expect(role.versions[1]!.capabilities).toEqual([{ capabilityId: MEETING_CAPABILITY_ID, version: 1, enabled: true }])
  expect(JSON.parse(await readFile(join(directory, 'state-before-meeting-capability-v1.json'), 'utf8'))).toEqual(old)
  expect(browserActions(allowedActions(state, role.id, role.versions[1]!))).toEqual([])
  expect(callViolation('browser_session', { action: 'start' }, ['transcribe'], [])).toContain('未获准')

  const meeting = new MeetingService(join(directory, 'meetings'), async () => '{}', () => store.snapshot().roles.find(item => item.id === MEETING_ROLE_ID), () => store.snapshot())
  await meeting.init()
  expect(meeting.availability().ready).toBe(true)
  await store.command(state.revision, { type: 'capability.toggle', id: MEETING_CAPABILITY_ID, enabled: false })
  expect(meeting.availability()).toMatchObject({ ready: false, state: 'disabled' })
  await expect(meeting.create({ fileName: 'meeting.wav' })).rejects.toThrow('已停用')
})
