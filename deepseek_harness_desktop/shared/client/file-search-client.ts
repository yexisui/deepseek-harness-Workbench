import type { FileSearchConfig, FileSearchRecord } from '../../packages/dsh-capabilities/src/core/file-search.ts'
export type { FileSearchConfig, FileSearchRecord } from '../../packages/dsh-capabilities/src/core/file-search.ts'
export async function fileSearchApi<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch('/api/capabilities/file-search/' + path, { credentials: 'same-origin', ...(body !== undefined ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) })
  const result = await response.json(); if (!response.ok) throw Error(result.error || '文件搜索失败'); return result
}
type Request = { id: string; query: string; path: string; roleId: string }
type Snapshot = { config?: FileSearchConfig; rows: FileSearchRecord[]; request?: Request; busy: boolean; error: string; query: string; path: string }
export function createFileSearchClient() {
  let state: Snapshot = { rows: [], busy: false, error: '', query: '', path: '' }, generation = 0
  const listeners = new Set<() => void>()
  const emit = (patch: Partial<Snapshot>) => { state = { ...state, ...patch }; listeners.forEach(fn => fn()) }
  const upsert = (row: FileSearchRecord) => emit({ rows: [row, ...state.rows.filter(r => r.id !== row.id)].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) })
  const refreshConfig = async () => { try { emit({ config: await fileSearchApi<FileSearchConfig>('config') }) } catch (e) { emit({ error: (e as Error).message }) } }
  const refresh = async () => { try { emit({ rows: await fileSearchApi<FileSearchRecord[]>('list') }) } catch (e) { emit({ error: (e as Error).message }) } }
  const cancel = async () => { const id = state.request?.id; generation++; emit({ busy: false, error: '搜索已取消' }); if (id) await fileSearchApi('cancel', { id }).catch(() => {}) }
  return {
    getSnapshot: () => state, subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } }, refreshConfig, refresh, cancel,
    draft: (patch: { query?: string; path?: string }) => emit({ ...patch, error: '' }),
    open: () => window.dispatchEvent(new CustomEvent('workbench-file-search-open', { detail: 'new' })),
    async search(roleId?: string) {
      if (!state.query.trim() || state.busy) return
      const token = ++generation, request = { id: crypto.randomUUID(), query: state.query.trim(), path: state.path.trim(), roleId: roleId || state.config?.roleId || '' }
      emit({ busy: true, error: '', request }); window.dispatchEvent(new CustomEvent('workbench-file-search-open', { detail: request.id }))
      try { const row = await fileSearchApi<FileSearchRecord>('query', request); if (token === generation) upsert(row) }
      catch (e) { if (token === generation) emit({ error: (e as Error).message }) }
      finally { if (token === generation) emit({ busy: false }) }
    },
    async command(id: string, action: string, value: Record<string, unknown> = {}) {
      const row = await fileSearchApi<FileSearchRecord | { deleted: string }>('command', { id, action, ...value })
      if ('deleted' in row) emit({ rows: state.rows.filter(r => r.id !== id) }); else upsert(row)
    },
  }
}
declare global { interface Window { workbenchFileSearch?: ReturnType<typeof createFileSearchClient> } }
export const fileSearchClient = () => window.workbenchFileSearch ??= createFileSearchClient()
export type SearchDesktop = { selectSearchDirectory: (path?: string) => Promise<string | null>; revealSearchResult: (path: string) => Promise<void> }
export const searchDesktop = () => (window as Window & { desktop?: Partial<SearchDesktop> }).desktop
export function fileSearchCommand(text: string) {
  const match = text.trim().match(/^(?:查找文件|搜索文件)[：:\s]+(.+)$/u)
  if (!match) return false
  const client = fileSearchClient(); client.draft({ query: match[1]!, path: '' }); void client.search(); return true
}
