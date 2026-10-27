import { forkIdentity, existingFork, writeFork } from './conversation-fork.ts'
import { mkdir, readFile, writeFile, rename, readdir, rm, stat } from 'node:fs/promises'
import { join, win32 } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { latest, type State } from '../core/model.ts'
import { allowedActions } from '../core/policy.ts'
import { InputError, text } from '../core/validation.ts'
import type { FileSearchRecord } from '../core/file-search.ts'
import { EverythingEngine } from './everything.ts'
import { json, readBody } from './http.ts'

export class FileSearchService {
  reportUsage?: import('../core/team-contributions.ts').ContributionReporter
  private roleId = ''
  private rows = new Map<string, FileSearchRecord>()
  private active = new Map<string, { controller: AbortController; roleId: string; roleVersion: number }>()
  private tail: Promise<unknown> = Promise.resolve()
  constructor(private root: string, private state: () => State, readonly engine: Pick<EverythingEngine, 'query' | 'status' | 'close'>) {}
  private serial<T>(fn: () => Promise<T>) { const next = this.tail.then(fn); this.tail = next.catch(() => {}); return next }
  private file(id: string) { if (!/^[a-f\d-]{36}$/.test(id)) throw new InputError('搜索记录标识无效'); return join(this.root, id + '.json') }
  async fork(id:string,target:string){return this.serial(async()=>{
    const source=this.rows.get(id);if(!source)throw new InputError('搜索记录不存在',404)
    const row=forkIdentity(source,target),file=this.file(target),existing=await existingFork<FileSearchRecord>(file,id);if(existing)return existing
    await writeFork(file,row);this.rows.set(target,row);return row
  })}

  async init() {
    await mkdir(this.root, { recursive: true })
    try { this.roleId = JSON.parse(await readFile(join(this.root, 'settings.json'), 'utf8')).roleId || '' } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e
      if (this.roles().some(role => role.id === 'builtin-file-search')) await this.configure('builtin-file-search')
    }
    for (const name of await readdir(this.root)) if (/^[a-f\d-]{36}\.json$/.test(name)) {
      const row = JSON.parse(await readFile(join(this.root, name), 'utf8')) as FileSearchRecord
      this.rows.set(row.id, row)
    }
  }
  private roles() { const state = this.state(); return state.roles.filter(r => r.enabled && !r.removedAt && !r.archivedAt && latest(r.versions) && allowedActions(state, r.id, latest(r.versions)!).includes('search-files')).map(r => ({ id: r.id, name: latest(r.versions)!.name })) }
  async config() { const roles = this.roles(), roleId = this.roleId || (roles.length === 1 ? roles[0]!.id : ''), engine = await this.engine.status(); return { roleId, roles, ready: roles.some(r => r.id === roleId), engine } }
  async configure(roleId: string) { return this.serial(async () => {
    if (!this.roles().some(r => r.id === roleId)) throw new InputError('请选择已绑定本地文件搜索能力的启用岗位')
    await writeFile(join(this.root, 'settings.json.tmp'), JSON.stringify({ roleId })); await rename(join(this.root, 'settings.json.tmp'), join(this.root, 'settings.json')); this.roleId = roleId; return this.config()
  }) }
  list() { return [...this.rows.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) }
  activities() { return [...this.active].map(([id, run]) => ({ id, roleId: run.roleId, roleVersion: run.roleVersion, name: '本地文件搜索', kind: 'file-search', status: 'running', componentIds: ['everything-search'] })) }
  reconcile() { for (const run of this.active.values()) { const s = this.state(), role = s.roles.find(r => r.id === run.roleId), version = role?.versions.find(v => v.version === run.roleVersion); if (!version || role?.archivedAt || role?.removedAt || !allowedActions(s, run.roleId, version).includes('search-files')) run.controller.abort() } }
  cancel(id: string) { this.file(id); this.active.get(id)?.controller.abort(); return { cancelled: id } }
  async search(body: Record<string, unknown>) {
    const id = typeof body.id === 'string' ? body.id : randomUUID(); this.file(id)
    const query = text(body.query, '搜索内容', 500, true), rawPath = text(body.path ?? '', '搜索路径', 2000), requestedRole = typeof body.roleId === 'string' ? body.roleId : ''
    if (this.active.has(id) || this.rows.has(id)) throw new InputError('此搜索已提交，请重新查询', 409)
    const roles = this.roles(), roleId = requestedRole || this.roleId || (roles.length === 1 ? roles[0]!.id : '')
    if (!roles.some(r => r.id === roleId)) throw new InputError('请在本地文件搜索能力设置中选择归属岗位')
    const role = this.state().roles.find(r => r.id === roleId)!, version = latest(role.versions)!, controller = new AbortController()
    if (this.active.size >= 4) throw new InputError('正在处理其他搜索，请稍候', 429)
    this.active.set(id, { controller, roleId, roleVersion: version.version })
    try {
      let directory = ''
      if (rawPath) {
        if (!/^[a-z]:[\\/]/i.test(rawPath) || /["\x00-\x1f]/.test(rawPath)) throw new InputError('请选择本机文件夹或输入完整盘符路径')
        directory = win32.normalize(rawPath)
        if (!(await stat(directory).catch(() => null))?.isDirectory()) throw new InputError('搜索路径不存在或不是文件夹')
      }
      controller.signal.throwIfAborted()
      this.reportUsage?.('capability','local-file-search',id);this.reportUsage?.('role',roleId,id)
      const result = await this.engine.query(query, directory, controller.signal)
      this.reconcile(); controller.signal.throwIfAborted()
      const now = new Date().toISOString(), row: FileSearchRecord = { id, roleId, roleVersion: version.version, roleName: version.name, title: '搜索 · ' + query.slice(0, 80), query, path: directory, createdAt: now, updatedAt: now, ...result }
      return await this.serial(async () => { controller.signal.throwIfAborted(); await writeFile(this.file(id) + '.tmp', JSON.stringify(row)); await rename(this.file(id) + '.tmp', this.file(id)); this.rows.set(id, row); return row })
    } finally { this.active.delete(id) }
  }
  async command(body: Record<string, unknown>) { return this.serial(async () => {
    const id = text(body.id, '搜索记录', 36, true), file = this.file(id), row = this.rows.get(id)
    if (!row) throw new InputError('搜索记录不存在', 404)
    if (body.action === 'delete') { await rm(file); this.rows.delete(id); return { deleted: id } }
    if (body.action !== 'rename') throw new InputError('未知搜索操作')
    const updated = { ...row, title: text(body.title, '名称', 120, true), updatedAt: new Date().toISOString() }
    await writeFile(file + '.tmp', JSON.stringify(updated)); await rename(file + '.tmp', file); this.rows.set(id, updated); return updated
  }) }
  async close() { for (const run of this.active.values()) run.controller.abort(); await this.engine.close(); await this.tail }
}
export async function fileSearchRoutes(service: FileSearchService, req: IncomingMessage, res: ServerResponse) {
  const path = new URL(req.url!, 'http://localhost').pathname.replace('/api/capabilities/file-search/', '')
  if (req.method === 'GET' && path === 'config') return json(res, 200, await service.config())
  if (req.method === 'GET' && path === 'list') return json(res, 200, service.list())
  if (req.method !== 'POST') throw new InputError('接口不存在', 404)
  const body = await readBody(req)
  if (path === 'config') return json(res, 200, await service.configure(body.roleId))
  if (path === 'query') return json(res, 200, await service.search(body))
  if (path === 'cancel') return json(res, 200, service.cancel(body.id))
  if (path === 'command') return json(res, 200, await service.command(body))
  throw new InputError('接口不存在', 404)
}
