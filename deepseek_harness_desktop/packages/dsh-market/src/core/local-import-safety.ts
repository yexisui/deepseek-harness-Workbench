import { lstatSync, mkdirSync, readdirSync } from 'node:fs'
import path from 'node:path'

export const LOCAL_IMPORT_RECORD = 'dsh-workbench.import.json'
export const LOCAL_IMPORT_LIMITS = {
  files: 2000,
  fileBytes: 200 * 1024 * 1024,
  expandedBytes: 500 * 1024 * 1024,
  manifestBytes: 1024 * 1024,
  sessions: 4,
  expiryMs: 30 * 60 * 1000,
} as const

export class LocalImportError extends Error {
  constructor(readonly code: string, message: string, readonly status = 400) {
    super(message)
    this.name = 'LocalImportError'
  }
}

export function fail(code: string, message: string, status = 400): never {
  throw new LocalImportError(code, message, status)
}

/** Same conservative path rules on every OS, including Windows ADS/devices. */
export function safeLocalPath(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 240
    || value !== value.normalize('NFC') || /[\\\x00-\x1f\x7f:*?"<>|]/.test(value)) {
    fail('invalid-path', 'Resource paths must be normal relative file names.')
  }
  const parts = value.split('/')
  if (parts.some(p => !p || p === '.' || p === '..' || /[. ]$/.test(p)
    || /^(con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³])(?:\.|$)/i.test(p))) {
    fail('invalid-path', 'Absolute, parent, device and ambiguous paths are not supported.')
  }
  if (parts.some(p => ['.git', '.svn', 'node_modules'].includes(p.toLowerCase()))) {
    fail('unsupported-files', 'Export the resource package without repository metadata or node_modules.')
  }
  return value
}

export function pathKey(rel: string): string { return rel.normalize('NFC').toLowerCase() }

/** Prevent both normalized duplicate names and file/directory prefix collisions. */
export class FilePaths {
  private files = new Set<string>()
  private names = new Map<string, string>()

  add(rel: string, directory = false): void {
    const parts = safeLocalPath(rel).split('/')
    for (let i = 1; i <= parts.length; i++) {
      const prefix = parts.slice(0, i).join('/')
      const key = pathKey(prefix)
      const old = this.names.get(key)
      if (old !== undefined && old !== prefix) fail('duplicate-path', 'Resource has case-insensitive duplicate paths.')
      if (i < parts.length && this.files.has(key)) fail('duplicate-path', 'A resource file is also used as a directory.')
      this.names.set(key, prefix)
    }
    const key = pathKey(rel)
    if (!directory) {
      if (this.files.has(key) || [...this.names.keys()].some(p => p.startsWith(key + '/'))) {
        fail('duplicate-path', 'Resource has duplicate file paths.')
      }
      this.files.add(key)
    } else if (this.files.has(key)) fail('duplicate-path', 'A resource file is also used as a directory.')
  }
}

/** lstat every existing ancestor: never traverse symlinks or Windows junctions. */
export function assertPlainPath(target: string): void {
  const resolved = path.resolve(target)
  let current = path.parse(resolved).root
  for (const part of resolved.slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part)
    try {
      const stat = lstatSync(current)
      if (stat.isSymbolicLink()) fail('unsafe-destination', 'Resource paths cannot contain symbolic links or junctions.')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
      throw error
    }
  }
}

export function plainMkdir(target: string): void {
  assertPlainPath(target)
  mkdirSync(target, { recursive: true })
  assertPlainPath(target)
}

export interface LocalFile { rel: string; bytes: number }

export function listPlainFiles(root: string, strict = true): LocalFile[] {
  assertPlainPath(root)
  const files: LocalFile[] = []
  const paths = new FilePaths()
  let bytes = 0
  const walk = (base: string, prefix: string): void => {
    for (const entry of readdirSync(base, { withFileTypes: true })) {
      const rel = prefix + entry.name
      safeLocalPath(rel)
      const full = path.join(base, entry.name)
      const stat = lstatSync(full)
      if (stat.isSymbolicLink() || (!stat.isDirectory() && !stat.isFile())) fail('unsupported-files', 'Symbolic links and special files are not supported.')
      paths.add(rel, stat.isDirectory())
      if (stat.isDirectory()) walk(full, rel + '/')
      else {
        if (strict && stat.size > LOCAL_IMPORT_LIMITS.fileBytes) fail('quota', 'One resource file exceeds 200 MiB.', 413)
        files.push({ rel, bytes: stat.size })
        bytes += stat.size
        if (files.length > LOCAL_IMPORT_LIMITS.files || bytes > LOCAL_IMPORT_LIMITS.expandedBytes) fail('quota', 'Resource exceeds 2,000 files or 500 MiB.', 413)
      }
    }
  }
  walk(root, '')
  return files
}

/** Imported files may never claim the official-market trust provenance. */
export function isImportedRecord(rel: string): boolean {
  return ['dsh-market.provenance.json', LOCAL_IMPORT_RECORD].includes(rel.split('/').at(-1)!.toLowerCase())
}
