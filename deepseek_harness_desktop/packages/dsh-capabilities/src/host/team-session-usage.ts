import { relative, isAbsolute, sep } from 'node:path'
import type { Session, SessionEvent } from '@deepseek-ai/dsh-session'
import type { State } from '../core/model.ts'
import { roleForPreset } from '../core/policy.ts'
import type { ContributionReporter } from '../core/team-contributions.ts'
import type { ManagedSkills } from '../../../dsh-skill-explorer/src/managed.ts'

/** Listens only to live events; no transcript scanning or inherited/forked-history counting. */
export class TeamSessionUsage {
  private calls=new Map<string,string>()
  constructor(private state:()=>State,private skills:()=>ReturnType<ManagedSkills['read']>['skills'],private record:ContributionReporter){}
  event(session:Pick<Session,'id'|'header'|'firstLiveSeq'>,event:SessionEvent){
    if(event.seq<session.firstLiveSeq)return
    const prefix=session.id+':',found=roleForPreset(this.state(),session.header.agentPreset)
    if(event.type==='user/message'&&event.data.source.kind==='user'&&found)this.record('role',found.role.id,prefix+event.seq)
    if(event.type==='tool/call'&&event.data.name==='skill'){
      let name:unknown;try{name=JSON.parse(event.data.arguments).name}catch{return}
      const bound=found?.version.skills?.find(s=>s.enabled&&s.name===name)
      const skills=this.skills().filter(s=>s.name===name&&!s.removed&&s.enabled)
      const candidates=skills.filter(s=>{if(s.scope==='global')return true;if(!session.header.cwd)return false;const path=relative(s.scope,session.header.cwd);return path!=='..'&&!path.startsWith('..'+sep)&&!isAbsolute(path)})
      const id=bound?.id??candidates.find(s=>s.scope!=='global')?.id??candidates[0]?.id
      if(id)this.calls.set(prefix+event.data.callId,id)
    }
    if(event.type==='tool/result'){
      const block=event.data.message.content[0],key=prefix+block.toolCallId,id=this.calls.get(key);this.calls.delete(key)
      if(id&&!block.isError&&!event.data.error)this.record('skill',id,key)
    }
    if(event.type==='turn/end')for(const key of this.calls.keys())if(key.startsWith(prefix))this.calls.delete(key)
  }
}
