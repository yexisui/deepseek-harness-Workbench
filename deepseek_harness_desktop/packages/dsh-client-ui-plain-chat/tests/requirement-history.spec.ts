// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest'
import { createRequirementHistory } from '../src/client/requirement-history.ts'
import { usesRequirements } from '../src/client/requirements-routing.ts'
import { initialState, latest } from '../../dsh-capabilities/src/core/model.ts'
import type { RequirementSummary } from '../../dsh-capabilities/src/core/requirements-model.ts'
beforeEach(() => sessionStorage.clear())
const row = (i: number): RequirementSummary => ({ id: `req-${i}`, title: `需求 ${i}`, roleId: 'builtin-analyst', roleVersion: 1, mode: 'quick', updatedAt: `2026-09-29T01:${String(i).padStart(2, '0')}:00.000Z`, confirmed: 0, total: 1, openQuestions: 0, running: false })
it('loads server history beyond forty rows and reopens records without duplicating local meeting storage', async () => {
  const items = Array.from({ length: 55 }, (_, i) => row(i))
  const list = vi.fn(async ({ offset = 0, limit = 30 }: { offset?: number; limit?: number } = {}) => ({ items: items.slice(offset, offset + limit), total: items.length }))
  const history = createRequirementHistory({ list, get: vi.fn(), remove: vi.fn() })
  await history.load(); expect(history.getSnapshot()).toMatchObject({ total: 55, hasMore: true })
  await history.load(true); expect(history.getSnapshot().items).toHaveLength(55)
  expect(history.getSnapshot().hasMore).toBe(false)
  history.open('req-53'); expect(history.active()?.title).toBe('需求 53')
  expect(sessionStorage.getItem('workbench-requirements-active-v1')).toBe('req-53')
  expect(sessionStorage.getItem('workbench-local-drafts-v1')).toBeNull()
  await history.load(); expect(history.getSnapshot().items).toHaveLength(55)
})
it('retains history and selected task when deletion fails, then removes only after server success', async () => {
  const remove = vi.fn().mockRejectedValueOnce(Error('任务运行中')).mockResolvedValue({ ok: true })
  const history = createRequirementHistory({ list: async () => ({ items: [row(1)], total: 1 }), get: vi.fn(), remove })
  await history.load(); history.open('req-1')
  await expect(history.remove('req-1')).rejects.toThrow('任务运行中')
  expect(history.active()?.id).toBe('req-1'); expect(history.getSnapshot().items).toHaveLength(1)
  await history.remove('req-1'); expect(history.active()).toBeUndefined(); expect(history.getSnapshot().items).toHaveLength(0)
  history.upsert(row(1), true); expect(history.getSnapshot().items).toHaveLength(0); expect(history.getSnapshot().activeId).toBeNull()
})
it('uses exact published capability bindings for both built-in and custom role routes', () => {
  const state = initialState(), role = state.roles.find(r => r.id === 'builtin-analyst')!
  expect(usesRequirements(state, latest(role.versions))).toBe(true)
  const custom = { ...structuredClone(role.versions[0]!), name: '自定义分析' }
  expect(usesRequirements(state, custom)).toBe(true)
  custom.capabilities[0]!.actions = []
  expect(usesRequirements(state, custom)).toBe(false)
  role.draft.capabilities = []
  expect(usesRequirements(state, latest(role.versions))).toBe(true)
  const old = { ...structuredClone(role.versions[0]!), capabilities: [] }
  expect(usesRequirements(state, old)).toBe(false)
})
