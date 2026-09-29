import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, readdir, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { deflateSync } from 'node:zlib'
import { randomBytes } from 'node:crypto'
import { Readable } from 'node:stream'
import type { IncomingMessage } from 'node:http'
import { roleIconIds } from '../src/core/appearance.ts'
import { emptyRole } from '../src/core/model.ts'
import { roleDefinition } from '../src/core/validation.ts'
import { CapabilityStore } from '../src/host/store.ts'
import { normalizeRolePng } from '../src/host/icons.ts'
import { fence, readBody } from '../src/host/http.ts'
import { writePresets } from '../src/host/presets.ts'

const stores: CapabilityStore[] = []
afterEach(async () => { for (const store of stores.splice(0)) await store.close() })
async function setup(directory?: string) {
  const store = new CapabilityStore(directory ?? await mkdtemp(join(tmpdir(), 'dsh-role-icons-')))
  await store.init(); stores.push(store); return store
}
const signature = Buffer.from('89504e470d0a1a0a', 'hex')
// Independent bitwise fixture CRC keeps malformed-image tests meaningful.
function chunk(type: string, value = Buffer.alloc(0)) {
  const result = Buffer.alloc(value.length + 12), payload = Buffer.concat([Buffer.from(type), value])
  result.writeUInt32BE(value.length); payload.copy(result, 4)
  let crc = 0xffffffff
  for (const byte of payload) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0) }
  result.writeUInt32BE((crc ^ 0xffffffff) >>> 0, result.length - 4)
  return result
}
function header(width = 256, height = 256, color = 6) {
  const value = Buffer.alloc(13); value.writeUInt32BE(width); value.writeUInt32BE(height, 4); value[8] = 8; value[9] = color; return value
}
function pixels(color = 6) { return Buffer.alloc(256 * (256 * (color === 6 ? 4 : 3) + 1)) }
function png(options: { header?: Buffer; compressed?: Buffer; before?: Buffer[]; after?: Buffer[] } = {}) {
  return Buffer.concat([signature, chunk('IHDR', options.header ?? header()), ...(options.before ?? []), chunk('IDAT', options.compressed ?? deflateSync(pixels())), ...(options.after ?? []), chunk('IEND')])
}
const dataUrl = (bytes = png()) => `data:image/png;base64,${bytes.toString('base64')}`

describe('local role icon assets', () => {
  it('accepts RGB/RGBA canvas PNGs, strips metadata and deduplicates resources across restarts', async () => {
    const store = await setup(), first = await store.icons.upload(dataUrl()), revision = store.snapshot().revision
    expect(first.id).toMatch(/^[a-f0-9]{64}$/)
    expect(await store.icons.upload(dataUrl(png({ before: [chunk('sRGB', Buffer.from([0]))] })))).toEqual(first)
    expect(await readdir(store.icons.directory)).toEqual([`${first.id}.png`])
    expect(await store.icons.read(first.id)).toEqual(png())
    expect(store.snapshot().revision).toBe(revision)
    const rgb = png({ header: header(256, 256, 2), compressed: deflateSync(pixels(2)) })
    expect(await store.icons.upload(dataUrl(rgb))).not.toEqual(first)
    await store.close(); const restarted = await setup(store.directory)
    expect(await restarted.icons.read(first.id)).toEqual(png())
    expect(await restarted.icons.upload(dataUrl())).toEqual(first)
  })

  it('rejects signatures, checksums, malformed chunks and unsupported image formats', () => {
    const brokenCrc = png(); brokenCrc[brokenCrc.length - 1]! ^= 1
    const cases = [Buffer.from('<svg onload="alert(1)"/>'), Buffer.alloc(300 * 1024 + 1), brokenCrc, png().subarray(0, -1), Buffer.concat([png(), Buffer.from('script')]),
      png({ header: header(257) }), png({ header: header(256, 1) }), png({ header: header(256, 256, 3) }),
      png({ before: [chunk('IHDR', header())] }), png({ before: [chunk('acTL', Buffer.alloc(8))] }), png({ before: [chunk('tEXt', Buffer.from('script'))] }),
      png({ before: [chunk('sRGB', Buffer.from([0])), chunk('sRGB', Buffer.from([0]))] }), png({ before: [chunk('sRGB', Buffer.from([4]))] }),
      png({ after: [chunk('pHYs', Buffer.alloc(9))] }), png({ before: [chunk('BAD!', Buffer.alloc(3))] })]
    for (const bytes of cases) expect(() => normalizeRolePng(bytes)).toThrow('PNG')
    for (const index of [8, 10, 11, 12]) { const value = header(); value[index] = index === 8 ? 16 : 1; expect(() => normalizeRolePng(png({ header: value }))).toThrow('PNG') }
  })

  it('accepts a full-size high-entropy canvas image within the existing JSON request limit', async () => {
    const store = await setup(), raw = randomBytes(pixels().length)
    for (let row = 0; row < 256; row++) raw[row * 1025] = 0
    const bytes = png({ compressed: deflateSync(raw) }), body = JSON.stringify({ dataUrl: dataUrl(bytes) })
    expect(Buffer.byteLength(body)).toBeLessThan(512 * 1024)
    const parsed = await readBody(Readable.from([body]) as IncomingMessage)
    const results = await Promise.all([store.icons.upload(parsed.dataUrl), store.icons.upload(parsed.dataUrl)])
    expect(results[0]).toEqual(results[1]); expect(await store.icons.read(results[0]!.id)).toEqual(bytes)
    expect(await readdir(store.icons.directory)).toEqual([`${results[0]!.id}.png`])
  })

  it('validates actual inflated pixel lengths, filters and the full zlib stream with a bounded output', () => {
    const badFilter = pixels(); badFilter[1025] = 5
    const compressed = deflateSync(pixels())
    for (const bytes of [Buffer.alloc(0), Buffer.from('not zlib'), compressed.subarray(0, -1), Buffer.concat([compressed, compressed]),
      deflateSync(pixels().subarray(0, -1)), deflateSync(Buffer.alloc(pixels().length + 1)), deflateSync(badFilter)]) {
      expect(() => normalizeRolePng(png({ compressed: bytes }))).toThrow('PNG')
    }
    const split = Buffer.concat([signature, chunk('IHDR', header()), chunk('IDAT', compressed.subarray(0, 20)), chunk('IDAT', compressed.subarray(20)), chunk('IEND')])
    expect(normalizeRolePng(split)).toEqual(png())
  })

  it('rejects external URLs, invalid base64 and asset paths; corrupted assets fall back and can be reuploaded', async () => {
    const store = await setup()
    for (const value of [null, 'https://example.com/icon.png', 'file:///icon.png', 'data:image/svg+xml;base64,AA==', 'data:image/png;base64,not base64', `data:image/png;base64,${'A'.repeat(512 * 1024)}`]) await expect(store.icons.upload(value)).rejects.toThrow('PNG')
    for (const id of ['../state.json', '..\\state.json', '%2e%2e%2fstate.json', 'https://example.com', 'A'.repeat(64), '0'.repeat(64) + '.png']) await expect(store.icons.read(id)).rejects.toThrow('标识')
    const { id } = await store.icons.upload(dataUrl()), path = join(store.icons.directory, `${id}.png`)
    await writeFile(path, '<svg>invalid</svg>')
    await expect(store.icons.read(id)).rejects.toMatchObject({ status: 404 })
    expect(await store.icons.upload(dataUrl())).toEqual({ id })
    expect(await store.icons.read(id)).toEqual(png())
  })

  it('keeps the existing same-origin JSON fence and rejects bodies beyond the upload request limit', async () => {
    const request = (headers = {}) => ({ method: 'POST', headers: { host: '127.0.0.1:3888', origin: 'http://127.0.0.1:3888', 'content-type': 'application/json', ...headers }, url: '/api/capabilities/icons' }) as IncomingMessage
    expect(() => fence(request())).not.toThrow()
    for (const headers of [{ origin: 'https://other.example' }, { 'sec-fetch-site': 'cross-site' }, { 'content-type': 'image/png' }]) expect(() => fence(request(headers))).toThrow()
    await expect(readBody(Readable.from([Buffer.alloc(512 * 1024 + 1)]) as IncomingMessage)).rejects.toMatchObject({ status: 413 })
  })
})

describe('role appearance compatibility and durable history', () => {
  it('leaves legacy roles unchanged and validates the explicit icon union', async () => {
    const store = await setup(), original = store.snapshot(), definition = original.roles[0]!.draft
    expect(definition).not.toHaveProperty('icon')
    expect(roleDefinition(definition, original)).toEqual(definition)
    for (const id of roleIconIds) expect(roleDefinition({ ...definition, icon: { kind: 'builtin', id } }, original).icon).toEqual({ kind: 'builtin', id })
    for (const icon of [null, 'chat', { kind: 'builtin', id: 'unknown' }, { kind: 'png', assetId: '../secret' }, { kind: 'url', url: 'https://example.com' }]) {
      await expect(store.command(original.revision, { type: 'role.save', id: original.roles[0]!.id, definition: { ...definition, icon }, publish: false })).rejects.toThrow()
      expect(store.snapshot()).toEqual(original)
    }
    await store.close(); expect((await setup(store.directory)).snapshot()).toEqual(original)
  })

  it('persists drafts, publishes immutable appearance versions, copies and restores historical choices', async () => {
    const store = await setup(), { id: assetId } = await store.icons.upload(dataUrl()), icon = { kind: 'png', assetId }
    const definition = { ...emptyRole(), name: '图标助手', icon: { kind: 'builtin', id: 'book' }, capabilities: [{ capabilityId: 'browser', version: 1, enabled: true }] }
    const created = await store.command(0, { type: 'role.save', definition, publish: false }), id = created.id
    await store.command(1, { type: 'role.save', id, definition: { ...definition, icon }, publish: true })
    await store.command(2, { type: 'role.save', id, definition: { ...definition, color: '#ff0000' }, publish: false })
    await store.close(); const restarted = await setup(store.directory), role = restarted.snapshot().roles.find(role => role.id === id)!
    expect(role.draft.icon).toEqual({ kind: 'builtin', id: 'book' }); expect(role.draft.color).toBe('#ff0000')
    expect(role.versions[0]!.icon).toEqual(icon); expect(role.versions[0]!.color).toBe(definition.color)
    await restarted.command(3, { type: 'role.save', id, definition: role.versions[0], publish: true })
    const copied = await restarted.command(4, { type: 'role.save', definition: role.versions[0], publish: true })
    expect(copied.state.roles.find(role => role.id === copied.id)!.draft.icon).toEqual(icon)
    const browser = copied.state.capabilities[0]!
    await restarted.command(5, { type: 'capability.save', id: browser.id, definition: browser.draft, publish: true, applyToRoles: [id] })
    const saved = restarted.snapshot().roles.find(role => role.id === id)!
    expect(saved.versions.map(version => version.icon)).toEqual([icon, icon, icon])
    expect(saved.versions[0]!.capabilities[0]!.version).toBe(1)
    expect(saved.versions[2]!.capabilities[0]!.version).toBe(2)
    await writePresets(restarted.directory, restarted.snapshot())
    expect(await readFile(join(restarted.directory, '.agent-presets', saved.versions[0]!.preset, 'agent.cordis.yml'), 'utf8')).not.toContain(assetId)
  })

  it('rejects missing resources on save without losing existing roles; missing icons never block startup', async () => {
    const store = await setup(), { id: assetId } = await store.icons.upload(dataUrl()), icon = { kind: 'png', assetId }
    const definition = { ...emptyRole(), name: '仍可使用的岗位', icon }, created = await store.command(0, { type: 'role.save', definition, publish: true })
    await unlink(join(store.icons.directory, `${assetId}.png`)); await store.close()
    const restarted = await setup(store.directory), original = restarted.snapshot()
    expect(original.roles.find(role => role.id === created.id)!.versions[0]!.icon).toEqual(icon)
    await expect(restarted.icons.read(assetId)).rejects.toMatchObject({ status: 404 })
    await expect(restarted.command(original.revision, { type: 'role.save', id: created.id, definition, publish: false })).rejects.toMatchObject({ status: 404 })
    expect(restarted.snapshot()).toEqual(original)
    const repaired = await restarted.command(original.revision, { type: 'role.save', id: created.id, definition: { ...definition, icon: { kind: 'builtin', id: 'chat' } }, publish: false })
    expect(repaired.state.roles.find(role => role.id === created.id)!.draft.icon).toEqual({ kind: 'builtin', id: 'chat' })
    expect(repaired.state.roles.find(role => role.id === created.id)!.versions[0]!.icon).toEqual(icon)
  })
})
