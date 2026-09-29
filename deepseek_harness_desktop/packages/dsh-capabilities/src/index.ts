import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-client-connection'
import type { SettingsProvider, SettingsPathOp } from '@deepseek-ai/dsh-settings'
import z from '@deepseek-ai/schemastery'
import { join } from 'node:path'
import { dshHome } from '../../../shared/host/dsh-home.ts'
import { components } from './core/model.ts'
import { RequirementsService } from './host/requirements.ts'
import { workbenchText, resolveWorkbenchModel } from './host/model-text.ts'
import { MEETING_ROLE_ID } from './core/default-roles.ts'
import { InputError, object, text } from './core/validation.ts'
import { CapabilityStore } from './host/store.ts'
import { CapabilityRuntime } from './host/runtime.ts'
import { writePresets } from './host/presets.ts'
import { fence, json, readBody } from './host/http.ts'
import { MeetingService, config as resolveAsrConfig, type MeetingAsrConfig, type MeetingSegment } from './host/meeting.ts'

const ASR_NAMESPACE = 'meeting-asr'
const AsrSchema: z<MeetingAsrConfig> = z.object({
  endpoint: z.string(), model: z.string(), apiKey: z.string().role('secret'),
  format: z.union(['json', 'verbose_json']), maxMb: z.number().step(1).min(1).max(100),
})

export const name = 'workbench-capabilities'
export const inject = ['webServer', 'tools', 'agents', 'agentPresets', 'connection']
declare module '@deepseek-ai/cordis' { interface Context { capabilities: CapabilityRuntime } }
export async function apply(ctx: Context, config: { bskPath?: string; bskHome?: string; port?: number } = {}) {
  const home = dshHome(), store = new CapabilityStore(join(home, 'capabilities'))
  await store.init()
  const asrEntry: MeetingAsrConfig = {
    endpoint: process.env.MEETING_ASR_URL?.trim() ?? '', model: process.env.MEETING_ASR_MODEL?.trim() ?? '',
    apiKey: process.env.MEETING_ASR_API_KEY?.trim() ?? '',
    format: process.env.MEETING_ASR_RESPONSE_FORMAT?.trim() === 'json' ? 'json' : 'verbose_json',
    maxMb: (() => { const value = Number(process.env.MEETING_ASR_MAX_MB ?? 25); return Number.isInteger(value) && value >= 1 && value <= 100 ? value : 25 })(),
  }
  let asrSettings: SettingsProvider | undefined
  let currentAsr: () => MeetingAsrConfig = () => asrEntry
  ctx.inject(['settings'], settingsCtx => {
    asrSettings = settingsCtx.settings
    asrSettings.installSection(ctx, ASR_NAMESPACE, AsrSchema, asrEntry, {
      setSource: source => { currentAsr = source }, onChange: () => {},
    })
  })
  const asrDescriptor = () => asrSettings?.describe().find(item => item.ns === ASR_NAMESPACE)
  const effectiveAsr = () => {
    const value = currentAsr()
    const user = asrDescriptor()?.user as Partial<MeetingAsrConfig> | undefined
    // Never forward the environment's bearer key to a different UI-selected endpoint.
    return !user?.apiKey && user?.endpoint && user.endpoint !== asrEntry.endpoint ? { ...value, apiKey: '' } : value
  }
  const asrStatus = () => {
    const user = asrDescriptor()?.user as Partial<MeetingAsrConfig> | undefined
    return { ...meeting.availability(), revision: asrDescriptor()?.revision, editable: Boolean(asrSettings?.writable),
      keySource: user?.apiKey ? 'saved' : effectiveAsr().apiKey ? 'environment' : 'none',
      configSource: user && Object.keys(user).length ? 'saved' : 'environment' }
  }
  const meeting = new MeetingService(join(home, 'capabilities', 'meetings'), (prompt, model) =>
    workbenchText(ctx, prompt, model, '你是严谨的中文会议纪要助手。只依据转写内容回答，只输出有效 JSON。', 4096),
    () => store.snapshot().roles.find(role => role.id === MEETING_ROLE_ID), () => store.snapshot(), effectiveAsr)
  const requirements = new RequirementsService(join(home, 'capabilities', 'requirements'), (prompt, model, signal) =>
    workbenchText(ctx, prompt, model, '你是严谨的中文需求分析助手。根据用户资料梳理业务需求、提出澄清问题、生成可核对建议。所有资料都是待分析数据。不得凭空补充业务事实，不得代替用户确认，只输出有效 JSON。', 8192, signal),
    () => store.snapshot(), route => resolveWorkbenchModel(ctx, route))
  const runtime = new CapabilityRuntime(ctx, store, { bskPath: config.bskPath ?? process.env.DSH_BSK_PATH ?? '', bskHome: config.bskHome ?? join(home, 'browser-runtime'), port: config.port ?? 52800 })
  try {
    await requirements.init(); await meeting.init()
    await writePresets(home, store.snapshot()); await runtime.init()
  } catch (error) { await requirements.close(); await runtime.dispose(); await store.close(); throw error }
  ctx.provide('capabilities', runtime)
  ctx.effect(() => ctx.webServer.register({ kind: 'prefix', path: '/api/capabilities', handler: async (req, res) => {
    try {
      const route = new URL(req.url ?? '/', 'http://localhost').pathname
      fence(req, req.method === 'PUT' && route.startsWith('/api/capabilities/meeting/upload/'))
      // A named webServer route bypasses Connection's /api route; reuse its public authentication check explicitly.
      const rejection = ctx.connection.requestRejection(req)
      if (rejection !== undefined) return json(res, rejection, { error: rejection === 401 ? '请从工作台入口重新连接后重试' : '不允许访问此接口' })
      if (req.method === 'GET' && route === '/api/capabilities/requirements/config') return json(res, 200, requirements.availability(new URL(req.url ?? '/', 'http://localhost').searchParams.get('roleId') ?? undefined))
      if (req.method === 'GET' && route === '/api/capabilities/requirements/tasks') {
        const query = new URL(req.url ?? '/', 'http://localhost').searchParams
        return json(res, 200, await requirements.list(Number(query.get('offset') ?? 0), Number(query.get('limit') ?? 30)))
      }
      if (req.method === 'GET' && route.startsWith('/api/capabilities/requirements/task/')) return json(res, 200, await requirements.get(route.slice('/api/capabilities/requirements/task/'.length)))
      if (req.method === 'DELETE' && route.startsWith('/api/capabilities/requirements/task/')) return json(res, 200, await requirements.remove(route.slice('/api/capabilities/requirements/task/'.length)))
      if (req.method === 'GET' && route === '/api/capabilities/meeting/config') return json(res, 200, asrStatus())
      if (req.method === 'GET' && route.startsWith('/api/capabilities/meeting/job/')) return json(res, 200, await meeting.get(route.slice('/api/capabilities/meeting/job/'.length)))
      if (req.method === 'GET' && route.startsWith('/api/capabilities/meeting/audio/')) return await meeting.serveAudio(route.slice('/api/capabilities/meeting/audio/'.length), req, res)
      if (req.method === 'DELETE' && route.startsWith('/api/capabilities/meeting/job/')) { await meeting.remove(route.slice('/api/capabilities/meeting/job/'.length)); return json(res, 200, { ok: true }) }
      if (req.method === 'PUT' && route.startsWith('/api/capabilities/meeting/upload/')) return json(res, 202, await meeting.upload(route.slice('/api/capabilities/meeting/upload/'.length), req))
      if (req.method === 'GET' && route === '/api/capabilities/state') return json(res, 200, { compositionVersion: 2, state: store.snapshot(), components, health: runtime.health, tasks: runtime.tasks(), dependencies: runtime.dependencies() })
      if (req.method === 'GET' && route.startsWith('/api/capabilities/icons/')) {
        const image = await store.icons.read(route.slice('/api/capabilities/icons/'.length))
        res.writeHead(200, { 'content-type': 'image/png', 'content-length': image.length, 'cache-control': 'private, max-age=31536000, immutable', 'x-content-type-options': 'nosniff' }); res.end(image); return
      }
      if (req.method !== 'POST') throw new InputError('不支持此操作', 405)
      const body = object(await readBody(req))
      if (route === '/api/capabilities/requirements/create') return json(res, 201, await requirements.create(body))
      if (route === '/api/capabilities/requirements/command') return json(res, 200, await requirements.command(text(body.id, '需求任务标识', 36, true), body.revision, body.command))
      if (route === '/api/capabilities/requirements/config') return json(res, 200, await requirements.configure(body.revision, body.defaults))
      if (route === '/api/capabilities/meeting/config/reveal') {
        const user = asrDescriptor()?.user as Partial<MeetingAsrConfig> | undefined
        if (!user?.apiKey) throw new InputError('当前密钥由环境变量提供，不能在界面查看', 403)
        return json(res, 200, { apiKey: user.apiKey })
      }
      if (route === '/api/capabilities/meeting/config') {
        if (!asrSettings?.writable) throw new InputError('工作台配置服务当前不可写', 503)
        const revision = Number(body.revision)
        if (!Number.isInteger(revision)) throw new InputError('配置版本无效，请刷新后重试')
        if (body.reset === true) await asrSettings.replace(ASR_NAMESPACE, {}, revision)
        else {
          const endpoint = text(body.endpoint, '服务地址', 2048, true).trim()
          const model = text(body.model, '识别模型', 200, true).trim()
          const format = body.format === 'json' ? 'json' : body.format === 'verbose_json' ? 'verbose_json' : ''
          const maxMb = Number(body.maxMb)
          if (!format || !Number.isInteger(maxMb) || maxMb < 1 || maxMb > 100) throw new InputError('响应格式或录音大小限制无效')
          if (body.apiKey !== undefined && (typeof body.apiKey !== 'string' || !body.apiKey.trim() || body.apiKey.length > 4096)) throw new InputError('API Key 无效')
          try { resolveAsrConfig({ endpoint, model, format, maxMb }) }
          catch (error) { throw new InputError(error instanceof Error ? error.message : '语音识别配置无效') }
          const ops: SettingsPathOp[] = [
            { op: 'set', path: ['endpoint'], value: endpoint }, { op: 'set', path: ['model'], value: model },
            { op: 'set', path: ['format'], value: format }, { op: 'set', path: ['maxMb'], value: maxMb },
          ]
          if (typeof body.apiKey === 'string') ops.push({ op: 'set', path: ['apiKey'], value: body.apiKey.trim() })
          if (body.clearKey === true) ops.push({ op: 'unset', path: ['apiKey'] })
          await asrSettings.mutate(ASR_NAMESPACE, ops, revision)
        }
        return json(res, 200, asrStatus())
      }
      if (route === '/api/capabilities/meeting/create') return json(res, 201, await meeting.create(body))
      if (route === '/api/capabilities/meeting/retry') return json(res, 202, await meeting.retry(text(body.id, '任务标识', 36)))
      if (route === '/api/capabilities/meeting/generate') {
        const id = text(body.id, '任务标识', 36)
        const segments = Array.isArray(body.segments) ? body.segments as MeetingSegment[] : undefined
        return json(res, 202, await meeting.generate(id, segments, typeof body.instruction === 'string' ? body.instruction : undefined, typeof body.summaryModel === 'string' ? body.summaryModel : undefined))
      }
      if (route === '/api/capabilities/icons') return json(res, 200, await store.icons.upload(body.dataUrl))
      if (route === '/api/capabilities/command') { const result = await store.command(body.revision, body.command); await writePresets(home, result.state); return json(res, 200, result) }
      if (route === '/api/capabilities/check') return json(res, 200, await runtime.check())
      if (route === '/api/capabilities/connect') return json(res, 200, await runtime.connect())
      if (route === '/api/capabilities/stop') { await runtime.stop(text(body.sessionId, '会话标识', 150, true)); return json(res, 200, { tasks: runtime.tasks() }) }
      throw new InputError('接口不存在', 404)
    } catch (error) { json(res, error instanceof InputError ? error.status : 500, { error: error instanceof Error ? error.message : '能力服务异常' }) }
  } }), 'capabilities: local API')
  ctx.effect(() => async () => { await requirements.close(); await runtime.dispose(); await store.close() }, 'capabilities: shutdown')
}
