import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { join } from 'node:path'
import { dshHome } from '../../../shared/host/dsh-home.ts'
import { components } from './core/model.ts'
import { InputError, object, text } from './core/validation.ts'
import { CapabilityStore } from './host/store.ts'
import { CapabilityRuntime } from './host/runtime.ts'
import { writePresets } from './host/presets.ts'
import { fence, json, readBody } from './host/http.ts'

export const name = 'workbench-capabilities'
export const inject = ['webServer', 'tools', 'agents', 'agentPresets']
declare module '@deepseek-ai/cordis' { interface Context { capabilities: CapabilityRuntime } }
export async function apply(ctx: Context, config: { bskPath?: string; bskHome?: string; port?: number } = {}) {
  const home = dshHome(), store = new CapabilityStore(join(home, 'capabilities'))
  await store.init()
  const runtime = new CapabilityRuntime(ctx, store, { bskPath: config.bskPath ?? process.env.DSH_BSK_PATH ?? '', bskHome: config.bskHome ?? join(home, 'browser-runtime'), port: config.port ?? 52800 })
  try { await writePresets(home, store.snapshot()); await runtime.init() } catch (error) { await runtime.dispose(); await store.close(); throw error }
  ctx.provide('capabilities', runtime)
  ctx.effect(() => ctx.webServer.register({ kind: 'prefix', path: '/api/capabilities', handler: async (req, res) => {
    try {
      fence(req)
      const route = new URL(req.url ?? '/', 'http://localhost').pathname
      if (req.method === 'GET' && route === '/api/capabilities/state') return json(res, 200, { state: store.snapshot(), components, health: runtime.health, tasks: runtime.tasks(), dependencies: runtime.dependencies() })
      if (req.method !== 'POST') throw new InputError('不支持此操作', 405)
      const body = object(await readBody(req))
      if (route === '/api/capabilities/command') { const result = await store.command(body.revision, body.command); await writePresets(home, result.state); return json(res, 200, result) }
      if (route === '/api/capabilities/check') return json(res, 200, await runtime.check())
      if (route === '/api/capabilities/connect') return json(res, 200, await runtime.connect())
      if (route === '/api/capabilities/stop') { await runtime.stop(text(body.sessionId, '会话标识', 150, true)); return json(res, 200, { tasks: runtime.tasks() }) }
      throw new InputError('接口不存在', 404)
    } catch (error) { json(res, error instanceof InputError ? error.status : 500, { error: error instanceof Error ? error.message : '能力服务异常' }) }
  } }), 'capabilities: local API')
  ctx.effect(() => async () => { await runtime.dispose(); await store.close() }, 'capabilities: shutdown')
}
