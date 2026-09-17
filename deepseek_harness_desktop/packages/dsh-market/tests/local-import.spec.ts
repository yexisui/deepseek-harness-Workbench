import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { deflateRawSync } from 'node:zlib'
import { Readable } from 'node:stream'
import { LocalWorkshopService, localResourceDir, readLocalImportRecord, LOCAL_IMPORT_RECORD, LOCAL_IMPORT_LIMITS } from '../src/core/local-import.ts'
import { crc32, extractLocalZip } from '../src/core/local-import-zip.ts'
import { safeLocalPath } from '../src/core/local-import-safety.ts'
import type { LocalKind } from '../src/core/local-types.ts'

let home: string
let service: LocalWorkshopService
beforeEach(() => { home = mkdtempSync(path.join(tmpdir(), 'dsh-local-import-')); service = new LocalWorkshopService({ dshHome: home }) })
afterEach(() => { rmSync(home, { recursive: true, force: true }) })

const skin = (id = 'custom-skin', version = '1.0.0'): Record<string, string> => ({
  'skin.json': JSON.stringify({ skinManifestVersion: 2, id, name: 'Custom skin', nameEn: 'Custom skin', author: 'Workshop tests', version, contributes: { stylesheet: 'skin.css' } }),
  'skin.css': ':root { --example: blue; }',
})
const plugin = (id = '@custom/test-plugin'): Record<string, string> => ({
  'package.json': JSON.stringify({ name: id, version: '1.0.0', main: 'lib/index.js', dsh: { bundle: { patch: './cordis.patch.yml' } } }),
  'cordis.patch.yml': '- insert:\n    - id: test\n      name: "' + id + '"\n',
  'lib/index.js': 'throw new Error("resource code must not execute");',
})
async function folder(files: Record<string, string>, kind: LocalKind = 'skin', use = service): Promise<string> {
  const id = use.start(kind, 'folder')
  for (const [name, content] of Object.entries(files)) await use.uploadFile(id, name, Readable.from([Buffer.from(content)]))
  return id
}

interface FixtureEntry { name: string; data?: string; method?: number; flags?: number; attrs?: number }
function zip(entries: FixtureEntry[]): Buffer {
  const local: Buffer[] = []
  const central: Buffer[] = []
  let offset = 0
  for (const entry of entries) {
    const raw = Buffer.from(entry.data ?? '')
    const name = Buffer.from(entry.name)
    const method = entry.method ?? 8
    const compressed = method === 8 ? deflateRawSync(raw) : raw
    const actualCompressed = entry.name.endsWith('/') ? Buffer.alloc(0) : compressed
    const header = Buffer.alloc(30)
    header.writeUInt32LE(0x04034b50)
    header.writeUInt16LE(20, 4)
    header.writeUInt16LE(entry.flags ?? 0x800, 6)
    header.writeUInt16LE(method, 8)
    header.writeUInt32LE(crc32(raw), 14)
    header.writeUInt32LE(actualCompressed.length, 18)
    header.writeUInt32LE(raw.length, 22)
    header.writeUInt16LE(name.length, 26)
    const directory = Buffer.alloc(46)
    directory.writeUInt32LE(0x02014b50)
    directory.writeUInt16LE(0x0314, 4)
    directory.writeUInt16LE(20, 6)
    directory.writeUInt16LE(entry.flags ?? 0x800, 8)
    directory.writeUInt16LE(method, 10)
    directory.writeUInt32LE(crc32(raw), 16)
    directory.writeUInt32LE(actualCompressed.length, 20)
    directory.writeUInt32LE(raw.length, 24)
    directory.writeUInt16LE(name.length, 28)
    directory.writeUInt32LE(entry.attrs ?? (entry.name.endsWith('/') ? 0x41ed0010 : 0x81a40000), 38)
    directory.writeUInt32LE(offset, 42)
    local.push(header, name, actualCompressed)
    central.push(directory, name)
    offset += header.length + name.length + actualCompressed.length
  }
  const directoryBytes = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(directoryBytes.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...local, directoryBytes, end])
}

describe('local Workshop library', () => {
  it('imports a folder copy, strips forged provenance, and hashes its own ownership record', async () => {
    const files = skin()
    const id = await folder({ ...files, 'dsh-market.provenance.json': '{"source":"https://dsh-market.com"}', [LOCAL_IMPORT_RECORD]: '{"source":"forged"}' })
    expect(service.inspect(id)).toMatchObject({ id: 'custom-skin', kind: 'skin', fileCount: 2, executable: false, conflict: false })
    expect(await service.commit(id)).toMatchObject({ source: 'local', managed: true, status: 'available' })
    const destination = localResourceDir(home, 'skin', 'custom-skin')
    expect(readFileSync(path.join(destination, 'skin.css'), 'utf8')).toBe(files['skin.css'])
    expect(existsSync(path.join(destination, 'dsh-market.provenance.json'))).toBe(false)
    expect(readLocalImportRecord(destination, { verify: true })).toMatchObject({ source: 'local-import', kind: 'skin', id: 'custom-skin' })
    writeFileSync(path.join(destination, 'skin.css'), 'changed')
    expect(readLocalImportRecord(destination, { verify: true })).toBeUndefined()
  })

  it('supports one wrapper folder and copied local ZIP assets', async () => {
    const id = service.start('skin', 'zip')
    const archive = zip([{ name: 'my-pack/' }, ...Object.entries(skin()).map(([name, data]) => ({ name: 'my-pack/' + name, data }))])
    await service.uploadFile(id, 'archive.zip', Readable.from([archive]))
    expect(service.inspect(id).fileCount).toBe(2)
    await service.commit(id)
    expect(service.resources()).toEqual([expect.objectContaining({ kind: 'skin', id: 'custom-skin', managed: true })])
  })

  it('preserves existing bytes unless replacement was explicitly confirmed, then keeps a backup', async () => {
    await service.commit(await folder(skin()))
    const second = await folder(skin('custom-skin', '2.0.0'))
    expect(service.inspect(second).conflict).toBe(true)
    await expect(service.commit(second)).rejects.toMatchObject({ code: 'conflict' })
    expect(JSON.parse(readFileSync(path.join(home, 'skins/custom-skin/skin.json'), 'utf8')).version).toBe('1.0.0')
    await service.commit(second, true)
    const backups = readdirSync(path.join(home, 'workshop/backups'))
    expect(backups).toHaveLength(1)
    expect(JSON.parse(readFileSync(path.join(home, 'workshop/backups', backups[0]!, 'skin.json'), 'utf8')).version).toBe('1.0.0')
  })

  it('rolls the original directory back when the final rename fails', async () => {
    await service.commit(await folder(skin()))
    let attempts = 0
    const failing = new LocalWorkshopService({ dshHome: home, rename: (from, to) => {
      if (++attempts === 2) throw new Error('simulated Windows file lock')
      renameSync(from, to)
    } })
    const second = await folder(skin('custom-skin', '2.0.0'), 'skin', failing)
    await expect(failing.commit(second, true)).rejects.toThrow('simulated Windows file lock')
    expect(JSON.parse(readFileSync(path.join(home, 'skins/custom-skin/skin.json'), 'utf8')).version).toBe('1.0.0')
    expect(readLocalImportRecord(path.join(home, 'skins/custom-skin'), { verify: true })).toBeDefined()
  })

  it('serializes simultaneous commits for the same id', async () => {
    const a = await folder(skin())
    const b = await folder(skin())
    const results = await Promise.allSettled([service.commit(a), service.commit(b)])
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1)
    expect(readLocalImportRecord(path.join(home, 'skins/custom-skin'), { verify: true })).toBeDefined()
  })

  it('validates built plugin packages but never loads their code', async () => {
    const id = await folder(plugin(), 'plugin')
    expect(service.inspect(id)).toMatchObject({ id: '@custom/test-plugin', executable: true })
    await service.commit(id)
    const dir = localResourceDir(home, 'plugin', '@custom/test-plugin')
    expect(path.basename(dir)).toMatch(/^[0-9a-f]{64}$/)
    expect(existsSync(path.join(dir, 'lib/index.js'))).toBe(true)
    expect(existsSync(path.join(home, 'profiles/web/package.json'))).toBe(false)
  })

  it('accepts official !!js expressions in a plugin patch without evaluating or loading code', async () => {
    const files = plugin()
    files['cordis.patch.yml'] = '- insert:\n    - id: test\n      name: "@custom/test-plugin"\n      disabled: !!js "(() => { throw new Error(\'must never evaluate\') })()"\n      config:\n        enabled: !!js "process.platform === \'win32\'"\n'
    const id = await folder(files, 'plugin')
    expect(service.inspect(id)).toMatchObject({ kind: 'plugin', id: '@custom/test-plugin', executable: true, fileCount: 3 })
    expect(existsSync(path.join(home, 'profiles'))).toBe(false)
  })

  it('keeps presets inert, derives the wrapper id, and reports active collisions', async () => {
    const id = await folder({ 'my-preset/preset.yml': 'name: My preset\n', 'my-preset/agent.cordis.yml': '- name: "@custom/persona"\n  config:\n    code: !!js "function() { throw new Error() }"\n' }, 'preset')
    expect(service.inspect(id)).toMatchObject({ id: 'my-preset', executable: true })
    await service.commit(id)
    expect(existsSync(path.join(home, '.agent-presets/my-preset'))).toBe(false)
    mkdirSync(path.join(home, '.agent-presets/my-preset'), { recursive: true })
    const replacement = await folder({ 'my-preset/preset.yml': 'name: My preset\n', 'my-preset/agent.cordis.yml': '- name: "@custom/persona"\n' }, 'preset')
    expect(() => service.inspect(replacement)).toThrow('Disable this preset')
  })

  it('accepts a sprite pet and rejects a missing referenced spritesheet', async () => {
    const manifest = JSON.stringify({ petManifestVersion: 2, id: 'custom-pet', displayName: 'Custom pet', license: 'CC0-1.0', renderer: 'sprite2d', sprite2d: { spritesheetPath: 'sprite.webp' } })
    const missing = await folder({ 'pet.json': manifest }, 'pet')
    expect(() => service.inspect(missing)).toThrow('missing the referenced file')
    const valid = await folder({ 'pet.json': manifest, 'sprite.webp': 'image bytes' }, 'pet')
    expect(service.inspect(valid)).toMatchObject({ id: 'custom-pet', executable: false })
  })

  it.each(['author', 'nameEn', 'version'])('rejects a skin missing the Skin Center required %s field before commit', async field => {
    const files = skin()
    const manifest = JSON.parse(files['skin.json']!) as Record<string, unknown>
    delete manifest[field]
    files['skin.json'] = JSON.stringify(manifest)
    const id = await folder(files)
    expect(() => service.inspect(id)).toThrow('Skin Center cannot load this manifest')
    await expect(service.commit(id)).rejects.toMatchObject({ code: 'invalid-manifest' })
    expect(existsSync(path.join(home, 'skins/custom-skin'))).toBe(false)
  })

  it('uses the complete skin schema, including id, preview and facet constraints', async () => {
    const files = skin('theme-' + 'a'.repeat(35))
    const manifest = JSON.parse(files['skin.json']!) as Record<string, unknown>
    manifest.preview = { light: 'skin.css' }
    manifest.facets = { client: { entry: 'hooks.mjs', apiVersion: 'unsupported' } }
    files['skin.json'] = JSON.stringify(manifest)
    files['hooks.mjs'] = 'throw new Error("not executed")'
    const id = await folder(files)
    expect(() => service.inspect(id)).toThrow('Skin Center cannot load this manifest')
  })

  it.each([
    { field: 'license', value: undefined },
    { field: 'unexpected', value: true },
    { field: 'version', value: 'not-semver' },
    { field: 'sprite2d', value: { spritesheetPath: 'sprite.webp', columns: -1 } },
  ])('rejects a pet its runtime parser cannot accept: $field', async ({ field, value }) => {
    const manifest: Record<string, unknown> = { petManifestVersion: 2, id: 'custom-pet', displayName: 'Custom pet', license: 'CC0-1.0', renderer: 'sprite2d', sprite2d: { spritesheetPath: 'sprite.webp' } }
    manifest[field] = value
    const id = await folder({ 'pet.json': JSON.stringify(manifest), 'sprite.webp': 'image bytes' }, 'pet')
    expect(() => service.inspect(id)).toThrow('Pet Center cannot load this manifest')
    expect(existsSync(path.join(home, 'pets/custom-pet'))).toBe(false)
  })

  it('validates nested preset group rows while preserving inert official !!js scalars', async () => {
    const valid = await folder({ 'my-preset/preset.yml': 'description: Name falls back to directory\n', 'my-preset/agent.cordis.yml': '- name: group\n  group: true\n  config:\n    - name: "@custom/persona"\n      disabled: !!js "throw new Error(\'not evaluated\')"\n' }, 'preset')
    expect(service.inspect(valid)).toMatchObject({ name: 'my-preset', executable: true })
    const invalid = await folder({ 'preset.yml': 'name: Broken group\n', 'agent.cordis.yml': '- name: group\n  group: true\n  config:\n    - config: {}\n' }, 'preset')
    expect(() => service.inspect(invalid)).toThrow('must contain plugin names')
    const unsupportedTag = await folder({ 'preset.yml': 'name: Broken tag\n', 'agent.cordis.yml': '- name: "@custom/persona"\n  config: !!unrecognized "data"\n' }, 'preset')
    expect(() => service.inspect(unsupportedTag)).toThrow('safe YAML')
  })

  it.each(['blue-fantasy', 'default', 'official-theme'])('rejects protected skin identity %s', async protectedId => {
    const id = await folder(skin(protectedId))
    expect(() => service.inspect(id)).toThrow('Built-in and core')
  })

  it('rejects core plugin identities and source-only packages', async () => {
    const official = await folder(plugin('@deepseek-ai/dsh-persona'), 'plugin')
    expect(() => service.inspect(official)).toThrow('Built-in and core')
    const files = plugin()
    delete files['lib/index.js']
    expect(() => service.inspect('missing')).toThrow()
    const sourceOnly = await folder(files, 'plugin')
    expect(() => service.inspect(sourceOnly)).toThrow('missing the referenced file')
  })

  it('rejects staged changes after inspection and preserves the library', async () => {
    const id = await folder(skin())
    service.inspect(id)
    writeFileSync(path.join(home, 'workshop/uploads/upload-' + id + '/files/skin.css'), 'changed')
    await expect(service.commit(id)).rejects.toMatchObject({ code: 'changed-resource' })
    expect(existsSync(path.join(home, 'skins/custom-skin'))).toBe(false)
  })

  it('rejects uploads after inspection', async () => {
    const id = await folder(skin())
    service.inspect(id)
    await expect(service.uploadFile(id, 'extra.txt', Readable.from(['extra']))).rejects.toMatchObject({ code: 'inspected-upload' })
  })

  it('expires unfinished staging and limits concurrent sessions', () => {
    let now = 1000
    const timed = new LocalWorkshopService({ dshHome: home, now: () => now })
    const ids = Array.from({ length: LOCAL_IMPORT_LIMITS.sessions }, () => timed.start('skin', 'folder'))
    expect(() => timed.start('skin', 'folder')).toThrow('Too many pending imports')
    now += LOCAL_IMPORT_LIMITS.expiryMs + 1
    expect(() => timed.inspect(ids[0])).toThrow('Upload expired')
    expect(readdirSync(path.join(home, 'workshop/uploads'))).toHaveLength(0)
  })

  it('does not follow a Windows junction or symlink destination', async () => {
    const external = path.join(home, 'outside')
    mkdirSync(external)
    symlinkSync(external, path.join(home, 'skins'), process.platform === 'win32' ? 'junction' : 'dir')
    const id = await folder(skin())
    expect(() => service.inspect(id)).toThrow('symbolic links or junctions')
    expect(readdirSync(external)).toHaveLength(0)
  })

  it('rejects wrong categories, extra wrapper levels and duplicate file paths', async () => {
    const id = await folder({ 'nested/wrapper/skin.json': skin()['skin.json']!, 'nested/wrapper/skin.css': '' })
    expect(() => service.inspect(id)).toThrow('manifest is missing')
    const wrong = await folder(skin(), 'pet')
    expect(() => service.inspect(wrong)).toThrow('different category')
    const upload = service.start('skin', 'folder')
    await service.uploadFile(upload, 'Wrapper/a.txt', Readable.from(['a']))
    await expect(service.uploadFile(upload, 'wrapper/b.txt', Readable.from(['b']))).rejects.toMatchObject({ code: 'duplicate-path' })
  })
})

describe('ZIP and cross-platform path validation', () => {
  it.each(['../escape', '/root', 'C:/test', 'C:test', '\\\\host\\share', 'a\\b', 'a/../b', 'a//b', 'a:stream', 'NUL.txt', 'com1', 'file.', 'file ', 'a/./b', 'node_modules/x', '.git/config'])('rejects ambiguous path %s', candidate => {
    expect(() => safeLocalPath(candidate)).toThrow()
  })

  it.each([
    [{ name: '../outside', data: 'bad' }],
    [{ name: 'a', data: 'one' }, { name: 'A', data: 'two' }],
    [{ name: 'folder/a', data: 'one' }, { name: 'Folder/b', data: 'two' }],
    [{ name: 'link', attrs: 0xa1ff0000, data: 'outside' }],
    [{ name: 'encrypted', flags: 0x801, data: 'secret' }],
    [{ name: 'unsupported', method: 12, data: 'bad' }],
  ])('rejects unsafe ZIP entries %j', (...entries) => {
    const archive = path.join(home, 'bad.zip')
    writeFileSync(archive, zip(entries as FixtureEntry[]))
    expect(() => extractLocalZip(archive, path.join(home, 'extract'))).toThrow()
  })

  it('rejects corrupt CRC data, truncated archives, ZIP64, and mismatched local names', () => {
    const original = zip([{ name: 'test.txt', data: 'hello', method: 0 }])
    const variants: Buffer[] = []
    const crc = Buffer.from(original); crc[38] = crc[38]! ^ 1; variants.push(crc)
    variants.push(original.subarray(0, original.length - 1))
    const zip64 = Buffer.from(original); zip64.writeUInt16LE(0xffff, zip64.length - 12); variants.push(zip64)
    const name = Buffer.from(original); name[30] = 'x'.charCodeAt(0); variants.push(name)
    for (let i = 0; i < variants.length; i++) {
      const archive = path.join(home, 'bad-' + i + '.zip')
      writeFileSync(archive, variants[i]!)
      expect(() => extractLocalZip(archive, path.join(home, 'extract-' + i))).toThrow()
    }
  })

  it('rejects declared expansion exceeding the budget before extraction', () => {
    const data = zip([{ name: 'big', data: 'x' }])
    const central = data.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]))
    data.writeUInt32LE(LOCAL_IMPORT_LIMITS.fileBytes + 1, central + 24)
    const archive = path.join(home, 'huge.zip')
    writeFileSync(archive, data)
    expect(() => extractLocalZip(archive, path.join(home, 'extract'))).toThrow('exceeds')
    expect(existsSync(path.join(home, 'extract'))).toBe(false)
  })
})
