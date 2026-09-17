/**
 * Host half of the dsh-market card: registers the market settings namespace
 * (the card's enable switch) and mounts the local Workshop resource gateway.
 * The settings card never requests the online catalog.
 * @module @linxin666/dsh-client-ui-market
 */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type { SettingsNamespace } from '@deepseek-ai/dsh-settings'
import z from 'schemastery'
import { mountOnce } from './mount-once.ts'
import { makeLocalWorkshopRoutes } from './local-routes.ts'
import { makeLocalActionRoutes, listExistingWorkshopPlugins } from './local-actions.ts'
import { dshHome } from './dsh-home.ts'

/** Stable cordis plugin name (matches cordis.patch.yml insert id). */
export const name = 'ui-market'

/** Services the routes need; the gateway requires the host webserver. */
export const inject = ['webServer']

/** Settings namespace of the card's enable switch. */
export const MARKET_SETTINGS_NAMESPACE = 'dsh-web-ui-market' as SettingsNamespace

/** Plugin config, validated by the same-named schemastery schema. */
export interface Config {
  /** Master switch for the market card. */
  enabled?: boolean
}

export const Config: z<Config> = z.object({
  enabled: z.boolean().default(true),
})

/** Register the namespace and mount the install gateway (once). */
export const apply = mountOnce('@linxin666/dsh-client-ui-market', applyImpl)

function applyImpl(ctx: Context): void {
  ctx.inject(['settings'], (settingsCtx) => {
    try {
      if (typeof settingsCtx.settings?.installSection === 'function') {
        settingsCtx.settings.installSection(ctx, MARKET_SETTINGS_NAMESPACE, Config, {}, {
          setSource: () => { /* application is browser-side; value is read from the scope */ },
          onChange: () => { /* browser half re-reads on scope publish */ },
        })
      } else if (typeof settingsCtx.settings?.register === 'function') {
        settingsCtx.settings.register(MARKET_SETTINGS_NAMESPACE, Config, { base: {} })
      }
    } catch {
      // Defensive fallback against settings registration differences
    }
  })
  const home = dshHome()
  const routes = [...makeLocalWorkshopRoutes({ dshHome: home,
    additionalResources: (req) => listExistingWorkshopPlugins(req, home),
  }), ...makeLocalActionRoutes({ dshHome: home })]
  for (const route of routes) {
    try {
      ctx.effect(() => {
        const dispose = ctx.webServer.register(route)
        return () => { dispose() }
      }, 'dsh-web-ui-market: routes')
    } catch {
      /* settings-only install: keep the card usable without the gateway */
    }
  }
}

export { isSafeRel, MARKET_ORIGIN, PROVENANCE_FILENAME } from './core/installer.ts'
export type { InstallProvenance, MarketKind } from './core/installer.ts'
