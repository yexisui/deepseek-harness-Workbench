import { afterEach, expect, it, vi } from 'vitest'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MeetingService } from '../src/host/meeting.ts'
import { hasTiming, parseSegments, sourceKey } from '../src/core/meeting-timing.ts'
let directory = ''
afterEach(async () => { vi.unstubAllGlobals(); if (directory) await rm(directory, { recursive: true, force: true }); directory = '' })
it('distinguishes missing/invalid timing from a real zero start, and accepts seconds, milliseconds and words', () => {
  expect(parseSegments({ text: '全文' })[0]).toMatchObject({ start: null, end: null })
  for (const row of [{ start: 0, end: 0 }, { start: -1, end: 2 }, { start: '2', end: 4 }, { end: 5 }, { start: 5, end: 3 }]) expect(hasTiming(parseSegments({ segments: [{ ...row, text: '原文' }] })[0])).toBe(false)
  expect(parseSegments({ segments: [{ start: 0, end: 2, text: '开头' }] })[0]).toMatchObject({ start: 0, end: 2000 })
  expect(parseSegments({ transcripts: [{ sentences: [{ begin_time: 2500, end_time: 6000, text: '原文' }] }] })[0]).toMatchObject({ start: 2500, end: 6000 })
  expect(parseSegments({ words: [{ start: 4, end: 5, word: '测试' }] })[0]).toMatchObject({ start: 4000, end: 5000, text: '测试' })
})
const id = '11111111-1111-4111-8111-111111111111'
async function setup(response: unknown, answer: unknown) {
  directory = await mkdtemp(join(tmpdir(), 'meeting-timing-'))
  const original = { id, fileName: 'test.mp3', extension: '.mp3', size: 3, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), mode: 'guided', audience: '', focus: '', summaryModel: 'summary', status: 'ready', segments: [{ id: 's1', start: 0, end: 0, speaker: '人工校对', text: '人工校对原文不能覆盖' }], minutes: { title: '保留标题', overview: '保留摘要', decisions: [{ text: '保留结论', sourceIds: ['s1'] }], actions: [], unknown: [] } }
  await writeFile(join(directory,id+'.json'), JSON.stringify(original)); await writeFile(join(directory,id+'.mp3'), 'mp3')
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(response))))
  const ask = vi.fn(async () => JSON.stringify(answer))
  const service = new MeetingService(directory, ask, undefined, undefined, () => ({ endpoint: 'http://127.0.0.1:9999/v1/audio/transcriptions', model: 'asr' }))
  await service.init(); return { service, original, ask }
}
async function finished(service: MeetingService) { for (let i=0;i<100;i++) { const job=await service.get(id);if(job.timingStatus!=='processing')return job;await new Promise(r=>setTimeout(r,10)) } throw new Error('timeout') }
it('keeps minutes and corrections on missing timestamps without asking summary model', async () => {
  const { service, original, ask } = await setup({ text: '全文' }, {})
  await service.repairTiming(id); const job=await finished(service)
  expect(job.timingStatus).toBe('error'); expect(job.timingError).toContain('未返回有效时间戳')
  expect(job.minutes).toEqual(original.minutes); expect(job.segments[0].text).toBe(original.segments[0].text);expect(job.status).toBe('ready');expect(ask).not.toHaveBeenCalled()
})
it('adds verified source links separately without rewriting original content', async () => {
  const {service,original}=await setup({segments:[{start:42,end:47,text:'这里是录音中的对应原文'}]}, {links:[{index:0,sources:[{id:'t1',quote:'录音中的对应原文'},{id:'t404',quote:'编造原文'}]}]})
  await service.repairTiming(id);const job=await finished(service)
  expect(job.timingStatus).toBe('ready');expect(job.minutes).toEqual(original.minutes);expect(job.segments[0].speaker).toBe('人工校对')
  expect(job.timing?.links[sourceKey(original.minutes.decisions[0])]).toEqual(['t1']);expect(job.timing?.segments[0].start).toBe(42000)
  expect(JSON.parse(await readFile(join(directory,id+'.json'),'utf8')).timing.links).toEqual(job.timing?.links)
})
it('rejects fabricated quotes and keeps prior minutes', async () => {
  const {service,original}=await setup({segments:[{start:42,end:47,text:'实际原文'}]}, {links:[{index:0,sources:[{id:'t1',quote:'没有出现的原文'}]}]})
  await service.repairTiming(id);const job=await finished(service);expect(job.timingStatus).toBe('error');expect(job.timing).toBeUndefined();expect(job.minutes).toEqual(original.minutes)
})
it('rejects generation during timing and recovers interrupted timing without losing minutes', async () => {
  const {service,original}=await setup({text:'全文'}, {})
  const stored={...original,timingStatus:'processing'};await writeFile(join(directory,id+'.json'),JSON.stringify(stored))
  await expect(service.generate(id)).rejects.toThrow('时间定位处理中')
  await service.init();const job=await service.get(id);expect(job.status).toBe('ready');expect(job.timingStatus).toBe('error');expect(job.minutes).toEqual(original.minutes)
})
