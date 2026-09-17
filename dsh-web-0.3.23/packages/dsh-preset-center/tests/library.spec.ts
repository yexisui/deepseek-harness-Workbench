/**
 * Preset library state machine: the two-directory contract, provenance
 * integrity, and the refusal codes every surface relies on.
 */

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  PresetOperationError,
  disablePreset,
  enablePreset,
  listPresetStates,
  moveDirectory,
  readPresetState,
  uninstallPreset,
} from '../src/core/library.ts'
import { ENABLED_DIR, LIBRARY_DIR, PROVENANCE_FILENAME } from '../src/core/paths.ts'
import { verifyProvenance } from '../src/core/provenance.ts'

let home: string

/** Write one workshop-installed preset (composition + provenance) into the library. */
function writeLibraryPreset(id: string, files: Record<string, string> = {}): string {
  const dir = join(home, LIBRARY_DIR, id)
  mkdirSync(dir, { recursive: true })
  const all: Record<string, string> = { 'agent.cordis.yml': '- id: persona\n  name: "@deepseek-ai/dsh-persona"\n', 'preset.yml': 'name: Test\n', ...files }
  const hashes: Record<string, string> = {}
  for (const [rel, content] of Object.entries(all)) {
    writeFileSync(join(dir, rel), content)
    hashes[rel] = createHash('sha256').update(content).digest('hex')
  }
  writeFileSync(join(dir, PROVENANCE_FILENAME), JSON.stringify({
    version: 1,
    source: 'https://dsh-market.com',
    kind: 'preset',
    id,
    installedAt: '2026-09-09T00:00:00.000Z',
    assetVersion: '1.0.0',
    files: hashes,
  }, null, 2) + '\n')
  return dir
}

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'dsh-preset-center-'))
})

afterEach(() => {
  rmSync(home, { recursive: true, force: true })
})

describe('preset library', () => {
  it('reports an absent preset as uninstalled', () => {
    const row = readPresetState(home, 'demo')
    expect(row).toMatchObject({ id: 'demo', installed: false, enabled: false, managed: false, integrity: 'none', conflict: false })
  })

  it('installs into the library and keeps the preset out of the discovery root', () => {
    writeLibraryPreset('demo')
    const row = readPresetState(home, 'demo')
    expect(row.installed).toBe(true)
    expect(row.enabled).toBe(false)
    expect(row.managed).toBe(true)
    expect(row.integrity).toBe('valid')
    expect(existsSync(join(home, ENABLED_DIR, 'demo'))).toBe(false)
  })

  it('enables by moving the directory into the discovery root and disables by moving it back', () => {
    writeLibraryPreset('demo')
    enablePreset(home, 'demo')
    expect(existsSync(join(home, LIBRARY_DIR, 'demo'))).toBe(false)
    expect(existsSync(join(home, ENABLED_DIR, 'demo', 'agent.cordis.yml'))).toBe(true)
    expect(readPresetState(home, 'demo')).toMatchObject({ installed: false, enabled: true, managed: true })

    disablePreset(home, 'demo')
    expect(existsSync(join(home, ENABLED_DIR, 'demo'))).toBe(false)
    expect(readPresetState(home, 'demo')).toMatchObject({ installed: true, enabled: false })
  })

  it('refuses to enable a preset that is not installed', () => {
    expect(() => enablePreset(home, 'ghost')).toThrowError(PresetOperationError)
    try {
      enablePreset(home, 'ghost')
    } catch (err) {
      expect((err as PresetOperationError).code).toBe('not-installed')
    }
  })

  it('refuses an invalid id before touching the filesystem', () => {
    for (const id of ['Demo', 'a b', '../escape', '', 'demo/preset']) {
      expect(() => enablePreset(home, id)).toThrowError(PresetOperationError)
    }
  })

  it('refuses to disable a directory the workshop did not install', () => {
    mkdirSync(join(home, ENABLED_DIR, 'hand'), { recursive: true })
    writeFileSync(join(home, ENABLED_DIR, 'hand', 'agent.cordis.yml'), '- id: persona\n  name: "@deepseek-ai/dsh-persona"\n')
    try {
      disablePreset(home, 'hand')
      throw new Error('expected a refusal')
    } catch (err) {
      expect(err).toBeInstanceOf(PresetOperationError)
      expect((err as PresetOperationError).code).toBe('not-managed')
    }
    expect(existsSync(join(home, ENABLED_DIR, 'hand'))).toBe(true)
  })

  it('reports a conflict when both copies exist and refuses to disable into an occupied library', () => {
    writeLibraryPreset('demo')
    enablePreset(home, 'demo')
    writeLibraryPreset('demo')
    expect(readPresetState(home, 'demo').conflict).toBe(true)
    try {
      disablePreset(home, 'demo')
      throw new Error('expected a refusal')
    } catch (err) {
      expect((err as PresetOperationError).code).toBe('conflict')
    }
  })

  it('uninstalls both copies and refuses unmanaged directories', () => {
    writeLibraryPreset('demo')
    enablePreset(home, 'demo')
    writeLibraryPreset('demo')
    uninstallPreset(home, 'demo')
    expect(existsSync(join(home, LIBRARY_DIR, 'demo'))).toBe(false)
    expect(existsSync(join(home, ENABLED_DIR, 'demo'))).toBe(false)

    mkdirSync(join(home, ENABLED_DIR, 'hand'), { recursive: true })
    try {
      uninstallPreset(home, 'hand')
      throw new Error('expected a refusal')
    } catch (err) {
      expect((err as PresetOperationError).code).toBe('not-managed')
    }
  })

  it('lists every id present in either directory, sorted', () => {
    writeLibraryPreset('beta')
    writeLibraryPreset('alpha')
    enablePreset(home, 'beta')
    expect(listPresetStates(home).map((row) => row.id)).toEqual(['alpha', 'beta'])
  })

  it('detects a modified file against the recorded provenance', () => {
    writeLibraryPreset('demo')
    writeFileSync(join(home, LIBRARY_DIR, 'demo', 'agent.cordis.yml'), '- id: persona\n  name: "@deepseek-ai/dsh-persona"\n# edited\n')
    const report = verifyProvenance(join(home, LIBRARY_DIR, 'demo'), 'demo')
    expect(report.state).toBe('modified')
    expect(report.mismatches).toContain('agent.cordis.yml')
    expect(readPresetState(home, 'demo').integrity).toBe('modified')
  })

  it('treats provenance for another id as absent', () => {
    writeLibraryPreset('demo')
    const raw = JSON.parse(readFileSync(join(home, LIBRARY_DIR, 'demo', PROVENANCE_FILENAME), 'utf8')) as Record<string, unknown>
    raw.id = 'other'
    writeFileSync(join(home, LIBRARY_DIR, 'demo', PROVENANCE_FILENAME), JSON.stringify(raw))
    expect(readPresetState(home, 'demo').managed).toBe(false)
  })

  it('moves a directory atomically and refuses an existing destination', () => {
    const src = join(home, 'from')
    const dest = join(home, 'to')
    mkdirSync(src, { recursive: true })
    writeFileSync(join(src, 'file.txt'), 'x')
    moveDirectory(src, dest)
    expect(existsSync(join(dest, 'file.txt'))).toBe(true)
    expect(existsSync(src)).toBe(false)

    mkdirSync(src, { recursive: true })
    expect(() => moveDirectory(src, dest)).toThrowError(PresetOperationError)
  })
})
