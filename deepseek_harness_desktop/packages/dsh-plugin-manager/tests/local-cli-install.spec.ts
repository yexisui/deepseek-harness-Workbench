/** Opt-in real official CLI check; all writes stay inside a disposable DSH home. */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { expect, it } from 'vitest'
import { CliGateway } from '../src/host/gateway.ts'

const binary = process.env.DSH_TEST_REAL_DSH_BINARY
it.skipIf(process.platform !== 'win32' || !binary)('installs a local bundle through the real official CLI from a Chinese path containing spaces', async () => {
  const root = mkdtempSync(join(tmpdir(), 'dsh-workshop 本地包 '))
  const home = join(root, 'home 资料')
  const profileName = 'workshop-qa'
  const profileDir = join(home, 'profiles', profileName)
  const source = join(root, 'plugin 资源')
  mkdirSync(profileDir, { recursive: true })
  mkdirSync(source, { recursive: true })
  writeFileSync(join(profileDir, 'package.json'), JSON.stringify({ name: 'workshop-qa-profile', private: true, type: 'module', dependencies: {}, dsh: { profile: { bundles: [] } } }))
  writeFileSync(join(profileDir, 'cordis.patch.yml'), '[]\n')
  writeFileSync(join(profileDir, 'pnpm-workspace.yaml'), 'packages: []\n')
  writeFileSync(join(source, 'package.json'), JSON.stringify({ name: 'dsh-workshop-local-qa', version: '1.0.0', type: 'module', main: './index.js', dsh: { bundle: { patch: './cordis.patch.yml' } } }))
  writeFileSync(join(source, 'index.js'), 'export const name = "local-qa"; export function apply() {}\n')
  writeFileSync(join(source, 'cordis.patch.yml'), '[]\n')
  const env = {
    ...process.env, DSH_HOME: home, DSH_PROFILE: profileName,
    PATH: dirname(binary!) + ';' + process.env.PATH,
    npm_config_offline: 'true', npm_config_cache: join(root, 'cache'), npm_config_store_dir: join(root, 'store'),
    PNPM_HOME: join(root, 'pnpm-home'), XDG_CACHE_HOME: join(root, 'xdg-cache'), XDG_DATA_HOME: join(root, 'xdg-data'),
  }
  const gateway = new CliGateway({ profileName, profileDir, patchPath: join(profileDir, 'cordis.patch.yml'), packageJsonPath: join(profileDir, 'package.json') }, env, { findBinary: () => binary! })
  try {
    const { jobId } = gateway.install(`file:${source}`)
    const deadline = Date.now() + 90_000
    while (gateway.status(jobId)?.phase === 'running' && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100))
    const job = gateway.status(jobId)
    expect(job?.error, JSON.stringify(job)).toBeUndefined()
    expect(job?.phase, JSON.stringify(job)).toBe('done')
    expect(job?.plugin?.id).toBe('dsh-workshop-local-qa')
    const manifest = JSON.parse(readFileSync(join(profileDir, 'package.json'), 'utf8'))
    expect(manifest.dependencies['dsh-workshop-local-qa']).toContain('file:')
    expect(manifest.dsh.profile.bundles).toContain('dsh-workshop-local-qa')
    expect(existsSync(join(profileDir, 'node_modules', 'dsh-workshop-local-qa', 'index.js'))).toBe(true)
  } finally {
    rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
  }
}, 100_000)
