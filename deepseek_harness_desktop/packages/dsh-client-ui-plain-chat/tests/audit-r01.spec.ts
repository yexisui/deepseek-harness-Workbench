// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MeetingService } from '../../dsh-capabilities/src/host/meeting.ts'
import { createLocalConversations } from '../src/client/local-conversations.ts'
import { createMeetingHistory } from '../src/client/meeting-history.ts'

let directory = ''
beforeEach(() => { localStorage.clear(); sessionStorage.clear() })
afterEach(async () => { vi.restoreAllMocks(); if (directory) await rm(directory, { recursive: true, force: true }); directory = '' })
it('R01 retains more than forty meetings alongside drafts and after reloading', () => {
  let id = 0, clock = 1
  vi.spyOn(Date, 'now').mockImplementation(() => ++clock)
  const store = createLocalConversations(() => `local-${++id}`)
  for (let i = 0; i < 55; i++) { const row = store.start('meeting-minutes-demo'); store.setMeeting(row.id, { jobId: `job-${i}` }, ''); store.commitDemo(row.id, `会议 ${i}`) }
  const draft = store.start(); store.setDraft(draft.id, '保留未发送文本')
  expect(store.getSnapshot().items).toHaveLength(56)
  expect(createLocalConversations().getSnapshot().items).toHaveLength(56)
  expect(createLocalConversations().getSnapshot().items.some(row => row.id === 'local-1')).toBe(true)
})
it('R01 server history paginates existing files and survives restart with a damaged row isolated', async () => {
  directory = await mkdtemp(join(tmpdir(), 'dsh-r01-'))
  const service = new MeetingService(directory, async () => '{}', undefined, undefined, () => ({ endpoint: 'http://127.0.0.1/asr', model: 'fixture' }))
  await service.init()
  for (let i = 0; i < 45; i++) await service.create({ fileName: `meeting-${i}.wav` })
  await writeFile(join(directory, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.json'), '{broken')
  const restarted = new MeetingService(directory, async () => '{}')
  await restarted.init()
  const first = await restarted.list(0, 30), second = await restarted.list(30, 30)
  expect(first.total).toBe(45); expect(first.unreadableCount).toBe(1)
  expect(new Set([...first.items, ...second.items].map(row => row.id)).size).toBe(45)
  expect(first.nextCursor).toBeTruthy()
  await restarted.remove(first.items[0]!.id)
  const afterDelete = await restarted.list(0, 30, first.nextCursor)
  expect(afterDelete.items.map(row => row.id)).toEqual(second.items.map(row => row.id))
  await expect(restarted.list(-1)).rejects.toThrow('分页')
  await expect(restarted.list(0, 30, 'invalid')).rejects.toThrow('游标')
})
it('R01 restores server meetings to an empty client without replacing local drafts', async () => {
  const row = { id: 'server-1', title: '服务器纪要', mode: 'guided' as const, audience: '', focus: '', summaryModel: '', status: 'ready' as const, updatedAt: new Date().toISOString(), createdAt: new Date().toISOString(), roleVersion: 2 }
  const local = createLocalConversations(), api = vi.fn(async () => ({ items: [row], total: 1 }))
  const history = createMeetingHistory(local, api)
  await history.load()
  expect(local.getSnapshot().items[0].title).toBe('服务器纪要')
  const restored = local.getSnapshot().items[0]
  local.setMeeting(restored.id, { ...(restored.meeting as object), draft: '未保存想法', tab: 'trace' }, '未保存想法')
  await history.load()
  expect(local.getSnapshot().items).toHaveLength(1)
  expect(local.getSnapshot().items[0].draft).toBe('未保存想法')
  expect((local.getSnapshot().items[0].meeting as any).tab).toBe('trace')
})
it('R01 does not resurrect a meeting deleted while a history request is in flight', async () => {
  const local = createLocalConversations()
  let resolve!: (page: any) => void
  const history = createMeetingHistory(local, () => new Promise(done => { resolve = done }))
  const pending = history.load(); history.forget('deleted')
  resolve({ items: [{ id:'deleted', title:'deleted', mode:'quick', status:'ready', updatedAt:new Date().toISOString() }], total:1 })
  await pending
  expect(local.getSnapshot().items).toEqual([])
})
it('R01 preserves entries and exposes a retryable history error', async () => {
  const local = createLocalConversations(); const row = local.start(); local.setDraft(row.id, 'keep')
  const history = createMeetingHistory(local, async () => { throw new Error('连接失败') })
  await history.load(); expect(history.getSnapshot().error).toBe('连接失败'); expect(local.getSnapshot().items[0].draft).toBe('keep')
})

it('keeps a manual name while typing, changing modes, leaving and reloading', () => {
  const local = createLocalConversations(); const row = local.start('meeting-minutes-demo')
  local.rename(row.id, '自定会议名称'); local.leave()
  expect(createLocalConversations().getSnapshot().items.find(x => x.id === row.id)?.title).toBe('自定会议名称')
  local.open(row.id); local.setDraft(row.id, '输入新的资料'); local.commitDemo(row.id, '自动生成名称')
  expect(createLocalConversations().getSnapshot().items.find(x => x.id === row.id)?.title).toBe('自定会议名称')
})
