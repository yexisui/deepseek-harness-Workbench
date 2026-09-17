/** Same-origin transport for the local Workshop. Importing stores files only. */
import type { LocalKind, LocalPreview, LocalResource } from '../core/local-types.ts'

export type LocalAction = 'install' | 'enable' | 'disable' | 'remove' | 'trust'
export interface LocalActionResult {
  message?: string
  requiresRestart?: boolean
  jobId?: string
}

export interface LocalWorkshopApi {
  list(signal?: AbortSignal): Promise<LocalResource[]>
  start(kind: LocalKind, format: 'zip' | 'folder', signal?: AbortSignal): Promise<string>
  upload(uploadId: string, path: string, file: File, signal?: AbortSignal): Promise<void>
  inspect(uploadId: string, signal?: AbortSignal): Promise<LocalPreview>
  commit(uploadId: string, replace: boolean): Promise<LocalResource>
  discard(uploadId: string): Promise<void>
  action(kind: LocalKind, id: string, action: LocalAction, confirmCode: boolean): Promise<LocalActionResult>
  job(jobId: string, signal?: AbortSignal): Promise<{ phase: string; error?: string }>
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { credentials: 'same-origin', ...options })
  const body = await response.json() as T & { ok?: boolean; error?: string; message?: string }
  if (!response.ok || body.ok === false) throw new Error(body.message ?? body.error ?? `HTTP ${response.status}`)
  return body
}

const json = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

export const localWorkshopApi: LocalWorkshopApi = {
  async list(signal) {
    return (await request<{ resources: LocalResource[] }>('/api/workshop/resources', { signal })).resources
  },
  async start(kind, format, signal) {
    return (await request<{ uploadId: string }>('/api/workshop/upload/start', { ...json({ kind, format }), signal })).uploadId
  },
  async upload(uploadId, path, file, signal) {
    await request('/api/workshop/upload/file?' + new URLSearchParams({ uploadId, path }).toString(), {
      method: 'PUT', headers: { 'content-type': 'application/octet-stream' }, body: file, signal,
    })
  },
  async inspect(uploadId, signal) {
    return (await request<{ preview: LocalPreview }>('/api/workshop/upload/inspect', { ...json({ uploadId }), signal })).preview
  },
  async commit(uploadId, replace) {
    return (await request<{ resource: LocalResource }>('/api/workshop/upload/commit', json({ uploadId, replace }))).resource
  },
  async discard(uploadId) { await request('/api/workshop/upload/discard', json({ uploadId })) },
  async action(kind, id, action, confirmCode) {
    return request<LocalActionResult>('/api/workshop/action', json({ kind, id, action, confirmCode }))
  },
  async job(jobId, signal) {
    return (await request<{ job: { phase: string; error?: string } }>('/api/plugin-manager/status?' + new URLSearchParams({ job: jobId }).toString(), { signal })).job
  },
}

/** Render sizes without interpreting user-controlled resource metadata as HTML. */
export function resourceSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
