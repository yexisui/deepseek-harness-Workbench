// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MeetingService } from '../../dsh-capabilities/src/host/meeting.ts'
import { removeMeetingConversation } from '../src/client/meeting-removal.ts'
let directory = ''
afterEach(async () => { vi.unstubAllGlobals(); if (directory) await rm(directory, { recursive: true, force: true }); directory = '' })
it('R02 cancels and settles active generation before deletion and keeps activities readable', async () => {
  directory = await mkdtemp(join(tmpdir(), 'dsh-r02-'))
  let signal: AbortSignal | undefined, settled = false
  const service = new MeetingService(directory, async (_prompt, _model, active) => {
    signal = active
    try { return await new Promise<string>((_, reject) => active!.addEventListener('abort', () => reject(new Error('cancelled')), { once: true })) }
    finally { settled = true }
  }, undefined, undefined, () => ({ endpoint: 'http://127.0.0.1/asr', model: 'test' }))
  await service.init(); const job = await service.create({ fileName: 'meeting.wav' })
  job.status = 'transcribed'; job.segments = [{ id: 's1', text: 'fixture', speaker: 'test', start: 0, end: 1 }]
  await writeFile(join(directory, job.id + '.json'), JSON.stringify(job))
  await service.generate(job.id); await vi.waitFor(() => expect(signal).toBeDefined())
  await service.remove(job.id)
  expect(signal!.aborted).toBe(true); expect(settled).toBe(true)
  await expect(service.componentActivities()).resolves.toEqual([])
  await expect(service.get(job.id)).rejects.toThrow('不存在')
  await expect(service.remove(job.id)).resolves.toBeUndefined()
})
it('R02 preserves the local entry on HTTP failure and cancellation', async () => {
  const remove = vi.fn(), request = vi.fn(async () => ({ ok: false, status: 500, json: async () => ({ error: '磁盘写入失败' }) }))
  vi.stubGlobal('fetch', request)
  await expect(removeMeetingConversation('job', '会议', remove, () => false)).resolves.toBe(false)
  expect(request).not.toHaveBeenCalled()
  await expect(removeMeetingConversation('job', '会议', remove, () => true)).rejects.toThrow('磁盘写入失败')
  expect(remove).not.toHaveBeenCalled()
})
it('R02 waits for server confirmation and supports retry after a lost successful response', async () => {
  const remove = vi.fn(); let resolve!: (value: any) => void
  vi.stubGlobal('fetch', vi.fn(() => new Promise(done => { resolve = done })))
  const pending = removeMeetingConversation('job', '会议', remove, () => true)
  expect(remove).not.toHaveBeenCalled(); resolve({ ok: true, status: 200 })
  await pending; expect(remove).toHaveBeenCalledTimes(1)
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404 })))
  await removeMeetingConversation('job', '会议', remove, () => true)
  expect(remove).toHaveBeenCalledTimes(2)
})
