import { createHash } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { parseDocument } from 'yaml'
import { validateSkinManifestV2 } from '../../../skins/skin-center/src/core/manifest-v2/validate.ts'
import { parsePetManifest } from '../../../dsh-pet/src/manifest-v2.ts'
import type { LocalKind } from './local-types.ts'
import { fail, LOCAL_IMPORT_LIMITS, safeLocalPath, type LocalFile } from './local-import-safety.ts'

export interface ResourceManifest {
  kind: LocalKind
  id: string
  name: string
  version?: string
  description?: string
  executable: boolean
}

function object(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function label(value: unknown, maximum = 200): string | undefined {
  return typeof value === 'string' && value.trim() && value.length <= maximum ? value.trim() : undefined
}

export function validateLocalId(kind: LocalKind, value: unknown): string {
  if (typeof value !== 'string' || value.length > 214) fail('invalid-manifest', 'Resource manifest needs a valid id.')
  if (kind === 'plugin') {
    if (!/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(value)) fail('invalid-manifest', 'Plugin name must be a valid npm package name.')
  } else {
    if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(value)) fail('invalid-manifest', 'Resource id must use up to 64 lowercase letters, digits and hyphens.')
    safeLocalPath(value)
  }
  return value
}

function textFile(root: string, rel: string): string {
  const full = path.join(root, rel)
  if (statSync(full).size > LOCAL_IMPORT_LIMITS.manifestBytes) fail('quota', 'A resource manifest exceeds 1 MiB.', 413)
  return readFileSync(full, 'utf8')
}

function json(root: string, rel: string): Record<string, unknown> {
  try {
    const result = JSON.parse(textFile(root, rel)) as unknown
    if (!result || Array.isArray(result) || typeof result !== 'object') fail('invalid-manifest', 'Manifest must be a JSON object.')
    return object(result)
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'quota') throw error
    fail('invalid-manifest', `Cannot read ${rel} as a JSON manifest.`)
  }
}

/** YAML tags are retained as inert values; no custom tag constructors run. */
function yaml(root: string, rel: string, composition = false): unknown {
  try {
    const doc = parseDocument(textFile(root, rel), {
      uniqueKeys: true,
      schema: 'core',
      // The official loader's !!js tag represents an expression. Keep it as
      // inert scalar text here; do not invoke the loader or compile expressions.
      customTags: composition ? [{ tag: 'tag:yaml.org,2002:js', resolve: (value: string) => value }] : [],
    })
    if (doc.errors.length || doc.warnings.some(warning => warning.code === 'TAG_RESOLVE_FAILED')) fail('invalid-manifest', `Invalid or unsupported YAML in ${rel}.`)
    return doc.toJS({ maxAliasCount: 30 })
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'quota') throw error
    fail('invalid-manifest', `Cannot read ${rel} as safe YAML.`)
  }
}

/** Match the official discovery shape check, including nested group rows. */
function validatePresetRows(rows: unknown, depth = 0, ancestors = new Set<unknown>()): void {
  if (!Array.isArray(rows) || depth > 64 || ancestors.has(rows)) fail('invalid-manifest', 'Preset composition must contain a finite list of named plugin rows.')
  const next = new Set(ancestors).add(rows)
  for (const row of rows) {
    const entry = object(row)
    if (!label(entry.name)) fail('invalid-manifest', 'Preset composition rows must contain plugin names.')
    if (entry.group === true) validatePresetRows(entry.config, depth + 1, next)
  }
}

function packageExport(value: unknown, depth = 0): string | undefined {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object' || depth > 16) return undefined
  const record = object(value)
  for (const key of ['node', 'import', 'default', 'require']) {
    const entry = packageExport(record[key], depth + 1)
    if (entry) return entry
  }
  return undefined
}

/** Validate manifest identity and its required on-disk entry references, without loading code. */
export function readResourceManifest(root: string, files: LocalFile[], expectedKind?: LocalKind, wrapper?: string): ResourceManifest {
  const names = new Set(files.map(file => file.rel))
  const candidates: LocalKind[] = []
  if (names.has('skin.json')) candidates.push('skin')
  if (names.has('pet.json')) candidates.push('pet')
  if (names.has('preset.yml')) candidates.push('preset')
  // Asset packs may carry package.json as publishing metadata; the asset manifest owns their kind.
  if (!candidates.length && names.has('package.json')) candidates.push('plugin')
  if (candidates.length !== 1 || (expectedKind && candidates[0] !== expectedKind)) fail('wrong-kind', 'Resource manifest is missing, ambiguous or belongs to a different category.')
  const kind = candidates[0]!
  const requireFile = (value: unknown): string => {
    const rel = safeLocalPath(typeof value === 'string' ? value.replace(/^\.\//, '') : value)
    if (!names.has(rel)) fail('missing-file', `Resource is missing the referenced file: ${rel}`)
    return rel
  }
  const optionalFile = (value: unknown): void => { if (value !== undefined) requireFile(value) }
  const requireDirectory = (value: unknown): string => {
    if (value === '.') return ''
    const rel = safeLocalPath(value)
    if (!files.some(file => file.rel.startsWith(rel + '/'))) fail('missing-file', `Resource has no files in the referenced folder: ${rel}`)
    return rel
  }
  let raw: Record<string, unknown>
  let id: string
  let name: string | undefined
  let executable = files.some(file => /\.(?:[cm]?js|[cm]?ts|jsx|tsx|wasm|node|exe|dll|ps1|sh|bat|cmd)$/i.test(file.rel))
  if (kind === 'skin') {
    raw = json(root, 'skin.json')
    const validation = validateSkinManifestV2(raw)
    if (!validation.ok) fail('invalid-manifest', 'Skin Center cannot load this manifest: ' + validation.errors.slice(0, 5).join('; '))
    id = validateLocalId(kind, raw.id)
    name = label(raw.name)
    const contributes = object(raw.contributes)
    requireFile(contributes.stylesheet)
    optionalFile(contributes.patches)
    for (const media of Object.values(object(contributes.backgroundMedia))) optionalFile(object(media).src)
    for (const preview of Object.values(object(raw.preview))) optionalFile(preview)
    for (const facet of Object.values(object(raw.facets))) {
      const entry = object(facet).entry
      if (entry !== undefined) { requireFile(entry); executable = true }
    }
  } else if (kind === 'pet') {
    raw = json(root, 'pet.json')
    const validation = parsePetManifest(raw, 'pet.json')
    if (!validation.ok) fail('invalid-manifest', 'Pet Center cannot load this manifest: ' + validation.diagnostics.filter(item => item.level === 'error').slice(0, 5).map(item => item.message).join('; '))
    // Use the same normalized v1/v2 shape as the Pet Center for file checks.
    raw = validation.manifest as unknown as Record<string, unknown>
    id = validateLocalId(kind, raw.id)
    name = label(raw.displayName)
    if (raw.renderer === 'sprite2d' || raw.renderer === undefined) {
      requireFile(object(raw.sprite2d).spritesheetPath ?? raw.spritesheetPath ?? 'spritesheet.webp')
    } else if (raw.renderer === 'live2d') {
      const modelPath = requireFile(object(raw.live2d).model)
      const model = json(root, modelPath)
      const modelBase = path.posix.dirname(modelPath)
      const checkModelFile = (value: unknown): void => {
        if (typeof value !== 'string') fail('invalid-manifest', 'Live2D model references must be file paths.')
        safeLocalPath(value)
        requireFile(modelBase === '.' ? value : modelBase + '/' + value)
      }
      const references = object(model.FileReferences)
      checkModelFile(references.Moc)
      if (!Array.isArray(references.Textures) || !references.Textures.length) fail('invalid-manifest', 'Live2D model must declare textures.')
      for (const texture of references.Textures) checkModelFile(texture)
      for (const key of ['Physics', 'Pose', 'UserData', 'DisplayInfo']) if (references[key] !== undefined) checkModelFile(references[key])
      for (const expression of Array.isArray(references.Expressions) ? references.Expressions : []) checkModelFile(object(expression).File)
      for (const motions of Object.values(object(references.Motions))) {
        if (Array.isArray(motions)) for (const motion of motions) {
          checkModelFile(object(motion).File)
          if (object(motion).Sound !== undefined) checkModelFile(object(motion).Sound)
        }
      }
    } else if (raw.renderer === 'frames2d') {
      const frames = object(raw.frames2d)
      const dir = requireDirectory(frames.dir ?? '.')
      const tracks = object(frames.tracks)
      const idle = object(frames.phases).idle
      if (typeof idle !== 'string' || !(idle in tracks) || !Object.keys(tracks).length) fail('invalid-manifest', 'Frame pets need an idle phase and matching tracks.')
      for (const [track, value] of Object.entries(tracks)) {
        safeLocalPath(track)
        const prefix = [dir, track].filter(Boolean).join('/')
        requireDirectory(prefix)
        const specified = object(value).frames
        if (specified !== undefined) {
          if (!Array.isArray(specified) || !specified.length) fail('invalid-manifest', 'Frame track must contain frame filenames.')
          for (const frame of specified) requireFile(prefix + '/' + safeLocalPath(frame))
        } else if (!files.some(file => file.rel.startsWith(prefix + '/') && /\.(webp|png|jpe?g|avif)$/i.test(file.rel))) {
          fail('missing-file', `Pet track has no image frames: ${track}`)
        }
      }
    } else fail('invalid-manifest', 'Pet renderer is not supported.')
  } else if (kind === 'preset') {
    raw = object(yaml(root, 'preset.yml'))
    name = label(raw.name)
    requireFile('agent.cordis.yml')
    // Existing preset.yml files identify themselves by their enclosing directory.
    const fallback = wrapper && /^[a-z0-9][a-z0-9-]{0,63}$/.test(wrapper) ? wrapper
      : 'preset-' + createHash('sha256').update(name ?? textFile(root, 'agent.cordis.yml')).digest('hex').slice(0, 12)
    id = validateLocalId(kind, raw.id ?? fallback)
    name ??= id
    const roster = yaml(root, 'agent.cordis.yml', true)
    validatePresetRows(roster)
    executable = true
  } else {
    raw = json(root, 'package.json')
    id = validateLocalId(kind, raw.name)
    name = label(raw.displayName) ?? id
    const patch = requireFile(object(object(raw.dsh).bundle).patch)
    const operations = yaml(root, patch, true)
    if (!Array.isArray(operations) || !operations.length) fail('invalid-manifest', 'Plugin bundle patch must be a nonempty YAML list.')
    const exports = object(raw.exports)
    const entry = requireFile(packageExport(exports['.']) ?? packageExport(raw.exports) ?? raw.main)
    if (!/\.[cm]?js$/.test(entry)) fail('missing-build', 'Plugin packages must include a built JavaScript entry.')
    if (object(raw.dsh).client !== undefined) {
      const client = requireFile(packageExport(exports['./client']))
      if (!/\.[cm]?js$/.test(client)) fail('missing-build', 'Plugin packages must include their built browser entry.')
    }
    executable = true
  }
  if (!name) fail('invalid-manifest', 'Resource manifest needs a nonempty display name.')
  return { kind, id, name, version: label(raw.version, 100), description: label(raw.description, 4000), executable }
}
