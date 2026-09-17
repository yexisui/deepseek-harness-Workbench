/** Local resource library: validate and copy bytes, never import/evaluate resource code. */
import { createHash, randomUUID } from 'node:crypto'
import {
  existsSync, lstatSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync,
} from 'node:fs'
import { open } from 'node:fs/promises'
import path from 'node:path'
import type { LocalImportRecord, LocalKind, LocalPreview, LocalResource } from './local-types.ts'
import { readResourceManifest, validateLocalId, type ResourceManifest } from './local-import-manifest.ts'
import {
  assertPlainPath, fail, FilePaths, isImportedRecord, listPlainFiles, LOCAL_IMPORT_LIMITS,
  LOCAL_IMPORT_RECORD, plainMkdir, safeLocalPath, type LocalFile,
} from './local-import-safety.ts'
import { extractLocalZip } from './local-import-zip.ts'

export { LocalImportError, LOCAL_IMPORT_LIMITS, LOCAL_IMPORT_RECORD } from './local-import-safety.ts'

const KIND_DIRECTORY: Record<LocalKind, string> = {
  skin: 'skins', pet: 'pets', preset: 'agent-presets', plugin: 'workshop/plugins',
}
const locks = new Map<string, Promise<unknown>>()

export function localResourceDir(home: string, kind: LocalKind, id: string): string {
  validateLocalId(kind, id)
  const directory = kind === 'plugin' ? createHash('sha256').update(id).digest('hex') : id
  return path.join(home, KIND_DIRECTORY[kind], directory)
}

/** Import and activation share the same queue so they cannot mutate one resource concurrently. */
export async function localResourceLock<T>(home: string, kind: LocalKind, id: string, action: () => Promise<T>): Promise<T> {
  const key = path.resolve(home).toLowerCase() + ':' + kind + ':' + id.toLowerCase()
  const previous = locks.get(key) ?? Promise.resolve()
  const pending = previous.catch(() => undefined).then(action)
  locks.set(key, pending)
  try { return await pending }
  finally { if (locks.get(key) === pending) locks.delete(key) }
}

function hashFiles(root: string, files: LocalFile[]): Record<string, string> {
  const hashes: Record<string, string> = Object.create(null) as Record<string, string>
  for (const file of [...files].sort((a, b) => a.rel.localeCompare(b.rel))) {
    if (!isImportedRecord(file.rel)) hashes[file.rel] = createHash('sha256').update(readFileSync(path.join(root, file.rel))).digest('hex')
  }
  return hashes
}

/** Metadata is an ownership record, never a code-trust assertion. Actions verify bytes again. */
export function readLocalImportRecord(root: string, options: { verify?: boolean } = {}): LocalImportRecord | undefined {
  try {
    assertPlainPath(root)
    const full = path.join(root, LOCAL_IMPORT_RECORD)
    assertPlainPath(full)
    if (lstatSync(full).size > LOCAL_IMPORT_LIMITS.manifestBytes) return undefined
    const raw = JSON.parse(readFileSync(full, 'utf8')) as LocalImportRecord
    if (raw.version !== 1 || raw.source !== 'local-import' || !['skin', 'pet', 'plugin', 'preset'].includes(raw.kind)
      || typeof raw.name !== 'string' || typeof raw.importedAt !== 'string'
      || typeof raw.files !== 'object' || raw.files === null || Array.isArray(raw.files)) return undefined
    validateLocalId(raw.kind, raw.id)
    const paths = new FilePaths()
    const entries = Object.entries(raw.files)
    if (!entries.length || entries.length > LOCAL_IMPORT_LIMITS.files) return undefined
    for (const [rel, hash] of entries) {
      paths.add(rel)
      if (isImportedRecord(rel) || typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash)) return undefined
    }
    if (options.verify) {
      const files = listPlainFiles(root).filter(file => !isImportedRecord(file.rel))
      const hashes = hashFiles(root, files)
      if (Object.keys(hashes).length !== entries.length || entries.some(([rel, hash]) => hashes[rel] !== hash)) return undefined
    }
    return raw
  } catch { return undefined }
}

interface Upload {
  id: string
  kind: LocalKind
  format: 'zip' | 'folder'
  root: string
  createdAt: number
  touchedAt: number
  busy: boolean
  files: LocalFile[]
  totalBytes: number
  inspected?: { root: string; files: LocalFile[]; manifest: ResourceManifest; hashes: Record<string, string> }
}

export interface LocalWorkshopOptions {
  dshHome: string
  now?: () => number
  /** Narrow atomic-write seam for testing rollback after the old directory has moved. */
  rename?: typeof renameSync
}

function plainExists(full: string): boolean {
  assertPlainPath(full)
  try { return lstatSync(full).isDirectory() } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}

function readDirectories(base: string): string[] {
  try {
    assertPlainPath(base)
    return readdirSync(base, { withFileTypes: true }).filter(entry => entry.isDirectory() && !entry.isSymbolicLink() && !entry.name.startsWith('.')).map(entry => entry.name)
  } catch { return [] }
}

function readSmallJson(full: string): Record<string, unknown> {
  try {
    assertPlainPath(full)
    if (lstatSync(full).size > LOCAL_IMPORT_LIMITS.manifestBytes) return {}
    const value: unknown = JSON.parse(readFileSync(full, 'utf8'))
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {}
  } catch { return {} }
}

function protectedId(kind: LocalKind, id: string): boolean {
  if (/^(default|standard|builtin|core|official)(-|$)/.test(id)) return true
  if (kind === 'skin' && id === 'blue-fantasy') return true
  if (kind === 'plugin') return /^@(deepseek-ai|deepseek)\//.test(id)
    || /^(?:@[^/]+\/)?dsh-(?:core|host|api|agent-presets|settings|web-all)(?:-|$)/.test(id)
    || ['@linxin666/dsh-client-ui-market', '@linxin666/dsh-skin-center', '@linxin666/dsh-pet', '@linxin666/dsh-preset-center'].includes(id)
  return false
}

/** A bounded, in-memory upload registry. Disk staging is purged on expiry or discard. */
export class LocalWorkshopService {
  readonly home: string
  private readonly now: () => number
  private readonly rename: typeof renameSync
  private readonly uploads = new Map<string, Upload>()

  constructor(options: LocalWorkshopOptions) {
    this.home = path.resolve(options.dshHome)
    this.now = options.now ?? Date.now
    this.rename = options.rename ?? renameSync
  }

  private get uploadsRoot(): string { return path.join(this.home, 'workshop', 'uploads') }

  /** Called on requests, without a background timer keeping the host process alive. */
  cleanup(): void {
    const cutoff = this.now() - LOCAL_IMPORT_LIMITS.expiryMs
    for (const [id, upload] of this.uploads) {
      if (!upload.busy && upload.touchedAt < cutoff) { this.removeStage(upload.root); this.uploads.delete(id) }
    }
    for (const name of readDirectories(this.uploadsRoot)) {
      if (!/^upload-[a-f0-9-]{36}$/.test(name) || this.uploads.has(name.slice(7))) continue
      const full = path.join(this.uploadsRoot, name)
      if (lstatSync(full).mtimeMs < cutoff) this.removeStage(full)
    }
  }

  private removeStage(full: string): void {
    const parent = path.resolve(this.uploadsRoot)
    const target = path.resolve(full)
    if (path.dirname(target) !== parent || !path.basename(target).startsWith('upload-')) fail('unsafe-destination', 'Invalid upload staging location.')
    assertPlainPath(target)
    rmSync(target, { recursive: true, force: true, maxRetries: 3 })
  }

  start(kind: LocalKind, format: 'zip' | 'folder'): string {
    if (!['skin', 'pet', 'plugin', 'preset'].includes(kind) || !['zip', 'folder'].includes(format)) fail('invalid-body', 'Choose a supported resource category and ZIP or folder format.')
    this.cleanup()
    if (this.uploads.size >= LOCAL_IMPORT_LIMITS.sessions) fail('busy', 'Too many pending imports. Finish or discard an existing import.', 409)
    const id = randomUUID()
    const root = path.join(this.uploadsRoot, 'upload-' + id)
    plainMkdir(path.join(root, 'files'))
    this.uploads.set(id, { id, kind, format, root, createdAt: this.now(), touchedAt: this.now(), busy: false, files: [], totalBytes: 0 })
    return id
  }

  private getUpload(id: unknown): Upload {
    this.cleanup()
    if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id)) fail('invalid-upload', 'Upload session is invalid.', 404)
    const upload = this.uploads.get(id)
    if (!upload) fail('expired-upload', 'Upload expired. Select the resource again.', 404)
    if (upload.busy) fail('busy', 'This upload is already being processed.', 409)
    upload.touchedAt = this.now()
    return upload
  }

  async uploadFile(id: unknown, relativePath: unknown, body: AsyncIterable<Uint8Array | string>): Promise<void> {
    const upload = this.getUpload(id)
    if (upload.inspected) fail('inspected-upload', 'This resource was already inspected. Start a new import to change its files.', 409)
    const rel = safeLocalPath(relativePath)
    if (upload.format === 'zip' && (rel !== 'archive.zip' || upload.files.length)) fail('invalid-upload', 'A ZIP upload must contain exactly one archive.zip file.')
    if (upload.files.length >= LOCAL_IMPORT_LIMITS.files) fail('quota', 'Resource exceeds 2,000 files.', 413)
    const paths = new FilePaths()
    for (const file of upload.files) paths.add(file.rel)
    paths.add(rel)
    upload.busy = true
    const full = path.join(upload.root, 'files', rel)
    let bytes = 0
    try {
      plainMkdir(path.dirname(full))
      assertPlainPath(full)
      const handle = await open(full, 'wx')
      try {
        for await (const chunk of body) {
          const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength)
          bytes += buffer.byteLength
          if (bytes > LOCAL_IMPORT_LIMITS.fileBytes || upload.totalBytes + bytes > LOCAL_IMPORT_LIMITS.expandedBytes) fail('quota', 'Upload exceeds 200 MiB per file or 500 MiB per resource.', 413)
          let offset = 0
          while (offset < buffer.length) offset += (await handle.write(buffer, offset, buffer.length - offset)).bytesWritten
          upload.touchedAt = this.now()
        }
      } finally { await handle.close() }
      upload.files.push({ rel, bytes })
      upload.totalBytes += bytes
    } catch (error) {
      assertPlainPath(full)
      rmSync(full, { force: true })
      throw error
    } finally { upload.busy = false }
  }

  private guardDestination(kind: LocalKind, id: string): boolean {
    if (protectedId(kind, id)) fail('protected-resource', 'Built-in and core resource IDs cannot be imported or replaced. Choose a custom ID.', 409)
    const destination = localResourceDir(this.home, kind, id)
    assertPlainPath(destination)
    const siblings = readDirectories(path.dirname(destination))
    if (siblings.some(name => name.toLowerCase() === path.basename(destination).toLowerCase() && name !== path.basename(destination))) fail('conflict', 'A resource with a case-equivalent directory already exists.', 409)
    if (kind === 'preset' && plainExists(path.join(this.home, '.agent-presets', id))) fail('active-resource', 'Disable this preset before replacing its library resource.', 409)
    if (kind === 'skin' && readSmallJson(path.join(this.home, 'skin-center-active.json')).active === id) fail('active-resource', 'Switch away from this skin before replacing it.', 409)
    if (kind === 'pet' && readSmallJson(path.join(this.home, 'pet.json')).petId === id) fail('active-resource', 'Select another pet before replacing it.', 409)
    if (kind === 'plugin') {
      const job = readSmallJson(path.join(this.home, 'workshop', 'plugin-jobs', createHash('sha256').update(id).digest('hex') + '.json'))
      if (job.state === 'running') fail('active-resource', 'Wait for the plugin installation to finish before replacing it.', 409)
      for (const profile of readDirectories(path.join(this.home, 'profiles'))) {
        const dependencies = readSmallJson(path.join(this.home, 'profiles', profile, 'package.json')).dependencies
        if (dependencies && typeof dependencies === 'object' && Object.hasOwn(dependencies, id)) fail('active-resource', 'Uninstall this plugin before replacing its local package.', 409)
      }
    }
    if (existsSync(destination) && !lstatSync(destination).isDirectory()) fail('conflict', 'The resource destination is occupied by a file.', 409)
    return plainExists(destination)
  }

  inspect(id: unknown): LocalPreview {
    const upload = this.getUpload(id)
    if (!upload.files.length) fail('empty-upload', 'Select a resource package containing files.')
    if (!upload.inspected) {
      let root = path.join(upload.root, 'files')
      if (upload.format === 'zip') {
        root = path.join(upload.root, 'extracted')
        assertPlainPath(root)
        rmSync(root, { recursive: true, force: true })
        extractLocalZip(path.join(upload.root, 'files', 'archive.zip'), root)
      }
      let files = listPlainFiles(root)
      const manifestNames = ['skin.json', 'pet.json', 'preset.yml', 'package.json']
      let wrapper: string | undefined
      if (!files.some(file => manifestNames.includes(file.rel))) {
        const roots = new Set(files.map(file => file.rel.split('/')[0]!))
        if (roots.size !== 1 || files.some(file => !file.rel.includes('/'))) fail('invalid-root', 'Resource must have its manifest at the root or inside one enclosing folder.')
        wrapper = [...roots][0]!
        root = path.join(root, wrapper)
        files = listPlainFiles(root)
      }
      // Strip untrusted imported provenance before generating our own ownership record.
      for (const file of files.filter(file => isImportedRecord(file.rel))) rmSync(path.join(root, file.rel), { force: true })
      files = files.filter(file => !isImportedRecord(file.rel))
      const manifest = readResourceManifest(root, files, upload.kind, wrapper)
      upload.inspected = { root, files, manifest, hashes: hashFiles(root, files) }
    }
    const { manifest, files } = upload.inspected
    const conflict = this.guardDestination(manifest.kind, manifest.id)
    return { ...manifest, fileCount: files.length, totalBytes: files.reduce((sum, file) => sum + file.bytes, 0), conflict }
  }

  async commit(id: unknown, replace = false): Promise<LocalResource> {
    this.inspect(id)
    const upload = this.getUpload(id)
    const inspected = upload.inspected!
    upload.busy = true
    try {
      return await localResourceLock(this.home, inspected.manifest.kind, inspected.manifest.id, async () => {
        const { root, manifest } = inspected
        const files = listPlainFiles(root)
        const hashes = hashFiles(root, files)
        if (Object.keys(hashes).length !== Object.keys(inspected.hashes).length
          || Object.entries(inspected.hashes).some(([rel, hash]) => hashes[rel] !== hash)) fail('changed-resource', 'Staged resource changed after inspection. Import it again.', 409)
        const exists = this.guardDestination(manifest.kind, manifest.id)
        if (exists && !replace) fail('conflict', 'Resource already exists. Confirm replacement first.', 409)
        const destination = localResourceDir(this.home, manifest.kind, manifest.id)
        plainMkdir(path.dirname(destination))
        const metadata: LocalImportRecord = {
          version: 1, source: 'local-import', kind: manifest.kind, id: manifest.id, name: manifest.name,
          ...(manifest.version ? { versionLabel: manifest.version } : {}), importedAt: new Date(this.now()).toISOString(), files: hashes,
        }
        writeFileSync(path.join(root, LOCAL_IMPORT_RECORD), JSON.stringify(metadata, null, 2) + '\n', { flag: 'wx' })
        const backup = path.join(this.home, 'workshop', 'backups', manifest.kind + '-' + encodeURIComponent(manifest.id) + '-' + this.now() + '-' + randomUUID())
        let backedUp = false
        try {
          if (exists) {
            plainMkdir(path.dirname(backup))
            assertPlainPath(destination)
            this.rename(destination, backup)
            backedUp = true
          }
          assertPlainPath(root)
          assertPlainPath(destination)
          this.rename(root, destination)
        } catch (error) {
          // Keep the previous resource intact even when final rename fails on Windows.
          if (backedUp && !existsSync(destination)) this.rename(backup, destination)
          if (existsSync(root)) rmSync(path.join(root, LOCAL_IMPORT_RECORD), { force: true })
          throw error
        }
        this.uploads.delete(upload.id)
        try { this.removeStage(upload.root) } catch { /* Import committed; expiry cleanup retries leftover staging. */ }
        return { ...manifest, source: 'local', status: 'available', managed: true }
      })
    } finally { upload.busy = false }
  }

  discard(id: unknown): void {
    const upload = this.getUpload(id)
    this.removeStage(upload.root)
    this.uploads.delete(upload.id)
  }

  resources(): LocalResource[] {
    this.cleanup()
    const resources = new Map<string, LocalResource>()
    const activeSkin = readSmallJson(path.join(this.home, 'skin-center-active.json')).active
    const activePet = readSmallJson(path.join(this.home, 'pet.json')).petId
    const pluginDependencies = new Set<string>()
    for (const profile of readDirectories(path.join(this.home, 'profiles'))) {
      try {
        const full = path.join(this.home, 'profiles', profile, 'package.json')
        assertPlainPath(full)
        if (lstatSync(full).size > LOCAL_IMPORT_LIMITS.manifestBytes) continue
        const pkg = JSON.parse(readFileSync(full, 'utf8')) as { dependencies?: Record<string, unknown> }
        for (const id of Object.keys(pkg.dependencies ?? {})) pluginDependencies.add(id)
      } catch { /* Absent or malformed optional profile metadata. */ }
    }
    for (const kind of ['skin', 'pet', 'plugin', 'preset'] as const) {
      const bases = [path.join(this.home, KIND_DIRECTORY[kind])]
      if (kind === 'preset') bases.push(path.join(this.home, '.agent-presets'))
      for (const base of bases) for (const dir of readDirectories(base)) {
        const full = path.join(base, dir)
        try {
          const files = listPlainFiles(full)
          const manifest = readResourceManifest(full, files, kind, dir)
          const record = readLocalImportRecord(full)
          const managed = record?.id === manifest.id && record.kind === kind
          const active = (kind === 'preset' && base === bases[1])
            || (kind === 'skin' && activeSkin === manifest.id) || (kind === 'pet' && activePet === manifest.id)
          resources.set(kind + ':' + manifest.id, {
            ...manifest, source: managed ? 'local' : 'existing', managed,
            status: active ? 'active' : 'available',
            ...(kind === 'plugin' ? { installed: pluginDependencies.has(manifest.id) } : {}),
          })
        } catch {
          // Invalid imported resources remain visible and removable; arbitrary unrelated directories do not.
          const record = readLocalImportRecord(full)
          if (record?.kind === kind) resources.set(kind + ':' + record.id, {
            kind, id: record.id, name: record.name, version: record.versionLabel, source: 'local', managed: true,
            status: 'invalid', executable: kind === 'plugin' || kind === 'preset',
          })
        }
      }
    }
    return [...resources.values()].sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name))
  }
}
