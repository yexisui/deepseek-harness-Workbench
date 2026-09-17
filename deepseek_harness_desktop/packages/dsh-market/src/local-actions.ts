/** Local Workshop lifecycle: ownership checks before the existing managers do the work. */
import { createHash, randomUUID } from 'node:crypto'
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import { dshHome } from './dsh-home.ts'
import { readJsonBody, writeJson } from './http.ts'
import { isLoopbackRequest } from './loopback.ts'
import { localResourceDir, localResourceLock } from './core/local-import.ts'
import type { LocalKind, LocalResource } from './core/local-types.ts'
import { isLocalResourceTrusted, localResourceUnchanged, readLocalTrustRecord, trustLocalResource } from '../../../shared/host/local-resource-trust.ts'
import { callWorkshopService, type WorkshopServiceCall, type WorkshopServiceResult } from '../../../shared/host/workshop-services.ts'

const KINDS = new Set(['skin', 'pet', 'plugin', 'preset'])
const ACTIONS = new Set(['install', 'enable', 'disable', 'remove', 'trust'])
const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/
const PACKAGE = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/

export interface LocalActionRouteDeps {
  dshHome?: string
  /** Calls the already-mounted manager; tests can inject a controlled service. */
  service?: WorkshopServiceCall
}

class ActionError extends Error {
  constructor(readonly code: string, message: string, readonly status = 409) { super(message) }
}

function assertTreeLocation(home: string, dir: string): void {
  const rel = relative(resolve(home), resolve(dir))
  if (!rel || rel.startsWith('..') || rel.startsWith(sep)) throw new ActionError('invalid-path', 'Resource path is outside the workbench', 400)
  let current = resolve(home)
  for (const segment of rel.split(sep)) {
    current = join(current, segment)
    if (existsSync(current) && lstatSync(current).isSymbolicLink()) throw new ActionError('invalid-path', 'Resource directories cannot be symbolic links', 400)
  }
}

function jsonFile(file: string): Record<string, unknown> | null {
  try { return JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown> } catch { return null }
}

function pluginJobPath(home: string, id: string): string {
  return join(home, 'workshop', 'plugin-jobs', `${createHash('sha256').update(id).digest('hex')}.json`)
}

/** Keep queued installs protected from replacement until the owning queue settles. */
function monitorPluginJob(home: string, id: string, jobId: string, original: IncomingMessage, service: WorkshopServiceCall): void {
  const file = pluginJobPath(home, id)
  // The HTTP socket may close while the CLI job continues; retain the validated origin facts.
  const request = { headers: { ...original.headers }, socket: { remoteAddress: original.socket.remoteAddress } } as IncomingMessage
  const tick = async (): Promise<void> => {
    const marker = jsonFile(file)
    if (marker?.jobId !== jobId || marker.state !== 'running') return
    try {
      const result = await service(request, `/api/plugin-manager/status?job=${encodeURIComponent(jobId)}`, undefined, home)
      const job = result.body.job as { phase?: string } | undefined
      if (job?.phase === 'done' || job?.phase === 'error' || result.status === 404) {
        if (jsonFile(file)?.jobId === jobId) writeFileSync(file, JSON.stringify({ ...marker, state: job?.phase ?? 'error' }))
        return
      }
    } catch { /* the installed manager may be reloading; keep the protection and retry */ }
    const timer = setTimeout(() => { void tick() }, 1000)
    timer.unref()
  }
  const timer = setTimeout(() => { void tick() }, 500)
  timer.unref()
}

async function successful(service: WorkshopServiceCall, req: IncomingMessage, home: string, path: string, body?: Record<string, unknown>): Promise<Record<string, unknown>> {
  const result = await service(req, path, body, home)
  if (result.status >= 400 || result.body.ok === false || result.body.error) {
    throw new ActionError(String(result.body.error ?? 'manager-error'), String(result.body.message ?? result.body.error ?? 'Resource manager rejected the action'), result.status >= 400 ? result.status : 409)
  }
  return result.body
}

type PluginRow = { id: string; version?: string; enabled?: boolean; source?: { spec?: string }; [key: string]: unknown }
async function installedPlugins(service: WorkshopServiceCall, req: IncomingMessage, home: string): Promise<PluginRow[]> {
  const result = await successful(service, req, home, '/api/plugin-manager/list')
  return Array.isArray(result.plugins) ? result.plugins as PluginRow[] : []
}

/** Existing profile plugins are visible but are never adopted or removed by this importer. */
export async function listExistingWorkshopPlugins(req: IncomingMessage, home: string, service: WorkshopServiceCall = callWorkshopService): Promise<LocalResource[]> {
  try {
    return (await installedPlugins(service, req, home)).map(row => ({
      kind: 'plugin', id: row.id, name: row.id, ...(row.version ? { version: row.version } : {}),
      source: 'existing', status: 'active', executable: true, managed: false,
      installed: true, enabled: row.enabled !== false,
    }))
  } catch { return [] }
}

/** All actions require a local, unchanged owned record; every delete is a recoverable move. */
export function makeLocalActionRoutes(deps: LocalActionRouteDeps = {}): WebRoute[] {
  const home = deps.dshHome ?? dshHome()
  const service = deps.service ?? callWorkshopService
  const execute = async (req: IncomingMessage, body: Record<string, unknown>): Promise<Record<string, unknown>> => {
    const kind = body.kind as LocalKind
    const id = body.id as string
    const action = body.action as string
    if (!KINDS.has(kind) || typeof id !== 'string' || !(kind === 'plugin' ? PACKAGE : ID).test(id) || !ACTIONS.has(action)) {
      throw new ActionError('invalid-action', 'Invalid resource identity or action', 400)
    }
    if (kind === 'plugin' && id.startsWith('@deepseek-ai/')) throw new ActionError('protected-resource', 'Official runtime packages cannot be managed here')
    return localResourceLock(home, kind, id, async () => {
      const libraryDir = localResourceDir(home, kind, id)
      const enabledDir = kind === 'preset' ? join(home, '.agent-presets', id) : libraryDir
      const dir = kind === 'preset' && existsSync(enabledDir) ? enabledDir : libraryDir
      assertTreeLocation(home, dir)
      const record = readLocalTrustRecord(dir, kind, id)
      if (!record) throw new ActionError('not-managed', 'Only resources imported by this workbench can be changed here')
      if (!localResourceUnchanged(dir, record)) throw new ActionError('resource-modified', 'Resource files changed. Import the updated resource again before using it.')
      if (kind === 'plugin') {
        const marker = jsonFile(pluginJobPath(home, id))
        if (marker?.state === 'running' && typeof marker.jobId === 'string') {
          const current = await service(req, `/api/plugin-manager/status?job=${encodeURIComponent(marker.jobId)}`, undefined, home)
          const job = current.body.job as { phase?: string } | undefined
          if (job?.phase === 'running' || (current.status !== 404 && job?.phase !== 'done' && job?.phase !== 'error')) {
            throw new ActionError('resource-busy', 'Wait for this plugin installation to finish before changing its imported resource')
          }
          writeFileSync(pluginJobPath(home, id), JSON.stringify({ ...marker, state: job?.phase ?? 'error' }))
        }
      }
      if (action === 'trust') {
        if (kind !== 'skin') throw new ActionError('unsupported-action', 'Script trust is available for skin hooks; install or enable other resources explicitly')
        if (body.confirmCode !== true) throw new ActionError('confirmation-required', 'This skin can execute scripts. Confirm before allowing them.')
        trustLocalResource(home, dir, record)
        return { ok: true, message: 'Skin scripts approved for this exact imported version. Reapply the skin to load its hooks.' }
      }
      if (action === 'remove') {
        if (kind === 'preset' && existsSync(enabledDir)) throw new ActionError('resource-active', 'Disable this preset before removing it')
        if (kind === 'skin' && jsonFile(join(home, 'skin-center-active.json'))?.active === id) throw new ActionError('resource-active', 'Apply another skin before removing this one')
        if (kind === 'pet' && jsonFile(join(home, 'pet.json'))?.petId === id) throw new ActionError('resource-active', 'Select another pet before removing this one')
        if (kind === 'plugin' && (await installedPlugins(service, req, home)).some(row => row.id === id)) {
          throw new ActionError('resource-installed', 'Uninstall this plugin in Settings / Plugins before removing its imported copy')
        }
        if (kind === 'preset') {
          const state = await successful(service, req, home, '/api/preset-center/state')
          if (state.rosterAvailable !== true) throw new ActionError('roster-unavailable', 'Preset roster is unavailable', 503)
          if (state.defaultId === id) throw new ActionError('default-preset', 'Change the default preset before removing this one')
          if (Array.isArray(state.occupied) && state.occupied.includes(id)) throw new ActionError('protected-resource', 'This preset id is supplied by another discovery root')
        }
        const backupRoot = join(home, 'workshop', 'backups')
        assertTreeLocation(home, backupRoot)
        mkdirSync(backupRoot, { recursive: true })
        const backup = join(backupRoot, `${kind}-${createHash('sha256').update(id).digest('hex').slice(0, 16)}-${Date.now()}-${randomUUID()}`)
        renameSync(dir, backup)
        return { ok: true, message: 'Resource removed from the library. A backup was kept in the workbench data directory.' }
      }
      if (kind === 'preset' && (action === 'enable' || action === 'disable')) {
        if (action === 'enable' && body.confirmCode !== true && !isLocalResourceTrusted(home, dir, 'preset', id)) {
          throw new ActionError('confirmation-required', 'A preset controls executable agent composition. Confirm this imported version before enabling it.')
        }
        await successful(service, req, home, `/api/preset-center/${action}`, { id, confirm: body.confirmCode === true })
        return { ok: true }
      }
      if (kind === 'plugin') {
        const rows = await installedPlugins(service, req, home)
        const installed = rows.find(row => row.id === id)
        if (action === 'install') {
          if (installed) throw new ActionError('already-installed', 'This plugin is already installed. Manage it in Settings / Plugins.')
          if (body.confirmCode !== true) throw new ActionError('confirmation-required', 'Installing this plugin executes package scripts and may download dependencies. Confirm before installing.')
          trustLocalResource(home, dir, record)
          // Install an immutable copy: queued CLI jobs never read a resource replaced by another import.
          const snapshots = join(home, 'workshop', 'install-snapshots')
          assertTreeLocation(home, snapshots)
          mkdirSync(snapshots, { recursive: true })
          const snapshot = join(snapshots, randomUUID())
          cpSync(dir, snapshot, { recursive: true, errorOnExist: true, force: false })
          const result = await successful(service, req, home, '/api/plugin-manager/install', { spec: `file:${snapshot}` })
          if (typeof result.jobId !== 'string') throw new ActionError('manager-error', 'Plugin manager did not return an installation job', 500)
          const marker = pluginJobPath(home, id)
          assertTreeLocation(home, marker)
          mkdirSync(dirname(marker), { recursive: true })
          writeFileSync(marker, JSON.stringify({ id, jobId: result.jobId, state: 'running', createdAt: new Date().toISOString() }))
          monitorPluginJob(home, id, result.jobId, req, service)
          return { ok: true, jobId: result.jobId, requiresRestart: true, message: 'Installation queued. Dependencies may require network access; restart the workbench after the job succeeds.' }
        }
        if (action === 'enable' || action === 'disable') {
          if (!installed) throw new ActionError('not-installed', 'Install the plugin before changing its state')
          if (!isLocalResourceTrusted(home, dir, 'plugin', id)) throw new ActionError('confirmation-required', 'This plugin version has not been approved for installation')
          await successful(service, req, home, '/api/plugin-manager/set-enabled', { id, enabled: action === 'enable' })
          return { ok: true, requiresRestart: true }
        }
      }
      throw new ActionError('unsupported-action', 'Apply skins and select pets from their existing Settings sections')
    })
  }
  const handler = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const send = (status: number, payload: unknown): void => writeJson(res, status, payload, { 'cache-control': 'no-store' })
    if (!isLoopbackRequest(req)) { send(403, { ok: false, error: 'loopback-only' }); return }
    if (req.method !== 'POST') { send(405, { ok: false, error: 'method-not-allowed' }); return }
    const body = await readJsonBody(req, { maxBytes: 16 * 1024, objectOnly: true }) as Record<string, unknown> | null
    if (!body) { send(400, { ok: false, error: 'invalid-body' }); return }
    try { send(200, await execute(req, body)) }
    catch (error) {
      const known = error instanceof ActionError
      send(known ? error.status : 500, { ok: false, error: known ? error.code : 'action-failed', message: error instanceof Error ? error.message : String(error) })
    }
  }
  return [{ kind: 'exact', path: '/api/workshop/action', handler }]
}

export type { WorkshopServiceResult }
