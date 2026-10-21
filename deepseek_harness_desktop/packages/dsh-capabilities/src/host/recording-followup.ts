import { latest, type State, type Action } from '../core/model.ts'
import { allowedActions } from '../core/policy.ts'
import { MEETING_CAPABILITY_ID } from '../core/default-roles.ts'
import { InputError, object } from '../core/validation.ts'
import type { RecordingService } from './recording.ts'
import type { MeetingService } from './meeting.ts'
const choices=[{id:'transcribe',action:'followup-transcribe',label:'转为文字'},{id:'quick',action:'followup-quick',label:'快速生成纪要'},{id:'guided',action:'followup-guided',label:'引导整理'}] as const
/** The adapter owns workflow links; recording capture has no meeting dependency. */
export class RecordingFollowupService {
 private pending=new Map<string,Promise<unknown>>()
 constructor(private recording:RecordingService,private meeting:MeetingService,private state:()=>State){}
 options(id:string){
  const row=this.recording.get(id),state=this.state(),role=state.roles.find(r=>r.id===row.roleId),version=role&&latest(role.versions)
  const empty={choices:[] as {id:string;label:string}[],link:row.followup,roleVersion:version?.version,capabilityId:'',capabilityVersion:0}
  if(!version||!role?.enabled||role.removedAt||role.archivedAt)return empty
  const granted=allowedActions(state,role.id,version)
  for(const binding of version.capabilities){
   if(!binding.enabled)continue
   const cap=state.capabilities.find(c=>c.id===binding.capabilityId),def=cap?.versions.find(v=>v.version===binding.version)
   if(!cap?.enabled||cap.removedAt||!def?.components.some(p=>p.componentId==='recording-followup')||def.followupTarget!==MEETING_CAPABILITY_ID)continue
   const target=version.capabilities.find(b=>b.capabilityId===def.followupTarget&&b.enabled)
   if(!target||!granted.includes('transcribe'))continue
   const actions=def.components.find(p=>p.componentId==='recording-followup')!.actions
   return {...empty,capabilityId:cap.id,capabilityVersion:def.version,choices:choices.filter(c=>actions.includes(c.action)&&(!binding.actions||binding.actions.includes(c.action))&&granted.includes(c.action as Action)).map(({id,label})=>({id,label}))}
  }
  return empty
 }
 async start(input:unknown){
  const body=object(input),id=String(body.id||'')
  if(this.pending.has(id))return this.pending.get(id)
  const task=this.run(id,body);this.pending.set(id,task)
  try{return await task}finally{this.pending.delete(id)}
 }
 private async run(id:string,body:Record<string,unknown>){
  const available=this.options(id),operation=String(body.operation||'')
  if(!available.choices.some(c=>c.id===operation))throw new InputError('当前岗位未启用此录音后续处理操作',409)
  const row=this.recording.get(id),path=this.recording.audioFile(id)
  if(row.followup){
   let job=await this.meeting.get(row.followup.jobId)
   if(!job.size)job=await this.meeting.importSavedAudio(job.id,path)
   return {link:row.followup,job}
  }
  const job=await this.meeting.create({title:row.title,fileName:row.audio,mode:operation==='quick'?'quick':'guided',audience:body.audience||'',focus:body.focus||'',summaryModel:body.summaryModel||'',roleId:row.roleId,roleVersion:available.roleVersion},id)
  const link={jobId:job.id,operation,roleVersion:available.roleVersion!,capabilityId:available.capabilityId,capabilityVersion:available.capabilityVersion}
  await this.recording.linkFollowup(id,link)
  return {link,job:await this.meeting.importSavedAudio(job.id,path)}
 }
}
