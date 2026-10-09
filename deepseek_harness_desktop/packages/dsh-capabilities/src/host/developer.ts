import { ExecutionStore, execution, step } from '../../../../shared/host/execution.ts'
import { randomUUID, createHash } from 'node:crypto'
import type { JevService } from '../../../dsh-jev-mode/src/host/service.ts'
import { mkdir, open, readFile, readdir, rename, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import type { GitService } from '../../../dsh-git-graph/src/host/git-service.ts'
import { changedPaths, lineDiff, type WorkspaceImage } from '../../../dsh-git-graph/src/core/workspace.ts'
import { allowedActions, wasRevoked } from '../core/policy.ts'
import type { Action, State } from '../core/model.ts'
import { InputError, integer, object, text, list } from '../core/validation.ts'
import { DEVELOPER_ROLE_ID, developerSummary, type DeveloperTask, type DeveloperRound, type DeveloperContext, type DeveloperProject } from '../core/developer-model.ts'

type Model = (prompt: string, model: string, signal: AbortSignal) => Promise<string>
type Run = (cwd: string, command: string, signal: AbortSignal, output: (text: string) => void) => Promise<number | null>
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
const now = () => new Date().toISOString()
const errorText = (error: unknown) => error instanceof Error ? error.message : String(error)
const string = (value: unknown, label: string, max = 4000) => value === undefined ? '' : text(value, label, max)
const hash = (value: string) => createHash('sha256').update(value).digest('hex')

/** Developer jobs have immutable cwd and published role bindings. They do not impersonate native sessions. */
export class DeveloperService {
  readonly executions: ExecutionStore
  private tail: Promise<unknown> = Promise.resolve()
  private running = new Map<string, { cwd: string; controller: AbortController; promise?: Promise<void> }>()
  private closed = false
  constructor(readonly root: string, readonly git: GitService, private model: Model, private run: Run, private state: () => State, private jev?: JevService, private skillGuidance?: (roleId:string,version:number,cwd?:string,createdAt?:number)=>string) { this.executions = new ExecutionStore(join(root,'_executions')) }
  private serialized<T>(fn: () => Promise<T>): Promise<T> { const next = this.tail.then(fn); this.tail = next.catch(() => {}); return next }
  private path(id: string, sub = '') { if (!UUID.test(id)) throw new InputError('开发任务标识无效'); return join(this.root, sub, id + '.json') }
  private async atomic(file: string, value: unknown) {
    const temp = file + '.' + randomUUID() + '.tmp', handle = await open(temp, 'wx', 0o600)
    try { await handle.writeFile(JSON.stringify(value)); await handle.sync() } finally { await handle.close() }
    try { await rename(temp, file) } finally { await unlink(temp).catch(() => {}) }
  }
  async init() {
    await this.executions.init()
    for (const folder of ['', 'snapshots', 'projects']) await mkdir(join(this.root, folder), { recursive: true })
    for (const item of (await this.list()).items) {
      const task = await this.get(item.id)
      for (const run of [...task.rounds, ...task.checks]) if (run.status === 'running') run.status = 'interrupted'
      if (item.running) { this.event(task, 'system', '工作台重启，未完成执行已标为中断；不会自动重放'); await this.save(task) }
    }
  }
  private authorize(task: Pick<DeveloperTask, 'roleId' | 'roleVersion' | 'authorityAt'>, action: Action = 'develop') {
    const state = this.state(), role = state.roles.find(r => r.id === task.roleId), version = role?.versions.find(v => v.version === task.roleVersion)
    if (!version || !allowedActions(state, task.roleId, version).includes(action) || wasRevoked(state, task.roleId, version, task.authorityAt)) throw new InputError('此任务的开发能力授权已撤销或未发布，请在能力中心检查', 403)
    return version
  }
  private idle(cwd: string) { if ([...this.running.values()].some(value => value.cwd === cwd)) throw new InputError('此目录有开发或验证正在执行，请先停止或等待完成', 409) }
  private event(task: DeveloperTask, kind: DeveloperTask['events'][number]['kind'], message: string, path?: string) {
    step('event-'+task.events.length,({read:'读取项目',write:'修改文件',git:'Git操作',run:'运行检查',snapshot:'保存检查点',system:'执行状态'})[kind],'done',message+(path?' · '+path:''))
    task.events.push({ runId:execution()?.record.id, id: randomUUID(), at: now(), kind, text: message, ...(path ? { path } : {}) })
    if (task.events.length > 3000) task.events.splice(0, task.events.length - 3000)
  }
  private async save(task: DeveloperTask) { task.revision++; task.updatedAt = now(); await this.atomic(this.path(task.id), task); return structuredClone(task) }
  private async update(id: string, fn: (task: DeveloperTask) => void | Promise<void>) { return this.serialized(async () => { const task = await this.get(id); await fn(task); return this.save(task) }) }
  private async snapshot(cwd: string) { const id = randomUUID(); await this.atomic(this.path(id, 'snapshots'), await this.git.workspace.capture(cwd)); return id }
  private async image(id: string): Promise<WorkspaceImage> { return JSON.parse(await readFile(this.path(id, 'snapshots'), 'utf8')) }
  async get(id: string): Promise<DeveloperTask> {
    try { const data = JSON.parse(await readFile(this.path(id), 'utf8')); if (data.schema !== 1 || data.id !== id || !Array.isArray(data.rounds) || !Array.isArray(data.messages)) throw new Error('开发任务格式损坏，原文件已保留'); return data }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new InputError('开发记录不存在', 404); throw error }
  }
  async list() {
    const items = []
    let unreadableCount = 0
    for (const file of await readdir(this.root)) if (file.endsWith('.json') && UUID.test(file.slice(0, -5))) {
      try { items.push(developerSummary(await this.get(file.slice(0, -5)))) } catch { unreadableCount++ }
    }
    return { items: items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), total: items.length, unreadableCount }
  }
  async create(raw: unknown) { return this.serialized(async () => {
    const data = object(raw), id = text(data.requestId, '创建请求标识', 36, true), cwd = await this.git.workspace.root(text(data.cwd, '目录', 4096, true))
    const roleId = string(data.roleId, '岗位', 90) || DEVELOPER_ROLE_ID
    const roleVersion = data.roleVersion === undefined ? this.state().roles.find(r => r.id === roleId)?.versions.at(-1)?.version ?? 0 : integer(data.roleVersion)
    const authority = { roleId, roleVersion, authorityAt: Date.now() }; this.authorize(authority)
    try { const existing = await this.get(id); if (existing.cwd !== cwd || existing.roleId !== roleId || existing.roleVersion !== roleVersion) throw new InputError('创建请求已关联另一开发任务', 409); return existing } catch (error) { if (!(error instanceof InputError && error.status === 404)) throw error }
    const task: DeveloperTask = { schema: 1, id, revision: 0, title: string(data.title, '名称', 120) || '新开发任务', cwd, ...authority, createdAt: now(), updatedAt: now(), permission: 'read', model: string(data.model, '模型', 250), baseline: await this.snapshot(cwd), draft: '', messages: [], rounds: [], checks: [], checkpoints: [], events: [] }
    this.event(task, 'system', '绑定项目并记录任务起点；原有修改保持'); return this.save(task)
  }) }
  async remove(id: string) { return this.serialized(async () => { const task = await this.get(id); this.idle(task.cwd); await unlink(this.path(id)); await this.executions.remove(id);return { ok: true } }) }
  async configureTask(id: string, revision: unknown, raw: unknown) { return this.update(id, task => {
    if (task.revision !== integer(revision)) throw new InputError('任务已更新，请重新读取后保存', 409)
    this.authorize(task); const data = object(raw)
    if (data.title !== undefined) task.title = text(data.title, '任务名称', 120, true)
    if (data.model !== undefined) task.model = text(data.model, '模型', 250)
    if (data.draft !== undefined) task.draft = text(data.draft, '输入草稿', 30000)
    if (data.permission !== undefined) {
      if (!['read', 'edit'].includes(String(data.permission))) throw new InputError('权限无效')
      task.permission = data.permission as 'read' | 'edit'
      if (task.permission === 'read') this.running.get(id)?.controller.abort()
    }
  }) }
  async project(cwd: string): Promise<DeveloperProject & { candidates: { name: string; command: string }[] }> {
    const root = await this.git.workspace.root(cwd)
    let config: DeveloperProject = { revision: 0, commands: [], editor: 'none' }
    try { config = JSON.parse(await readFile(join(this.root, 'projects', hash(root) + '.json'), 'utf8')) } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
    let candidates: { name: string; command: string }[] = []
    try {
      const packageFile = await this.git.workspace.read(root, 'package.json'), pkg = JSON.parse(packageFile.text)
      const pm = (typeof pkg.packageManager === 'string' && pkg.packageManager.startsWith('pnpm@') ? 'pnpm' : 'npm') + (process.platform === 'win32' ? '.cmd' : '')
      candidates = Object.keys(object(pkg.scripts ?? {})).filter(name => /^[a-zA-Z0-9:_-]+$/.test(name)).map(name => ({ name, command: `${pm} run ${name}` }))
    } catch { /* No scripts available: the UI explicitly asks for a command. */ }
    return { ...config, candidates }
  }
  async configureProject(cwd: string, revision: unknown, raw: unknown) { return this.serialized(async () => {
    const root = await this.git.workspace.root(cwd); this.idle(root)
    const old = await this.project(root), data = object(raw)
    if (integer(revision) !== old.revision) throw new InputError('项目设置已变化，请重新读取', 409)
    const commands = list(data.commands, 20).map(value => { const c = object(value); return { id: text(c.id, '命令标识', 90, true), name: text(c.name, '名称', 120, true), command: text(c.command, '命令', 2000, true) } })
    if (new Set(commands.map(c => c.id)).size !== commands.length) throw new InputError('命令标识重复')
    if (!['none', 'vscode'].includes(String(data.editor))) throw new InputError('编辑器配置无效')
    const config: DeveloperProject = { revision: old.revision + 1, commands, editor: data.editor as DeveloperProject['editor'] }
    await this.atomic(join(this.root, 'projects', hash(root) + '.json'), config); return this.project(root)
  }) }
  async changes(id: string, scope: string, selected?: string) {
    const task = await this.get(id)
    let before: WorkspaceImage, after: WorkspaceImage
    if (scope === 'round') {
      const round = selected ? task.rounds.find(r => r.id === selected) : task.rounds.at(-1)
      if (!round) return { files: [], before: null, after: null, label: '尚无开发轮次' }
      before = await this.image(round.before); after = round.after ? await this.image(round.after) : await this.git.workspace.capture(task.cwd)
    } else {
      const checkpoint = selected ? task.checkpoints.find(c => c.id === selected) : undefined
      if (selected && !checkpoint) throw new InputError('检查点不存在')
      before = await this.image(checkpoint?.snapshot ?? task.baseline); after = await this.git.workspace.capture(task.cwd)
    }
    return { files: changedPaths(before, after), before, after, label: `${before.at} → ${after.at}（包含期间外部改动，归属以操作轨迹为准）` }
  }
  async privateDiff(id: string, scope: string, path: string, selected?: string) {
    const images = await this.changes(id, scope, selected)
    const before = images.before?.files[path], after = images.after?.files[path]
    return { path, before: { path, version: before?.hash ?? 'missing', size: before?.size ?? 0, text: before?.text ?? '', reason: before?.reason }, after: { path, version: after?.hash ?? 'missing', size: after?.size ?? 0, text: after?.text ?? '', reason: after?.reason }, label: images.label, patch: before?.reason || after?.reason ? '' : lineDiff(before?.text ?? '', after?.text ?? '', path) }
  }
  async checkpoint(id: string, name: string) { return this.update(id, async task => {
    this.authorize(task); this.idle(task.cwd)
    if (task.checkpoints.length >= 100) throw new InputError('当前任务已有 100 个检查点，请新建任务继续')
    task.checkpoints.push({ id: randomUUID(), name: text(name, '检查点名称', 120, true), at: now(), snapshot: await this.snapshot(task.cwd) }); this.event(task, 'snapshot', '保存检查点：' + name)
  }) }
  async restorePreview(id: string, checkpointId: string) {
    const task = await this.get(id), checkpoint = task.checkpoints.find(c => c.id === checkpointId)
    if (!checkpoint) throw new InputError('检查点不存在')
    const before = await this.image(checkpoint.snapshot), after = await this.git.workspace.capture(task.cwd), state = await this.git.workspace.state(task.cwd)
    const writes = new Map(task.rounds.flatMap(r => r.writes).map(w => [w.path, w]))
    return { fingerprint: after.fingerprint, index: state.index, files: changedPaths(before, after).map(path => {
      const expected = writes.get(path)?.after, current = after.files[path]?.hash ?? 'missing'
      const reason = !expected ? '不是本任务记录的写入' : expected !== current ? '之后已有其他修改' : before.files[path]?.reason || after.files[path]?.reason ? '此文件未保存完整文本' : state.files.some(f => f.path === path && f.index !== ' ' && f.index !== '?') ? '文件在暂存区有变化' : ''
      return { path, reason, action: before.files[path] ? after.files[path] ? '修改' : '恢复' : '移除' }
    }) }
  }
  async restore(id: string, checkpointId: string, fingerprint: string, names: string[]) {await this.get(id);return this.executions.run(id,{operation:'恢复检查点',input:'恢复选中的文件：'+names.join('、')},()=>this.restoreWork(id,checkpointId,fingerprint,names),()=>({status:'done',summary:'所选文件恢复完成'}))}
  private async restoreWork(id: string, checkpointId: string, fingerprint: string, names: string[]) { return this.serialized(async () => {
    const task = await this.get(id)
    this.authorize(task); this.idle(task.cwd)
    if (task.permission !== 'edit') throw new InputError('请先允许编辑', 403)
    const preview = await this.restorePreview(id, checkpointId)
    if (preview.fingerprint !== fingerprint || !names.length || names.some(name => !preview.files.some(f => f.path === name && !f.reason))) throw new InputError('恢复预览已失效或选中项有冲突，请重新预览', 409)
    const target = await this.image(task.checkpoints.find(c => c.id === checkpointId)!.snapshot)
    const round: DeveloperRound = { id: randomUUID(), at: now(), before: await this.snapshot(task.cwd), status: 'running', writes: [] }
    const release = await this.git.workspace.lease(task.cwd, round.id)
    task.rounds.push(round)
    try {
      await this.save(task)
      for (const name of new Set(names)) {
        this.authorize(task)
        const current = await this.git.workspace.read(task.cwd, name), state = await this.git.workspace.state(task.cwd)
        if (state.operation || state.files.some(f => f.conflict) || state.index !== preview.index) throw new InputError('暂存区或 Git 状态已改变，剩余恢复已停止', 409)
        const expected = task.rounds.flatMap(r => r.writes).filter(w => w.path === name).at(-1)?.after
        if (!expected || current.version !== expected) throw new InputError('文件已改变，剩余恢复已停止：' + name, 409)
        const restored = await this.git.workspace.write(task.cwd, name, target.files[name]?.text ?? null, expected)
        round.writes.push({ path: name, before: expected, after: restored.version })
        this.event(task, 'write', '从检查点恢复（保留暂存区）', name)
        await this.save(task)
      }
      round.after = await this.snapshot(task.cwd); round.status = 'done'
      this.event(task, 'snapshot', '检查点恢复完成'); return await this.save(task)
    } catch (error) {
      round.status = 'failed'; round.error = errorText(error)
      try { round.after = await this.snapshot(task.cwd) } catch { /* Keep partial write records even if the directory disappears. */ }
      this.event(task, 'snapshot', '恢复已停止；已完成的文件和记录保留：' + round.error)
      await this.save(task); throw error
    } finally { release() }
  }) }
  async addWorktree(id: string, name: string, base: string) { return this.serialized(async () => {
    const task = await this.get(id); this.authorize(task, 'inspect-git'); this.idle(task.cwd)
    const result = await this.git.addWorktree(task.cwd, name, base)
    if (!result.ok) throw new InputError(result.error.message, 409)
    this.event(task, 'git', '创建独立工作目录：' + result.path); await this.save(task); return result
  }) }
  async gitAction(id: string, raw: unknown) { await this.get(id); return this.executions.run(id,{operation:'Git 操作',input:'执行已选择的 Git 操作'},()=>this.gitActionWork(id,raw),()=>({status:'done',summary:'Git 操作已完成'})) }
  private async gitActionWork(id: string, raw: unknown) { return this.update(id, async task => {
    this.authorize(task, 'inspect-git'); this.idle(task.cwd); const data = object(raw)
    if (data.type === 'stage' || data.type === 'unstage') {
      const expected = object(data.expected)
      await this.git.workspace.stage(task.cwd, list(data.paths, 100).map(v => text(v, '路径', 1500, true)), data.type === 'unstage', { head: text(expected.head, 'HEAD', 64), index: text(expected.index, '索引', 64, true), fingerprint: text(expected.fingerprint, '代码指纹', 64, true) })
      this.event(task, 'git', data.type === 'stage' ? '按文件暂存' : '取消文件暂存')
    } else if (data.type === 'commit') {
      const expected = object(data.expected), result = await this.git.workspace.commit(task.cwd, text(data.message, '提交说明', 4000, true), { head: text(expected.head, 'HEAD', 64), index: text(expected.index, '索引', 64, true) })
      this.event(task, 'git', '创建本地提交 ' + result.head)
    } else if (data.type === 'switch' || data.type === 'branch') {
      const result = data.type === 'switch' ? await this.git.switchBranch(task.cwd, text(data.name, '分支', 200, true)) : await this.git.createBranch(task.cwd, text(data.name, '分支', 200, true))
      if (!result.ok) throw new InputError(result.error.message, 409)
      this.event(task, 'git', (data.type === 'switch' ? '切换分支 ' : '从当前 HEAD 创建并切换分支 ') + result.branch)
    } else throw new InputError('不支持的 Git 操作')
  }) }
  async stop(id: string) { const active = this.running.get(id); active?.controller.abort(); if (active?.promise) await active.promise; return this.get(id) }
  private launch(task: DeveloperTask, release: () => void, fn: (signal: AbortSignal) => Promise<void>) {
    if (this.closed) throw new InputError('服务正在关闭', 503)
    const active = { cwd: task.cwd, controller: new AbortController(), promise: undefined as Promise<void> | undefined }
    this.running.set(task.id, active)
    const timer = setInterval(() => { try { this.authorize(task) } catch { active.controller.abort() } }, 1000)
    active.promise = Promise.resolve().then(() => fn(active.controller.signal)).finally(() => { clearInterval(timer); release(); if (this.running.get(task.id) === active) this.running.delete(task.id) })
    void active.promise.catch(() => {})
  }
  async send(id: string, raw: unknown) { return this.serialized(async () => {
    const task = await this.get(id), data = object(raw), requestId = text(data.requestId, '请求标识', 36, true)
    if (!UUID.test(requestId)) throw new InputError('请求标识无效')
    if (task.rounds.some(r => r.id === requestId)) return task
    this.authorize(task); this.idle(task.cwd)
    const message = text(data.message, '消息', 30000, true)
    const contexts: DeveloperContext[] = list(data.contexts ?? [], 12).map(value => { const ref = object(value); return { path: text(ref.path, '文件', 1500, true), side: ref.side === 'before' ? 'before' : 'after', version: text(ref.version, '引用版本', 200), start: integer(ref.start), end: integer(ref.end), text: text(ref.text, '片段', 16000) } })
    task.messages.push({ id: randomUUID(), role: 'user', runId:requestId, text: message, at: now(), contexts }); task.draft = ''
    task.model = string(data.model, '模型', 250) || task.model
    const round: DeveloperRound = { id: requestId, at: now(), before: await this.snapshot(task.cwd), status: 'running', writes: [] }
    task.rounds.push(round); this.event(task, 'system', '开始开发轮次；权限：' + (task.permission === 'edit' ? '允许项目内文本编辑' : '只读'))
    const release = await this.git.workspace.lease(task.cwd, requestId)
    try { await this.save(task); this.launch(task, release, signal => this.develop(task.id, requestId, signal)) } catch (error) { release(); throw error }
    return task
  }) }
  private async develop(id: string, roundId: string, signal: AbortSignal) {
    const task=await this.get(id)
    await this.executions.run(id,{id:roundId,operation:'开发任务',input:task.messages.at(-1)?.text??'执行开发任务',inputKind:'user',model:task.model,roleVersion:task.roleVersion},async()=>{step('permission','检查项目权限','done',task.permission==='edit'?'允许项目内编辑':'只读讨论');await this.developWork(id,roundId,signal);return this.get(id)},value=>{const round=value.rounds.find(r=>r.id===roundId)!;return {status:round.status==='done'?'done':signal.aborted?'stopped':execution()?.record.events.some(e=>e.status==='review')?'review':'failed',summary:round.error||'开发轮次已保存；测试状态以实际验证记录为准',result:round.status==='done'?{kind:'developer',text:value.messages.at(-1)?.text??''}:undefined}})
  }
  private async developWork(id: string, roundId: string, signal: AbortSignal) {
    const observed = new Map<string, string>(), evidence: unknown[] = []
    const jev = this.jev?.begin('developer:'+id)
    let formatRetries = 0
    try {
      let task = await this.get(id)
      await jev?.check('begin', {permission:task.permission,messages:task.messages.slice(-16)}, signal)
      const listing = await this.git.workspace.files(task.cwd)
      // Project rules are data for the development agent, scoped to its selected directory.
      for (const name of listing.files.filter(name => /(^|\/)AGENTS\.md$/i.test(name)).slice(0, 30)) {
        const file = await this.git.workspace.read(task.cwd, name); evidence.push({ operation: 'project-rule', path: name, text: file.text.slice(0, 18000) })
      }
      for (let step = 0; step < 24; step++) {
        signal.throwIfAborted(); task = await this.get(id); const role = this.authorize(task)
        const prompt = JSON.stringify({ project: task.cwd, permission: task.permission, role: { duties: role.duties, requirements: role.requirements, format: role.format, skills: this.skillGuidance?.(task.roleId,task.roleVersion,task.cwd,Date.parse(task.createdAt)) }, files: listing.files.slice(0, 2500), conversation: task.messages.slice(-16), operations: evidence.slice(-24) })
        const output = await this.model(prompt + (jev?.guidance() ?? ''), task.model, signal); signal.throwIfAborted()
        let command: Record<string, unknown>
        try { command = object(JSON.parse(output.trim().replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, ''))) }
        catch {
          if (formatRetries >= 2 || step === 23) throw new InputError('模型未返回有效的开发指令，重试后已停止；已有写入保留')
          formatRetries++
          evidence.push({ error: '上次输出不是单个有效 JSON 对象，未执行任何操作。请按系统指定的 action 格式重新输出；中文分析放入 finish 的 message 字段。岗位输出格式仅约束 message，不替代外层 JSON。' })
          await this.update(id, current => this.event(current, 'system', `模型返回格式无效，正在重试（${formatRetries}/2）`))
          continue
        }
        if (command.action === 'finish') {
          const reviewed=await jev?.check('review',{messages:task.messages.slice(-16),evidence,answer:command.message},signal)
          if(reviewed?.decision==='clarify')command.message=String(command.message)+'\n\nJEV 待确认：'+reviewed.summary+'\n'+reviewed.missing.join('\n')
          await this.update(id, current => { current.messages.push({ id: randomUUID(), role: 'assistant', runId:roundId, text: text(command.message, '回答', 40000, true), at: now() }) }); break
        }
        const name = string(command.path, '文件路径', 1500)
        if (command.action === 'read') {
          const file = await this.git.workspace.read(task.cwd, name); observed.set(name, file.version); evidence.push({ action: 'read', ...file, text: file.text.slice(0, 48000) })
          await this.update(id, current => this.event(current, 'read', '读取文件', name))
        } else if (command.action === 'search') {
          evidence.push({ action: 'search', matches: await this.git.workspace.search(task.cwd, text(command.query, '搜索', 200, true)) })
          await this.update(id, current => this.event(current, 'read', '搜索项目内容'))
        } else if (command.action === 'write' || command.action === 'remove') {
          const current = await this.get(id); this.authorize(current); signal.throwIfAborted()
          if (current.permission !== 'edit') { evidence.push({ error: '任务为只读，请说明建议并结束，不能修改' }); continue }
          const expected = observed.get(name)
          if (!expected) { evidence.push({ error: '必须先 read 此路径，包括新文件；使用当前内容再修改' }); continue }
          await jev?.check('action',{permission:current.permission,messages:current.messages.slice(-4),command,expectedVersion:expected,evidence:evidence.slice(-6)},signal)
          const authorized=await this.get(id);this.authorize(authorized);signal.throwIfAborted()
          if(authorized.permission!=='edit')throw new InputError('检查期间任务编辑权限已改变，未写入文件',409)
          const result = await this.git.workspace.write(task.cwd, name, command.action === 'remove' ? null : text(command.content, '文件内容', 256 * 1024), expected)
          observed.set(name, result.version)
          evidence.push({ action: command.action, path: name, version: result.version, completed: true })
          await this.update(id, current => { current.rounds.find(r => r.id === roundId)!.writes.push({ path: name, before: expected, after: result.version }); this.event(current, 'write', command.action === 'remove' ? '已移除文件' : '已写入文件', name) })
        } else throw new InputError('模型请求了未经适配的动作，已停止：' + String(command.action))
        if (step === 23) throw new InputError('本轮达到 24 次操作上限，已有结果保留，可继续发送')
      }
      await this.update(id, async task => { const round = task.rounds.find(r => r.id === roundId)!; round.after = await this.snapshot(task.cwd); round.status = 'done'; this.event(task, 'system', '本轮开发完成；测试状态以运行页为准') })
    } catch (error) {
      await this.update(id, async task => {
        const round = task.rounds.find(r => r.id === roundId)!; round.status = signal.aborted ? 'stopped' : 'failed'; round.error = signal.aborted ? '已停止，保留已经完成的写入' : errorText(error)
        try { round.after = await this.snapshot(task.cwd) } catch { /* Missing directory does not erase the failure record. */ }
        this.event(task, 'system', round.error)
      })
    } finally { jev?.finish() }
  }
  async verify(id: string, commandId: string, requestId: string) { return this.serialized(async () => {
    const task = await this.get(id)
    if (!UUID.test(requestId)) throw new InputError('运行请求标识无效')
    if (task.checks.some(c => c.id === requestId)) return task
    this.authorize(task, 'verify-code'); this.idle(task.cwd)
    const command = (await this.project(task.cwd)).commands.find(c => c.id === commandId)
    if (!command) throw new InputError('请先在项目设置中确认验证命令')
    const state = await this.git.workspace.state(task.cwd)
    task.checks.push({ id: requestId, name: command.name, command: command.command, cwd: task.cwd, fingerprint: state.fingerprint, index: state.index, head: state.head, at: now(), status: 'running', output: '' })
    this.event(task, 'run', '执行验证：' + command.name)
    const release = await this.git.workspace.lease(task.cwd, requestId)
    try { await this.save(task) } catch (error) { release(); throw error }
    this.launch(task, release, async signal => this.executions.run(id,{id:requestId,operation:'运行验证',input:command.name+'：'+command.command},async()=>{
      let output = '', exitCode: number | null = null, error = ''
      const persist = setInterval(() => { void this.update(id, current => { const check = current.checks.find(c => c.id === requestId)!; check.output = output }).catch(() => {}) }, 1000)
      try { exitCode = await this.run(task.cwd, command.command, signal, chunk => { output = (output + chunk).slice(-160000) }) } catch (e) { error = errorText(e) }
      finally { clearInterval(persist) }
      const after = await this.git.workspace.state(task.cwd).catch(() => undefined)
      await this.update(id, current => { const check = current.checks.find(c => c.id === requestId)!; check.output = output + (error ? '\n' + error : ''); check.exitCode = exitCode; check.finishedAt = now(); check.status = signal.aborted ? 'stopped' : exitCode === 0 && !error ? 'passed' : 'failed'; check.changedDuringRun = after?.fingerprint !== state.fingerprint; this.event(current, 'run', `${command.name}：${check.status}${check.changedDuringRun ? '；运行期间代码有变化' : ''}`) })
      return this.get(id)
    },value=>{const check=value.checks.find(c=>c.id===requestId)!;return {status:check.status==='passed'?'done':check.status==='stopped'?'stopped':'failed',summary:command.name+'：'+check.status+(check.changedDuringRun?'；代码变化，需重新验证':''),result:{kind:'check',text:check.output}}}).then(()=>undefined)); return task
  }) }
  async componentActivities() {
    return Promise.all([...this.running.keys()].map(async id => { const task = await this.get(id); return { id, roleId: task.roleId, roleVersion: task.roleVersion, name: task.title, kind: 'developer', status: 'running', componentIds: ['developer-files', 'developer-git', 'developer-checks'] } }))
  }
  async stopComponents(ids: string[]) { const activities = await this.componentActivities(); const runs = activities.filter(t => t.componentIds.some(id => ids.includes(id))).map(t => this.running.get(t.id)).filter(Boolean); runs.forEach(run => run!.controller.abort()); await Promise.allSettled(runs.map(run => run!.promise)) }
  async close() { this.closed = true; for (const run of this.running.values()) run.controller.abort(); await Promise.allSettled([...this.running.values()].map(run => run.promise)); await this.tail }
}
