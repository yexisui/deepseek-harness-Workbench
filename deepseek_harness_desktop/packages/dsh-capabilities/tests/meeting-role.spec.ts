import { afterEach, expect, it, vi } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { initialState } from '../src/core/model.ts'
import { MEETING_ROLE_ID } from '../src/core/default-roles.ts'
import { MeetingService } from '../src/host/meeting.ts'

let directory = ''
afterEach(async () => { vi.unstubAllEnvs(); if (directory) await rm(directory, { recursive: true, force: true }); directory = '' })

it('captures the published meeting role for each job and blocks new work while disabled', async () => {
  vi.stubEnv('MEETING_ASR_URL', 'http://127.0.0.1:9000/v1/audio/transcriptions')
  vi.stubEnv('MEETING_ASR_MODEL', 'speech-test')
  directory = await mkdtemp(join(tmpdir(), 'dsh-meeting-role-'))
  const role = initialState().roles.find(item => item.id === MEETING_ROLE_ID)!
  const service = new MeetingService(directory, async () => '{}', () => role)
  await service.init()
  const job = await service.create({ fileName: 'meeting.wav', roleVersion: 1 })
  expect(job.role).toEqual(expect.objectContaining({ version: 1, name: '会议纪要助手', requirements: role.versions[0]!.requirements }))
  role.enabled = false
  await expect(service.create({ fileName: 'another.wav' })).rejects.toThrow('已停用')
  await expect(service.generate(job.id)).rejects.toThrow('已停用')
  expect((await service.get(job.id)).role).toEqual(job.role)
})
