/**
 * Provider disable/enable core: the disabled-profile archive and the path ops
 * a toggle performs.
 *
 * Disabling a provider uses the only sanctioned seam that takes it out of the
 * model catalog (which both the composer picker and the subagent selection
 * read): unset `llm-pi-ai.providers.<route>` — the same write the official
 * Remove-provider button performs. Because that deletes the profile, the
 * toggle first stashes it in this plugin's own settings namespace under
 * `disabled.<route>`; enabling restores the profile verbatim and clears the
 * archive entry. Orderings are chosen so the worst case is a harmless
 * duplicate archive, never a lost profile.
 *
 * @module @linxin666/dsh-client-ui-model-capabilities/core/provider-toggle
 */

import type { JsonValue } from '@deepseek-ai/dsh-util-values'
import type { PathOp, SetPathOp } from './capabilities.ts'

/** This plugin's own settings namespace (registered by the host half). */
export const CAPS_SETTINGS_NAMESPACE = 'dsh-model-capabilities'

/** One archived provider profile. */
export interface StashedProvider {
  /** The profile exactly as the user layer held it (open structure, verbatim). */
  profile: Record<string, unknown>
  /** Display name at disable time, for the archive listing. */
  displayName?: string
}

/** Whether a value is a plain data object (not an array, null, or class instance). */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Parse the archive from the namespace's resolved value: `disabled` keyed by
 * route id. Malformed entries are skipped (a stash this plugin did not write
 * must not break the listing).
 */
export function readDisabledStore(value: unknown): Record<string, StashedProvider> {
  const out: Record<string, StashedProvider> = {}
  if (!isPlainObject(value) || !isPlainObject(value['disabled'])) return out
  const disabled = value['disabled']
  for (const [route, entry] of Object.entries(disabled)) {
    if (!isPlainObject(entry) || !isPlainObject(entry['profile'])) continue
    out[route] = {
      profile: entry['profile'],
      ...(typeof entry['displayName'] === 'string' && entry['displayName'].length > 0
        ? { displayName: entry['displayName'] }
        : {}),
    }
  }
  return out
}

/** Whether one settings layer holds a profile for the route. */
export function hasProfileAt(section: unknown, route: string): boolean {
  if (!isPlainObject(section) || !isPlainObject(section['providers'])) return false
  return isPlainObject(section['providers'][route])
}

/**
 * Whether a layer other than the user section holds the route, so unsetting the
 * user profile would not take the provider down. The composition `base` layer
 * answers directly when the view carries it; a view without `base` falls back
 * to "the resolved value has it but the user layer does not".
 */
export function hasNonUserProfile(
  view: { user?: unknown, base?: unknown, value?: unknown },
  route: string,
): boolean {
  if (view.base !== undefined) return hasProfileAt(view.base, route)
  return !hasProfileAt(view.user, route) && hasProfileAt(view.value, route)
}

/** Archive one profile: `disabled.<route> = stash` in the plugin namespace. */
export function buildStashOp(route: string, stash: StashedProvider): SetPathOp {
  // The stash is the JSON-parsed stored profile plus a display-name string.
  return { op: 'set', path: ['disabled', route], value: stash as unknown as JsonValue }
}

/** Drop one archive entry: unset `disabled.<route>` in the plugin namespace. */
export function buildUnstashOp(route: string): PathOp {
  return { op: 'unset', path: ['disabled', route] }
}

/** Take the route down: unset `providers.<route>` in the pi-ai namespace. */
export function buildUnsetProviderOp(route: string): PathOp {
  return { op: 'unset', path: ['providers', route] }
}

/** Bring the route back: restore the archived profile verbatim. */
export function buildRestoreProviderOp(route: string, profile: Record<string, unknown>): SetPathOp {
  return {
    op: 'set',
    path: ['providers', route],
    // The profile came from a JSON-parsed stored view, so it is JSON-shaped.
    value: profile as unknown as JsonValue,
  }
}
