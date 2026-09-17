/**
 * Preset-center host HTTP routes — the loopback-only library gateway the
 * Workshop's Presets panel calls. Endpoints (all under /api/preset-center):
 *  - GET  /api/preset-center/state             library + discovery state
 *  - GET  /api/preset-center/composition?id=   one preset's composition text
 *  - POST /api/preset-center/enable            { id, confirm? }
 *  - POST /api/preset-center/disable           { id }
 *  - POST /api/preset-center/uninstall         { id }
 *
 * The route layer is the only place that reads the roster, so it owns the two
 * policies the library cannot express: a preset whose id a shipped or
 * configured root already supplies is refused (that root wins discovery
 * order, so enabling would look successful and do nothing), and the preset the
 * `agent-presets` default setting names is never disabled or uninstalled (a
 * default naming a missing preset fails every new session).
 * @module @linxin666/dsh-client-ui-preset-center/routes
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import { readFileSync, statSync } from 'node:fs'
import { join, sep } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import type { AgentPresets } from '@deepseek-ai/dsh-agent-presets'
import { dshHome } from './dsh-home.ts'
import { guardedHandler } from './host/run-guarded.ts'
import { isLoopbackRequest } from './loopback.ts'
import { readJsonBody, writeJson } from './http.ts'
import { COMPOSITION_FILE, enabledRoot, isPresetId } from './core/paths.ts'
import { profilePresetDir, needsConfirmation, type CompositionProfile } from './core/profile.ts'
import {
  disablePreset,
  enablePreset,
  listPresetStates,
  readPresetState,
  uninstallPreset,
  PresetOperationError,
  type PresetStateRow,
} from './core/library.ts'

export const PRESET_CENTER_API_PREFIX = '/api/preset-center'

/** Composition viewer size cap (bytes). */
export const COMPOSITION_MAX_BYTES = 256 * 1024

/** Dependencies of the route family (all injectable for tests). */
export interface PresetCenterRouteDeps {
  /** Plugin context; used only to resolve the roster service. */
  ctx?: Context
  /** DSH home root (defaults to the live $DSH_HOME resolution). */
  dshHome?: string
  /** Roster accessor (test seam); defaults to `ctx.get('agentPresets')`. */
  roster?: () => AgentPresets | undefined
}

interface RouteError {
  status: number
  error: string
  message?: string
}

const ERRORS: Record<string, RouteError> = {
  'invalid-id': { status: 400, error: 'invalid-id', message: 'invalid preset id' },
  'invalid-body': { status: 400, error: 'invalid-body' },
  'loopback-only': { status: 403, error: 'loopback-only' },
  'method-not-allowed': { status: 405, error: 'method-not-allowed' },
  'not-installed': { status: 404, error: 'not-installed' },
  'not-enabled': { status: 404, error: 'not-enabled' },
  'not-managed': { status: 409, error: 'not-managed' },
  'already-enabled': { status: 409, error: 'already-enabled' },
  'conflict': { status: 409, error: 'conflict' },
  'shadowed': { status: 409, error: 'shadowed' },
  'confirmation-required': { status: 409, error: 'confirmation-required' },
  'broken': { status: 409, error: 'broken' },
  'default-preset': { status: 409, error: 'default-preset' },
  'roster-unavailable': { status: 503, error: 'roster-unavailable' },
  'write': { status: 500, error: 'write' },
}

function send(res: ServerResponse, status: number, payload: unknown): void {
  writeJson(res, status, payload, { 'cache-control': 'no-store' })
}

function sendError(res: ServerResponse, err: RouteError, message?: string): void {
  send(res, err.status, { ok: false, error: err.error, ...(message === undefined && err.message === undefined ? {} : { message: message ?? err.message }) })
}

/** Whether `path` lives inside `root` (a boundary-safe prefix test). */
function isUnder(path: string, root: string): boolean {
  return path === root || path.startsWith(root + sep)
}

/** Ids supplied by every root except the discovery root this feature manages. */
async function occupiedIds(roster: AgentPresets | undefined, root: string): Promise<string[] | null> {
  if (roster === undefined) return null
  try {
    const rows = await roster.list()
    return rows.filter((row) => !isUnder(row.path, root)).map((row) => row.id).sort()
  } catch {
    return null
  }
}

/** The default preset id, or null when the roster is unavailable. */
function defaultIdOf(roster: AgentPresets | undefined): string | null {
  if (roster === undefined) return null
  try {
    return roster.defaultId
  } catch {
    return null
  }
}

/** One state row enriched with the composition profile. */
function rowPayload(home: string, row: PresetStateRow): PresetStateRow & { profile: CompositionProfile } {
  return { ...row, profile: profilePresetDir(row.dir) }
}

/** Build the preset-center routes. */
export function makePresetCenterRoutes(deps: PresetCenterRouteDeps = {}): WebRoute[] {
  const home = deps.dshHome ?? dshHome()
  const root = enabledRoot(home)
  const rosterOf = deps.roster ?? (() => deps.ctx?.get('agentPresets') as AgentPresets | undefined)

  const guard = (req: IncomingMessage, res: ServerResponse, method: string): boolean => {
    if (!isLoopbackRequest(req)) {
      sendError(res, ERRORS['loopback-only'])
      return false
    }
    if (req.method !== method) {
      sendError(res, ERRORS['method-not-allowed'])
      return false
    }
    return true
  }

  const readId = async (req: IncomingMessage, res: ServerResponse): Promise<{ id: string; confirm: boolean } | null> => {
    let body: { id?: unknown; confirm?: unknown }
    try {
      body = ((await readJsonBody(req, { maxBytes: 16 * 1024 })) ?? {}) as { id?: unknown; confirm?: unknown }
    } catch {
      sendError(res, ERRORS['invalid-body'])
      return null
    }
    if (!isPresetId(body.id)) {
      sendError(res, ERRORS['invalid-id'])
      return null
    }
    return { id: body.id, confirm: body.confirm === true }
  }

  const handleState = guardedHandler('preset-center/state', async (req: IncomingMessage, res: ServerResponse) => {
    if (!guard(req, res, 'GET')) return
    const roster = rosterOf()
    const occupied = await occupiedIds(roster, root)
    const presets = listPresetStates(home).map((row) => rowPayload(home, row))
    send(res, 200, {
      ok: true,
      defaultId: defaultIdOf(roster),
      occupied: occupied ?? [],
      rosterAvailable: occupied !== null,
      presets,
    })
  })

  const handleComposition = guardedHandler('preset-center/composition', async (req: IncomingMessage, res: ServerResponse) => {
    if (!guard(req, res, 'GET')) return
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    const id = url.searchParams.get('id')
    if (!isPresetId(id)) {
      sendError(res, ERRORS['invalid-id'])
      return
    }
    const row = readPresetState(home, id)
    if (!row.installed && !row.enabled) {
      sendError(res, ERRORS['not-installed'])
      return
    }
    const file = join(row.dir, COMPOSITION_FILE)
    try {
      if (statSync(file).size > COMPOSITION_MAX_BYTES) {
        send(res, 200, { ok: true, id, text: '', truncated: true, profile: profilePresetDir(row.dir) })
        return
      }
      const text = readFileSync(file, 'utf8')
      send(res, 200, { ok: true, id, text, truncated: false, profile: profilePresetDir(row.dir) })
    } catch {
      sendError(res, ERRORS['not-installed'], 'composition file is missing')
    }
  })

  const handleEnable = guardedHandler('preset-center/enable', async (req: IncomingMessage, res: ServerResponse) => {
    if (!guard(req, res, 'POST')) return
    const parsed = await readId(req, res)
    if (parsed === null) return
    const { id, confirm } = parsed
    const roster = rosterOf()
    const occupied = await occupiedIds(roster, root)
    if (occupied === null) {
      sendError(res, ERRORS['roster-unavailable'], 'the agent-preset roster is unavailable')
      return
    }
    if (occupied.includes(id)) {
      sendError(res, ERRORS['shadowed'], `preset id is already supplied by another root: ${id}`)
      return
    }
    const state = readPresetState(home, id)
    if (!state.installed && !state.enabled) {
      sendError(res, ERRORS['not-installed'])
      return
    }
    if (!state.managed) {
      sendError(res, ERRORS['not-managed'])
      return
    }
    const profile = profilePresetDir(state.dir)
    if (needsConfirmation(profile) && !confirm) {
      send(res, 409, { ok: false, error: 'confirmation-required', message: 'preset carries executable content', profile })
      return
    }
    try {
      enablePreset(home, id)
    } catch (err) {
      if (err instanceof PresetOperationError) {
        sendError(res, ERRORS[err.code] ?? ERRORS.write, err.message)
        return
      }
      throw err
    }
    const broken = await brokenReason(roster, id)
    if (broken !== undefined) {
      try {
        disablePreset(home, id)
      } catch {
        /* the preset stays enabled and the official roster reports it broken */
      }
      send(res, 409, { ok: false, error: 'broken', message: broken })
      return
    }
    send(res, 200, { ok: true, state: rowPayload(home, readPresetState(home, id)) })
  })

  const handleDisable = guardedHandler('preset-center/disable', async (req: IncomingMessage, res: ServerResponse) => {
    if (!guard(req, res, 'POST')) return
    const parsed = await readId(req, res)
    if (parsed === null) return
    const { id } = parsed
    const refusal = refusalForProtected(rosterOf(), id)
    if (refusal !== null) {
      sendError(res, ERRORS['default-preset'], refusal)
      return
    }
    try {
      disablePreset(home, id)
    } catch (err) {
      if (err instanceof PresetOperationError) {
        sendError(res, ERRORS[err.code] ?? ERRORS.write, err.message)
        return
      }
      throw err
    }
    send(res, 200, { ok: true, state: rowPayload(home, readPresetState(home, id)) })
  })

  const handleUninstall = guardedHandler('preset-center/uninstall', async (req: IncomingMessage, res: ServerResponse) => {
    if (!guard(req, res, 'POST')) return
    const parsed = await readId(req, res)
    if (parsed === null) return
    const { id } = parsed
    const refusal = refusalForProtected(rosterOf(), id)
    if (refusal !== null) {
      sendError(res, ERRORS['default-preset'], refusal)
      return
    }
    try {
      uninstallPreset(home, id)
    } catch (err) {
      if (err instanceof PresetOperationError) {
        sendError(res, ERRORS[err.code] ?? ERRORS.write, err.message)
        return
      }
      throw err
    }
    send(res, 200, { ok: true, id })
  })

  // guardedHandler consumes rejections and returns undefined; the wrapper
  // narrows that to the void signature WebRoute declares.
  const route = (path: string, handler: (req: IncomingMessage, res: ServerResponse) => unknown): WebRoute => ({
    kind: 'exact',
    path,
    handler: (req, res) => { void handler(req, res) },
  })

  return [
    route(`${PRESET_CENTER_API_PREFIX}/state`, handleState),
    route(`${PRESET_CENTER_API_PREFIX}/composition`, handleComposition),
    route(`${PRESET_CENTER_API_PREFIX}/enable`, handleEnable),
    route(`${PRESET_CENTER_API_PREFIX}/disable`, handleDisable),
    route(`${PRESET_CENTER_API_PREFIX}/uninstall`, handleUninstall),
  ]
}

/** Why a disable/uninstall of `id` is refused, or null when it is allowed. */
function refusalForProtected(roster: AgentPresets | undefined, id: string): string | null {
  const current = defaultIdOf(roster)
  if (current !== null && current === id) {
    return `preset is the current default; change the default in Settings - Agent presets first: ${id}`
  }
  return null
}

/** The roster's broken reason for `id`, or undefined when healthy or unknown. */
async function brokenReason(roster: AgentPresets | undefined, id: string): Promise<string | undefined> {
  if (roster === undefined) return undefined
  try {
    const rows = await roster.list()
    const row = rows.find((entry) => entry.id === id)
    return row?.broken
  } catch {
    return undefined
  }
}
