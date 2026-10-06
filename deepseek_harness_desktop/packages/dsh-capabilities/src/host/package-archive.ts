import { createHash } from 'node:crypto'
import { readFile, open } from 'node:fs/promises'
import { join } from 'node:path'
import { crc32, extractLocalZip } from '../../../dsh-market/src/core/local-import-zip.ts'
import { FilePaths, safeLocalPath, listPlainFiles, plainMkdir, assertPlainPath } from '../../../dsh-market/src/core/local-import-safety.ts'
import { manifest, type CapabilityManifest } from '../core/distribution.ts'
import { InputError, object } from '../core/validation.ts'

export { FilePaths, safeLocalPath, plainMkdir, assertPlainPath, extractLocalZip }
export const packageLimit = 64 * 1024 * 1024
export const sha256 = (data: string | Uint8Array) => createHash('sha256').update(data).digest('hex')
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']'
  if (value && typeof value === 'object') return '{' + Object.entries(value).sort(([a],[b]) => a < b ? -1 : a > b ? 1 : 0).map(([key,v]) => JSON.stringify(key) + ':' + canonical(v)).join(',') + '}'
  return JSON.stringify(value)
}
export type CheckedPackage = { manifest: CapabilityManifest; hash: string; files: Map<string, Buffer>; bytes: number }
export async function checkPackage(root: string, development = false): Promise<CheckedPackage> {
  const all = listPlainFiles(root)
  if (all.length > 501 || all.reduce((n,f) => n + f.bytes, 0) > packageLimit) throw new InputError('能力包最多 500 个交付文件、64 MiB', 413)
  if ((all.find(f => f.rel === 'capability.json')?.bytes ?? Infinity) > 256 * 1024) throw new InputError('根目录需要有效的 capability.json（最多 256 KiB）')
  let raw: Record<string,unknown>
  try { raw = object(JSON.parse(await readFile(join(root, 'capability.json'), 'utf8'))) } catch { throw new InputError('capability.json 不是有效的 JSON 对象') }
  const declared = object(raw.files), paths = new FilePaths(), files = new Map<string,Buffer>()
  paths.add('capability.json')
  for (const rel of Object.keys(declared).sort()) {
    paths.add(rel)
    if (!/^(runtime|resources|docs)\//.test(rel) || /(^|\/)(\.env(?:\..*)?|.*credentials.*|ai_key\.txt|settings\.ya?ml|state\.json)$/i.test(rel)) throw new InputError('交付清单包含私人配置或不受支持的文件位置')
    if (!all.some(f => f.rel === rel)) throw new InputError(`缺少交付文件：${rel}`)
    assertPlainPath(join(root, rel))
    const content = await readFile(join(root, rel)), digest = sha256(content)
    if (development && declared[rel] === 'auto') declared[rel] = digest
    if (declared[rel] !== digest) throw new InputError(`文件校验失败：${rel}；请重新构建并导出`)
    files.set(rel, content)
  }
  if (all.some(f => f.rel !== 'capability.json' && !files.has(f.rel))) throw new InputError('能力包包含清单之外的文件，请只选择交付目录')
  const parsed = manifest(raw), content = Buffer.from(canonical(parsed)), hash = sha256(content)
  files.set('capability.json', content)
  return { manifest: parsed, hash, files, bytes: [...files.values()].reduce((n,b) => n + b.length, 0) }
}
export async function writePackage(root: string, pack: CheckedPackage) {
  plainMkdir(root)
  for (const [rel, bytes] of pack.files) { safeLocalPath(rel); const path = join(root, rel); plainMkdir(join(path, '..')); const file = await open(path,'wx',0o600); try { await file.writeFile(bytes); await file.sync() } finally { await file.close() } }
}
/** Deterministic, plain-file ZIP. The same hardened reader validates every generated archive in tests. */
export function packageZip(files: Map<string,Buffer>): Buffer {
  const bodies: Buffer[] = [], directory: Buffer[] = []; let offset = 0
  for (const [rel,data] of [...files].sort(([a],[b]) => a.localeCompare(b, 'en'))) {
    safeLocalPath(rel); const name = Buffer.from(rel), crc = crc32(data)
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20,4); local.writeUInt16LE(0x800,6); local.writeUInt16LE(0x21,12); local.writeUInt32LE(crc,14); local.writeUInt32LE(data.length,18); local.writeUInt32LE(data.length,22); local.writeUInt16LE(name.length,26)
    const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50); central.writeUInt16LE(20,4); central.writeUInt16LE(20,6); central.writeUInt16LE(0x800,8); central.writeUInt16LE(0x21,14); central.writeUInt32LE(crc,16); central.writeUInt32LE(data.length,20); central.writeUInt32LE(data.length,24); central.writeUInt16LE(name.length,28); central.writeUInt32LE(offset,42)
    bodies.push(local,name,data); directory.push(central,name); offset += local.length + name.length + data.length
  }
  const index = Buffer.concat(directory), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(files.size,8); end.writeUInt16LE(files.size,10); end.writeUInt32LE(index.length,12); end.writeUInt32LE(offset,16)
  return Buffer.concat([...bodies,index,end])
}
