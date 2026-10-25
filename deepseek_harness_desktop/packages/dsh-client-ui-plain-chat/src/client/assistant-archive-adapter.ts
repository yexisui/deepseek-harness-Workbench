import type { ArchiveApi } from '../../../dsh-session-archive/src/client/api.ts'
import { createArchiveApi } from '../../../dsh-session-archive/src/client/api.ts'
import type { ArchiveController, ArchiveControllerDeps } from '../../../dsh-session-archive/src/client/archive-controller.ts'
import type { ArchiveSessionRow, BatchResponse, OpResult, SessionPreviewView } from '../../../dsh-session-archive/src/core/types.ts'
import type { AssistantArchiveClient, ArchiveEntry } from './assistant-archive-client.ts'
import type { ConversationHistoryRow } from './LocalConversationRows.tsx'

export interface AssistantArchivePorts {
  archives: AssistantArchiveClient
  rows(): ConversationHistoryRow[]
  current(): string | undefined
  archive(row: ConversationHistoryRow): Promise<void>
  restore(entry: ArchiveEntry): Promise<void>
  remove(id: string): Promise<void>
  preview(id: string): Promise<SessionPreviewView>
}

/** Adapt data and commands; the original settings component and store own all UI. */
export function createAssistantArchiveApi(ports: AssistantArchivePorts, native: ArchiveApi = createArchiveApi()): ArchiveApi {
  const rows = () => new Map(ports.rows().map(row => [row.id, row]))
  const known = (id: string) => Boolean(rows().has(id) || ports.archives.getSnapshot().entries[id])
  const batch = async (kind: 'archive' | 'unarchive' | 'delete', ids: string[], current?: string, expectedTotal?: number): Promise<BatchResponse> => {
    const special = ids.filter(known), ordinary = ids.filter(id => !known(id))
    const results: OpResult[] = []
    let freedBytes = 0
    if (ordinary.length) {
      try {
        const result = kind === 'archive' ? await native.archive(ordinary, current)
          : kind === 'unarchive' ? await native.unarchive(ordinary)
          : await native.deleteSessions(ordinary, current, (expectedTotal ?? ids.length) - special.length)
        results.push(...result.results); freedBytes = result.freedBytes
      } catch (error) {
        results.push(...ordinary.map(id => ({ id, status: 'failed' as const, reason: 'error' as const, detail: String(error) })))
      }
    }
    for (const id of special) {
      try {
        const row = rows().get(id), entry = ports.archives.getSnapshot().entries[id]
        if (kind === 'delete' && (id === ports.current() || row?.running)) {
          results.push({ id, status: 'skipped', reason: row?.running ? 'running' : 'current' }); continue
        }
        if (kind === 'archive') {
          if (row) await ports.archive(row)
          else if (entry) await ports.archives.change({ id, archived: true })
        } else if (kind === 'unarchive') {
          if (entry?.archived) await ports.restore(entry)
        } else {
          await ports.remove(id)
          await ports.archives.change({ id, title: row?.title ?? entry?.title, role: row?.role ?? entry?.role, archived: false, removed: true })
        }
        results.push({ id, status: 'ok' })
      } catch (error) { results.push({ id, status: 'failed', reason: 'error', detail: String(error) }) }
    }
    return { results: ids.flatMap(id => results.filter(result => result.id === id)), freedBytes }
  }
  return {
    ...native,
    async inventory() {
      const [inventory] = await Promise.all([native.inventory(), ports.archives.refresh()])
      const entries = ports.archives.getSnapshot().entries, source = rows()
      const special: ArchiveSessionRow[] = []
      for (const id of new Set([...source.keys(), ...Object.keys(entries)])) {
        const entry = entries[id], row = source.get(id) ?? entry?.localSnapshot
        if (entry?.removed || (!row && !entry?.archived)) continue
        special.push({ id, title: row?.title ?? entry?.title, archived: ports.archives.hidden(id,entry?.localSnapshot),
          archivedAt: entry?.archived ? Date.parse(entry.archivedAt) : undefined,
          createdAt: row?.createdAt, lastActivityAt: row?.updatedAt,
          lastActivityReliable: Number.isFinite(row?.updatedAt),
          running: source.get(id)?.running ?? false, blank: row?.kind === 'draft' && !row.draft && !row.meeting && !row.codeTaskId,
          workspaceIds: [], childIds: [], childCount: 0, issues: [] })
      }
      const nativeIds = new Set(inventory.rows.map(row => row.id))
      const added = special.filter(row => !nativeIds.has(row.id))
      return { ...inventory, rows: [...inventory.rows, ...added], archivedSessionIds: [...inventory.archivedSessionIds, ...added.filter(row => row.archived).map(row => row.id)] }
    },
    preview: id => known(id) ? ports.preview(id) : native.preview(id),
    archive: (ids, current) => batch('archive', ids, current),
    unarchive: ids => batch('unarchive', ids),
    deleteSessions: (ids, current, total) => batch('delete', ids, current, total),
  }
}

export function adaptAssistantArchiveController(original: ArchiveController, ports: AssistantArchivePorts, refresh: () => Promise<void>): ArchiveController {
  // Reuse the registered controller class, avoiding another store runtime or UI implementation.
  const Controller = original.constructor as new (deps: ArchiveControllerDeps) => ArchiveController
  return new Controller({ store: original.store, api: createAssistantArchiveApi(ports),
    sessions: { list: { getSnapshot: () => ({ current: ports.current() ?? original.getCurrentSessionId() }) }, refresh } })
}
