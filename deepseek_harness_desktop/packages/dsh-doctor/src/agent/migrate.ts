/** Read-only compatibility entry for the retired author aggregate migration. */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parseProfileManifest } from '../core/manifest.ts'

export interface LegacyMigrationResult {
  kind: 'noop' | 'error'
  message: string
}

/**
 * Report manual deployment when the old author aggregate is installed.
 * This command never queries a registry, installs a package, or changes a
 * profile. The official DSH installer and Doctor rescue provisioning remain
 * separate operations.
 */
export async function migrateLegacyAggregate(home: string, profile: string): Promise<LegacyMigrationResult> {
  const packageJsonPath = join(home, 'profiles', profile, 'package.json')
  let manifestText: string
  try {
    manifestText = await readFile(packageJsonPath, 'utf8')
  } catch {
    return { kind: 'noop', message: 'profile package.json not found' }
  }
  const parsed = parseProfileManifest(manifestText, packageJsonPath)
  if (parsed.error !== undefined) return { kind: 'error', message: parsed.error }
  if (parsed.facts.dependencies['@linxin666/dsh-web-ui-all'] === undefined) {
    return { kind: 'noop', message: 'legacy aggregate is not installed' }
  }
  return {
    kind: 'error',
    message: 'doctor: automatic author-plugin migration is disabled; deploy the required package manually. The existing profile was not changed.',
  }
}
