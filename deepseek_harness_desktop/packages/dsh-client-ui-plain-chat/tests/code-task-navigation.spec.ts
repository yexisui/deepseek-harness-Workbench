// @vitest-environment jsdom
import { beforeEach, expect, it } from 'vitest'
import { createLocalConversations } from '../src/client/local-conversations.ts'

beforeEach(() => { sessionStorage.clear(); localStorage.clear() })

it('retains bound code history while a new conversation gets its own task', () => {
  let sequence = 0
  const rows = createLocalConversations(() => `row-${++sequence}`)
  const first = rows.start('developer', 'developer')
  rows.setCodeTask(first.id, { id: 'task-one', title: '修复加法' })
  rows.setDraft(first.id, '')
  const second = rows.start('developer', 'developer')
  expect(second.codeTaskId).toBeUndefined()
  rows.open(first.id)
  expect(rows.active()).toMatchObject({ codeTaskId: 'task-one', title: '修复加法' })
  rows.rename(first.id, '我的代码任务')
  rows.setCodeTask(first.id, { id: 'task-one', title: '引擎标题' })
  expect(rows.active()?.title).toBe('我的代码任务')
  expect(createLocalConversations().active()?.codeTaskId).toBe('task-one')
})
