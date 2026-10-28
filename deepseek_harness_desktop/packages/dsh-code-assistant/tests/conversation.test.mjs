import test from 'node:test'
import assert from 'node:assert/strict'
import { groupConversation, questionSummaries, toolResult } from '../src/core/conversation.mjs'
import { CodeAssistantService } from '../src/host/service.mjs'
const user = (id, text) => ({ info: { id, role: 'user', time: { created: 1000 } }, parts: [{ type: 'text', text }] })
const answer = (id, parentID, text = '回复') => ({ info: { id, role: 'assistant', parentID, time: { created: 2000, completed: 3000 } }, parts: [{ type: 'text', text }] })
test('three questions keep every answer, including delayed replies and chained parent IDs', () => {
  const messages = [user('q1', '介绍项目'), answer('a1', 'q1'), user('q2', '跑测试'), answer('a2', 'q2'), user('q3', '修好'), answer('late', 'a1'), answer('a3', 'q3')]
  const before = JSON.stringify(messages), { rounds, unassigned } = groupConversation(messages, 'done')
  assert.equal(rounds.length, 3); assert.deepEqual(rounds[0].messages.map(m => m.info.id), ['q1','a1','late'])
  assert.deepEqual(rounds[1].messages.map(m => m.info.id), ['q2','a2']); assert.deepEqual(unassigned, [])
  assert.equal(JSON.stringify(messages), before)
})
test('missing explicit parents stay unassigned; legacy parentless replies use message order', () => {
  const { rounds, unassigned } = groupConversation([answer('orphan', 'missing'), user('q', '你好'), answer('legacy'), answer('unknown', 'deleted')], 'done')
  assert.deepEqual(rounds[0].messages.map(m => m.info.id), ['q', 'legacy'])
  assert.deepEqual(unassigned.map(m => m.info.id), ['orphan', 'unknown'])
})
test('parent cycles terminate and missing message IDs retain legacy user content once', () => {
  const { rounds, unassigned } = groupConversation([user(undefined, '旧问题'), answer('legacy'), answer('a', 'b'), answer('b', 'a')])
  assert.equal(rounds[0].title, '旧问题'); assert.equal(rounds[0].messages.length, 2); assert.equal(unassigned.length, 2)
})
test('completed tool calls with nonzero exits are failures; unknown exits are not invented', () => {
  assert.equal(toolResult({ tool:'bash', state:{status:'completed',metadata:{exit:1}} }).failed,true)
  assert.equal(toolResult({ tool:'shell', state:{status:'completed',metadata:{exitCode:'-1'}} }).exit,-1)
  assert.equal(toolResult({ tool:'bash', state:{status:'completed',metadata:{exit:0}} }).failed,false)
  assert.equal(toolResult({ tool:'bash', state:{status:'completed'} }).exit,null)
  assert.equal(toolResult({ tool:'read', state:{status:'error'} }).failed,true)
})
test('later successful question never overwrites earlier failure and stopping applies only to latest', () => {
  const bad=answer('a1','q1');bad.parts=[{type:'tool',tool:'bash',state:{status:'completed',metadata:{exit:1}}}]
  const messages=[user('q1','测试'),bad,user('q2','修复'),answer('a2','q2')]
  assert.deepEqual(groupConversation(messages,'done').rounds.map(r=>r.status),['failed','done'])
  assert.deepEqual(groupConversation(messages,'stopped').rounds.map(r=>r.status),['failed','stopped'])
  assert.equal(groupConversation(messages,'running').rounds[1].status,'running')
})
test('compaction is not counted as a user question; missing times are not taken from task update time', () => {
  const messages=[{info:{id:'compact',role:'user'},parts:[{type:'compaction'}]}, {info:{id:'q',role:'user'},parts:[{type:'file',filename:'code.py'}]}]
  const summary=questionSummaries({messages,status:'done',updatedAt:'2026-10-28T10:00:00Z'})
  assert.equal(summary.length,1);assert.equal(summary[0].title,'附件问题');assert.equal(summary[0].createdAt,undefined)
})
test('history includes question summaries without outputs, preserves role/trash filters and does not write records', () => {
  const service=new CodeAssistantService({}), task={id:'task',roleId:'developer',title:'项目',cwd:'C:/项目',status:'done',updatedAt:'2026-10-28',messages:[user('q1','第一问'),answer('a1','q1','private output'),user('q2','第二问')]}
  service.tasks.set(task.id,task);service.tasks.set('other',{...task,id:'other',roleId:'other'})
  const before=JSON.stringify([...service.tasks]), rows=service.history('developer').tasks
  assert.equal(rows.length,1);assert.equal(rows[0].questions.length,2);assert(!JSON.stringify(rows).includes('private output'))
  assert.equal(JSON.stringify([...service.tasks]),before)
  service.historyProjects.set(service.historyProjectKey('developer',task.cwd),{roleId:'developer',cwd:task.cwd,removedAt:'now'})
  assert.equal(service.history('developer').tasks.length,0)
})
