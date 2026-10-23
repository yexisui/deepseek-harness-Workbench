import { describe, expect, it } from 'vitest'
import { allocateHistoryNumbers, nativeHistoryRows, roleForPreset, searchHistory, sortHistory, type HistoryRole } from '../src/client/conversation-history.ts'
import type { ConversationHistoryRow } from '../src/client/LocalConversationRows.tsx'
const roles: HistoryRole[] = [{ id: 'meeting', enabled: true, draft: { name: '会议助手', color: '#456' }, versions: [{ name: '会议助手', color: '#456', preset: 'workbench-role-meeting-v1' }] }]
const row = (id: string, updatedAt: number, extra: Partial<ConversationHistoryRow> = {}): ConversationHistoryRow => ({ id, title: id, role: 'meeting', kind: 'demo', draft: '', updatedAt, ...extra })
describe('assistant conversation ordering and lookup', () => {
  it('keeps allocated numbers when time, title, direction or visible records change', () => {
    const rows = [row('a', 20, { createdAt: 1 }), row('b', 10, { createdAt: 2 })]
    const numbers = allocateHistoryNumbers({}, rows)
    expect(numbers.meeting).toEqual({ a: 1, b: 2 })
    const renamed = [row('b', 99, { title: '改名' }), row('c', 100, { createdAt: 3 })]
    const next = allocateHistoryNumbers(numbers, renamed)
    expect(next.meeting).toEqual({ a: 1, b: 2, c: 3 })
    expect(sortHistory(rows, { sort: 'time', direction: 'desc' }, numbers).map(r => r.id)).toEqual(['a', 'b'])
    expect(sortHistory(rows, { sort: 'number', direction: 'desc' }, numbers).map(r => r.id)).toEqual(['b', 'a'])
    expect(sortHistory(rows, { sort: 'number', direction: 'asc' }, numbers).map(r => r.id)).toEqual(['a', 'b'])
    expect(allocateHistoryNumbers(next, renamed)).toBe(next)
  })
  it('numbers assistants independently and keeps temporary drafts unnumbered', () => {
    const numbers = allocateHistoryNumbers({}, [row('one', 1), row('two', 2, { role: 'other' }), row('draft', 4, { kind: 'draft' })])
    expect(numbers.meeting).toEqual({ one: 1 }); expect(numbers.other).toEqual({ two: 1 })
    expect(sortHistory([row('missing', NaN), row('ok', 2)], { sort: 'time', direction: 'asc' }, numbers).map(r => r.id)).toEqual(['ok', 'missing'])
  })
  it('identifies saved presets, including a removed assistant, without guessing from titles', () => {
    expect(roleForPreset('workbench-chat', roles)).toBe('chat')
    expect(roleForPreset('workbench-role-meeting-v1', roles)).toBe('meeting')
    expect(roleForPreset('workbench-role-deleted-v2', roles)).toBe('deleted')
    expect(roleForPreset('custom-agent', roles)).toBe('preset:custom-agent')
  })
  it('excludes archives, subagents and unselected blank native sessions while preserving workspace membership', () => {
    const state = { current: 'blank', ids: ['a', 'archived', 'child', 'blank', 'empty'], byId: Object.fromEntries(['a', 'archived', 'child', 'blank', 'empty'].map(id => [id, { title: id, updatedAt: 5, blank: ['blank', 'empty'].includes(id), origin: id === 'child' ? 'subagent' : undefined, projectionValues: { agentPreset: id === 'a' ? 'workbench-role-meeting-v1' : 'workbench-chat' } }])) }
    const result = nativeHistoryRows(state, [{ title: '项目甲', sessionIds: ['a'] }], ['archived'], roles)
    expect(result.map(r => r.nativeId)).toEqual(['a', 'blank'])
    expect(result[0]).toMatchObject({ role: 'meeting', workspace: '项目甲' })
  })
  it('finds conversations by title, assistant and project independent of collapsed views', () => {
    const rows = [row('会议摘要', 1, { workspace: '项目甲' }), row('文档', 2, { role: 'chat' })]
    expect(searchHistory(rows, '会议助手 项目甲', roles)).toEqual([rows[0]])
    expect(searchHistory(rows, '自由聊天', roles)).toEqual([rows[1]])
    expect(searchHistory(rows, '没有这个词', roles)).toEqual([])
  })
})
