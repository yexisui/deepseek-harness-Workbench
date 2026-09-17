/**
 * The preset-center storage contract: where an installed preset lives while it
 * is inert (the library) and where it must live to be discovered (the harness
 * home's user preset root).
 *
 * Both paths are a cross-package contract, not private state:
 *  - the library is the destination the market installer writes (`preset`
 *    asset kind) and no discovery root scans;
 *  - the discovery root is `USER_PRESET_DIR` of
 *    `@deepseek-ai/dsh-agent-presets`, appended to the roster unless a
 *    deployment sets `includeUserRoot: false`.
 * @module @linxin666/dsh-client-ui-preset-center/core/paths
 */

import { join } from 'node:path'

/** Library directory under the DSH home: installed but inert. */
export const LIBRARY_DIR = 'agent-presets'

/** Official user preset root under the DSH home: present means enabled. */
export const ENABLED_DIR = '.agent-presets'

/**
 * Provenance filename written by the market installer (mirrors
 * `PROVENANCE_FILENAME` in `@linxin666/dsh-client-ui-market`; no
 * cross-package runtime import, the same way the skin center mirrors it).
 */
export const PROVENANCE_FILENAME = 'dsh-market.provenance.json'

/** The composition file that makes a directory a preset. */
export const COMPOSITION_FILE = 'agent.cordis.yml'

/** Official preset id rule (mirrors `PRESET_ID` in `@deepseek-ai/dsh-agent-presets`). */
export const PRESET_ID_RE = /^[a-z0-9][a-z0-9-]*$/

/** Whether `id` is a usable preset directory name. */
export function isPresetId(id: unknown): id is string {
  return typeof id === 'string' && PRESET_ID_RE.test(id)
}

/** The library directory for one DSH home. */
export function libraryRoot(dshHome: string): string {
  return join(dshHome, LIBRARY_DIR)
}

/** The discovery root for one DSH home. */
export function enabledRoot(dshHome: string): string {
  return join(dshHome, ENABLED_DIR)
}
