/** Host-only, content-bound consent for resources imported by the local Workshop. */
import { createHash, randomUUID } from 'node:crypto'
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export const LOCAL_IMPORT_RECORD = 'dsh-workbench.import.json'
export interface LocalTrustRecord {
  version: 1
  source: 'local-import'
  kind: 'skin' | 'pet' | 'preset' | 'plugin'
  id: string
  importedAt: string
  files: Record<string, string>
  versionLabel?: string
}

export function safeResourceRelativePath(rel: string): boolean {
  return rel.length > 0 && rel.length <= 1024 && !/[\\:\x00-\x1f]/.test(rel)
    && rel.split('/').every(part => part !== '' && part !== '.' && part !== '..')
}

/** Read metadata only. Metadata conveys ownership, never permission to execute. */
export function readLocalTrustRecord(dir: string, kind: LocalTrustRecord['kind'], id: string): LocalTrustRecord | null {
  try {
    const file = join(dir, LOCAL_IMPORT_RECORD)
    if (lstatSync(dir).isSymbolicLink() || lstatSync(file).isSymbolicLink()) return null
    const value = JSON.parse(readFileSync(file, 'utf8')) as LocalTrustRecord
    if (value.version !== 1 || value.source !== 'local-import' || value.kind !== kind || value.id !== id
      || typeof value.importedAt !== 'string' || !value.files || typeof value.files !== 'object' || Array.isArray(value.files)) return null
    const entries = Object.entries(value.files)
    if (!entries.length || entries.length > 2000) return null
    if (entries.some(([rel, hash]) => !safeResourceRelativePath(rel) || typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash))) return null
    if (new Set(entries.map(([rel]) => rel.toLowerCase())).size !== entries.length) return null
    return value
  } catch { return null }
}

/** Refuse links, missing/changed files, and unrecorded additions (including dot files). */
export function localResourceUnchanged(dir: string, record: LocalTrustRecord): boolean {
  try {
    let count = 0
    const visit = (base: string): boolean => {
      for (const entry of readdirSync(join(dir, base), { withFileTypes: true })) {
        const rel = base ? `${base}/${entry.name}` : entry.name
        const abs = join(dir, rel)
        const stat = lstatSync(abs)
        if (stat.isSymbolicLink()) return false
        if (stat.isDirectory()) { if (!visit(rel)) return false; continue }
        if (!stat.isFile()) return false
        if (rel === LOCAL_IMPORT_RECORD || rel === 'dsh-market.provenance.json') continue
        if (++count > 2000 || record.files[rel] === undefined) return false
        if (createHash('sha256').update(readFileSync(abs)).digest('hex') !== record.files[rel]) return false
      }
      return true
    }
    return visit('') && count === Object.keys(record.files).length
  } catch { return false }
}

export function localContentDigest(record: LocalTrustRecord): string {
  return createHash('sha256').update(JSON.stringify(Object.entries(record.files).sort(([a], [b]) => a.localeCompare(b, 'en')))).digest('hex')
}

export function localTrustPath(home: string, kind: string, id: string): string {
  return join(home, 'workshop', 'trust', `${kind}-${createHash('sha256').update(id).digest('hex')}.json`)
}

/** Consent lives outside the imported archive so bundled JSON cannot grant trust. */
export function trustLocalResource(home: string, dir: string, record: LocalTrustRecord): void {
  if (!localResourceUnchanged(dir, record)) throw new Error('resource-modified')
  const dest = localTrustPath(home, record.kind, record.id)
  mkdirSync(dirname(dest), { recursive: true })
  const temp = `${dest}.${randomUUID()}.tmp`
  try {
    writeFileSync(temp, JSON.stringify({ version: 1, kind: record.kind, id: record.id, importedAt: record.importedAt, digest: localContentDigest(record), confirmedAt: new Date().toISOString() }), { flag: 'wx' })
    renameSync(temp, dest)
  } finally { if (existsSync(temp)) rmSync(temp) }
}

export function isLocalResourceTrusted(home: string, dir: string, kind: LocalTrustRecord['kind'], id: string): boolean {
  try {
    const record = readLocalTrustRecord(dir, kind, id)
    if (!record || !localResourceUnchanged(dir, record)) return false
    const trust = JSON.parse(readFileSync(localTrustPath(home, kind, id), 'utf8')) as Record<string, unknown>
    return trust.version === 1 && trust.kind === kind && trust.id === id && trust.importedAt === record.importedAt && trust.digest === localContentDigest(record)
  } catch { return false }
}
