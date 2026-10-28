import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { CodeAssistantService } from '../src/host/service.mjs'

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'history-trash-中文 ')), cwd = join(root, 'project')
  const options = { root: join(root, 'state'), toolsRoot: root, assets: root, projects: () => [{ path: cwd, name: 'project' }], stream: async function* () {} }
  await mkdir(join(options.root, 'tasks'), { recursive: true }); await mkdir(join(cwd, '.git'), { recursive: true })
  await writeFile(join(cwd, 'source.txt'), 'keep source'); await writeFile(join(cwd, '.git', 'HEAD'), 'keep commit')
  const service = new CodeAssistantService(options)
  const tasks = ['developer', 'developer', 'another'].map((roleId,i) => ({ schema: 1, id: randomUUID(), roleId, cwd, title: '任务'+i, status: 'done', updatedAt: '2026-10-28T01:00:00.000Z', sessionId: 'keep-session', messages: [{ text: 'keep conversation' }], permissions: [] }))
  for (const task of tasks) { await service.save(task, false); service.tasks.set(task.id, task) }
  return { root, cwd, options, service, tasks, cleanup: () => rm(root, { recursive: true, force: true }) }
}
test('project trash is persistent, role-scoped and restores separately removed tasks independently', async () => {
  const f = await fixture(); let restarted
  try {
    await f.service.setHistoryRemoved(f.tasks[0].id, 'developer', true)
    const files = await Promise.all(f.tasks.map(t => readFile(join(f.options.root, 'tasks', t.id+'.json'), 'utf8')))
    const snapshot = await f.service.setProjectHistoryRemoved(f.cwd, 'developer', true)
    assert.equal(snapshot.tasks.length, 0); assert.equal(snapshot.removedProjects[0].count, 1); assert.equal(snapshot.removedTasks.length, 0)
    assert.equal(f.service.history('another').tasks.length, 1); assert.equal(f.service.history('another').removedProjects.length, 0)
    assert.equal(f.service.projectList().length, 1)
    await f.service.setProjectHistoryRemoved(f.cwd, 'developer', true)
    assert.equal(f.service.history('developer').removedProjects[0].removedAt, snapshot.removedProjects[0].removedAt)
    await assert.rejects(f.service.setHistoryRemoved(f.tasks[0].id, 'developer', false), /先.*恢复所属项目/)
    restarted = new CodeAssistantService(f.options); await restarted.init()
    assert.deepEqual(restarted.history('developer'), snapshot)
    const restored = await restarted.setProjectHistoryRemoved(f.cwd, 'developer', false)
    assert.deepEqual(restored.tasks.map(t => t.id), [f.tasks[1].id]); assert.equal(restored.removedTasks[0].id, f.tasks[0].id)
    assert.deepEqual(await Promise.all(f.tasks.map(t => readFile(join(f.options.root, 'tasks', t.id+'.json'), 'utf8'))), files)
    await restarted.setHistoryRemoved(f.tasks[0].id, 'developer', false)
    assert.equal(restarted.history('developer').tasks.length, 2)
    assert.equal(await readFile(join(f.cwd, 'source.txt'), 'utf8'), 'keep source'); assert.equal(await readFile(join(f.cwd, '.git', 'HEAD'), 'utf8'), 'keep commit')
  } finally { await restarted?.close(); await f.cleanup() }
})
test('project removal rejects running or active tasks and retries atomic metadata write failures', async () => {
  const f = await fixture()
  try {
    f.tasks[0].status = 'running'
    await assert.rejects(f.service.setProjectHistoryRemoved(f.cwd, 'developer', true), /正在运行/)
    f.tasks[0].status = 'done'; f.service.active = { task: f.tasks[0] }
    await assert.rejects(f.service.setProjectHistoryRemoved(f.cwd, 'developer', true), /正在运行/)
    f.service.active = null
    // Make the atomic rename fail, then remove only this known fixture obstruction.
    const destination = join(f.options.root, 'history-projects.json')
    await mkdir(destination)
    await assert.rejects(f.service.setProjectHistoryRemoved(f.cwd, 'developer', true))
    assert.equal(f.service.history('developer').tasks.length, 2)
    await rm(destination, { recursive: true }); await f.service.setProjectHistoryRemoved(f.cwd, 'developer', true)
    const save = f.service.saveHistoryProjects
    f.service.saveHistoryProjects = async () => { throw Error('disk unavailable') }
    await assert.rejects(f.service.setProjectHistoryRemoved(f.cwd, 'developer', false), /disk unavailable/)
    assert.equal(f.service.history('developer').removedProjects.length, 1)
    f.service.saveHistoryProjects = save
    await f.service.setProjectHistoryRemoved(f.cwd, 'developer', false)
    assert.equal(f.service.history('developer').tasks.length, 2)
  } finally { await f.cleanup() }
})
test('empty and legacy projects can be restored, and Windows path variants share one marker', async () => {
  const f = await fixture()
  try {
    await f.service.setProjectHistoryRemoved(join(f.root, 'empty'), 'developer', true)
    assert.equal(f.service.history('developer').removedProjects[0].count, 0)
    const legacy = { ...f.tasks[0], id: randomUUID(), cwd: undefined }
    f.service.tasks.set(legacy.id, legacy)
    await f.service.setProjectHistoryRemoved('', 'developer', true)
    assert(!f.service.history('developer').tasks.some(t => t.id === legacy.id))
    await f.service.setProjectHistoryRemoved('', 'developer', false)
    assert(f.service.history('developer').tasks.some(t => t.id === legacy.id))
    if (process.platform === 'win32') {
      await f.service.setProjectHistoryRemoved(f.cwd.toUpperCase().replaceAll('\\','/')+'/', 'developer', true)
      assert(!f.service.history('developer').tasks.some(t => t.cwd === f.cwd))
      await f.service.setProjectHistoryRemoved(f.cwd, 'developer', false)
      assert.equal(f.service.history('developer').tasks.length, 3)
    }
  } finally { await f.cleanup() }
})
test('project history routes and GET snapshots expose consistent counts without touching the engine', async () => {
  const f = await fixture()
  try {
    const request = async (route, data) => {
      let result
      const req = { url: '/api/capabilities/code-assistant/'+route, method: data ? 'POST' : 'GET', async *[Symbol.asyncIterator]() { yield Buffer.from(JSON.stringify(data)) } }
      await f.service.routes(req, { writeHead(code) { assert.equal(code,200) }, end(body) { result = JSON.parse(body) } }); return result
    }
    const removed = await request('history/project/remove', { roleId: 'developer', cwd: f.cwd })
    assert.equal(removed.tasks.length, 0); assert.equal(removed.removedProjects.length, 1)
    assert.deepEqual(await request('history?roleId=developer'), removed)
    const restored = await request('history/project/restore', { roleId: 'developer', cwd: f.cwd })
    assert.equal(restored.tasks.length, 2); assert.equal(restored.removedProjects.length, 0)
    await assert.rejects(request('history/project/remove', { roleId: 'developer' }), /项目路径无效/)
  } finally { await f.cleanup() }
})
