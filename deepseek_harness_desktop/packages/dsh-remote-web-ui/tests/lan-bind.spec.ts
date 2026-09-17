/** The managed lan-bind patch block: parse, strip, and write semantics. */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { afterEach, describe, expect, it } from 'vitest'
import { LAN_BIND_BLOCK_BEGIN, LAN_BIND_BLOCK_END, lanBindState, managedBlock, managedBindOf, profilePatchFile, stripManagedBlock, writeLanBind } from '../src/lan-bind.ts'

const tempDirs: string[] = []

function tempHome(): string {
  const dir = mkdtempSync(join(tmpdir(), 'remote-web-ui-lan-bind-'))
  tempDirs.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('managedBindOf / managedBlock', () => {
  it('parses the pinned bind out of the block', () => {
    expect(managedBindOf(managedBlock('0.0.0.0', 3080))).toEqual({ host: '0.0.0.0', port: 3080 })
    expect(managedBindOf(managedBlock('127.0.0.1', 3191))).toEqual({ host: '127.0.0.1', port: 3191 })
  })

  it('returns undefined without a managed block', () => {
    expect(managedBindOf('- id: other\n  config:\n    host: 0.0.0.0\n')).toBeUndefined()
    expect(managedBindOf('')).toBeUndefined()
  })

  it('surfaces hand-edited values instead of claiming a known state', () => {
    const handEdited = managedBlock('0.0.0.0', 3080).replace("'0.0.0.0'", "'192.168.1.5'")
    expect(managedBindOf(handEdited)?.host).toBe('192.168.1.5')
  })
})

describe('stripManagedBlock', () => {
  it('removes the block and keeps surrounding content byte-identical', () => {
    const before = '- id: a\n  config:\n    x: 1\n'
    const content = `${before}${LAN_BIND_BLOCK_BEGIN}\n- id: webserver\n  config:\n    host: '0.0.0.0'\n    port: 3080\n${LAN_BIND_BLOCK_END}\n- id: b\n`
    expect(stripManagedBlock(content)).toBe(`${before}- id: b\n`)
  })

  it('leaves content without a block untouched', () => {
    const content = '- id: only\n'
    expect(stripManagedBlock(content)).toBe(content)
  })
})

describe('writeLanBind / lanBindState', () => {
  it('appends the block, preserves other rows, and rewrites in place', () => {
    const home = tempHome()
    const patch = join(home, 'profiles', 'web', 'cordis.patch.yml')
    mkdirSync(join(home, 'profiles', 'web'), { recursive: true })
    writeFileSync(patch, '- insert:\n    - id: remote-web-ui\n      name: \'@linxin666/dsh-remote-web-ui\'\n')
    writeLanBind('0.0.0.0', 3080, 'web', home)
    const afterOn = readFileSync(patch, 'utf8')
    expect(afterOn).toContain('- id: remote-web-ui')
    expect(managedBindOf(afterOn)).toEqual({ host: '0.0.0.0', port: 3080 })
    expect(lanBindState('web', home)).toEqual({ blockPresent: true, host: '0.0.0.0', port: 3080 })
    // Flipping rewrites the same block (no duplication).
    writeLanBind('127.0.0.1', 3191, 'web', home)
    const afterOff = readFileSync(patch, 'utf8')
    expect(managedBindOf(afterOff)).toEqual({ host: '127.0.0.1', port: 3191 })
    expect(afterOff.split(LAN_BIND_BLOCK_BEGIN)).toHaveLength(2)
  })

  it('reports a missing file as untouched', () => {
    const home = tempHome()
    expect(lanBindState('web', home)).toEqual({ blockPresent: false })
  })

  it('refuses profiles that escape the profiles directory', () => {
    const home = tempHome()
    expect(() => writeLanBind('0.0.0.0', 3080, '../elsewhere', home)).toThrow(/unsafe lan-bind profile/)
    expect(() => writeLanBind('0.0.0.0', 3080, 'a/b', home)).toThrow(/unsafe lan-bind profile/)
    expect(() => writeLanBind('0.0.0.0', 3080, '..', home)).toThrow(/unsafe lan-bind profile/)
    expect(() => profilePatchFile('../../elsewhere', home)).toThrow(/unsafe lan-bind profile/)
  })

  it('truncates an unterminated block instead of stacking a second webserver row', () => {
    const home = tempHome()
    const patch = join(home, 'profiles', 'web', 'cordis.patch.yml')
    mkdirSync(join(home, 'profiles', 'web'), { recursive: true })
    // A hand-truncated file: BEGIN present, END missing.
    writeFileSync(patch, '- id: keep\n' + `${LAN_BIND_BLOCK_BEGIN}\n- id: webserver\n  config:\n    host: '0.0.0.0'\n`)   
    writeLanBind('127.0.0.1', 3191, 'web', home)
    const after = readFileSync(patch, 'utf8')
    expect(managedBindOf(after)).toEqual({ host: '127.0.0.1', port: 3191 })
    expect(after.split(LAN_BIND_BLOCK_BEGIN)).toHaveLength(2)
    expect(after.split('- id: webserver')).toHaveLength(2)
    expect(after).toContain('- id: keep')
  })

  it.skipIf(process.platform === 'win32')('preserves the original file permissions instead of resetting to umask', () => {
    const home = tempHome()
    const patch = join(home, 'profiles', 'web', 'cordis.patch.yml')
    mkdirSync(join(home, 'profiles', 'web'), { recursive: true })
    writeFileSync(patch, '- id: a\n', { mode: 0o600 })
    writeLanBind('0.0.0.0', 3080, 'web', home)
    expect(statSync(patch).mode & 0o777).toBe(0o600)
  })

  it('strips empty array placeholder [] so cordis.patch.yml remains valid YAML', () => {
    const home = tempHome()

    // Case 1: only []
    const patch1 = join(home, 'profiles', 'p1', 'cordis.patch.yml')
    mkdirSync(join(home, 'profiles', 'p1'), { recursive: true })
    writeFileSync(patch1, '[]\n')
    writeLanBind('0.0.0.0', 3080, 'p1', home)
    const content1 = readFileSync(patch1, 'utf8')
    expect(content1).not.toContain('[]')
    expect(content1.startsWith(LAN_BIND_BLOCK_BEGIN)).toBe(true)
    expect(managedBindOf(content1)).toEqual({ host: '0.0.0.0', port: 3080 })

    // Case 2: # comment followed by []
    const patch2 = join(home, 'profiles', 'p2', 'cordis.patch.yml')
    mkdirSync(join(home, 'profiles', 'p2'), { recursive: true })
    writeFileSync(patch2, '# user patch\n[]\n')
    writeLanBind('0.0.0.0', 3080, 'p2', home)
    const content2 = readFileSync(patch2, 'utf8')
    expect(content2).not.toContain('[]')
    expect(content2).toContain('# user patch')
    expect(managedBindOf(content2)).toEqual({ host: '0.0.0.0', port: 3080 })

    // Case 3: existing entries followed by []
    const patch3 = join(home, 'profiles', 'p3', 'cordis.patch.yml')
    mkdirSync(join(home, 'profiles', 'p3'), { recursive: true })
    writeFileSync(patch3, '- id: keep\n  config:\n    x: 1\n[]\n')
    writeLanBind('0.0.0.0', 3080, 'p3', home)
    const content3 = readFileSync(patch3, 'utf8')
    expect(content3).not.toContain('[]')
    expect(content3).toContain('- id: keep')
    expect(managedBindOf(content3)).toEqual({ host: '0.0.0.0', port: 3080 })
  })
})

