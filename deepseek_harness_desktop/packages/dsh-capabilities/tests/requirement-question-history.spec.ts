import {expect,it} from 'vitest'
import {requirementQuestionHistory,syncRequirementQuestionRun} from '../src/core/requirement-question-history.ts'
import {emptyTemplateWorkspace} from '../src/core/requirement-template.ts'
import type {RequirementTask} from '../src/core/requirements-model.ts'
const task=()=>({template:emptyTemplateWorkspace(),messages:[]} as unknown as RequirementTask)
it('reads old successful answers and the last failed question without writing to the task',()=>{
 const t=task();t.template!.answers=[{id:'old',question:'旧问题',answer:'旧答案',at:'2026-10-26T01:00:00Z',sources:[]}];t.run={id:'failed',templateAction:'ask',status:'error',instruction:'失败问题',startedAt:'2026-10-26T02:00:00Z',error:'原错误'} as never
 const before=structuredClone(t),rows=requirementQuestionHistory(t);expect(rows).toHaveLength(2);expect(rows[0]).toMatchObject({question:'失败问题',status:'error',error:'原错误'});expect(rows[1].answer?.answer).toBe('旧答案');expect(rows[1].sources).toBeUndefined();expect(t).toEqual(before)
})
it('matches repeated questions by run id and never assigns an older answer to a failed retry',()=>{
 const t=task();t.messages=[{id:'m1',runId:'one',role:'user',text:'相同问题',createdAt:'2026-10-26T01:00:00Z',questionRun:{status:'ready'}},{id:'m2',runId:'two',role:'user',text:'相同问题',createdAt:'2026-10-26T02:00:00Z',questionRun:{status:'error',error:'失败'}}]
 t.template!.answers=[{id:'a1',runId:'one',question:'相同问题',answer:'第一次答案',at:'2026-10-26T01:00:02Z',sources:[]}]
 const rows=requirementQuestionHistory(t);expect(rows).toHaveLength(2);expect(rows[0].answer).toBeUndefined();expect(rows[1].answer?.answer).toBe('第一次答案')
})
it('does not duplicate a legacy completed run and preserves its recorded time',()=>{
 const t=task();t.messages=[{id:'m1',runId:'one',role:'user',text:'旧问题',createdAt:'2026-10-26T01:00:00Z'}];t.template!.answers=[{id:'a1',question:'旧问题',answer:'旧答案',at:'2026-10-26T01:00:02Z',sources:[]}];t.run={id:'one',templateAction:'ask',status:'ready',instruction:'旧问题',startedAt:'2026-10-26T01:00:00Z',finishedAt:'2026-10-26T01:00:03Z'} as never
 syncRequirementQuestionRun(t);const rows=requirementQuestionHistory(t);expect(rows).toHaveLength(1);expect(rows[0].answer?.answer).toBe('旧答案');expect(rows[0].at).toBe(t.messages[0].createdAt);expect(rows[0].sources).toBeUndefined()
})
