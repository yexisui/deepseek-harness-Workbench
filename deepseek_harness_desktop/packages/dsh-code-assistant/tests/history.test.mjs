import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { CodeAssistantService } from '../src/host/service.mjs'

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'code-history-'))
  const options = { root: join(root, 'state'), toolsRoot: root, assets: root, projects: () => [], stream: async function* () {} }
  const service = new CodeAssistantService(options)
  await mkdir(join(options.root, 'tasks'), { recursive: true })
  await mkdir(join(root, 'project', '.git'), { recursive: true })
  await writeFile(join(root, 'project', 'code.py'), 'keep source')
  await writeFile(join(root, 'project', '.git', 'HEAD'), 'keep commit')
  const task = { schema: 1, id: randomUUID(), roleId: 'developer', cwd: join(root, 'project'), title: '原任务', status: 'done', updatedAt: '2026-10-28T01:00:00.000Z', sessionId: 'original-session', messages: [{ text: 'keep conversation' }], permissions: [], requests: ['previous'] }
  service.tasks.set(task.id, task); await service.save(task, false)
  return { root, service, options, task, cleanup: () => rm(root, { recursive: true, force: true }) }
}

test('history removal and restore survive restart without deleting conversation, engine session or project', async () => {
  const f = await fixture()
  let restarted
  try {
    const original = structuredClone(f.task)
    f.service.engine = { start() { throw Error('must not start engine') }, request() { throw Error('must not touch engine') } }
    assert.equal(f.service.list('developer').length, 1)
    assert.deepEqual(await f.service.setHistoryRemoved(f.task.id, 'developer', true), [])
    const removedAt = f.service.get(f.task.id).historyRemovedAt
    assert(removedAt)
    await f.service.setHistoryRemoved(f.task.id, 'developer', true)
    assert.equal(f.service.get(f.task.id).historyRemovedAt, removedAt)
    const saved = JSON.parse(await readFile(join(f.options.root, 'tasks', f.task.id + '.json'), 'utf8'))
    delete saved.historyRemovedAt
    assert.deepEqual(saved, original)
    restarted = new CodeAssistantService(f.options); await restarted.init()
    assert.equal(restarted.list('developer').length, 0)
    assert.deepEqual(restarted.view(restarted.get(f.task.id)).messages, original.messages)
    const restored = await restarted.setHistoryRemoved(f.task.id, 'developer', false)
    assert.equal(restored[0].id, f.task.id)
    assert.equal(restored[0].updatedAt, original.updatedAt)
    assert.deepEqual(restarted.get(f.task.id), original)
    assert.equal(await readFile(join(f.root, 'project', 'code.py'), 'utf8'), 'keep source')
    assert.equal(await readFile(join(f.root, 'project', '.git', 'HEAD'), 'utf8'), 'keep commit')
  } finally { await restarted?.close(); await f.cleanup() }
})

test('history mutation rejects another role and running tasks, and failed writes remain retryable', async () => {
  const f = await fixture()
  try {
    await assert.rejects(f.service.setHistoryRemoved(f.task.id, 'other-role', true), /不属于/)
    f.task.status = 'running'
    await assert.rejects(f.service.setHistoryRemoved(f.task.id, 'developer', true), /正在运行/)
    f.task.status = 'done'; f.service.active = { task: f.task }
    await assert.rejects(f.service.setHistoryRemoved(f.task.id, 'developer', true), /正在运行/)
    f.service.active = null
    const save = f.service.save
    f.service.save = async () => { throw Error('disk unavailable') }
    await assert.rejects(f.service.setHistoryRemoved(f.task.id, 'developer', true), /disk unavailable/)
    assert.equal(f.service.list('developer').length, 1)
    assert.equal(f.service.get(f.task.id).historyRemovedAt, undefined)
    f.service.save = save
    await f.service.setHistoryRemoved(f.task.id, 'developer', true)
    assert.equal(f.service.list('developer').length, 0)
    f.service.save = async () => { throw Error('disk unavailable') }
    await assert.rejects(f.service.setHistoryRemoved(f.task.id, 'developer', false), /disk unavailable/)
    assert.equal(f.service.list('developer').length, 0)
    f.service.save = save
    await f.service.setHistoryRemoved(f.task.id, 'developer', false)
    assert.equal(f.service.list('developer').length, 1)
  } finally { await f.cleanup() }
})

test('forking a hidden task produces a visible independent record', async () => {
  const f = await fixture()
  try {
    f.task.sessionId = ''
    await f.service.setHistoryRemoved(f.task.id, 'developer', true)
    const fork = await f.service.fork(f.task.id, randomUUID())
    assert.equal(fork.historyRemovedAt, undefined)
    assert.deepEqual(f.service.list('developer').map(t => t.id), [fork.id])
    assert(f.service.get(f.task.id).historyRemovedAt)
  } finally { await f.cleanup() }
})

test('continuing a hidden conversation brings it back to history only after a successful send', async () => {
  const f = await fixture()
  try {
    await f.service.setHistoryRemoved(f.task.id, 'developer', true)
    f.service.authorize = () => {}; f.service.resolveModel = () => null
    await assert.rejects(f.service.send(f.task.id, { requestId: randomUUID(), message: '继续' }), /选择工作台模型/)
    assert.equal(f.service.list('developer').length, 0)
    f.service.resolveModel = () => 'existing-model'
    f.service.workspace = { lease: async () => () => {} }
    f.service.ensureSession = async () => 'original-session'
    f.service.engine = { request: async () => ({}) }
    f.service.run = async active => { active.release(); f.service.active = null }
    await f.service.send(f.task.id, { requestId: randomUUID(), message: '继续' })
    assert.equal(f.service.list('developer')[0].id, f.task.id)
    assert.equal(f.service.get(f.task.id).sessionId, 'original-session')
  } finally { await f.cleanup() }
})

test('history routes return only their role records and leave legacy tasks compatible', async () => {
  const f = await fixture()
  try {
    f.service.tasks.set('legacy', { id: 'legacy', roleId: 'developer', title: '旧任务', status: 'idle' })
    f.service.tasks.set('other', { id: 'other', roleId: 'another', title: '其他岗位', status: 'done' })
    const request = async (route, data) => {
      let result
      const req = { url: '/api/capabilities/code-assistant/' + route, method: 'POST', async *[Symbol.asyncIterator]() { yield Buffer.from(JSON.stringify(data)) } }
      const res = { writeHead(code) { assert.equal(code, 200) }, end(body) { result = JSON.parse(body) } }
      await f.service.routes(req, res)
      return result
    }
    assert.deepEqual((await request('history/remove', { id: f.task.id, roleId: 'developer' })).tasks.map(t => t.id), ['legacy'])
    assert.deepEqual((await request('history/restore', { id: f.task.id, roleId: 'developer' })).tasks.map(t => t.id), [f.task.id, 'legacy'])
  } finally { await f.cleanup() }
})
