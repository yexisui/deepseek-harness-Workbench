import { randomUUID } from 'node:crypto'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-tools'
import type { UserMessage } from '@deepseek-ai/dsh-llm'
import type { JevRun, JevService } from './service.ts'
const notice=(text:string):UserMessage=>({id:randomUUID() as UserMessage['id'],role:'user',content:[{type:'text',text}],source:{kind:'plugin',plugin:'@linxin666/dsh-jev-mode',form:'notice',summary:text.slice(0,120)}})
/** Public host hooks; original final tool guards still enforce role permissions. */
export function installNative(ctx:Context,service:JevService) {
  const runs=new Map<string,{turn:number;run:JevRun;reviewed:boolean;input:unknown;start:number;restrictTools?:boolean}>(),previous=new Map<string,boolean>()
  const disposers=[
    ctx.on('agent/pre-step',async({agent,turn,messages,signal},next)=>{
      const accepted=await next();if(accepted.kind!=='enter')return accepted
      let entry=runs.get(agent.id)
      if(!entry||entry.turn!==turn){
        entry={turn,run:service.begin('native:'+agent.id),reviewed:false,input:messages,start:agent.session.snapshotEvents().length};runs.set(agent.id,entry)
        const result=await entry.run.check('begin',{messages:accepted.messages},signal),wasEnabled=previous.get(agent.id)??agent.session.snapshotEvents().some(e=>e.type==='user/message'&&e.data.source.kind==='plugin'&&e.data.source.plugin==='@linxin666/dsh-jev-mode');previous.set(agent.id,entry.run.enabled)
        if(result)return {...accepted,messages:[...accepted.messages,notice(`JEV 本轮已开启（配置 v${entry.run.snapshot.revision}，决策模型 ${entry.run.snapshot.value.model}）。沿用岗位职责与权限；依据不足先澄清。${entry.run.guidance()}`)]}
        if(wasEnabled)return {...accepted,messages:[...accepted.messages,notice('JEV 本轮已关闭，先前 JEV 评估仅为历史记录，本轮按当前岗位和用户要求处理。')]}
      }
      return accepted
    }),
    ctx.on('tools/pre-execute',async(exec,next)=>{
      const original=await next();if(original.kind==='deny')return original
      const entry=exec.agent&&runs.get(exec.agent.id);if(!entry?.run.enabled)return original
      if(entry.restrictTools)return {kind:'deny',reason:'JEV 结果需要确认，本轮只补充说明；请确认后发起新一轮动作'}
      try{await entry.run.check('action',{input:entry.input,tool:exec.name,args:exec.arguments,authority:'JEV 不授予权限，仍须通过现有岗位授权检查'},exec.signal);return original}catch(e){return {kind:'deny',reason:(e as Error).message}}
    }),
    ctx.on('agent/turn-stopping',async({agent,turn,signal})=>{
      const entry=runs.get(agent.id);if(!entry||entry.turn!==turn||entry.reviewed||!entry.run.enabled)return
      entry.reviewed=true
      const events=agent.session.snapshotEvents().slice(entry.start).filter(e=>['assistant/message','tool/result'].includes(e.type)).slice(-8)
      const result=await entry.run.check('review',{input:entry.input,results:events},signal)
      if(result?.decision==='clarify'){entry.restrictTools=true;agent.steer(notice(`JEV 结果复核提示：${result.summary}。补充待确认项，纠正缺乏证据的完成声明；保留已经执行动作的真实状态，不要再次自动执行。`))}
    }),
    ctx.on('agent/status',({agent,status})=>{if(status==='idle')runs.delete(agent.id)}),
    ctx.on('agent/disposed',({agent})=>{runs.delete(agent.id);previous.delete(agent.id)}),
  ]
  return ()=>{disposers.forEach(dispose=>dispose());runs.clear();previous.clear()}
}
