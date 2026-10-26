import {createHash} from 'node:crypto'
import type {SettingsProvider} from '@deepseek-ai/dsh-settings'
import type {KnowledgeProvider, KnowledgeRequest, KnowledgeStatus} from '../core/knowledge.ts'
import {InputError, text} from '../core/validation.ts'

export const KNOWLEDGE_NAMESPACE = 'external-knowledge'
export type KnowledgeConnectionConfig = {name: string; baseUrl: string; apiKey: string}
export const emptyConnection: KnowledgeConnectionConfig = {name: '', baseUrl: '', apiKey: ''}
type RemoteStatus = {protocol: string; collections: {id: string; name: string}[]}

export function connectionUrl(value: unknown) {
  const raw = text(value, '服务地址', 2048, true).trim()
  let url: URL
  try {url = new URL(raw)} catch {throw new InputError('请输入完整的 HTTP 或 HTTPS 服务地址')}
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new InputError('服务地址仅支持 HTTP/HTTPS，不要在地址中包含凭据、查询参数或锚点')
  return url.href.replace(/\/+$/, '')
}

/** A small, explicit HTTP protocol. Database vendor URLs require a server-side adapter. */
export class HttpKnowledgeProvider implements KnowledgeProvider {
  readonly id: string
  constructor(private readonly config: KnowledgeConnectionConfig) {
    this.id = 'http-' + createHash('sha256').update(config.baseUrl).digest('hex').slice(0, 24)
  }
  private async request(path: string, body: unknown, signal: AbortSignal): Promise<any> {
    try {
      const response = await fetch(this.config.baseUrl + path, {
        method: body === undefined ? 'GET' : 'POST', redirect: 'error', signal,
        headers: {'accept': 'application/json', ...(body === undefined ? {} : {'content-type': 'application/json'}), ...(this.config.apiKey ? {'authorization': 'Bearer ' + this.config.apiKey} : {})},
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      if (!response.ok) {await response.body?.cancel(); throw new InputError(`知识库服务返回 HTTP ${response.status}，请检查地址、凭据和服务状态`, 502)}
      if (!response.headers.get('content-type')?.includes('application/json')) {await response.body?.cancel(); throw new InputError('服务未返回 JSON；请使用兼容工作台检索协议的接口', 502)}
      const reader = response.body?.getReader(); if (!reader) throw new InputError('知识库响应为空', 502)
      const chunks: Uint8Array[] = []; let size = 0
      try {for (;;) {const {done, value} = await reader.read(); if (done) break; size += value.length; if (size > 1024 * 1024) throw new InputError('知识库响应超过 1 MB', 502); chunks.push(value)}} finally {await reader.cancel().catch(()=>{})}
      try {return JSON.parse(Buffer.concat(chunks).toString('utf8'))} catch {throw new InputError('知识库返回了无效 JSON', 502)}
    } catch (error) {
      if (signal.aborted) throw new InputError('知识库连接超时或调用已取消', 408)
      // Never expose remote response bodies, URLs, request headers or transport errors containing credentials.
      if (error instanceof InputError) throw error
      throw new InputError('无法连接知识库服务，请确认服务已启动且地址可访问', 502)
    }
  }
  async status(): Promise<Omit<KnowledgeStatus, 'available' | 'providerId'>> {
    const base = {configured: true, label: this.config.name, checkedAt: new Date().toISOString()}
    try {
      const data: RemoteStatus = await this.request('/v1/status', undefined, AbortSignal.timeout(8_000))
      if (data?.protocol !== 'workbench-knowledge-v1' || !Array.isArray(data.collections) || data.collections.length > 500) throw new InputError('服务不支持 workbench-knowledge-v1 检索协议', 502)
      const ids = new Set<string>()
      const collections = data.collections.map(c => {const id = text(c.id, '资料集标识', 240, true), name = text(c.name, '资料集名称', 240, true); if (ids.has(id)) throw new InputError('服务返回重复资料集', 502); ids.add(id); return {id, name}})
      return {...base, verified: true, message: '连接检测通过，可选择资料集检索。检测仅验证协议和资料集，未验证问答效果。', collections}
    } catch (error) {
      return {...base, verified: false, message: error instanceof InputError ? error.message : '知识库状态无效，请检查服务协议', collections: []}
    }
  }
  async search(request: KnowledgeRequest, signal: AbortSignal) {
    // Session/role metadata stays in the workbench. Send only the requested query and filters.
    const scope = request.scope ? {collectionIds: request.scope.collectionIds, ...(request.scope.product ? {product: request.scope.product} : {}), ...(request.scope.project ? {project: request.scope.project} : {})} : undefined
    return this.request('/v1/search', {query: request.query, limit: request.limit, scope}, AbortSignal.any([signal, AbortSignal.timeout(60_000)]))
  }
}

/** One settings namespace; the browser receives only a key-presence flag. */
export class KnowledgeConnection {
  constructor(private readonly settings: () => SettingsProvider | undefined, private readonly current: () => KnowledgeConnectionConfig) {}
  private descriptor() {return this.settings()?.describe().find(item => item.ns === KNOWLEDGE_NAMESPACE)}
  view() {
    const value = this.current()
    return {name: value.name, baseUrl: value.baseUrl, hasApiKey: !!value.apiKey, configured: !!value.baseUrl, editable: !!this.settings()?.writable, revision: this.descriptor()?.revision}
  }
  provider() {const value = this.current(); return value.baseUrl ? new HttpKnowledgeProvider({...value}) : undefined}
  private draft(body: Record<string, unknown>) {
    const current = this.current(), baseUrl = connectionUrl(body.baseUrl), name = text(body.name, '连接名称', 120, true).trim()
    if (body.apiKey !== undefined && (typeof body.apiKey !== 'string' || body.apiKey.length > 4096 || /[\r\n]/.test(body.apiKey))) throw new InputError('API Key 无效')
    if (body.clearKey && body.apiKey) throw new InputError('清除密钥和填写新密钥不能同时进行')
    const key = typeof body.apiKey === 'string' ? body.apiKey.trim() : ''
    // A saved bearer key must never silently follow a changed destination.
    return {name, baseUrl, apiKey: body.clearKey ? '' : key || (baseUrl === current.baseUrl ? current.apiKey : '')}
  }
  async check(body: Record<string, unknown>) {
    const provider = new HttpKnowledgeProvider(this.draft(body)), status = await provider.status()
    return {...status, providerId: provider.id}
  }
  async save(body: Record<string, unknown>) {
    const settings = this.settings()
    if (!settings?.writable) throw new InputError('工作台配置服务当前不可写', 503)
    if (!Number.isInteger(body.revision)) throw new InputError('配置版本无效，请刷新后重试')
    const config = body.reset === true ? {} : this.draft(body)
    await settings.replace(KNOWLEDGE_NAMESPACE, config, body.revision as number)
    return this.view()
  }
}
