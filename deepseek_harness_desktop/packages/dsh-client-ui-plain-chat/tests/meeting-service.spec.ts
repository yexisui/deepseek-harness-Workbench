import { afterEach, describe, expect, it, vi } from 'vitest'
import { Readable } from 'node:stream'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import type { IncomingMessage } from 'node:http'
import { MeetingService } from '../../dsh-capabilities/src/host/meeting.ts'

let root = ''
afterEach(async () => {
  vi.unstubAllEnvs(); vi.unstubAllGlobals()
  if (root && resolve(root).startsWith(resolve(tmpdir()) + '\\')) await rm(root, { recursive: true, force: true })
  root = ''
})

describe('meeting service', () => {
  it('stays unavailable without a transcription endpoint and model', async () => {
    vi.stubEnv('MEETING_ASR_URL', '')
    vi.stubEnv('MEETING_ASR_MODEL', '')
    root = await mkdtemp(join(tmpdir(), 'dsh-meeting-test-'))
    const service = new MeetingService(root, async () => '{}')
    await service.init()
    expect(service.availability().ready).toBe(false)
    await expect(service.create({ fileName: 'meeting.mp3' })).rejects.toThrow('默认配置')
  })

  it('uses a configurable compatible transcription endpoint and workbench summary model', async () => {
    vi.stubEnv('MEETING_ASR_URL', 'https://speech.example.com/v1/audio/transcriptions')
    vi.stubEnv('MEETING_ASR_MODEL', 'local-whisper')
    vi.stubEnv('MEETING_ASR_API_KEY', 'test-key')
    root = await mkdtemp(join(tmpdir(), 'dsh-meeting-test-'))
    const requests: Array<{ url: string; model?: string }> = []
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      const form = init?.body as FormData
      requests.push({ url, model: form?.get('model')?.toString() })
      if (url !== 'https://speech.example.com/v1/audio/transcriptions') throw new Error(`Unexpected URL: ${url}`)
      return new Response(JSON.stringify({ segments: [{ start: 2, end: 6, speaker: '发言人 1', text: '王磊周五前提交清单。' }] }), { status: 200, headers: { 'content-type': 'application/json' } })
    }))
    const summaryRoutes: string[] = []
    const service = new MeetingService(root, async (_prompt, route) => {
      summaryRoutes.push(route)
      return JSON.stringify({ title: '周例会纪要', overview: '确认任务清单', decisions: [], actions: [{ text: '提交清单', owner: '王磊', deadline: '周五前', sourceIds: ['s1'] }], unknown: [] })
    })
    await service.init()
    const created = await service.create({ fileName: 'meeting.mp3', mode: 'quick', summaryModel: 'chosen/summary-model' })
    const request = Object.assign(Readable.from([Buffer.from('audio-content')]), { complete: true }) as unknown as IncomingMessage
    await service.upload(created.id, request)
    let job = await service.get(created.id)
    for (let i = 0; i < 100 && job.status !== 'ready' && job.status !== 'error'; i++) { await new Promise(resolve => setTimeout(resolve, 10)); job = await service.get(created.id) }
    expect(job.status, job.error).toBe('ready')
    expect(job.segments[0]).toMatchObject({ id: 's1', start: 2000, speaker: '发言人 1' })
    expect(job.minutes?.actions[0]).toMatchObject({ owner: '王磊', sourceIds: ['s1'] })
    expect(requests).toEqual([{ url: 'https://speech.example.com/v1/audio/transcriptions', model: 'local-whisper' }])
    expect(summaryRoutes).toEqual(['chosen/summary-model'])
    await service.remove(created.id)
    await expect(service.get(created.id)).rejects.toThrow('会议任务不存在')
  })

  it('accepts a local endpoint without an API key and a text-only transcript', async () => {
    vi.stubEnv('MEETING_ASR_URL', 'http://127.0.0.1:9000/v1/audio/transcriptions')
    vi.stubEnv('MEETING_ASR_MODEL', 'offline-asr')
    vi.stubEnv('MEETING_ASR_API_KEY', '')
    root = await mkdtemp(join(tmpdir(), 'dsh-meeting-test-'))
    vi.stubGlobal('fetch', vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      expect((init?.headers as Record<string, string>).Authorization).toBeUndefined()
      return new Response(JSON.stringify({ text: '本地识别完成。' }), { status: 200 })
    }))
    const service = new MeetingService(root, async () => '{}')
    await service.init()
    const created = await service.create({ fileName: 'meeting.wav', mode: 'guided' })
    await service.upload(created.id, Object.assign(Readable.from([Buffer.from('audio-content')]), { complete: true }) as unknown as IncomingMessage)
    let job = await service.get(created.id)
    for (let i = 0; i < 100 && job.status === 'transcribing'; i++) { await new Promise(resolve => setTimeout(resolve, 10)); job = await service.get(created.id) }
    expect(job.status).toBe('transcribed')
    expect(job.segments).toEqual([{ id: 's1', start: 0, end: 0, speaker: '发言人', text: '本地识别完成。' }])
  })
})
