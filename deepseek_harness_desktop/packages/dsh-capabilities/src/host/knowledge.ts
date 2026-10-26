import { createHash } from 'node:crypto'
import { InputError, text } from '../core/validation.ts'
import { noKnowledge, type KnowledgeProvider, type KnowledgeStatus, type KnowledgeRequest, type KnowledgeEvidence } from '../core/knowledge.ts'
import type { DocumentKnowledgeAdapter } from '../core/document-knowledge.ts'

/** One shared retrieval boundary for document and requirement workflows. No mock is installed here. */
export class KnowledgeService implements DocumentKnowledgeAdapter {
  constructor(private readonly provider: () => KnowledgeProvider | undefined = () => undefined, private readonly legacy: () => DocumentKnowledgeAdapter | undefined = () => undefined) {}
  async status(): Promise<KnowledgeStatus> {
    const provider = this.provider(), legacy = provider ? undefined : this.legacy()
    if (!provider && !legacy) return structuredClone(noKnowledge)
    const status = await (provider ?? legacy)!.status()
    const collections = 'collections' in status && Array.isArray(status.collections) ? status.collections.map(c => ({ id: text(c.id, '资料集标识', 240, true), name: text(c.name, '资料集名称', 240, true) })) : []
    return { available: true, configured: status.configured === true, verified: status.verified === true, label: text(status.label, '服务名称', 240, true), message: text(status.message, '服务状态', 1000), providerId: provider?.id ?? 'legacy-document', ...('checkedAt' in status && typeof status.checkedAt === 'string' ? { checkedAt: status.checkedAt } : {}), collections }
  }
  async search(request: KnowledgeRequest, signal: AbortSignal): Promise<{ sources: KnowledgeEvidence[] }> {
    signal.throwIfAborted()
    const provider = this.provider(), legacy = provider ? undefined : this.legacy()
    if (!provider && !legacy) throw new InputError('外部知识库接口已预留，暂未接入服务', 409)
    const status = await this.status(); signal.throwIfAborted()
    if (!status.configured) throw new InputError('外部知识库尚未配置', 409)
    const query = text(request.query, '检索问题', 20000, true), limit = Math.min(8, Math.max(1, Math.floor(request.limit)))
    if (!Number.isFinite(limit)) throw new InputError('检索条数无效')
    if (request.scope) {
      if (!provider || !Array.isArray(request.scope.collectionIds) || !request.scope.collectionIds.length || request.scope.collectionIds.some(id => !status.collections.some(c => c.id === id))) throw new InputError('所选资料集不可用；请重新选择允许范围', 409)
    }
    const input = { query, limit, ...(request.scope ? { scope: structuredClone(request.scope) } : {}), ...(request.context ? { context: { ...request.context } } : {}) }
    const result = provider ? await provider.search(input, signal) : await legacy!.search({ query, limit }, signal)
    signal.throwIfAborted()
    if (!Array.isArray(result.sources)) throw new InputError('知识库未返回有效来源列表')
    const seen = new Set<string>(), retrievedAt = new Date().toISOString(), providerId = provider?.id ?? 'legacy-document'
    const sources: KnowledgeEvidence[] = []
    for (const value of result.sources.slice(0, limit)) {
      const v = value as Partial<KnowledgeEvidence>
      const content = text(v.text, '来源正文', 100000, true).slice(0, 6000), title = text(v.title, '来源标题', 240, true)
      const documentId = text(v.documentId ?? v.id, '来源文档', 240, true), chunkId = text(v.chunkId ?? v.id, '来源片段', 240, true)
      if (request.scope && (!v.collectionId || !request.scope.collectionIds.includes(v.collectionId))) throw new InputError('知识库返回了所选范围之外的资料，结果未采用')
      const id = JSON.stringify([providerId, v.collectionId ?? '', documentId, chunkId])
      if (seen.has(id)) continue
      seen.add(id)
      let url: string | undefined
      if (v.url) { const parsed = new URL(v.url); if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new InputError('来源链接无效'); url = parsed.href }
      sources.push({ id, providerId, documentId, chunkId, title, text: content, hash: createHash('sha256').update(content).digest('hex'), retrievedAt, ...(v.collectionId ? { collectionId: text(v.collectionId, '资料集', 240) } : {}), ...(v.locator ? { locator: text(v.locator, '原文位置', 500) } : {}), ...(v.version ? { version: text(v.version, '来源版本', 240) } : {}), ...(url ? { url } : {}) })
    }
    return { sources }
  }
}
