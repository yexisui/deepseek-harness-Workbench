import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CodeAssistantService } from '../src/host/service.mjs'

test('project removal is code-assistant-only, persistent and reversible through selection', async () => {
  const root = await mkdtemp(join(tmpdir(), 'code-project-list-'))
  const project = join(root, '项目'), other = join(root, '其他项目')
  await mkdir(project); await writeFile(join(project, 'keep.txt'), 'keep')
  const registered = [{ path: project, name: '项目' }, { path: other, name: '其他项目' }]
  const options = { root: join(root, 'state'), toolsRoot: root, assets: root, projects: () => registered, addProject: async path => registered.push({ path, name: path }), stream: async function* () {} }
  let service = new CodeAssistantService(options)
  try {
    await service.init()
    service.tasks.set('history', { id: 'history', cwd: project, title: '保留历史' })
    assert.deepEqual(await service.removeLocalProject(project), [registered[1]])
    assert.equal(registered.length, 2)
    assert.equal(service.tasks.get('history').title, '保留历史')
    assert.equal(await readFile(join(project, 'keep.txt'), 'utf8'), 'keep')
    await service.close(); service = new CodeAssistantService(options); await service.init()
    assert.deepEqual(service.projectList(), [registered[1]])
    assert.equal((await service.addLocalProject(project)).length, 2)
    assert.equal(registered.length, 2)
    service.active = { task: { cwd: project } }
    await assert.rejects(service.removeLocalProject(project), /正在运行/)
    service.active = null
    assert.equal(service.projectList().length, 2)
  } finally { service.active = null; await service.close(); await rm(root, { recursive: true, force: true }) }
})
