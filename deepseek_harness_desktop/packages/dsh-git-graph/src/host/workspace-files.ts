import { watch, createReadStream, type FSWatcher } from 'node:fs'
import { lstat, mkdir, readFile, readdir, realpath, rename, unlink, writeFile } from 'node:fs/promises'
import { createHash, randomUUID } from 'node:crypto'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import type { GitRunner, WorkspaceGate } from './git-service.ts'
import { changedPaths, lineDiff, parseFileStatus, type CommitPreview, type FileImage, type FileView, type WorkspaceDiff, type WorkspaceImage, type WorkspaceState } from '../core/workspace.ts'

const digest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex')
const MAX_TEXT = 256 * 1024, MAX_FILES = 12000, MAX_SNAPSHOT = 24 * 1024 * 1024
const omitted = new Set(['.git', 'node_modules', '.pnpm-store', '.cache', 'dist', 'build', 'coverage', '__pycache__', 'runtime', 'dsh-data'])
export function excludedPath(name: string): boolean {
  return name.split('/').some(part => omitted.has(part.toLowerCase()) || /^(\.env(?:\..*)?|\.npmrc|\.netrc|credentials(?:\..*)?|secrets?(?:\..*)?|ai_key\.txt|id_rsa|id_ed25519)$/i.test(part) || /\.(pem|p12|pfx|key)$/i.test(part))
}
export class WorkspaceError extends Error { constructor(message: string, readonly status = 400) { super(message) } }
export class WorkspaceFiles {
  private queues = new Map<string, Promise<unknown>>()
  private watchers = new Map<string, { watchers: FSWatcher[]; listeners: Set<() => void>; timer?: NodeJS.Timeout }>()
  private flights = new Map<string, Promise<WorkspaceImage>>()
  private leases = new Map<string, string>()
  constructor(private runner: GitRunner, private gate: WorkspaceGate) {}
  async lease(path: string, owner: string) {
    const root = await this.root(path)
    if (this.leases.has(root)) throw new WorkspaceError('此目录有开发或验证正在执行', 409)
    this.leases.set(root, owner)
    return () => { if (this.leases.get(root) === owner) this.leases.delete(root) }
  }
  async busy(path: string) { const root = await this.root(path); return this.leases.has(root) }
  async root(path: string): Promise<string> {
    if (typeof path !== 'string' || !path || path.length > 4096) throw new WorkspaceError('请选择本地项目')
    const verdict = await this.gate(path)
    if (!verdict.ok) throw new WorkspaceError('目录不存在或尚未登记为工作区', 403)
    return verdict.canonical
  }
  async serial<T>(path: string, fn: () => Promise<T>): Promise<T> {
    const root = await this.root(path), tail = this.queues.get(root) ?? Promise.resolve()
    const next = tail.catch(() => {}).then(fn)
    this.queues.set(root, next)
    try { return await next } finally { if (this.queues.get(root) === next) this.queues.delete(root) }
  }
  private async git(root: string, args: string[], allowed = [0]) {
    const result = await this.runner.run(['--literal-pathspecs', '-c', 'core.quotepath=false', ...args], root, AbortSignal.timeout(30_000))
    if (!allowed.includes(result.exitCode ?? -1)) throw new WorkspaceError(result.stderr.trim().slice(0, 1500) || 'Git 操作失败', 409)
    if (Buffer.byteLength(result.stdout) >= 1024 * 1024 - 1024) throw new WorkspaceError('Git 输出超过读取上限，请缩小范围')
    return result.stdout
  }
  private async gitRoot(root: string): Promise<boolean> {
    const result = await this.runner.run(['rev-parse', '--show-toplevel'], root, AbortSignal.timeout(15_000))
    if (result.exitCode !== 0) {
      if (/not a git repository/i.test(result.stderr)) return false
      throw new WorkspaceError('Git 仓库检测失败：' + (result.stderr.trim().slice(0, 1200) || `进程退出码 ${result.exitCode}`), 503)
    }
    // Do not silently expand a registered subfolder to its parent repository.
    if (await realpath(result.stdout.trim()) !== root) throw new WorkspaceError('请选择 Git 仓库根目录；当前目录是仓库的子目录')
    return true
  }
  private async filename(root: string, name: string, allowMissing = false): Promise<string> {
    if (typeof name !== 'string' || !name || name.length > 1500 || name.includes('\\') || name.includes(':') || name.includes('\0') || isAbsolute(name) || name.split('/').some(p => !p || p === '.' || p === '..') || excludedPath(name)) throw new WorkspaceError('文件路径越界或属于排除项', 403)
    const target = resolve(root, name), rel = relative(root, target)
    if (rel.startsWith('..') || isAbsolute(rel)) throw new WorkspaceError('文件路径越界', 403)
    let current = root
    for (const part of name.split('/')) {
      current = join(current, part)
      try { if ((await lstat(current)).isSymbolicLink()) throw new WorkspaceError('暂不读取或写入符号链接', 403) }
      catch (error) { if (allowMissing && (error as NodeJS.ErrnoException).code === 'ENOENT') break; throw error }
    }
    return target
  }
  async files(path: string) {
    const root = await this.root(path), names: string[] = [], excluded: string[] = []
    if (await this.gitRoot(root)) names.push(...(await this.git(root, ['ls-files', '-z', '--cached', '--others', '--exclude-standard'])).split('\0').filter(Boolean))
    else {
      const walk = async (dir: string, prefix: string) => {
        for (const e of await readdir(dir, { withFileTypes: true })) {
          const name = prefix + e.name
          if (excludedPath(name) || e.isSymbolicLink()) { excluded.push(name); continue }
          if (e.isDirectory()) await walk(join(dir, e.name), name + '/')
          else if (e.isFile()) names.push(name)
          if (names.length > MAX_FILES) throw new WorkspaceError('项目文件超过 12000 个，请选择更小的工作区')
        }
      }
      await walk(root, '')
    }
    const filtered = [...new Set(names)].filter(name => { if (!excludedPath(name)) return true; excluded.push(name); return false }).sort()
    if (filtered.length > MAX_FILES) throw new WorkspaceError('项目文件超过 12000 个，请缩小范围')
    return { root, files: filtered, excluded }
  }
  async read(path: string, name: string): Promise<FileView> {
    const root = await this.root(path), file = await this.filename(root, name, true)
    let stat
    try { stat = await lstat(file) } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { path: name, text: '', size: 0, version: 'missing' }; throw error }
    if (!stat.isFile() || stat.isSymbolicLink()) return { path: name, text: '', size: stat.size, version: 'unsupported', reason: '目录、子模块或链接，请在外部编辑器查看' }
    if (stat.size > MAX_TEXT) {
      const hash = createHash('sha256')
      for await (const chunk of createReadStream(file)) hash.update(chunk)
      return { path: name, text: '', size: stat.size, version: hash.digest('hex'), reason: '文件超过 256 KB，请在外部编辑器查看' }
    }
    const bytes = await readFile(file), version = digest(bytes)
    if (bytes.includes(0)) return { path: name, text: '', size: bytes.length, version, reason: '二进制文件' }
    return { path: name, version, text: bytes.toString('utf8'), size: bytes.length }
  }
  capture(path: string): Promise<WorkspaceImage> {
    const current = this.flights.get(path)
    if (current) return current
    const work = this.captureNow(path)
    this.flights.set(path, work)
    void work.finally(() => { if (this.flights.get(path) === work) this.flights.delete(path) }).catch(() => {})
    return work
  }
  private async captureNow(path: string): Promise<WorkspaceImage> {
    const listing = await this.files(path), files: Record<string, FileImage> = {}, excluded = [...listing.excluded]
    let bytes = 0
    for (const name of listing.files) {
      let value: FileView
      try { value = await this.read(listing.root, name) } catch (error) { if (error instanceof WorkspaceError && error.status === 403) { excluded.push(name); continue } throw error }
      if (value.version === 'missing') continue
      bytes += Buffer.byteLength(value.text)
      const reason = value.reason || (bytes > MAX_SNAPSHOT ? '快照文本总量超过 24 MB，仅保留文件指纹' : undefined)
      files[name] = { hash: value.version, size: value.size, ...(reason ? { reason } : { text: value.text }) }
    }
    return { root: listing.root, at: new Date().toISOString(), fingerprint: digest(JSON.stringify(Object.entries(files).map(([name, f]) => [name, f.hash]))), files, excluded }
  }
  async state(path: string): Promise<WorkspaceState> {
    const root = await this.root(path), git = await this.gitRoot(root), image = await this.capture(root)
    if (!git) return { root, git, branch: '', head: '', index: '', fingerprint: image.fingerprint, files: [], operation: false }
    const [head, branch, index, status, markers] = await Promise.all([
      this.git(root, ['rev-parse', '--verify', 'HEAD'], [0, 128]), this.git(root, ['symbolic-ref', '--short', '-q', 'HEAD'], [0, 1]),
      this.git(root, ['ls-files', '--stage', '-z']), this.git(root, ['status', '--porcelain=v1', '-z', '--untracked-files=all']),
      Promise.all(['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-merge', 'rebase-apply'].map(async name => {
        const file = (await this.git(root, ['rev-parse', '--git-path', name])).trim()
        try { await lstat(resolve(root, file)); return true } catch { return false }
      })),
    ])
    return { root, git, branch: branch.trim(), head: /^[a-f0-9]{40,64}\s*$/.test(head) ? head.trim() : '', index: digest(index), fingerprint: image.fingerprint, files: parseFileStatus(status), operation: markers.some(Boolean) }
  }
  async initialize(path: string) { return this.serial(path, async () => { const root = await this.root(path); if (await this.gitRoot(root)) throw new WorkspaceError('目录已经是 Git 仓库'); await this.git(root, ['init']); this.notify(root); return this.state(root) }) }
  async search(path: string, query: string) {
    if (!query.trim() || query.length > 200) return []
    const listing = await this.files(path), matches: { path: string; line: number; text: string }[] = []
    for (const name of listing.files) {
      const file = await this.read(path, name)
      file.text.split('\n').forEach((text, index) => { if (matches.length < 200 && text.toLowerCase().includes(query.toLowerCase())) matches.push({ path: name, line: index + 1, text: text.slice(0, 500) }) })
      if (matches.length >= 200) break
    }
    return matches
  }
  async write(path: string, name: string, content: string | null, expected: string) {
    return this.serial(path, async () => {
      if (content !== null && (typeof content !== 'string' || Buffer.byteLength(content) > MAX_TEXT || content.includes('\0'))) throw new WorkspaceError('仅支持 256 KB 以内的文本修改')
      const root = await this.root(path), old = await this.read(root, name)
      if (old.reason || old.version !== expected) throw new WorkspaceError('文件已被其他操作修改，请重新读取后再修改：' + name, 409)
      const filename = await this.filename(root, name, true)
      if (content === null) { if (old.version !== 'missing') await unlink(filename) }
      else {
        await mkdir(dirname(filename), { recursive: true })
        await this.filename(root, name, true)
        const temp = filename + '.' + randomUUID() + '.tmp'
        try {
          const mode = old.version === 'missing' ? 0o644 : (await lstat(filename)).mode
          await writeFile(temp, content, { flag: 'wx', mode })
          if ((await this.read(root, name)).version !== expected) throw new WorkspaceError('保存前检测到外部修改，已取消覆盖', 409)
          await rename(temp, filename)
        } finally { await unlink(temp).catch(() => {}) }
      }
      this.notify(root)
      return this.read(root, name)
    })
  }
  private async revision(root: string, ref: string) {
    if (!ref || ref.startsWith('-') || /[\0\r\n]/.test(ref) || ref.length > 200) throw new WorkspaceError('比较版本无效')
    const value = (await this.git(root, ['rev-parse', '--verify', '--end-of-options', ref + '^{commit}'])).trim()
    if (!/^[a-f0-9]{40,64}$/.test(value)) throw new WorkspaceError('比较版本不存在')
    return value
  }
  async compare(path: string, ref: string, commit = false) {
    const root = await this.root(path), target = await this.revision(root, ref)
    const base = commit ? (await this.git(root, ['rev-list', '--parents', '-n', '1', target])).trim().split(' ')[1] ?? '' : (await this.git(root, ['merge-base', target, 'HEAD'])).trim()
    const files = commit && !base ? (await this.git(root, ['diff-tree', '--root', '--no-commit-id', '--name-only', '-r', '-z', target])).split('\0').filter(Boolean) : (await this.git(root, ['diff', '--name-only', '-z', base!, commit ? target : 'HEAD'])).split('\0').filter(Boolean)
    return { base, target: commit ? target : (await this.git(root, ['rev-parse', 'HEAD'])).trim(), files: files.filter(name => !excludedPath(name)) }
  }
  async diff(path: string, name: string, scope: 'staged' | 'unstaged' | 'branch' | 'commit', ref = 'HEAD'): Promise<WorkspaceDiff> {
    const root = await this.root(path); await this.filename(root, name, true)
    const state = await this.state(root)
    if (!state.git) throw new WorkspaceError('请先初始化 Git')
    const status = state.files.find(file => file.path === name)
    let left = scope === 'staged' ? (state.head ? 'HEAD' : '') : ':', right = ''
    let args = scope === 'staged' ? ['diff', '--cached'] : ['diff']
    if (scope === 'branch' || scope === 'commit') {
      const compare = await this.compare(root, ref, scope === 'commit'); left = compare.base ?? ''; right = compare.target
      args = left ? ['diff', left, right] : ['show', '--format=', right]
    }
    const blob = async (rev: string, file: string): Promise<FileView> => {
      if (!rev) return { path: file, version: 'empty', text: '', size: 0 }
      const value = await this.runner.run(['show', rev === ':' ? ':' + file : rev + ':' + file], root, AbortSignal.timeout(15_000))
      if (value.exitCode !== 0) return { path: file, version: rev, text: '', size: 0 }
      const size = Buffer.byteLength(value.stdout), reason = size > MAX_TEXT ? '版本文件超过 256 KB' : value.stdout.includes('\0') ? '二进制文件' : undefined
      return { path: file, version: rev, size, text: reason ? '' : value.stdout, ...(reason ? { reason } : {}) }
    }
    if (status?.oldPath) await this.filename(root, status.oldPath, true)
    const before = await blob(left, status?.oldPath ?? name), after = right ? await blob(right, name) : scope === 'staged' ? await blob(':', name) : await this.read(root, name)
    const patch = before.reason || after.reason ? '' : status?.index === '?' ? lineDiff('', after.text, name) : await this.git(root, [...args, '--no-ext-diff', '--no-textconv', '--unified=3', '--', name, ...(status?.oldPath ? [status.oldPath] : [])])
    return { path: name, before, after, patch, label: scope === 'staged' ? 'HEAD → 暂存区' : scope === 'unstaged' ? '暂存区 → 工作目录' : `${left.slice(0, 8) || '空版本'} → ${right.slice(0, 8)}` }
  }
  async stage(path: string, names: string[], unstage: boolean, expected: Pick<WorkspaceState, 'head' | 'index' | 'fingerprint'>) {
    return this.serial(path, async () => {
      if (!Array.isArray(names) || !names.length || names.length > 100) throw new WorkspaceError('请选择 1 至 100 个文件')
      const root = await this.root(path), state = await this.state(root)
      this.checkState(state, expected)
      for (const name of names) await this.filename(root, name, true)
      const paths = [...new Set(names.flatMap(name => { const row = state.files.find(f => f.path === name); return row?.oldPath ? [name, row.oldPath] : [name] }))]
      for (const name of paths) await this.filename(root, name, true)
      if (unstage) await this.git(root, state.head ? ['reset', '-q', 'HEAD', '--', ...paths] : ['rm', '--cached', '-q', '--', ...paths])
      else await this.git(root, ['add', '--', ...paths])
      this.notify(root); return this.state(root)
    })
  }
  private checkState(state: WorkspaceState, expected: Pick<WorkspaceState, 'head' | 'index'> & { fingerprint?: string }) {
    if (!state.git || state.operation || state.files.some(f => f.conflict)) throw new WorkspaceError('Git 存在冲突或未完成操作，请先处理', 409)
    if (state.head !== expected.head || state.index !== expected.index || (expected.fingerprint !== undefined && state.fingerprint !== expected.fingerprint)) throw new WorkspaceError('代码或暂存区已变化，请刷新后重试', 409)
  }
  async preview(path: string): Promise<CommitPreview> {
    const root = await this.root(path), state = await this.state(root)
    this.checkState(state, state)
    const files = (await this.git(root, ['diff', '--cached', '--name-only', '-z'])).split('\0').filter(Boolean)
    const patch = files.some(excludedPath) ? '暂存区含凭据或排除项，请在外部 Git 工具审查并处理后继续。' : await this.git(root, ['diff', '--cached', '--no-ext-diff', '--no-textconv', '--stat'])
    return { head: state.head, index: state.index, branch: state.branch, files, patch }
  }
  async commit(path: string, message: string, expected: Pick<CommitPreview, 'head' | 'index'>) {
    return this.serial(path, async () => {
      const root = await this.root(path), state = await this.state(root)
      this.checkState(state, expected)
      if (typeof message !== 'string' || !message.trim() || message.length > 4000 || message.includes('\0')) throw new WorkspaceError('请填写有效的提交说明')
      const preview = await this.preview(root)
      if (!preview.files.length || preview.files.some(excludedPath)) throw new WorkspaceError('暂存区为空或含排除项，无法提交')
      await this.git(root, ['commit', '-m', message])
      const head = (await this.git(root, ['rev-parse', 'HEAD'])).trim()
      this.notify(root); return { head }
    })
  }
  async subscribe(path: string, listener: () => void): Promise<() => void> {
    const root = await this.root(path)
    let item = this.watchers.get(root)
    if (!item) {
      item = { watchers: [], listeners: new Set() }; this.watchers.set(root, item)
      const schedule = () => { const current = this.watchers.get(root); if (!current) return; if (current.timer) clearTimeout(current.timer); current.timer = setTimeout(() => this.notify(root), 600) }
      try { const watcher = watch(root, { recursive: true }, (_event, file) => { if (!file || !excludedPath(String(file).replaceAll('\\', '/')) || String(file).startsWith('.git')) schedule() }); watcher.on('error', schedule); item.watchers.push(watcher) } catch { /* UI focus/manual refresh remains available. */ }
      if (await this.gitRoot(root)) {
        const gitDir = resolve(root, (await this.git(root, ['rev-parse', '--git-common-dir'])).trim())
        if (!gitDir.startsWith(root)) try { const watcher = watch(gitDir, { recursive: true }, schedule); watcher.on('error', schedule); item.watchers.push(watcher) } catch { /* Manual refresh fallback. */ }
      }
    }
    item.listeners.add(listener)
    return () => { const current = this.watchers.get(root); if (!current) return; current.listeners.delete(listener); if (!current.listeners.size) { current.watchers.forEach(w => w.close()); if (current.timer) clearTimeout(current.timer); this.watchers.delete(root) } }
  }
  notify(root: string) { this.watchers.get(root)?.listeners.forEach(listener => listener()) }
  close() { for (const item of this.watchers.values()) { item.watchers.forEach(w => w.close()); if (item.timer) clearTimeout(item.timer) } this.watchers.clear() }
}
