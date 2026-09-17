/** Minimal bounded ZIP reader. Only stored/deflated regular files are supported. */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { inflateRawSync } from 'node:zlib'
import { fail, FilePaths, LOCAL_IMPORT_LIMITS, plainMkdir, safeLocalPath } from './local-import-safety.ts'

const CRC_TABLE = Array.from({ length: 256 }, (_, i) => {
  let value = i
  for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0)
  return value >>> 0
})

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 0xff]!
  return (crc ^ 0xffffffff) >>> 0
}

interface ZipEntry {
  name: string
  rawName: Buffer
  directory: boolean
  flags: number
  method: number
  crc: number
  compressed: number
  expanded: number
  offset: number
}

function checkExtra(bytes: Buffer): void {
  for (let pos = 0; pos < bytes.length;) {
    if (pos + 4 > bytes.length) fail('invalid-zip', 'Malformed ZIP extra field.')
    const tag = bytes.readUInt16LE(pos)
    const size = bytes.readUInt16LE(pos + 2)
    pos += 4
    if (pos + size > bytes.length) fail('invalid-zip', 'Malformed ZIP extra field.')
    // ZIP64, NTFS/reparse attributes, Unix links and Unicode filename aliases.
    if ([0x0001, 0x000a, 0x000d, 0x5855, 0x756e, 0x7075].includes(tag)) {
      fail('unsupported-zip', 'ZIP64, filesystem links and alternate ZIP filenames are not supported. Export a standard ZIP.')
    }
    pos += size
  }
}

function readDirectory(bytes: Buffer): { entries: ZipEntry[]; centralOffset: number } {
  if (bytes.length > LOCAL_IMPORT_LIMITS.fileBytes) fail('quota', 'ZIP archive exceeds 200 MiB.', 413)
  let end = -1
  for (let p = bytes.length - 22; p >= Math.max(0, bytes.length - 22 - 65535); p--) {
    if (bytes.readUInt32LE(p) === 0x06054b50 && p + 22 + bytes.readUInt16LE(p + 20) === bytes.length) { end = p; break }
  }
  if (end < 0) fail('invalid-zip', 'ZIP directory is missing or truncated.')
  const count = bytes.readUInt16LE(end + 10)
  const centralSize = bytes.readUInt32LE(end + 12)
  const centralOffset = bytes.readUInt32LE(end + 16)
  if (count === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) fail('unsupported-zip', 'ZIP64 archives are not supported.')
  if (bytes.readUInt16LE(end + 4) !== 0 || bytes.readUInt16LE(end + 6) !== 0
    || bytes.readUInt16LE(end + 8) !== count) fail('unsupported-zip', 'Multi-volume ZIP archives are not supported.')
  if (centralOffset + centralSize !== end) fail('invalid-zip', 'ZIP directory size does not match the archive.')
  if (!count || count > LOCAL_IMPORT_LIMITS.files * 2) fail('quota', 'ZIP archive has too many entries.', 413)
  const entries: ZipEntry[] = []
  const seen = new FilePaths()
  const explicitNames = new Set<string>()
  let pos = centralOffset
  let fileCount = 0
  let total = 0
  for (let i = 0; i < count; i++) {
    if (pos + 46 > end || bytes.readUInt32LE(pos) !== 0x02014b50) fail('invalid-zip', 'Malformed ZIP directory entry.')
    const flags = bytes.readUInt16LE(pos + 8)
    const method = bytes.readUInt16LE(pos + 10)
    const compressed = bytes.readUInt32LE(pos + 20)
    const expanded = bytes.readUInt32LE(pos + 24)
    const nameSize = bytes.readUInt16LE(pos + 28)
    const extraSize = bytes.readUInt16LE(pos + 30)
    const commentSize = bytes.readUInt16LE(pos + 32)
    const offset = bytes.readUInt32LE(pos + 42)
    const next = pos + 46 + nameSize + extraSize + commentSize
    if (next > end || !nameSize) fail('invalid-zip', 'Truncated ZIP directory entry.')
    if (flags & ~0x080e || flags & 1) fail('unsupported-zip', 'Encrypted or unsupported ZIP archives are not supported.')
    if (method !== 0 && method !== 8) fail('unsupported-zip', 'Use ZIP stored or deflate compression.')
    if (expanded === 0xffffffff || compressed === 0xffffffff || offset === 0xffffffff) fail('unsupported-zip', 'ZIP64 archives are not supported.')
    if (bytes.readUInt16LE(pos + 34)) fail('unsupported-zip', 'Multi-volume ZIP archives are not supported.')
    const attrs = bytes.readUInt32LE(pos + 38)
    const mode = attrs >>> 16
    if ((mode & 0xf000) !== 0 && (mode & 0xf000) !== 0x8000 && (mode & 0xf000) !== 0x4000) fail('unsupported-files', 'ZIP links and special files are not supported.')
    if ((attrs & 0x400) !== 0) fail('unsupported-files', 'ZIP reparse-point entries are not supported.')
    const rawName = bytes.subarray(pos + 46, pos + 46 + nameSize)
    let decoded: string
    try { decoded = new TextDecoder('utf-8', { fatal: true }).decode(rawName) }
    catch { fail('unsupported-zip', 'ZIP filenames must use UTF-8. Export the ZIP with UTF-8 filenames.') }
    const directory = decoded.endsWith('/')
    const name = safeLocalPath(directory ? decoded.slice(0, -1) : decoded)
    if (((mode & 0xf000) === 0x4000 || (attrs & 0x10) !== 0) && !directory) fail('invalid-zip', 'ZIP directory attributes conflict with the filename.')
    if (explicitNames.has(name.toLowerCase())) fail('duplicate-path', 'ZIP contains duplicate entry names.')
    explicitNames.add(name.toLowerCase())
    seen.add(name, directory)
    if (directory && (compressed !== 0 || expanded !== 0)) fail('invalid-zip', 'ZIP directory contains file data.')
    if (!directory) {
      total += expanded
      if (++fileCount > LOCAL_IMPORT_LIMITS.files || expanded > LOCAL_IMPORT_LIMITS.fileBytes || total > LOCAL_IMPORT_LIMITS.expandedBytes) {
        fail('quota', 'ZIP exceeds 2,000 files, 200 MiB per file or 500 MiB expanded.', 413)
      }
    }
    checkExtra(bytes.subarray(pos + 46 + nameSize, pos + 46 + nameSize + extraSize))
    entries.push({ name, rawName, directory, flags, method, compressed, expanded, offset, crc: bytes.readUInt32LE(pos + 16) })
    pos = next
  }
  if (pos !== end) fail('invalid-zip', 'ZIP directory has unaccounted entries.')
  return { entries, centralOffset }
}

export function extractLocalZip(archive: string, destination: string): void {
  const bytes = readFileSync(archive)
  const { entries, centralOffset } = readDirectory(bytes)
  const ranges: Array<[number, number]> = []
  for (const entry of entries) {
    const pos = entry.offset
    if (pos + 30 > centralOffset || bytes.readUInt32LE(pos) !== 0x04034b50) fail('invalid-zip', 'ZIP file header is missing.')
    const nameSize = bytes.readUInt16LE(pos + 26)
    const extraSize = bytes.readUInt16LE(pos + 28)
    const dataStart = pos + 30 + nameSize + extraSize
    let end = dataStart + entry.compressed
    if (end > centralOffset || !bytes.subarray(pos + 30, pos + 30 + nameSize).equals(entry.rawName)
      || bytes.readUInt16LE(pos + 6) !== entry.flags || bytes.readUInt16LE(pos + 8) !== entry.method) {
      fail('invalid-zip', 'ZIP file header disagrees with its directory.')
    }
    checkExtra(bytes.subarray(pos + 30 + nameSize, dataStart))
    if (!(entry.flags & 8)) {
      if (bytes.readUInt32LE(pos + 14) !== entry.crc || bytes.readUInt32LE(pos + 18) !== entry.compressed
        || bytes.readUInt32LE(pos + 22) !== entry.expanded) fail('invalid-zip', 'ZIP sizes or checksum disagree.')
    } else {
      // Data descriptors occur after streamed ZIP entries, with an optional signature.
      if (end + 12 > centralOffset) fail('invalid-zip', 'ZIP data descriptor is missing.')
      let descriptor = end
      if (bytes.readUInt32LE(descriptor) === 0x08074b50) descriptor += 4
      if (descriptor + 12 > centralOffset || bytes.readUInt32LE(descriptor) !== entry.crc
        || bytes.readUInt32LE(descriptor + 4) !== entry.compressed || bytes.readUInt32LE(descriptor + 8) !== entry.expanded) {
        fail('invalid-zip', 'ZIP data descriptor disagrees with its directory.')
      }
      end = descriptor + 12
    }
    ranges.push([pos, end])
  }
  ranges.sort((a, b) => a[0] - b[0])
  if (ranges[0]?.[0] !== 0) fail('unsupported-zip', 'Self-extracting ZIP archives are not supported.')
  for (let i = 1; i < ranges.length; i++) {
    if (ranges[i]![0] !== ranges[i - 1]![1]) fail('invalid-zip', 'ZIP file ranges overlap or contain unlisted data.')
  }
  if (ranges.at(-1)?.[1] !== centralOffset) fail('invalid-zip', 'ZIP contains unlisted trailing file data.')
  plainMkdir(destination)
  for (const entry of entries) {
    const full = path.join(destination, ...entry.name.split('/'))
    if (entry.directory) { plainMkdir(full); continue }
    const start = entry.offset + 30 + bytes.readUInt16LE(entry.offset + 26) + bytes.readUInt16LE(entry.offset + 28)
    const compressed = bytes.subarray(start, start + entry.compressed)
    let output: Buffer
    try {
      output = entry.method === 0 ? compressed : inflateRawSync(compressed, { maxOutputLength: Math.max(1, entry.expanded) })
    } catch { fail('invalid-zip', 'ZIP deflate data is invalid or exceeds its declared size.') }
    if (output.length !== entry.expanded || crc32(output) !== entry.crc) fail('invalid-zip', 'ZIP checksum or expanded size is invalid.')
    plainMkdir(path.dirname(full))
    writeFileSync(full, output, { flag: 'wx' })
  }
}
