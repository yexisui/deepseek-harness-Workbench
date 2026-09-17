/** JSON-only contract shared by the local Workshop host and settings UI. */
export type LocalKind = 'skin' | 'pet' | 'plugin' | 'preset'

export interface LocalResource {
  kind: LocalKind
  id: string
  name: string
  version?: string
  description?: string
  source: 'local' | 'existing'
  status: 'available' | 'active' | 'invalid'
  executable: boolean
  managed: boolean
  installed?: boolean
  enabled?: boolean
  thumbnail?: string
}

export interface LocalPreview {
  kind: LocalKind
  id: string
  name: string
  version?: string
  description?: string
  fileCount: number
  totalBytes: number
  executable: boolean
  conflict: boolean
}

export interface LocalImportRecord {
  version: 1
  source: 'local-import'
  kind: LocalKind
  id: string
  name: string
  versionLabel?: string
  importedAt: string
  files: Record<string, string>
}
