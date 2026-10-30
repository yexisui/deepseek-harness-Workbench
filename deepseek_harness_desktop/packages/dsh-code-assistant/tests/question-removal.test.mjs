import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { CodeAssistantService } from '../src/host/service.mjs'
import { visibleConversation, questionSummaries } from '../src/core/conversation.mjs'

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'question-removal-'))
  const options = { root, toolsRoot: root, assets: root, projects: () => [], stream: async function* () {} }
  const service = new CodeAssistantService(options)
  await mkdir(join(root, 'tasks'))
  const ask = id => ({ info: { id, role: 'user', time: { created: 100 } }, parts: [{ type: 'text', text: id }] })
  const reply = (id, parentID) => ({ info: { id, role: 'assistant', parentID, time: { completed: 200 } }, parts: [{ type: 'text', text: id }] })
  const task = { schema: 1, id: randomUUID(), roleId: 'developer', cwd: root, title: 'question removal', status: 'done', updatedAt: '2026-10-29T01:00:00.000Z', sessionId: 'preserve-context', messages: [ask('q1'), reply('a1', 'q1'), ask('q2'), reply('a2', 'q2'), reply('late-a1', 'q1')], permissions: [], requests: ['existing'] }
  service.tasks.set(task.id, task); await service.save(task, false)
  return { root, options, service, task, cleanup: () => rm(root, { recursive: true, force: true }) }
}

test('removes the whole question including delayed replies from body and history, persists and restores original bytes', async () => {
  const f = await fixture(); let restarted
  try {
    const before = await readFile(join(f.root, 'tasks', f.task.id + '.json'), 'utf8')
    await f.service.setQuestionRemoved(f.task.id, 'developer', 'q1', true)
    const current = f.service.get(f.task.id), grouped = visibleConversation(current)
    assert.deepEqual(grouped.rounds.map(q => q.id), ['q2'])
    assert.deepEqual(grouped.rounds[0].messages.map(m => m.info.id), ['q2', 'a2'])
    assert.equal(grouped.rounds[0].index, 1)
    assert.deepEqual(f.service.list('developer')[0].questions, questionSummaries(current))
    assert.deepEqual(current.messages, f.task.messages)
    assert.equal(current.updatedAt, f.task.updatedAt)
    restarted = new CodeAssistantService(f.options); await restarted.init()
    assert.deepEqual(questionSummaries(restarted.get(f.task.id)).map(q => q.id), ['q2'])
    await restarted.setQuestionRemoved(f.task.id, 'developer', 'q1', false)
    assert.equal(await readFile(join(f.root, 'tasks', f.task.id + '.json'), 'utf8'), before)
  } finally { await restarted?.close(); await f.cleanup() }
})

test('can remove every round, continue with a new question and undo in reverse order', async () => {
  const f = await fixture()
  try {
    for (const id of ['q1','q2']) await f.service.setQuestionRemoved(f.task.id, 'developer', id, true)
    const task = f.service.get(f.task.id)
    assert.equal(visibleConversation(task).rounds.length, 0)
    task.messages.push({ info: { id: 'q3', role: 'user' }, parts: [{ type: 'text', text: '继续问' }] })
    assert.deepEqual(questionSummaries(task).map(q => q.id), ['q3'])
    await f.service.setQuestionRemoved(task.id, task.roleId, task.removedQuestionIds.at(-1), false)
    assert.deepEqual(questionSummaries(f.service.get(task.id)).map(q => q.id), ['q2','q3'])
  } finally { await f.cleanup() }
})

test('rejects wrong role, nonexistent question and running task; failed save leaves visibility unchanged and retryable', async () => {
  const f = await fixture()
  try {
    await assert.rejects(f.service.setQuestionRemoved(f.task.id, 'other', 'q1', true), /不属于/)
    await assert.rejects(f.service.setQuestionRemoved(f.task.id, 'developer', 'missing', true), /不存在/)
    f.task.status = 'running'
    await assert.rejects(f.service.setQuestionRemoved(f.task.id, 'developer', 'q1', true), /正在运行/)
    f.task.status = 'done'
    const save = f.service.save; f.service.save = async () => { throw Error('write failed') }
    await assert.rejects(f.service.setQuestionRemoved(f.task.id, 'developer', 'q1', true), /write failed/)
    assert.equal(questionSummaries(f.service.get(f.task.id)).length, 2)
    f.service.save = save
    await f.service.setQuestionRemoved(f.task.id, 'developer', 'q1', true)
    assert.equal(questionSummaries(f.service.get(f.task.id)).length, 1)
  } finally { await f.cleanup() }
})
