/**
 * DSH compatibility contract invariant: every family package declares its
 * minimum runtime metadata. Generated nested compatibility
 * shims are intentionally outside the family package walker.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { walkFamilyPackages } from './lib/family-packages.mjs'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const SUPPORTED_MINIMUM = /^>=\s*v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/

function readManifest(pkgPath) {
  return JSON.parse(readFileSync(pkgPath, 'utf8'))
}

function assertSupportedMinimum(pkgPath) {
  const minimum = readManifest(pkgPath)?.dsh?.engines?.dsh
  assert.equal(typeof minimum, 'string', `${relative(ROOT, pkgPath)} must declare dsh.engines.dsh`)
  assert.match(minimum, SUPPORTED_MINIMUM, `${relative(ROOT, pkgPath)} must use the supported >=<semver> form`)
}

test('every family package declares a supported DSH runtime floor', () => {
  const packages = walkFamilyPackages(ROOT)
  assert.ok(packages.length > 0, 'family walker found no packages')
  for (const { pkgPath } of packages) assertSupportedMinimum(pkgPath)
})
