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
import { workbenchClassificationAdapter } from './host/ai-classification-adapter.ts'
import { makeLocalManagementRoutes } from './host/local-management-routes.ts'
import type { InventoryEntry } from './core/classification.ts'
import { registerWorkshopServiceRoutes } from '../../../shared/host/workshop-services.ts'
import { inventoryControlRoute, presetConfiguredRows, type PresetControl } from './host/inventory-control.ts'
import { apply as mountSkills } from '../../dsh-skill-explorer/src/index.ts'

/** Stable cordis plugin name (matches cordis.patch.yml insert id). */
export const name = 'ui-plugin-manager'

/** Services the gateway needs — the web server seam. */
export const inject = ['webServer']

/** Apply the host half (once per process). */
export const apply = mountOnce('@linxin666/dsh-client-ui-plugin-manager', applyImpl)

function applyImpl(ctx: Context): void {
  ctx.inject(['skills','sessions'] as never, child=>mountSkills(child))
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
    const loader = ctx.get('loader') as unknown as { entries(): Iterable<{ id: string; options: {name: string; group?: boolean;disabled?:unknown;config?:{plugin?:string}}; disabled: boolean; fiber?: {state: number} }> } | undefined
    if (!loader) throw new Error('插件清单尚未就绪，请稍后刷新。')
    return [...loader.entries()].filter(e => !e.options.group).map(e => ({ entryId:e.id, moduleName:e.options.name, sourceModule:e.options.config?.plugin,enabled:!e.disabled,controlReason:e.options.disabled!=null&&typeof e.options.disabled!=='boolean'?'由条件表达式控制，请使用对应配置入口':undefined, fiberPhase:e.fiber ? ['pending','loading','active','failed',null,'unloading'][e.fiber.state] ?? null : null }))
  }
  const offline = new OfflineInstaller(facts, inventory)
  const gateway = new CliGateway(facts)
  const cliAvailable = (): boolean => findDshBinary() !== null

  ctx.effect(() => {
    const beforeCapabilityChange = async (moduleName: string) => {
      const service = ctx.get('capabilities' as never) as unknown as { assertPluginChange?: (name: string) => void | Promise<void> } | undefined
      await service?.assertPluginChange?.(moduleName)
    }
    const aiDisposers:Array<()=>void>=[]
    const routes = [inventoryControlRoute(facts,gateway,inventory,()=>ctx.get('agentPresets' as never) as unknown as PresetControl|undefined,beforeCapabilityChange),...makeGatewayRoutes({ facts, gateway, cliAvailable, offline, beforeCapabilityChange }), ...makeLocalManagementRoutes(offline, gateway, inventory, beforeCapabilityChange, async () => {
      const presets = ctx.get('agentPresets' as never) as unknown as { compositionInventory(): Promise<{ id: string; name?: string; isDefault: boolean; broken?: string; rows: { entryId: string | null; moduleName: string; enabled: boolean | 'conditional'; fiberState?: number }[] }[]> } | undefined
      if (!presets) return []
      return Promise.all((await presets.compositionInventory()).map(async p => {const rows=p.rows.map((e,i) => ({ entryId: e.entryId ?? 'row-'+i, moduleName: e.moduleName, enabled: e.enabled === true, fiberPhase: e.enabled === 'conditional' ? 'conditional' : e.fiberState === undefined ? null : ['pending','loading','active','failed',null,'unloading'][e.fiberState] ?? null }));let configured:InventoryEntry[]=rows;try{const control=presets as unknown as PresetControl;configured=presetConfiguredRows(await control.read(p.id),rows,(await control.resolve(p.id)).trust,p.id)}catch{configured=rows.map(e=>({...e,controlReason:'预设配置不可读取，暂不能切换'}))}return {id:p.id,name:p.name??p.id,isDefault:p.isDefault,broken:p.broken,rows:configured}}))
    },workbenchClassificationAdapter(ctx,facts.profileDir),dispose=>aiDisposers.push(dispose),req=>{
      const connection=ctx.get('connection' as never) as unknown as {requestRejection(req:import('node:http').IncomingMessage):number|undefined}|undefined
      return connection?connection.requestRejection(req):503
    })]
    const disposers = routes.map(route => ctx.webServer.register(route))
    disposers.push(registerWorkshopServiceRoutes(dirname(dirname(facts.profileDir)), routes))
    return () => {
      for (const dispose of aiDisposers) dispose()
      for (const dispose of disposers) dispose()
    }
  }, 'plugin-manager: gateway routes')
}
