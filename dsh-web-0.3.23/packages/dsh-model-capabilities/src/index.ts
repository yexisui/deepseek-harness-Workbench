/**
 * Host loader entry for the dsh-model-capabilities plugin — runs in the DSH host process.
 *
 * Registers the plugin's own settings namespace `dsh-model-capabilities`,
 * which stores the profiles of disabled providers: disabling a custom pi-ai
 * provider stashes its profile here and unsets `llm-pi-ai.providers.<route>`
 * (the official Remove-provider seam), which unregisters the route and takes
 * the provider out of the model catalog that both the composer picker and the
 * subagent selection read; enabling restores the profile. The namespace holds
 * configuration only — API keys stay in the credentials service and are
 * untouched by a toggle.
 * @module @linxin666/dsh-client-ui-model-capabilities
 */
import type { Context } from '@deepseek-ai/cordis'
import type { SettingsNamespace } from '@deepseek-ai/dsh-settings'
import z from 'schemastery'
import { CAPS_SETTINGS_NAMESPACE } from './core/provider-toggle.ts'
import { mountOnce } from './mount-once.ts'

/** Stable cordis plugin name (matches cordis.patch.yml insert id). */
export const name = 'ui-model-capabilities'

/** Plugin config: the disabled-provider archive, keyed by provider route id. */
export interface Config {
  /** route id -> stashed provider profile (plus its display name). */
  disabled?: Record<string, unknown>
}

export const Config: z<Config> = z.object({
  disabled: z.any().default({}),
})

/** Register the namespace (once per process; the family bundle may add a second row). */
export const apply = mountOnce('@linxin666/dsh-client-ui-model-capabilities', applyImpl)

function applyImpl(ctx: Context): void {
  ctx.inject(['settings'], (settingsCtx) => {
    try {
      if (typeof settingsCtx.settings?.installSection === 'function') {
        settingsCtx.settings.installSection(ctx, CAPS_SETTINGS_NAMESPACE as SettingsNamespace, Config, {}, {
          setSource: () => { /* application is browser-side; the value is read over the wire */ },
          onChange: () => { /* pickers refresh through the settings/document-updated event */ },
        })
      } else if (typeof settingsCtx.settings?.register === 'function') {
        settingsCtx.settings.register(CAPS_SETTINGS_NAMESPACE as SettingsNamespace, Config, { base: {} })
      }
    } catch {
      // A settings-registration difference must not take the host down; the
      // browser half degrades to capability editing without disable/enable.
    }
  })
}
