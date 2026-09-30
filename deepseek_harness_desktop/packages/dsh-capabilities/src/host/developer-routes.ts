import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-workspace'
import type {} from '@deepseek-ai/dsh-subprocess'
import { basename } from 'node:path'
import { object, text, InputError } from '../core/validation.ts'
import { json, readBody } from './http.ts'
import type { DeveloperService } from './developer.ts'

/** Called only after the capability API's same-origin fence and connection authentication. */
export async function developerRoutes(ctx: Context, service: DeveloperService | undefined, req: IncomingMessage, res: ServerResponse) {
  if (!service) throw new InputError('开发工作区服务正在加载，或 Git 插件尚未启用', 503)
  const url = new URL(req.url ?? '/', 'http://localhost'), route = url.pathname.slice('/api/capabilities/developer/'.length)
  const param = (name: string) => url.searchParams.get(name) ?? ''
  const cwd = param('cwd'), files = service.git.workspace
  if (req.method === 'GET') {
    if (route === 'projects') return json(res, 200, ctx.workspaceRegistry.list().map(w => ({ id: w.id, path: w.path, name: basename(w.path) })))
    if (route === 'tasks') return json(res, 200, await service.list())
    if (route === 'task') return json(res, 200, await service.get(param('id')))
    if (route === 'project') return json(res, 200, await service.project(cwd))
    if (route === 'state') return json(res, 200, await files.state(cwd))
    if (route === 'files') return json(res, 200, await files.files(cwd))
    if (route === 'file') return json(res, 200, await files.read(cwd, param('path')))
    if (route === 'search') return json(res, 200, await files.search(cwd, param('q')))
    if (route === 'changes') { const view = await service.changes(param('id'), param('scope'), param('selected') || undefined); return json(res, 200, { files: view.files, label: view.label }) }
    if (route === 'diff') {
      const scope = param('scope')
      if (scope === 'task' || scope === 'round' || scope === 'checkpoint') return json(res, 200, await service.privateDiff(param('id'), scope, param('path'), param('selected') || undefined))
      if (!['staged', 'unstaged', 'branch', 'commit'].includes(scope)) throw new InputError('差异范围无效')
      return json(res, 200, await files.diff(cwd, param('path'), scope as 'staged' | 'unstaged' | 'branch' | 'commit', param('ref') || 'HEAD'))
    }
    if (route === 'compare') return json(res, 200, await files.compare(cwd, param('ref'), param('commit') === 'true'))
    if (route === 'preview') return json(res, 200, await files.preview(cwd))
    if (route === 'graph') return json(res, 200, await service.git.graph(cwd, 100))
    if (route === 'branches') return json(res, 200, await service.git.branches(cwd))
    if (route === 'worktrees') return json(res, 200, { ...(await service.git.worktrees(cwd)), tasks: (await service.list()).items })
    if (route === 'restore-preview') return json(res, 200, await service.restorePreview(param('id'), param('checkpoint')))
    if (route === 'events') {
      await files.root(cwd)
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', 'connection': 'keep-alive' })
      res.write(': connected\n\n')
      const cleanup = await files.subscribe(cwd, () => res.write('event: change\ndata: {}\n\n'))
      const timer = setInterval(() => res.write(': heartbeat\n\n'), 15000)
      res.on('close', () => { cleanup(); clearInterval(timer) }); return
    }
  }
  if (req.method === 'DELETE' && route === 'task') return json(res, 200, await service.remove(param('id')))
  if (req.method !== 'POST') throw new InputError('不支持此操作', 405)
  const data = object(await readBody(req)), id = () => text(data.id, '任务', 36, true)
  if (route === 'register') { const root = text(data.cwd, '项目目录', 4096, true); const w = await ctx.workspaceRegistry.create(root, basename(root)); return json(res, 201, { id: w.id, path: w.path, name: basename(w.path) }) }
  if (route === 'create') return json(res, 201, await service.create(data))
  if (route === 'settings') return json(res, 200, await service.configureTask(id(), data.revision, data.settings))
  if (route === 'project') return json(res, 200, await service.configureProject(text(data.cwd, '目录', 4096, true), data.revision, data.settings))
  if (route === 'send') return json(res, 202, await service.send(id(), data))
  if (route === 'stop') return json(res, 200, await service.stop(id()))
  if (route === 'verify') return json(res, 202, await service.verify(id(), text(data.commandId, '命令', 90, true), text(data.requestId, '请求', 36, true)))
  if (route === 'checkpoint') return json(res, 200, await service.checkpoint(id(), text(data.name, '名称', 120, true)))
  if (route === 'restore') {
    if (!Array.isArray(data.paths) || data.paths.some(p => typeof p !== 'string') || data.paths.length > 100) throw new InputError('恢复文件列表无效')
    return json(res, 200, await service.restore(id(), text(data.checkpoint, '检查点', 36, true), text(data.fingerprint, '指纹', 64, true), data.paths as string[]))
  }
  if (route === 'git') return json(res, 200, await service.gitAction(id(), data.command))
  if (route === 'init') return json(res, 200, await files.initialize(text(data.cwd, '目录', 4096, true)))
  if (route === 'worktree') {
    const result = await service.addWorktree(id(), text(data.name, '目录名称', 100, true), text(data.base || 'HEAD', '起点', 200, true))
    await ctx.workspaceRegistry.create(result.path, 'wt: ' + result.name)
    return json(res, 201, result)
  }
  if (route === 'open-editor') {
    const root = text(data.cwd, '目录', 4096, true), filename = text(data.path, '文件', 1500, true)
    await files.read(root, filename)
    if ((await service.project(root)).editor !== 'vscode') throw new InputError('请先在项目设置选择 VS Code')
    const { spawn } = await import('node:child_process')
    const target = root.replaceAll('\\', '/') + '/' + filename
    // The registered protocol carries only an encoded path. No shell command is constructed.
    const child = process.platform === 'win32' ? spawn('rundll32.exe', ['url.dll,FileProtocolHandler', 'vscode://file/' + target.split('/').map(encodeURIComponent).join('/')], { windowsHide: true, stdio: 'ignore' }) : spawn('code', ['--goto', target], { stdio: 'ignore' })
    await new Promise<void>((resolve, reject) => { child.once('error', reject); child.once('spawn', () => resolve()) })
    child.unref(); return json(res, 200, { requested: true })
  }
  throw new InputError('接口不存在', 404)
}
