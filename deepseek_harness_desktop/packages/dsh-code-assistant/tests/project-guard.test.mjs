import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { assertIsolatedProject } from '../src/host/project-guard.mjs'

test('blocks discoverable native plugins/config without changing project files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'workbench-config-guard-'))
  await mkdir(join(root, '.git'))
  const child = join(root, 'src'); await mkdir(child)
  await assertIsolatedProject(child)
  await writeFile(join(root, 'opencode.json'), '{"plugin":["example"]}')
  await assert.rejects(assertIsolatedProject(child), /原生配置/)
  assert.equal(await readFile(join(root, 'opencode.json'), 'utf8'), '{"plugin":["example"]}')
  const separate = join(root, 'separate'); await mkdir(join(separate, '.git'), { recursive: true })
  await assertIsolatedProject(separate)
  await mkdir(join(separate, '.opencode'))
  await assert.rejects(assertIsolatedProject(separate), /原生配置/)
})
