import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/agent/dsh-process.ts', () => ({ spawnDsh: vi.fn(() => { throw new Error('unexpected subprocess') }) }))
import { spawnDsh } from '../src/agent/dsh-process.ts'
import { migrateLegacyAggregate } from '../src/agent/migrate.ts'

const homes: string[] = []
afterEach(() => {
  for (const home of homes.splice(0)) rmSync(home, { recursive: true, force: true })
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

function profile(dependencies: Record<string, string>) {
  const home = mkdtempSync(join(tmpdir(), 'doctor-migrate-'))
  homes.push(home)
  const directory = join(home, 'profiles', 'web')
  mkdirSync(directory, { recursive: true })
  const path = join(directory, 'package.json')
  writeFileSync(path, JSON.stringify({ name: 'dsh-profile-web', dependencies, dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', ...Object.keys(dependencies)] } } }))
  writeFileSync(join(directory, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n')
  return { home, directory, path }
}

describe('read-only author aggregate migration', () => {
  it.each(['0.3.2', 'link:../repo/dsh-web-ui-all', 'file:../dsh-web-ui-all.tgz'])(
    'reports manual deployment for %s without network, subprocesses or profile writes', async spec => {
      const state = profile({ '@linxin666/dsh-web-ui-all': spec })
      const original = readFileSync(state.path, 'utf8')
      const fetch = vi.fn(() => { throw new Error('unexpected network') })
      vi.stubGlobal('fetch', fetch)
      const result = await migrateLegacyAggregate(state.home, 'web')
      expect(result).toMatchObject({ kind: 'error', message: expect.stringContaining('deploy the required package manually') })
      expect(fetch).not.toHaveBeenCalled()
      expect(spawnDsh).not.toHaveBeenCalled()
      expect(readFileSync(state.path, 'utf8')).toBe(original)
      expect(readFileSync(join(state.directory, 'pnpm-lock.yaml'), 'utf8')).toBe('lockfileVersion: 9\n')
      expect(readdirSync(state.directory).sort()).toEqual(['package.json', 'pnpm-lock.yaml'])
    },
  )

  it('leaves the official base and non-legacy dependencies unchanged', async () => {
    const state = profile({ '@deepseek-ai/dsh-base': '0.1.5', '@linxin666/dsh-web-all': '0.3.23' })
    const original = readFileSync(state.path, 'utf8')
    expect((await migrateLegacyAggregate(state.home, 'web')).kind).toBe('noop')
    expect(readFileSync(state.path, 'utf8')).toBe(original)
    expect(spawnDsh).not.toHaveBeenCalled()
  })
})
