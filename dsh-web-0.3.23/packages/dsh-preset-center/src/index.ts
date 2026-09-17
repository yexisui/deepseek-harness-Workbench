/**
 * Host half of the preset center: mounts the loopback-only preset-library
 * gateway (see `routes.ts`) that the Workshop's Presets panel drives.
 *
 * The library itself is plain filesystem state under `$DSH_HOME` (see
 * `core/library.ts`); this half owns no durable record of its own, so a
 * preset enabled by another process or deleted by hand is reported from disk
 * on the next read.
 * @module @linxin666/dsh-client-ui-preset-center
 */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { mountOnce } from './mount-once.ts'
import { makePresetCenterRoutes } from './routes.ts'

/** Stable cordis plugin name (matches the cordis.patch.yml insert id). */
export const name = 'ui-preset-center'

/** The gateway requires the host webserver; the roster is read opportunistically. */
export const inject = ['webServer']

/** Mount the preset-center gateway (once per process). */
export const apply = mountOnce('@linxin666/dsh-client-ui-preset-center', applyImpl)

function applyImpl(ctx: Context): void {
  const routes = makePresetCenterRoutes({ ctx })
  for (const route of routes) {
    try {
      ctx.effect(() => {
        const dispose = ctx.webServer.register(route)
        return () => { dispose() }
      }, `dsh-preset-center: route ${route.path}`)
    } catch {
      /* settings-only install: the panel degrades to a gateway-unavailable note */
    }
  }
}

export { makePresetCenterRoutes, PRESET_CENTER_API_PREFIX, COMPOSITION_MAX_BYTES } from './routes.ts'
export type { PresetCenterRouteDeps } from './routes.ts'
export {
  disablePreset,
  enablePreset,
  listPresetStates,
  readPresetState,
  scanPresetIds,
  uninstallPreset,
  moveDirectory,
  PresetOperationError,
} from './core/library.ts'
export type { PresetOperationCode, PresetStateRow } from './core/library.ts'
export { profileComposition, profilePresetDir, needsConfirmation } from './core/profile.ts'
export type { CodeExecution, CompositionProfile } from './core/profile.ts'
export { readProvenance, verifyProvenance, listFiles } from './core/provenance.ts'
export type { PresetProvenance, ProvenanceReport, ProvenanceState } from './core/provenance.ts'
export {
  COMPOSITION_FILE,
  ENABLED_DIR,
  LIBRARY_DIR,
  PRESET_ID_RE,
  PROVENANCE_FILENAME,
  enabledRoot,
  isPresetId,
  libraryRoot,
} from './core/paths.ts'
