/** Public status contains no endpoint credentials. Providers own their configuration and ACLs. */
export type KnowledgeScope = { providerId?: string; collectionIds: string[]; product?: string; project?: string }
export type KnowledgeContext = { taskId: string; roleId: string; roleVersion: number; authorityAt?: number; kind?: string }
export type KnowledgeStatus = {
  moduleEnabled?: boolean; available: boolean; configured: boolean; verified: boolean; label: string; message: string
  providerId?: string; checkedAt?: string; collections: { id: string; name: string }[]
}
export type KnowledgeEvidence = {
  id: string; title: string; text: string; providerId: string; documentId: string; chunkId: string
  collectionId?: string; locator?: string; url?: string; version?: string; hash: string; retrievedAt: string
}
export type KnowledgeRequest = { query: string; limit: number; scope?: KnowledgeScope; context?: KnowledgeContext }
export interface KnowledgeProvider {
  id: string
  status(): Promise<Omit<KnowledgeStatus, 'available' | 'providerId'>>
  /** Apply provider-side access rules as well as the host-validated scope. Never widen an empty result. */
  search(request: KnowledgeRequest, signal: AbortSignal): Promise<{ sources: Omit<KnowledgeEvidence, 'providerId' | 'hash' | 'retrievedAt'>[] }>
}
export const noKnowledge: KnowledgeStatus = { available: false, configured: false, verified: false, label: '外部知识库', message: '接口已预留，暂未接入服务。其他助手功能可继续使用。', collections: [] }
