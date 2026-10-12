export const FILE_SEARCH_CAPABILITY = 'local-file-search'
export const FILE_SEARCH_COMPONENT = 'everything-search'
export type FileSearchItem = { path: string; name: string; directory: boolean; size: number | null; modifiedAt: string }
export type FileSearchRecord = { id: string; roleId: string; roleVersion: number; roleName: string; title: string; query: string; path: string; createdAt: string; updatedAt: string; items: FileSearchItem[]; hasMore: boolean }
export type FileSearchConfig = { roleId: string; roles: { id: string; name: string }[]; ready: boolean; engine: { state: 'missing' | 'stopped' | 'ready' | 'error'; message: string } }
/** Filename terms only: Everything operators are data, * and ? remain wildcards. */
export function filenameTerms(query: string): string[] {
  return query.trim().split(/\s+/u).filter(Boolean).map(term => {
    const pattern = [...term].map(c => c === '*' ? '.*' : c === '?' ? '.' : /[\p{L}\p{N}_-]/u.test(c) ? c : `\\x{${c.codePointAt(0)!.toString(16)}}`).join('')
    return 'nopath:regex:' + (/[?*]/.test(term) ? '^' + pattern + '$' : pattern)
  })
}
