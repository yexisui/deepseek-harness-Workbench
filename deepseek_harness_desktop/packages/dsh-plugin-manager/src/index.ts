/**
 * Host half of the dsh-plugin-manager plugin — runs in the DSH host process.
 *
 * Dual-channel design: on runtimes with the official installer services
 * (DSHCode and the 1.0.4 checkout web), the browser half uses the official
 * `/plugin-installer` and `/plugin-control` RPC channels and this half does
 * nothing. On the npm-published web runtime (rc.6/rc.7), those channels do
 * not exist, so this half mounts a loopback-fenced HTTP gateway: the
 * inventory reads the profile files, installs and removals spawn the
 * official CLI (the single writer), and enablement writes bare `disabled`
 * override rows into the profile patch.
 * @module @linxin666/dsh-client-ui-plugin-manager
 */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { mountOnce } from './mount-once.ts'
import { findDshBinary, CliGateway } from './host/gateway.ts'
import { profileExists, resolveProfile } from './host/profile.ts'
import { makeGatewayRoutes } from './host/routes.ts'
import { dirname } from 'node:path'
import { OfflineInstaller } from './host/offline-installer.ts'
import { makeLocalManagementRoutes } from './host/local-management-routes.ts'
import type { InventoryEntry } from './core/classification.ts'
import { registerWorkshopServiceRoutes } from '../../../shared/host/workshop-services.ts'

/** Stable cordis plugin name (matches cordis.patch.yml insert id). */
export const name = 'ui-plugin-manager'

/** Services the gateway needs — the web server seam. */
export const inject = ['webServer']

/** Apply the host half (once per process). */
export const apply = mountOnce('@linxin666/dsh-client-ui-plugin-manager', applyImpl)

function applyImpl(ctx: Context): void {
  // Gateway mode needs the boot profile; on hosts without one (desktop
  // launches that do not pass --profile) the official channels serve the
  // browser half, so this half stays dormant.
  let facts
  try {
    facts = resolveProfile()
  } catch (error) {
    console.error('[plugin-manager]', error instanceof Error ? error.message : String(error))
    return
  }
  if (!profileExists(facts.profileDir)) return

  const inventory = (): InventoryEntry[] => {
    const loader = ctx.get('loader') as unknown as { entries(): Iterable<{ id: string; options: {name: string; group?: boolean}; disabled: boolean; fiber?: {state: number} }> } | undefined
    if (!loader) throw new Error('插件清单尚未就绪，请稍后刷新。')
    return [...loader.entries()].filter(e => !e.options.group).map(e => ({ entryId:e.id, moduleName:e.options.name, enabled:!e.disabled, fiberPhase:e.fiber ? ['pending','loading','active','failed',null,'unloading'][e.fiber.state] ?? null : null }))
  }
  const offline = new OfflineInstaller(facts, inventory)
  const gateway = new CliGateway(facts)
  const cliAvailable = (): boolean => findDshBinary() !== null

  ctx.effect(() => {
    const routes = [...makeGatewayRoutes({ facts, gateway, cliAvailable, offline }), ...makeLocalManagementRoutes(offline, gateway, inventory)]
    const disposers = routes.map(route => ctx.webServer.register(route))
    disposers.push(registerWorkshopServiceRoutes(dirname(dirname(facts.profileDir)), routes))
    return () => {
      for (const dispose of disposers) dispose()
    }
  }, 'plugin-manager: gateway routes')
}
