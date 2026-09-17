/**
 * The gateway HTTP surface: loopback-fenced routes serving the plugin
 * inventory, CLI-backed install/removal jobs, next-start enablement, the
 * (empty on this runtime) failure ring, and explicit rejection of removed update endpoints. The
 * fence is the shared family loopback guard — same-origin local browsers
 * only, mirroring the official loopback authority the installer channels
 * would have enforced.
 * @module @linxin666/dsh-client-ui-plugin-manager/host
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import { readJsonBody, writeJson } from './http.ts'
import { isLoopbackRequest } from './loopback.ts'
import { detectOfficialChannels, findDshBinary, unsafeSpecReason, type CliGateway } from './gateway.ts'
import { readPatchText, readProfileManifest, type ProfileFacts } from './profile.ts'
import { setRowEnabled, writePatchAtomic } from './rows.ts'
import { buildPluginRow, claimedEntryRowsOf, findRowOwner, LOCKED_ENTRY_IDS, snapshotGateway } from './state.ts'

/** Route prefix the browser half mirrors. */
export const GATEWAY_PREFIX = '/api/plugin-manager'
const UPDATES_DISABLED = 'plugin-manager: plugin updates are disabled in this deployment'

/** Dependencies every route shares. */
export interface GatewayRouteDeps {
  facts: ProfileFacts
  gateway: CliGateway
  /** Resolve the dsh binary presence (the CLI is the write path). */
  cliAvailable: () => boolean
  /** Official-channel detection seam (test seam); defaults to the boot dump probe. */
  officialChannels?: () => Promise<boolean>
}

/** Error text for a caught request or lifecycle failure. */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Build the gateway routes.
 * @param deps - profile facts, the CLI gateway, and seams.
 * @returns the web-server routes to register.
 */
export function makeGatewayRoutes(deps: GatewayRouteDeps): WebRoute[] {
  const { facts, gateway } = deps
  /** Wrap a handler with the loopback fence and JSON error reporting. */
  const guard = (handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>) =>
    async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
      if (!isLoopbackRequest(req)) {
        writeJson(res, 403, { ok: false, error: 'forbidden: loopback-only' })
        return
      }
      try {
        await handler(req, res)
      } catch (error) {
        writeJson(res, 500, { error: messageOf(error) })
      }
    }

  const listHandler = async (_req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const patchText = await readPatchText(facts.patchPath)
    const snapshot = await snapshotGateway(facts, patchText)
    writeJson(res, 200, { plugins: snapshot.plugins })
  }

  const installHandler = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const body = (await readJsonBody(req, { maxBytes: 64 * 1024, objectOnly: true }) ?? {}) as Record<string, unknown>
    const spec = body['spec']
    if (typeof spec !== 'string' || spec.trim() === '') {
      writeJson(res, 400, { error: 'plugin-manager: install needs a spec' })
      return
    }
    const unsafeSpec = unsafeSpecReason(spec.trim())
    if (unsafeSpec !== undefined) {
      writeJson(res, 400, { error: unsafeSpec })
      return
    }
    if (!deps.cliAvailable()) {
      writeJson(res, 500, { error: 'plugin-manager: dsh CLI not found on PATH' })
      return
    }
    writeJson(res, 200, gateway.install(spec.trim()))
  }

  const updateHandler = async (_req: IncomingMessage, res: ServerResponse): Promise<void> => {
    writeJson(res, 410, { error: UPDATES_DISABLED })
  }

  const removeHandler = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const body = (await readJsonBody(req, { maxBytes: 64 * 1024, objectOnly: true }) ?? {}) as Record<string, unknown>
    const id = body['id']
    if (typeof id !== 'string' || id.trim() === '') {
      writeJson(res, 400, { error: 'plugin-manager: remove needs an id' })
      return
    }
    const unsafeId = unsafeSpecReason(id.trim())
    if (unsafeId !== undefined) {
      writeJson(res, 400, { error: unsafeId })
      return
    }
    if (!deps.cliAvailable()) {
      writeJson(res, 500, { error: 'plugin-manager: dsh CLI not found on PATH' })
      return
    }
    writeJson(res, 200, gateway.remove(id.trim()))
  }

  const statusHandler = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const jobId = url.searchParams.get('job')
    if (jobId === null) {
      writeJson(res, 400, { error: 'plugin-manager: status needs a job id' })
      return
    }
    const job = gateway.status(jobId)
    if (job === undefined) {
      writeJson(res, 404, { error: 'plugin-manager: unknown job' })
      return
    }
    writeJson(res, 200, { job })
  }

  const setEnabledHandler = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const body = (await readJsonBody(req, { maxBytes: 64 * 1024, objectOnly: true }) ?? {}) as Record<string, unknown>
    const id = body['id']
    const enabled = body['enabled']
    if (typeof id !== 'string' || id.trim() === '' || typeof enabled !== 'boolean') {
      writeJson(res, 400, { error: 'plugin-manager: set-enabled needs an id and a boolean enabled' })
      return
    }
    const target = id.trim()
    const unsafeTarget = unsafeSpecReason(target)
    if (unsafeTarget !== undefined) {
      writeJson(res, 400, { error: unsafeTarget })
      return
    }
    const outcome = await gateway.withMutationLock(async () => {
      const patchText = await readPatchText(facts.patchPath)
      // Write and read the same id space: the entry ids the package's bundle
      // patch claims (falling back to the package name), not the package name
      // itself. Package-name rows never matched the loader entries. The row
      // carries the entry's own name: the include semantics skip a bare row
      // whose name mismatches the inserted entry.
      const manifest = await readProfileManifest(facts.packageJsonPath)
      let ownerName = target
      let entries: Array<{ id: string; name: string; baseEnabled: boolean }>
      if (manifest.dependencies[target] !== undefined) {
        entries = await claimedEntryRowsOf(facts, target)
      } else {
        // Row-level toggle: the id is one entry row claimed by an aggregate's
        // bundle patch (e.g. web-ui-pet), not a dependency name. Only that
        // row gets the override; its siblings keep their state.
        const owner = await findRowOwner(facts, Object.keys(manifest.dependencies), target)
        if (owner === undefined) {
          return { error: `plugin-manager: plugin ${target} is not installed` } as const
        }
        if (!enabled && LOCKED_ENTRY_IDS.has(target)) {
          // Never persist a disabled override that would take down the manager
          // tab itself, its settings surface, or the aggregate compat face —
          // the UI performing these writes must stay reachable to undo them.
          return { error: `plugin-manager: row ${target} is required by this manager and cannot be disabled` } as const
        }
        ownerName = owner.packageName
        entries = [owner.row]
      }
      let next = patchText
      for (const entry of entries) {
        // A whole-package disable still force-keeps the locked rows mounted.
        const entryEnabled = enabled || LOCKED_ENTRY_IDS.has(entry.id)
        next = setRowEnabled(next, facts.patchPath, entry.id, entry.name, entryEnabled, entry.baseEnabled)
      }
      if (next !== patchText) {
        await writePatchAtomic(facts.patchPath, next)
      }
      const snapshot = await snapshotGateway(facts, next)
      const plugin = snapshot.plugins.find(item => item.id === ownerName)
      return plugin === undefined
        ? { error: `plugin-manager: plugin ${ownerName} is not installed` } as const
        : { plugin } as const
    })
    if ('error' in outcome) {
      writeJson(res, 404, { error: outcome.error })
      return
    }
    writeJson(res, 200, { plugin: outcome.plugin })
  }

  const failuresHandler = async (_req: IncomingMessage, res: ServerResponse): Promise<void> => {
    // The npm web runtime keeps no boot-failure ring; the install-error path
    // is the only repair surface here.
    writeJson(res, 200, { items: [], pluginRoot: facts.profileDir, safeMode: false })
  }

  // One verdict per host process: the browser half reads it instead of
  // probing the official channel, whose route 405s on the npm web runtime.
  let modePromise: Promise<{ official: boolean | null }> | undefined
  const probeOfficialChannels = (): Promise<boolean> => {
    const binary = findDshBinary()
    if (binary === null) return Promise.resolve(false)
    return detectOfficialChannels(binary, facts.profileName)
  }
  const modeHandler = async (_req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (modePromise === undefined) {
      if (facts.desktop) {
        // Desktop registers installer services programmatically, so the CLI
        // dump cannot see them. Null tells the browser to perform its existing
        // direct RPC capability probe before falling back to this gateway.
        modePromise = Promise.resolve({ official: null })
      } else {
        const probe = deps.officialChannels ?? probeOfficialChannels
        modePromise = probe().then(official => ({ official })).catch(() => ({ official: false }))
      }
    }
    writeJson(res, 200, await modePromise)
  }

  const checkUpdatesHandler = updateHandler

  return [
    { kind: 'exact', path: `${GATEWAY_PREFIX}/list`, handler: guard(listHandler) },
    { kind: 'exact', path: `${GATEWAY_PREFIX}/install`, handler: guard(installHandler) },
    { kind: 'exact', path: `${GATEWAY_PREFIX}/update`, handler: guard(updateHandler) },
    { kind: 'exact', path: `${GATEWAY_PREFIX}/remove`, handler: guard(removeHandler) },
    { kind: 'exact', path: `${GATEWAY_PREFIX}/status`, handler: guard(statusHandler) },
    { kind: 'exact', path: `${GATEWAY_PREFIX}/set-enabled`, handler: guard(setEnabledHandler) },
    { kind: 'exact', path: `${GATEWAY_PREFIX}/failures`, handler: guard(failuresHandler) },
    { kind: 'exact', path: `${GATEWAY_PREFIX}/mode`, handler: guard(modeHandler) },
    { kind: 'exact', path: `${GATEWAY_PREFIX}/check-updates`, handler: guard(checkUpdatesHandler) },
  ]
}

/** Re-exported for host wiring: build a plugin row against the live snapshot. */
export { buildPluginRow }
