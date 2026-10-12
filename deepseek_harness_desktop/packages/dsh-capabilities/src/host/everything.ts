import { execFile, spawn, type ChildProcess } from 'node:child_process'
import { mkdir, readFile, writeFile, rm, stat } from 'node:fs/promises'
import { join, resolve, relative, isAbsolute, win32 } from 'node:path'
import { randomUUID, createHash } from 'node:crypto'
import { filenameTerms, type FileSearchItem } from '../core/file-search.ts'
import { InputError } from '../core/validation.ts'

export class EverythingEngine {
  private child?: ChildProcess
  private starting?: Promise<string>
  private closed = false
  private instance: string
  constructor(private tools: string, private root: string, private fixtureInstance?: string) {
    this.instance = fixtureInstance ?? 'DSH-' + createHash('sha256').update(resolve(root)).digest('hex').slice(0, 12)
  }
  private async executable(tool: string, key: string) {
    const root = join(this.tools, tool)
    try {
      const pointer = JSON.parse((await readFile(join(root, 'current.json'), 'utf8')).replace(/^\uFEFF/, ''))
      const path = resolve(root, pointer[key]), rel = relative(root, path)
      if (!rel || rel.startsWith('..') || isAbsolute(rel) || !(await stat(path)).isFile()) throw Error()
      return path
    } catch { throw new InputError('搜索工具尚未安装，请运行工作台部署入口补装 Everything。', 503) }
  }
  private run(exe: string, args: string[], signal?: AbortSignal) {
    return new Promise<string>((ok, fail) => execFile(exe, args, { windowsHide: true, timeout: 20000, maxBuffer: 2 * 1024 * 1024, encoding: 'utf8', signal, env: { ...process.env, APPDATA: this.root } }, (error, stdout) => error ? fail(error) : ok(stdout.trim())))
  }
  async status() {
    try {
      const es = await this.executable('es', 'es')
      for (const instance of [this.instance, ...(this.fixtureInstance ? [] : [''])]) {
        try { await this.run(es, [...(instance ? ['-instance', instance] : []), '-get-everything-version']); return { state: 'ready' as const, message: 'Everything 已连接；搜索范围为已索引的本地位置。' } } catch { /* Check the next existing instance. */ }
      }
      await this.executable('everything', 'everything')
      return { state: 'stopped' as const, message: '首次搜索时自动启动 Everything；首次建立索引可能需要稍候。' }
    } catch (error) { return { state: 'missing' as const, message: (error as Error).message } }
  }
  private async ensure(): Promise<string> {
    if (this.closed) throw new InputError('搜索服务已关闭', 503)
    const es = await this.executable('es', 'es')
    for (const instance of [this.instance, ...(this.fixtureInstance ? [] : [''])]) {
      try { await this.run(es, [...(instance ? ['-instance', instance] : []), '-get-everything-version']); return instance } catch { /* Start only our own instance. */ }
    }
    if (this.fixtureInstance) throw new InputError('测试索引未运行', 503)
    if (this.starting) return this.starting
    this.starting = (async () => {
      const service = await this.run('sc.exe', ['query', 'Everything']).catch(() => '')
      if (!/\b4\s+RUNNING\b/.test(service)) throw new InputError('Everything 索引服务尚未启动，请运行工作台部署入口并完成 Windows 授权。', 503)
      const exe = await this.executable('everything', 'everything')
      await mkdir(this.root, { recursive: true })
      const config = join(this.root, 'Everything.ini')
      let ini = await readFile(config, 'utf8').catch((e: NodeJS.ErrnoException) => { if (e.code !== 'ENOENT') throw e; return '\uFEFF[Everything]\r\nrun_as_admin=0\r\nrun_in_background=1\r\nshow_tray_icon=0\r\ncheck_for_updates_on_startup=0\r\n' })
      // Named clients share the installed service. In 1.4 the CLI setter only
      // configures and exits, so set our private INI before starting the client.
      const pipe = String.raw`service_pipe_name=\\.\PIPE\Everything Service`
      ini = /^service_pipe_name=/m.test(ini) ? ini.replace(/^service_pipe_name=.*$/m, pipe) : ini + pipe + '\r\n'
      await writeFile(config, ini)
      if (this.closed) throw new InputError('搜索服务已关闭', 503)
      this.child = spawn(exe, ['-instance', this.instance, '-config', config, '-db', join(this.root, 'Everything.db'), '-startup'], { windowsHide: true, stdio: 'ignore' })
      let failure: Error | undefined
      this.child.on('error', error => { failure = error })
      for (let i = 0; i < 30; i++) {
        if (failure) throw failure
        await new Promise(ok => setTimeout(ok, 200))
        try { await this.run(es, ['-instance', this.instance, '-get-everything-version']); return this.instance } catch { /* Startup in progress. */ }
      }
      throw new InputError('Everything 尚未启动，请检查搜索工具安装后重试。', 503)
    })().finally(() => { this.starting = undefined })
    return this.starting
  }
  async query(query: string, directory: string, signal?: AbortSignal) {
    const es = await this.executable('es', 'es'), instance = await this.ensure()
    signal?.throwIfAborted()
    await mkdir(this.root, { recursive: true })
    const output = join(this.root, randomUUID() + '.json')
    try {
      await this.run(es, [...(instance ? ['-instance', instance] : []), '-ipc2', '-export-json', output, '-name', '-path-column', '-size', '-date-modified', '-attributes', '-date-format', '1', '-sort-name', '-n', '201', '-timeout', '15000', ...(directory ? ['-path', directory] : []), '--', ...filenameTerms(query)], signal)
      const raw = (await readFile(output, 'utf8')).replace(/^\uFEFF/, '').trim()
      const rows = raw ? JSON.parse(raw) : []
      if (!Array.isArray(rows)) throw Error('搜索引擎返回格式错误')
      const items: FileSearchItem[] = rows.map(row => {
        if (typeof row.name !== 'string' || typeof row.path !== 'string') throw Error('搜索结果路径无效')
        const path = win32.resolve(row.path, row.name)
        return { path, name: win32.basename(path), directory: (Number(row.attributes) & 16) !== 0, size: Number.isFinite(row.size) ? row.size : null, modifiedAt: typeof row.date_modified === 'string' ? row.date_modified : '' }
      }).filter(item => {
        if (!/^[a-z]:\\/i.test(item.path)) return false
        if (!directory) return true
        const rel = win32.relative(directory, item.path)
        return rel !== '..' && !rel.startsWith('..\\') && !win32.isAbsolute(rel)
      })
      return { items: items.slice(0, 200), hasMore: rows.length > 200 }
    } catch (error) {
      if (signal?.aborted) throw new InputError('搜索已取消', 409)
      const code = (error as NodeJS.ErrnoException).code
      if (code === '8' || Number(code) === 8) throw new InputError('Everything 未运行，请重试。', 503)
      throw new InputError('搜索未完成，索引可能仍在加载或引擎未就绪，请稍后重试。', 503)
    } finally { await rm(output, { force: true }) }
  }
  async close() {
    this.closed = true
    await this.starting?.catch(() => {})
    if (!this.child) return
    try { await this.run(await this.executable('es', 'es'), ['-instance', this.instance, '-exit']) } catch { this.child.kill() }
    this.child = undefined
  }
}
