/**
 * Local Workshop browser half. Registers the dictionaries and the existing
 * first-level settings section for local ZIP/folder imports and inventory.
 * @module @linxin666/dsh-client-ui-market/client
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { SettingsScope, SettingsScopeSpec } from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import {
  MarketCardController,
  MarketSection,
  type MarketSettings,
  type WorkshopPanelKeyProps,
  type WorkshopPanelOwnerProps,
} from './MarketCard.tsx'
import { en, zh, type MarketKey } from './locales.ts'

export type {
  MarketCardProps,
  MarketSectionProps,
  WorkshopPanelKeyProps,
  WorkshopPanelOwnerProps,
  WorkshopPresetRecord,
} from './MarketCard.tsx'
export type { InstalledPluginItem, InstallProgressItem, PluginManagerService } from './plugin-manager-bridge.ts'

const MARKET_NS = 'dsh-web-ui-market'
const SECTION_ID = 'dsh-workshop'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Market card copy. */
    'dsh-web-ui-market': MarketKey
  }

  interface SlotMap {
    /**
     * Compatibility declaration for existing contributors. The local
     * Workshop manages all four kinds itself and does not render remote
     * catalog panels.
     */
    'dsh-workshop.panel': {
      kind: 'keyed'
      scope: 'root'
      owner: WorkshopPanelOwnerProps
      keyProps: { preset: WorkshopPanelKeyProps }
    }
  }
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Optional rc.6 compatibility binder provided by dsh-web-settings. */
    webUiSettings?: { bind<S>(spec: SettingsScopeSpec<S>): SettingsScope<S> }
  }
}

export const inject = ['slots', 'locale', 'connection', 'settingsScope', 'remote']

/** Register the local Workshop section without remote catalog or telemetry. */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => {
    try {
      return ctx.locale.register(MARKET_NS, { zh, en })
    } catch {
      return () => {}
    }
  }, 'dsh-web-ui-market: dictionaries')

  const binder = ctx.get('webUiSettings') ?? ctx.settingsScope
  const settingsScope = binder.bind<MarketSettings>({ namespace: MARKET_NS })
  const controller = new MarketCardController(settingsScope)

  // Keep the existing first-level section and slot identity for compatibility.
  // The section entry owns the controller: unregistering it (fiber
  // disposal, hot reload) releases the scope subscription through dispose.
  ctx.slots.inject('settings.section', () => {
    try {
      const unregister = ctx.slots.register({
        name: 'settings.section',
        id: SECTION_ID,
        order: 150,
        label: () => ctx.locale.bind(MARKET_NS)('settings.title'),
        locale: MARKET_NS,
        children: { 'dsh-workshop.panel': { kind: 'keyed', scope: 'root' } },
        inject: () => controller.inject(),
      }, MarketSection)
      return () => {
        unregister()
        controller.dispose()
      }
    } catch {
      return () => {}
    }
  })
}
