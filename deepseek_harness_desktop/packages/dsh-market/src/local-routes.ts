/** Loopback + same-origin gateway for staged local ZIP/folder imports. */
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import { dshHome } from './dsh-home.ts'
import { asJsonObject, readJsonBody, writeJson } from './http.ts'
import { isLoopbackRequest } from './loopback.ts'
import { LocalImportError, LocalWorkshopService, type LocalWorkshopOptions } from './core/local-import.ts'
import type { LocalKind, LocalResource } from './core/local-types.ts'

export interface MakeLocalWorkshopRoutesDeps {
  dshHome?: string
  now?: () => number
  /** Share the library instance with lifecycle/inventory integrations. */
  service?: LocalWorkshopService
  additionalResources?: (req: IncomingMessage) => Promise<LocalResource[]> | LocalResource[]
}

export function makeLocalWorkshopRoutes(deps: MakeLocalWorkshopRoutesDeps = {}): WebRoute[] {
  const options: LocalWorkshopOptions = { dshHome: deps.dshHome ?? dshHome(), now: deps.now }
  const service = deps.service ?? new LocalWorkshopService(options)
  const respond = (res: ServerResponse, status: number, body: unknown): void => {
    writeJson(res, status, body, { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' })
  }
  const jsonBody = async (req: IncomingMessage): Promise<Record<string, unknown>> => {
    const body = asJsonObject(await readJsonBody(req, { maxBytes: 16 * 1024, objectOnly: true }))
    if (!body) throw new LocalImportError('invalid-body', 'A JSON object is required.')
    return body
  }
  const route = (suffix: string, method: string, action: (req: IncomingMessage) => Promise<unknown>): WebRoute => ({
    kind: 'exact', path: '/api/workshop/' + suffix,
    handler: async (req, res) => {
      let trusted = false
      try { trusted = isLoopbackRequest(req) } catch { /* malformed authority */ }
      if (!trusted) { respond(res, 403, { ok: false, error: 'loopback-only' }); return }
      if (req.method !== method) { respond(res, 405, { ok: false, error: 'method-not-allowed' }); return }
      try { respond(res, 200, await action(req)) }
      catch (error) {
        const known = error instanceof LocalImportError
        respond(res, known ? error.status : 500, {
          ok: false, error: known ? error.code : 'write-failed',
          message: known ? error.message : 'The local resource operation failed. Check file permissions and try again.',
        })
      }
    },
  })
  return [
    route('resources', 'GET', async req => {
      const merged = new Map(service.resources().map(resource => [resource.kind + ':' + resource.id, resource]))
      for (const resource of await deps.additionalResources?.(req) ?? []) {
        const key = resource.kind + ':' + resource.id
        const local = merged.get(key)
        merged.set(key, local?.source === 'local'
          ? { ...resource, ...local, status: local.status === 'invalid' ? 'invalid' : resource.status, installed: resource.installed, enabled: resource.enabled }
          : resource)
      }
      return { ok: true, resources: [...merged.values()] }
    }),
    route('upload/start', 'POST', async req => {
      const body = await jsonBody(req)
      return { ok: true, uploadId: service.start(body.kind as LocalKind, body.format as 'zip' | 'folder') }
    }),
    route('upload/file', 'PUT', async req => {
      const url = new URL(req.url ?? '', 'http://localhost')
      const contentLength = Number(req.headers['content-length'])
      if (Number.isFinite(contentLength) && contentLength > 200 * 1024 * 1024) throw new LocalImportError('quota', 'One resource file exceeds 200 MiB.', 413)
      req.setTimeout(120_000, () => req.destroy())
      try { await service.uploadFile(url.searchParams.get('uploadId'), url.searchParams.get('path'), req) }
      finally { req.setTimeout(0) }
      return { ok: true }
    }),
    route('upload/inspect', 'POST', async req => {
      const body = await jsonBody(req)
      return { ok: true, preview: service.inspect(body.uploadId) }
    }),
    route('upload/commit', 'POST', async req => {
      const body = await jsonBody(req)
      return { ok: true, resource: await service.commit(body.uploadId, body.replace === true) }
    }),
    route('upload/discard', 'POST', async req => {
      const body = await jsonBody(req)
      service.discard(body.uploadId)
      return { ok: true }
    }),
  ]
}
