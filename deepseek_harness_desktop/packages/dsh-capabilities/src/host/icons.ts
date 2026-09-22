import { createHash, randomUUID } from 'node:crypto'
import { mkdir, open, rename, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { inflateSync } from 'node:zlib'
import { roleIconAssetIdPattern } from '../core/appearance.ts'
import { InputError } from '../core/validation.ts'

const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
const maxBytes = 300 * 1024
const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  return value >>> 0
})
function crc32(bytes: Buffer) {
  let crc = 0xffffffff
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255]! ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}
function chunk(type: string, data: Buffer) {
  const value = Buffer.alloc(12 + data.length)
  value.writeUInt32BE(data.length); value.write(type, 4, 'ascii'); data.copy(value, 8)
  value.writeUInt32BE(crc32(value.subarray(4, -4)), value.length - 4)
  return value
}
function invalid(): never { throw new InputError('PNG 图标无效，请重新选择图片并调整后上传') }

/** Accept the editor's static canvas output, not arbitrary original image files. */
export function normalizeRolePng(bytes: Buffer): Buffer {
  if (bytes.length < 45 || bytes.length > maxBytes || !bytes.subarray(0, 8).equals(signature)) invalid()
  let offset = 8, header: Buffer | undefined, dataEnded = false, ended = false
  const data: Buffer[] = [], metadata = new Set<string>()
  while (offset < bytes.length) {
    if (bytes.length - offset < 12) invalid()
    const length = bytes.readUInt32BE(offset), end = offset + length + 12
    if (end > bytes.length) invalid()
    const type = bytes.toString('ascii', offset + 4, offset + 8), value = bytes.subarray(offset + 8, end - 4)
    if (crc32(bytes.subarray(offset + 4, end - 4)) !== bytes.readUInt32BE(end - 4)) invalid()
    if (!header && type !== 'IHDR') invalid()
    if (type === 'IHDR') {
      if (header || offset !== 8 || length !== 13) invalid()
      if (value.readUInt32BE(0) !== 256 || value.readUInt32BE(4) !== 256 || value[8] !== 8 || ![2, 6].includes(value[9]!) || value[10] !== 0 || value[11] !== 0 || value[12] !== 0) invalid()
      header = value
    } else if (type === 'IDAT') {
      if (dataEnded) invalid()
      data.push(value)
    } else if (type === 'IEND') {
      if (length !== 0 || !data.length || end !== bytes.length) invalid()
      ended = true
    } else {
      // Canvas may write these fixed-size colour/resolution hints. Drop them from storage.
      const lengths: Record<string, number> = { sRGB: 1, gAMA: 4, cHRM: 32, pHYs: 9 }
      if (lengths[type] !== length || metadata.has(type) || data.length) invalid()
      if (type === 'sRGB' && value[0]! > 3 || type === 'gAMA' && value.readUInt32BE(0) === 0 || type === 'pHYs' && value[8]! > 1) invalid()
      metadata.add(type)
    }
    if (data.length && type !== 'IDAT') dataEnded = true
    offset = end
  }
  if (!header || !ended) invalid()
  const compressed = Buffer.concat(data), rowBytes = 256 * (header[9] === 6 ? 4 : 3), expectedBytes = 256 * (rowBytes + 1)
  try {
    // Bounded inflation also rejects bombs, truncated streams and extra zlib payloads.
    const decoded = inflateSync(compressed, { maxOutputLength: expectedBytes, info: true }) as unknown as { buffer: Buffer; engine: { bytesWritten: number } }
    if (decoded.buffer.length !== expectedBytes || decoded.engine.bytesWritten !== compressed.length) invalid()
    for (let row = 0; row < 256; row++) if (decoded.buffer[row * (rowBytes + 1)]! > 4) invalid()
  } catch { invalid() }
  return Buffer.concat([signature, chunk('IHDR', header), chunk('IDAT', compressed), chunk('IEND', Buffer.alloc(0))])
}

function assetId(value: unknown): string {
  if (typeof value !== 'string' || !roleIconAssetIdPattern.test(value)) throw new InputError('图标资源标识无效')
  return value
}

/** Immutable local assets survive draft replacement and historical role versions. */
export class RoleIconStore {
  constructor(readonly directory: string) {}
  async upload(dataUrl: unknown): Promise<{ id: string }> {
    if (typeof dataUrl !== 'string' || dataUrl.length > Math.ceil(maxBytes / 3) * 4 + 22 || !/^data:image\/png;base64,(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(dataUrl)) invalid()
    const bytes = normalizeRolePng(Buffer.from(dataUrl.slice(22), 'base64'))
    const id = createHash('sha256').update(bytes).digest('hex'), path = join(this.directory, `${id}.png`)
    await mkdir(this.directory, { recursive: true })
    try { if ((await this.read(id)).equals(bytes)) return { id } } catch (error) { if (!(error instanceof InputError && error.status === 404)) throw error }
    const temporary = join(this.directory, `${id}-${randomUUID()}.tmp`), file = await open(temporary, 'wx')
    try {
      try { await file.writeFile(bytes); await file.sync() } finally { await file.close() }
      await rename(temporary, path)
    } catch (error) { await unlink(temporary).catch(() => {}); throw error }
    return { id }
  }
  async read(value: unknown): Promise<Buffer> {
    const id = assetId(value)
    try {
      const file = await open(join(this.directory, `${id}.png`), 'r')
      try {
        const stat = await file.stat()
        if (!stat.isFile() || stat.size > maxBytes) throw new Error('Invalid icon file')
        const bytes = await file.readFile()
        if (createHash('sha256').update(bytes).digest('hex') !== id) throw new Error('Invalid icon digest')
        normalizeRolePng(bytes)
        return bytes
      } finally { await file.close() }
    } catch { throw new InputError('图标资源已失效，请选择推荐图标或重新上传 PNG', 404) }
  }
}
