import { afterEach, beforeEach, expect, it } from 'vitest'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, mkdir, writeFile, readFile, rm, realpath, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { GitService, type GitRunner } from '../src/host/git-service.ts'
import { changedPaths, parseFileStatus } from '../src/core/workspace.ts'
const exec = promisify(execFile)
let root: string, git: GitService
const runner: GitRunner = { async run(args, cwd, signal) {
  try { const result = await exec('git', ['-c', 'user.name=Developer QA', '-c', 'user.email=qa@example.invalid', ...args], { cwd, encoding: 'utf8', windowsHide: true, signal }); return { exitCode: 0, ...result } }
  catch (e) { const error = e as { code?: number; stdout?: string; stderr?: string }; return { exitCode: error.code ?? 1, stdout: error.stdout ?? '', stderr: error.stderr ?? '' } }
} }
const command = (...args: string[]) => runner.run(args, root)
beforeEach(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), 'developer-git-')))
  git = new GitService(runner, async path => path === root ? { ok: true, canonical: root } : { ok: false, error: { code: 'workspace-unknown', message: 'denied' } })
  await command('init'); await writeFile(join(root, 'main.ts'), 'export const answer = 1\n'); await command('add', '.'); await command('commit', '-m', 'initial')
})
afterEach(async () => { git.workspace.close(); await rm(root, { recursive: true, force: true }) })
it('keeps staged and unstaged contents separate and commits the reviewed index only', async () => {
  await writeFile(join(root, 'main.ts'), 'export const answer = 2\n')
  await git.workspace.stage(root, ['main.ts'], false, await git.workspace.state(root))
  await writeFile(join(root, 'main.ts'), 'export const answer = 3\n')
  const state = await git.workspace.state(root)
  expect(state.files[0]).toMatchObject({ path: 'main.ts', index: 'M', worktree: 'M' })
  expect((await git.workspace.diff(root, 'main.ts', 'staged')).patch).toContain('+export const answer = 2')
  expect((await git.workspace.diff(root, 'main.ts', 'unstaged')).patch).toContain('+export const answer = 3')
  const preview = await git.workspace.preview(root), result = await git.workspace.commit(root, 'reviewed change', preview)
  expect(result.head).not.toBe(preview.head)
  expect((await command('show', 'HEAD:main.ts')).stdout).toContain('answer = 2')
  expect(await readFile(join(root, 'main.ts'), 'utf8')).toContain('answer = 3')
}, 30000)
it('rejects stale stage/commit previews without changing external work', async () => {
  await writeFile(join(root, 'main.ts'), 'changed\n')
  const state = await git.workspace.state(root)
  await writeFile(join(root, 'main.ts'), 'external\n')
  await expect(git.workspace.stage(root, ['main.ts'], false, state)).rejects.toThrow('已变化')
  await git.workspace.stage(root, ['main.ts'], false, await git.workspace.state(root))
  const preview = await git.workspace.preview(root)
  await writeFile(join(root, 'other.txt'), 'extra\n'); await command('add', 'other.txt')
  await expect(git.workspace.commit(root, 'stale', preview)).rejects.toThrow('已变化')
  expect((await command('diff', '--cached', '--name-only')).stdout).toContain('other.txt')
}, 30000)
it('captures the dirty starting point and keeps cumulative changes after a commit', async () => {
  await writeFile(join(root, 'main.ts'), 'preexisting\n')
  const baseline = await git.workspace.capture(root)
  expect(changedPaths(baseline, await git.workspace.capture(root))).toEqual([])
  await git.workspace.write(root, 'main.ts', 'task change\n', baseline.files['main.ts']!.hash)
  await command('add', '.'); await command('commit', '-m', 'task')
  expect(changedPaths(baseline, await git.workspace.capture(root))).toEqual(['main.ts'])
  expect((await git.workspace.state(root)).files).toEqual([])
}, 30000)
it('protects traversal, credentials, symlinks, and changed file contents', async () => {
  await writeFile(join(root, '.env'), 'PRIVATE=sentinel'); await mkdir(join(root, 'target')); await symlink(join(root, 'target'), join(root, 'link'), 'junction')
  await expect(git.workspace.read(root, '../outside')).rejects.toThrow()
  await expect(git.workspace.read(root, '.env')).rejects.toThrow('排除项')
  await expect(git.workspace.write(root, 'link/new.txt', 'x', 'missing')).rejects.toThrow('符号链接')
  const image = await git.workspace.capture(root)
  expect(JSON.stringify(image)).not.toContain('PRIVATE=sentinel')
  const file = await git.workspace.read(root, 'main.ts')
  await writeFile(join(root, 'main.ts'), 'external')
  await expect(git.workspace.write(root, 'main.ts', 'mine', file.version)).rejects.toThrow('其他操作修改')
  expect(await readFile(join(root, 'main.ts'), 'utf8')).toBe('external')
}, 30000)
it('unstages new files on unborn branches and handles names literally', async () => {
  const empty = join(root, 'empty'); await mkdir(empty)
  const service = new GitService(runner, async path => ({ ok: true, canonical: path }))
  await expect(service.workspace.initialize(empty)).rejects.toThrow('仓库的子目录')
  await runner.run(['init'], empty)
  await writeFile(join(empty, '[测试] 空格.txt'), 'hello\n')
  await service.workspace.stage(empty, ['[测试] 空格.txt'], false, await service.workspace.state(empty))
  await service.workspace.stage(empty, ['[测试] 空格.txt'], true, await service.workspace.state(empty))
  expect(await readFile(join(empty, '[测试] 空格.txt'), 'utf8')).toBe('hello\n')
  expect((await service.workspace.state(empty)).files[0]!.index).toBe('?')
}, 30000)
it('compares initial commits, detects file changes through a shared observer, and blocks branch changes while occupied', async () => {
  const head = (await command('rev-parse', 'HEAD')).stdout.trim()
  expect((await git.workspace.compare(root, head, true)).files).toContain('main.ts')
  expect((await git.workspace.diff(root, 'main.ts', 'commit', head)).patch).toContain('+export const answer = 1')
  const release = await git.workspace.lease(root, 'task')
  expect((await git.createBranch(root, 'codex/occupied')).ok).toBe(false)
  release()
  const event = new Promise<void>(async resolve => { const dispose = await git.workspace.subscribe(root, () => { dispose(); resolve() }); await writeFile(join(root, 'main.ts'), 'external save\n') })
  await event
}, 30000)
it('parses rename records without splitting unicode names or losing the second status', () => {
  expect(parseFileStatus('RM 新 文件.ts\0旧 文件.ts\0?? other.ts\0')).toEqual([{ path: '新 文件.ts', oldPath: '旧 文件.ts', index: 'R', worktree: 'M', conflict: false }, { path: 'other.ts', index: '?', worktree: '?', conflict: false }])
})

it('does not expose an excluded original path through a staged rename', async () => {
  await writeFile(join(root, '.env'), 'SECRET=private-fixture\n')
  await command('add', '.env'); await command('commit', '-m', 'fixture')
  await command('mv', '.env', 'public.txt')
  await expect(git.workspace.diff(root, 'public.txt', 'staged')).rejects.toThrow('排除项')
  await expect(git.workspace.stage(root, ['public.txt'], true, await git.workspace.state(root))).rejects.toThrow('排除项')
}, 30000)
