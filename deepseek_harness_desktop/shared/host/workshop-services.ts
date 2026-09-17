/** In-process access to existing guarded lifecycle routes; no second installer queue. */
import type { IncomingMessage, ServerResponse } from 'node:http'
import { Readable } from 'node:stream'
import { resolve } from 'node:path'

export interface WorkshopServiceRoute {
  kind: string
  path: string
  handler: (req: IncomingMessage, res: ServerResponse) => unknown
}
export interface WorkshopServiceResult { status: number; body: Record<string, unknown> }
export type WorkshopServiceCall = (original: IncomingMessage, path: string, body: Record<string, unknown> | undefined, home: string) => Promise<WorkshopServiceResult>

const key = Symbol.for('dsh-workbench.lifecycle-routes.v1')
function registry(): Map<string, WorkshopServiceRoute> {
  const host = globalThis as unknown as Record<symbol, Map<string, WorkshopServiceRoute> | undefined>
  return host[key] ??= new Map()
}

export function registerWorkshopServiceRoutes(home: string, routes: WorkshopServiceRoute[]): () => void {
  const entries = routes.filter(route => route.kind === 'exact')
  const address = (path: string): string => `${resolve(home)}:${path}`
  for (const route of entries) registry().set(address(route.path), route)
  return () => { for (const route of entries) if (registry().get(address(route.path)) === route) registry().delete(address(route.path)) }
}

/** Keep the caller's real peer and origin when invoking the owning route's guard. */
export const callWorkshopService: WorkshopServiceCall = (original, path, body, home) => new Promise((resolveResult, reject) => {
  const route = registry().get(`${resolve(home)}:${path.split('?')[0]}`)
  if (!route) { resolveResult({ status: 503, body: { error: 'service-unavailable', message: 'The resource manager is unavailable. Restart the workbench after updating.' } }); return }
  const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]) as unknown as IncomingMessage
  req.url = path
  req.method = body === undefined ? 'GET' : 'POST'
  req.headers = { ...original.headers }
  Object.defineProperty(req, 'socket', { value: original.socket })
  let status = 200
  const timer = setTimeout(() => reject(new Error('resource-manager-timeout')), 30_000)
  const res = {
    writeHead(code: number) { status = code; return this },
    end(value: string) {
      clearTimeout(timer)
      try { resolveResult({ status, body: JSON.parse(value) as Record<string, unknown> }) } catch (error) { reject(error) }
    },
  } as unknown as ServerResponse
  try { Promise.resolve(route.handler(req, res)).catch(error => { clearTimeout(timer); reject(error) }) }
  catch (error) { clearTimeout(timer); reject(error) }
})
