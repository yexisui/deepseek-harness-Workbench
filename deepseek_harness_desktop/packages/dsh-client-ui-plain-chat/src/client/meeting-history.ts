import type { MeetingSummary } from '../../../dsh-capabilities/src/host/meeting.ts'
import type { LocalConversation, createLocalConversations } from './local-conversations.ts'

type Page = { items: MeetingSummary[]; total: number; unreadableCount?: number; nextCursor?: string }
export function meetingHistoryRow(item: MeetingSummary): LocalConversation {
  return { id: `meeting-${item.id}`, role: item.roleId ?? 'meeting-minutes-demo', kind: 'demo', customTitle: item.customTitle, title: item.title, draft: '', updatedAt: Date.parse(item.updatedAt), meeting: {
    mode: item.mode, audience: item.audience, focus: item.focus, summaryModel: item.summaryModel, jobId: item.id, roleId: item.roleId, roleVersion: item.roleVersion,
    phase: item.status === 'ready' ? 'ready' : item.status === 'transcribed' ? 'transcript' : 'processing',
    messages: [{ id: 0, kind: 'intro', createdAt: item.createdAt }], trace: ['从已保存的会议恢复'], draft: '', showTranscript: false,
  } }
}
async function list(cursor?: string): Promise<Page> {
  const response = await fetch(`/api/capabilities/meeting/jobs?limit=30${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`, { credentials: 'same-origin' })
  const data = await response.json()
  if (!response.ok || !Array.isArray(data.items)) throw new Error(data.error || '会议历史读取失败，请重试')
  return data
}
/** The server owns history; existing local view/draft snapshots are retained when merging. */
export function createMeetingHistory(local: ReturnType<typeof createLocalConversations>, api = list) {
  let state = { loading: false, error: '', hasMore: false, total: 0, unreadableCount: 0 }, cursor: string | undefined
  const removed = new Set<string>()
  const listeners = new Set<() => void>()
  const emit = (patch: Partial<typeof state>) => { state = { ...state, ...patch }; listeners.forEach(fn => fn()) }
  return {
    getSnapshot: () => state,
    subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } },
    forget: (id: string) => { removed.add(id) },
    async load(more = false) {
      if (state.loading) return
      emit({ loading: true, error: '' })
      try {
        const page = await api(more ? cursor : undefined)
        cursor = page.nextCursor
        local.restoreMeetings(page.items.filter(item => !removed.has(item.id)).map(meetingHistoryRow))
        emit({ total: page.total, hasMore: Boolean(cursor), unreadableCount: page.unreadableCount ?? 0 })
      } catch (error) { emit({ error: error instanceof Error ? error.message : String(error) }) }
      finally { emit({ loading: false }) }
    },
  }
}
