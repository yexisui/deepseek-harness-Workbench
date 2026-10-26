import type { RequirementTask, RequirementQuestionRun } from './requirements-model.ts'
import type { TemplateAnswer } from './requirement-template.ts'

export type RequirementQuestionEntry = RequirementQuestionRun & { id:string; question:string; at:string; answer?:TemplateAnswer }

/** Keep status on the original question, including failures, stops and restarts. */
export function syncRequirementQuestionRun(task:RequirementTask) {
  const run=task.run
  if(run?.templateAction!=='ask')return
  const question=task.messages.find(message=>message.role==='user'&&message.runId===run.id)
  if(question)question.questionRun={...question.questionRun,status:run.status,finishedAt:run.finishedAt,error:run.error}
}

/** Read old answers without migrating or inventing their original reference scope. */
export function requirementQuestionHistory(task?:RequirementTask):RequirementQuestionEntry[] {
  if(!task?.template)return []
  const answers=task.template.answers,used=new Set<string>(),rows:RequirementQuestionEntry[]=[],latest=task.run?.templateAction==='ask'?task.run:undefined
  const questions=task.messages.filter(message=>message.role==='user'&&(message.questionRun||message.runId===latest?.id))
  for(const message of questions){
    const run=message.questionRun??(message.runId===latest?.id?latest:undefined)
    if(!run)continue
    const answer=answers.find(a=>!used.has(a.id)&&a.runId===message.runId&&!!a.runId)??(run.status==='ready'?answers.find(a=>!used.has(a.id)&&!a.runId&&a.question===message.text&&a.at>=message.createdAt&&(!run.finishedAt||a.at<=run.finishedAt)):undefined)
    if(answer)used.add(answer.id)
    rows.push({id:message.runId??message.id,question:message.text,at:message.createdAt,status:run.status,finishedAt:run.finishedAt,error:run.error,sources:message.questionRun?.sources,answer})
  }
  if(latest&&!questions.some(message=>message.runId===latest.id)&&latest.status!=='ready')rows.push({id:latest.id,question:latest.instruction,at:latest.startedAt,status:latest.status,finishedAt:latest.finishedAt,error:latest.error})
  for(const answer of answers)if(!used.has(answer.id))rows.push({id:answer.runId??answer.id,question:answer.question,at:answer.at,status:'ready',finishedAt:answer.at,answer})
  return rows.sort((a,b)=>b.at.localeCompare(a.at))
}
