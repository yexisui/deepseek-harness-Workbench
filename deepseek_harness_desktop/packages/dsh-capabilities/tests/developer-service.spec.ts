import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { DeveloperService } from '../src/host/developer.ts'
import { initialState } from '../src/core/model.ts'
import { GitService, type GitRunner } from '../../dsh-git-graph/src/host/git-service.ts'
import { CapabilityStore } from '../src/host/store.ts'
const exec = promisify(execFile)
let root: string, repo: string, service: DeveloperService, state: ReturnType<typeof initialState>, git: GitService
let model: (prompt: string, signal: AbortSignal) => Promise<string>
let check: (cwd: string, command: string, signal: AbortSignal, output: (text: string) => void) => Promise<number | null>
const runner: GitRunner = { async run(args, cwd) { try { const r = await exec('git', ['-c', 'user.name=QA', '-c', 'user.email=qa@example.invalid', ...args], { cwd, encoding: 'utf8', windowsHide: true }); return { exitCode: 0, ...r } } catch (e) { const r = e as any; return { exitCode: r.code, stdout: r.stdout, stderr: r.stderr } } } }
beforeEach(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), 'developer-service-'))); repo = join(root, 'repo'); await mkdir(repo)
  await runner.run(['init'], repo); await writeFile(join(repo, 'main.ts'), 'original\n'); await runner.run(['add', '.'], repo); await runner.run(['commit', '-m', 'initial'], repo)
  state = initialState(); for(const role of state.roles)for(const version of role.versions)version.capabilities=state.capabilities.map(c=>({capabilityId:c.id,version:c.versions.at(-1)!.version,enabled:true})); model = async () => JSON.stringify({ action: 'finish', message: '只读分析完成，尚未执行测试' }); check = async (_cwd, _command, _signal, output) => { output('real fixture output'); return 0 }
  git = new GitService(runner, async path => path === repo ? { ok: true, canonical: repo } : { ok: false, error: { code: 'workspace-unknown', message: 'denied' } })
  service = new DeveloperService(join(root, 'tasks'), git, (prompt, _model, signal) => model(prompt, signal), (...args) => check(...args), () => state)
  await service.init()
})
afterEach(async () => { await service.close(); git.workspace.close(); await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }) })
async function create() { return service.create({ requestId: randomUUID(), cwd: repo, roleId: 'builtin-developer', roleVersion: 1 }) }
async function done(id: string) {
  for (let i = 0; i < 300; i++) { const task = await service.get(id); if (![...task.rounds, ...task.checks].some(r => r.status === 'running')) return task; await new Promise(resolve => setTimeout(resolve, 30)) }
  throw Error('Job did not finish')
}
it('creates idempotently, binds immutable directory, and persists exact role and dirty baseline', async () => {
  await writeFile(join(repo, 'main.ts'), 'before task\n')
  const task = await create(), same = await service.create({ requestId: task.id, cwd: repo })
  expect(task.id).toBe(same.id); expect((await service.list()).items).toHaveLength(1)
  expect((await service.changes(task.id, 'task')).files).toEqual([])
  await expect(service.configureTask(task.id, task.revision - 1, { title: 'stale' })).rejects.toThrow('任务已更新')
}, 30000)
it('writes only after read and edit permission; snapshots survive a later Git commit', async () => {
  let task = await create(); task = await service.configureTask(task.id, task.revision, { permission: 'edit' })
  let n = 0; model = async () => JSON.stringify([{ action: 'read', path: 'main.ts' }, { action: 'write', path: 'main.ts', content: 'updated\n' }, { action: 'finish', message: '已修改；未运行测试' }][n++])
  const requestId = randomUUID(); await service.send(task.id, { requestId, message: 'change' }); await service.send(task.id, { requestId, message: 'duplicate' })
  const result = await done(task.id)
  expect(result.messages.filter(m => m.role === 'user')).toHaveLength(1); expect(result.rounds[0]!.status).toBe('done'); expect(result.rounds[0]!.writes).toHaveLength(1)
  expect(await readFile(join(repo, 'main.ts'), 'utf8')).toBe('updated\n')
  await runner.run(['add', '.'], repo); await runner.run(['commit', '-m', 'task'], repo)
  expect((await service.changes(task.id, 'task')).files).toEqual(['main.ts'])
}, 30000)
it('denies writes in read-only mode and preserves unsaved external changes', async () => {
  let task = await create(); let n = 0
  model = async () => JSON.stringify([{ action: 'read', path: 'main.ts' }, { action: 'write', path: 'main.ts', content: 'denied' }, { action: 'finish', message: '只读，未修改' }][n++])
  await service.send(task.id, { requestId: randomUUID(), message: 'read-only' }); await done(task.id)
  expect(await readFile(join(repo, 'main.ts'), 'utf8')).toBe('original\n')
  task = await service.get(task.id); await service.configureTask(task.id, task.revision, { permission: 'edit' }); n = 0
  model = async () => { if (n++ === 0) return JSON.stringify({ action: 'read', path: 'main.ts' }); await writeFile(join(repo, 'main.ts'), 'external\n'); return JSON.stringify({ action: 'write', path: 'main.ts', content: 'stale' }) }
  await service.send(task.id, { requestId: randomUUID(), message: 'edit' }); const result = await done(task.id)
  expect(result.rounds.at(-1)!.status).toBe('failed'); expect(await readFile(join(repo, 'main.ts'), 'utf8')).toBe('external\n')
}, 30000)
it('stops model calls and does not replay them on reopen', async () => {
  const task = await create()
  model = async (_prompt, signal) => new Promise((_resolve, reject) => { if (signal.aborted) reject(Error('aborted')); else signal.addEventListener('abort', () => reject(Error('aborted'))) })
  await service.send(task.id, { requestId: randomUUID(), message: 'long task' }); const result = await service.stop(task.id)
  expect(result.rounds[0]!.status).toBe('stopped'); expect((await service.get(task.id)).messages).toHaveLength(1)
}, 30000)
it('retries malformed model responses without executing embedded commands or duplicating user messages', async () => {
  const task = await create(); let calls = 0
  model = async prompt => {
    calls++
    if (calls === 1) return '分析如下：{"action":"write","path":"main.ts","content":"must not execute"}'
    expect(JSON.parse(prompt).operations.at(-1).error).toContain('未执行任何操作')
    return JSON.stringify({ action: 'finish', message: '只读分析完成' })
  }
  await service.send(task.id, { requestId: randomUUID(), message: 'explain' }); const result = await done(task.id)
  expect(calls).toBe(2); expect(result.rounds[0]!.status).toBe('done'); expect(result.rounds[0]!.writes).toEqual([])
  expect(result.messages.filter(m => m.role === 'user')).toHaveLength(1)
  expect(result.events.some(e => e.text.includes('正在重试（1/2）'))).toBe(true)
  expect(await readFile(join(repo, 'main.ts'), 'utf8')).toBe('original\n')
}, 30000)
it('bounds format retries and retains successful writes if the model keeps returning invalid JSON', async () => {
  let task = await create(); task = await service.configureTask(task.id, task.revision, { permission: 'edit' }); let calls = 0
  model = async () => {
    calls++
    if (calls === 1) return JSON.stringify({ action: 'read', path: 'main.ts' })
    if (calls === 2) return JSON.stringify({ action: 'write', path: 'main.ts', content: 'completed before format failure\n' })
    return '{invalid'
  }
  await service.send(task.id, { requestId: randomUUID(), message: 'edit' }); const result = await done(task.id)
  expect(calls).toBe(5); expect(result.rounds[0]!.status).toBe('failed'); expect(result.rounds[0]!.writes).toHaveLength(1)
  expect(result.rounds[0]!.error).toContain('重试后已停止'); expect(result.rounds[0]!.after).toBeTruthy()
  expect(await readFile(join(repo, 'main.ts'), 'utf8')).toBe('completed before format failure\n')
  expect(await git.workspace.busy(repo)).toBe(false)
}, 30000)
it('runs only confirmed project commands and binds results to the actual directory and code fingerprint', async () => {
  const task = await create()
  await expect(service.verify(task.id, 'unknown', randomUUID())).rejects.toThrow('确认验证命令')
  await service.configureProject(repo, 0, { editor: 'none', commands: [{ id: 'test', name: '检查', command: 'node --version' }] })
  check = async (cwd, command, _signal, output) => { expect(cwd).toBe(repo); expect(command).toBe('node --version'); await writeFile(join(repo, 'main.ts'), 'changed during test\n'); output('passed'); return 0 }
  const requestId = randomUUID(); await service.verify(task.id, 'test', requestId); const result = await done(task.id)
  expect(result.checks[0]).toMatchObject({ status: 'passed', changedDuringRun: true, output: 'passed', cwd: repo })
  await service.verify(task.id, 'test', requestId); expect((await service.get(task.id)).checks).toHaveLength(1)
}, 30000)
it('isolates incomplete drafts from published execution and blocks publish until repaired', async () => {
  const store = new CapabilityStore(join(root, 'capabilities')); await store.init()
  try {
    const current = store.snapshot(), cap = current.capabilities.find(c => c.id === 'developer-workspace')!, definition = { ...cap.draft, components: cap.draft.components.filter(c => c.componentId !== 'developer-git') }
    await store.command(current.revision, { type: 'capability.save', id: cap.id, definition, publish: false })
    expect(store.snapshot().capabilities.find(c => c.id === cap.id)!.draft.components).toHaveLength(2)
    expect(store.snapshot().capabilities.find(c => c.id === cap.id)!.versions[0]!.components).toHaveLength(3)
    await expect(store.command(store.snapshot().revision, { type: 'capability.save', id: cap.id, definition, publish: true })).rejects.toThrow('必需组件')
    await store.command(store.snapshot().revision, { type: 'capability.save', id: cap.id, definition: cap.draft, publish: true })
  } finally { await store.close() }
}, 30000)

it('records partial checkpoint restores and refuses later external changes', async () => {
  await writeFile(join(repo, 'other.ts'), 'second original\n')
  let task = await create(); task = await service.configureTask(task.id, task.revision, { permission: 'edit' })
  task = await service.checkpoint(task.id, 'before edit')
  let n = 0
  model = async () => JSON.stringify([{ action: 'read', path: 'main.ts' }, { action: 'write', path: 'main.ts', content: 'first edited\n' }, { action: 'read', path: 'other.ts' }, { action: 'write', path: 'other.ts', content: 'second edited\n' }, { action: 'finish', message: 'done' }][n++])
  await service.send(task.id, { requestId: randomUUID(), message: 'edit both' }); await done(task.id)
  const checkpoint = task.checkpoints[0]!.id, preview = await service.restorePreview(task.id, checkpoint)
  expect(preview.files.every(f => !f.reason)).toBe(true)
  const write = git.workspace.write.bind(git.workspace)
  const spy = vi.spyOn(git.workspace, 'write').mockImplementation(async (...args) => {
    const result = await write(...args)
    if (args[1] === 'main.ts') await writeFile(join(repo, 'other.ts'), 'external during restore\n')
    return result
  })
  await expect(service.restore(task.id, checkpoint, preview.fingerprint, ['main.ts', 'other.ts'])).rejects.toThrow('文件已改变')
  spy.mockRestore()
  const result = await service.get(task.id), round = result.rounds.at(-1)!
  expect(round.status).toBe('failed'); expect(round.writes).toHaveLength(1); expect(round.after).toBeTruthy()
  expect(await readFile(join(repo, 'main.ts'), 'utf8')).toBe('original\n')
  expect(await readFile(join(repo, 'other.ts'), 'utf8')).toBe('external during restore\n')
  expect((await service.restorePreview(task.id, checkpoint)).files[0]!.reason).toContain('其他修改')
  expect(await git.workspace.busy(repo)).toBe(false)
}, 30000)

it('stops verification, releases its directory, and honors revoked Git authorization', async () => {
  const task = await create()
  await service.configureProject(repo, 0, { editor: 'none', commands: [{ id: 'long', name: 'long', command: 'fixture' }] })
  check = async (_cwd, _cmd, signal) => new Promise(resolve => { if (signal.aborted) resolve(null); else signal.addEventListener('abort', () => resolve(null)) })
  await service.verify(task.id, 'long', randomUUID())
  expect(await git.workspace.busy(repo)).toBe(true)
  expect((await service.stop(task.id)).checks[0]!.status).toBe('stopped')
  expect(await git.workspace.busy(repo)).toBe(false)
  state.roles.find(r => r.id === task.roleId)!.enabled = false
  await expect(service.addWorktree(task.id, 'denied', 'HEAD')).rejects.toThrow('授权')
}, 30000)
