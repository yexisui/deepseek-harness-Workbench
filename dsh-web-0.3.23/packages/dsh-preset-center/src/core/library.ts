/**
 * The preset library state machine: install, enable, disable, uninstall, and
 * the filesystem-derived state every surface reads.
 *
 * Two directories, one truth (see `paths.ts`): a preset in the library is
 * inert because no discovery root scans it; a preset in the discovery root is
 * live because the official roster re-reads its roots on every call. Every
 * transition is a directory move, so a crash between steps leaves a state the
 * next scan reports instead of a half-written preset.
 *
 * The module owns no policy: reserved ids and the default-preset guard live in
 * the route layer, which is the only place that can read the roster.
 * @module @linxin666/dsh-client-ui-preset-center/core/library
 */

import { cpSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { enabledRoot, isPresetId, libraryRoot } from './paths.ts'
import { isDirectory, verifyProvenance, type ProvenanceReport } from './provenance.ts'

/** Why a library operation was refused. */
export type PresetOperationCode =
  | 'invalid-id'
  | 'not-installed'
  | 'already-enabled'
  | 'not-enabled'
  | 'not-managed'
  | 'conflict'
  | 'write'

/** A refused library operation. */
export class PresetOperationError extends Error {
  readonly code: PresetOperationCode
  constructor(code: PresetOperationCode, message: string) {
    super(message)
    this.code = code
  }
}

/** Filesystem-derived state of one preset id. */
export interface PresetStateRow {
  /** Preset id (the directory name). */
  id: string
  /** The library copy exists. */
  installed: boolean
  /** The discovery-root copy exists. */
  enabled: boolean
  /** A well-formed market provenance record is present in either copy. */
  managed: boolean
  /** Market asset version recorded at install, when the record carries one. */
  assetVersion?: string
  /** Install timestamp recorded at install. */
  installedAt?: string
  /** Integrity of the copy that governs (enabled copy wins). */
  integrity: 'valid' | 'modified' | 'missing' | 'none'
  /** Both copies exist: a hand copy or an interrupted operation. */
  conflict: boolean
  /** The directory the row describes. */
  dir: string
}

/** Subdirectory ids of one root, sorted; absent roots yield none. */
export function scanPresetIds(root: string): string[] {
  let entries
  try {
    entries = readdirSync(root, { withFileTypes: true })
  } catch {
    return []
  }
  return entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.') && isPresetId(entry.name))
    .map((entry) => entry.name)
    .sort()
}

/** The state of one id, derived from the two directories. */
export function readPresetState(dshHome: string, id: string): PresetStateRow {
  const libraryDir = join(libraryRoot(dshHome), id)
  const enabledDir = join(enabledRoot(dshHome), id)
  const installed = isDirectory(libraryDir)
  const enabled = isDirectory(enabledDir)
  const dir = enabled ? enabledDir : libraryDir
  const report: ProvenanceReport = dir === libraryDir && !installed
    ? { state: 'missing', provenance: null, mismatches: [], missing: [], extra: [] }
    : verifyProvenance(dir, id)
  const provenance = report.provenance
  return {
    id,
    installed,
    enabled,
    managed: provenance !== null,
    ...(provenance?.assetVersion === undefined ? {} : { assetVersion: provenance.assetVersion }),
    ...(provenance?.installedAt === undefined ? {} : { installedAt: provenance.installedAt }),
    integrity: installed || enabled ? report.state : 'none',
    conflict: installed && enabled,
    dir,
  }
}

/** Every id present in either directory, sorted, with its state. */
export function listPresetStates(dshHome: string): PresetStateRow[] {
  const ids = [...new Set([...scanPresetIds(libraryRoot(dshHome)), ...scanPresetIds(enabledRoot(dshHome))])].sort()
  return ids.map((id) => readPresetState(dshHome, id))
}

const RETRYABLE = new Set(['EPERM', 'EBUSY', 'EACCES', 'ENOTEMPTY'])

function errnoOf(err: unknown): string | undefined {
  const code = typeof err === 'object' && err !== null ? (err as { code?: unknown }).code : undefined
  return typeof code === 'string' ? code : undefined
}

/** File count and byte total of a tree, for the cross-volume copy check. */
function treeStats(dir: string): { files: number; bytes: number } {
  let files = 0
  let bytes = 0
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name)
    if (entry.isDirectory()) {
      const nested = treeStats(abs)
      files += nested.files
      bytes += nested.bytes
    } else if (entry.isFile()) {
      files += 1
      bytes += statSync(abs).size
    }
  }
  return { files, bytes }
}

/**
 * Move one directory into a destination that must not exist yet. A rename is
 * atomic within a volume; across volumes the directory is copied, verified by
 * file count and byte total, and only then removed from the source. Transient
 * Windows handle-release failures are retried briefly before giving up.
 */
export function moveDirectory(src: string, dest: string): void {
  let lastError: unknown
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      renameSync(src, dest)
      return
    } catch (err) {
      lastError = err
      const code = errnoOf(err)
      if (code === 'EXDEV') {
        try {
          cpSync(src, dest, { recursive: true, errorOnExist: true, force: false })
          const from = treeStats(src)
          const to = treeStats(dest)
          if (from.files !== to.files || from.bytes !== to.bytes) {
            rmSync(dest, { recursive: true, force: true })
            throw new PresetOperationError('write', `cross-volume copy of ${src} did not match its source`)
          }
          rmSync(src, { recursive: true, force: true })
          return
        } catch (copyErr) {
          try { rmSync(dest, { recursive: true, force: true }) } catch { /* best effort */ }
          throw copyErr instanceof PresetOperationError
            ? copyErr
            : new PresetOperationError('write', copyErr instanceof Error ? copyErr.message : String(copyErr))
        }
      }
      if (code === undefined || !RETRYABLE.has(code)) break
      const until = Date.now() + 60 * (attempt + 1)
      while (Date.now() < until) { /* brief handle-release wait */ }
    }
  }
  throw new PresetOperationError('write', lastError instanceof Error ? lastError.message : String(lastError))
}

/** Absolute library path of one id. */
export function libraryDirOf(dshHome: string, id: string): string {
  return join(libraryRoot(dshHome), id)
}

/** Absolute discovery-root path of one id. */
export function enabledDirOf(dshHome: string, id: string): string {
  return join(enabledRoot(dshHome), id)
}

/**
 * Move a preset from the library into the discovery root.
 * @throws {PresetOperationError} invalid-id, not-installed, already-enabled, conflict, write.
 */
export function enablePreset(dshHome: string, id: string): PresetStateRow {
  if (!isPresetId(id)) throw new PresetOperationError('invalid-id', `invalid preset id: ${String(id)}`)
  const src = libraryDirOf(dshHome, id)
  const dest = enabledDirOf(dshHome, id)
  if (isDirectory(dest)) throw new PresetOperationError('already-enabled', `preset is already enabled: ${id}`)
  if (!isDirectory(src)) throw new PresetOperationError('not-installed', `preset is not installed: ${id}`)
  mkdirSync(enabledRoot(dshHome), { recursive: true })
  moveDirectory(src, dest)
  return readPresetState(dshHome, id)
}

/**
 * Move a preset from the discovery root back into the library.
 * @throws {PresetOperationError} invalid-id, not-enabled, not-managed, conflict, write.
 */
export function disablePreset(dshHome: string, id: string): PresetStateRow {
  if (!isPresetId(id)) throw new PresetOperationError('invalid-id', `invalid preset id: ${String(id)}`)
  const src = enabledDirOf(dshHome, id)
  const dest = libraryDirOf(dshHome, id)
  if (!isDirectory(src)) throw new PresetOperationError('not-enabled', `preset is not enabled: ${id}`)
  if (!readPresetState(dshHome, id).managed) {
    throw new PresetOperationError('not-managed', `preset was not installed from the Workshop: ${id}`)
  }
  if (existsSync(dest)) throw new PresetOperationError('conflict', `library already holds ${id}`)
  mkdirSync(libraryRoot(dshHome), { recursive: true })
  moveDirectory(src, dest)
  return readPresetState(dshHome, id)
}

/**
 * Remove every copy of a workshop-managed preset.
 * @throws {PresetOperationError} invalid-id, not-managed, write.
 */
export function uninstallPreset(dshHome: string, id: string): void {
  if (!isPresetId(id)) throw new PresetOperationError('invalid-id', `invalid preset id: ${String(id)}`)
  const state = readPresetState(dshHome, id)
  if (!state.installed && !state.enabled) return
  if (!state.managed) {
    throw new PresetOperationError('not-managed', `preset was not installed from the Workshop: ${id}`)
  }
  for (const dir of [libraryDirOf(dshHome, id), enabledDirOf(dshHome, id)]) {
    if (!isDirectory(dir)) continue
    try {
      rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 })
    } catch (err) {
      throw new PresetOperationError('write', err instanceof Error ? err.message : String(err))
    }
  }
}
