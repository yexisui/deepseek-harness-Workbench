import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { ManagedSkills } from '../../../dsh-skill-explorer/src/managed.ts'
import { contributionCatalog, contributionKey, type ContributionMember, type ContributionReporter, type ContributionCount, type ContributionSnapshot } from '../core/team-contributions.ts'
import type { State } from '../core/model.ts'
import { InputError, object, text } from '../core/validation.ts'

type Config = { schema:1; revision:number; members:ContributionMember[]; owners:Record<string,string> }
type Usage = { schema:1; startedAt:string; days:Record<string,Record<string,ContributionCount>>; seen:string[] }
const dateKey=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`

/** Only IDs, roster fields and aggregate counters are stored, never task content. */
export class TeamContributions {
  private config:Config={schema:1,revision:0,members:[],owners:{}}
  private usage:Usage={schema:1,startedAt:'',days:{},seen:[]}
  private seen=new Set<string>()
  private configTail:Promise<unknown>=Promise.resolve()
  private usageTail:Promise<unknown>=Promise.resolve()
  private dirty=false
  private configError=''
  private usageError=''
  private ready=false
  private timer?:ReturnType<typeof setTimeout>
  private skills:ManagedSkills
  readonly root:string
  constructor(home:string,private state:()=>State,private clock:()=>Date=()=>new Date()) {this.root=join(home,'team-contributions');this.skills=new ManagedSkills(home,()=>[])}
  private async read<T>(name:string,fallback:T):Promise<T>{try{return JSON.parse(await readFile(join(this.root,name),'utf8'))}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return fallback;throw e}}
  private async save(name:string,value:unknown){await mkdir(this.root,{recursive:true});const file=join(this.root,name),tmp=file+'.'+randomUUID()+'.tmp';try{await writeFile(tmp,JSON.stringify(value),{mode:0o600});await rename(tmp,file)}finally{await rm(tmp,{force:true}).catch(()=>{})}}
  async init(){
    try{const value=await this.read('settings.json',this.config);if(value.schema!==1||!Number.isSafeInteger(value.revision)||!Array.isArray(value.members)||!value.owners||typeof value.owners!=='object')throw Error();this.config=value}catch{this.configError='团队配置无法读取，请检查 team-contributions/settings.json；原文件未被覆盖。'}
    try{const value=await this.read('usage.json',{...this.usage,startedAt:this.clock().toISOString()});if(value.schema!==1||!Array.isArray(value.seen)||!value.days||!Number.isFinite(Date.parse(value.startedAt)))throw Error();this.usage=value;this.seen=new Set(value.seen);await this.save('usage.json',value);this.ready=true}catch{this.usageError='使用统计存储不可用，当前未采集新计数；请检查 team-contributions/usage.json 后重启工作台。'}
  }
  catalog(){return contributionCatalog(this.state(),this.skills.read().skills)}
  snapshot(period='30'):ContributionSnapshot{
    if(this.configError)throw new InputError(this.configError,503)
    if(!['7','30','all'].includes(period))throw new InputError('统计周期无效')
    const from=this.clock();from.setHours(0,0,0,0);if(period!=='all')from.setDate(from.getDate()-Number(period)+1)
    const start=period==='all'?'':dateKey(from),end=dateKey(this.clock()),counts:Record<string,ContributionCount>={}
    for(const [day,items] of Object.entries(this.usage.days))if(day>=start&&day<=end)for(const [key,value] of Object.entries(items)){const previous=counts[key];counts[key]={count:(previous?.count??0)+value.count,lastAt:previous&&previous.lastAt>value.lastAt?previous.lastAt:value.lastAt}}
    return {revision:this.config.revision,members:structuredClone(this.config.members),owners:{...this.config.owners},entries:this.catalog(),counts,startedAt:this.usage.startedAt,syncedAt:this.clock().toISOString(),warning:this.usageError}
  }
  async change(raw:unknown){
    const work=this.configTail.then(async()=>{
      if(this.configError)throw new InputError(this.configError,503)
      const body=object(raw);if(body.revision!==this.config.revision)throw new InputError('团队配置已在其他页面更新，请刷新后重新保存',409)
      const next=structuredClone(this.config),type=body.type
      if(type==='members.save'||type==='members.import'){
        const incoming=type==='members.save'?[body.member]:body.members
        if(!Array.isArray(incoming)||!incoming.length||incoming.length>1000)throw new InputError('每次可保存 1–1000 位成员')
        const employeeIds=new Set<string>()
        for(const value of incoming){const row=object(value),employeeId=text(row.employeeId,'工号',64,true).trim(),name=text(row.name,'姓名',80,true).trim(),department=text(row.department??'','部门',120).trim();if(!employeeId||!name||/[\r\n\x00-\x1f]/.test(employeeId+name+department))throw new InputError('工号、姓名和部门不能包含控制字符或空姓名');const normalized=employeeId.toLocaleLowerCase();if(employeeIds.has(normalized))throw new InputError('名单包含重复工号：'+employeeId);employeeIds.add(normalized)
          const existing=type==='members.save'&&row.id?next.members.find(m=>m.id===row.id):next.members.find(m=>m.employeeId.toLocaleLowerCase()===normalized)
          if(type==='members.save'&&row.id&&!existing)throw new InputError('成员已被移除，请刷新',409)
          if(next.members.some(m=>m.id!==existing?.id&&m.employeeId.toLocaleLowerCase()===normalized))throw new InputError('工号已存在：'+employeeId)
          const member={id:existing?.id??randomUUID(),employeeId,name,department};if(existing)Object.assign(existing,member);else next.members.push(member)
        }
        if(next.members.length>10000)throw new InputError('最多保存 10000 位成员')
      }else if(type==='members.remove'){
        const id=text(body.id,'成员',100,true);if(!next.members.some(m=>m.id===id))throw new InputError('成员不存在',404);next.members=next.members.filter(m=>m.id!==id);for(const [key,owner] of Object.entries(next.owners))if(owner===id)delete next.owners[key]
      }else if(type==='owner.set'){
        const key=text(body.key,'贡献条目',200,true);if(!this.catalog().some(e=>e.key===key))throw new InputError('条目已被移除，请刷新',409)
        if(body.memberId){const id=text(body.memberId,'贡献人',100,true);if(!next.members.some(m=>m.id===id))throw new InputError('贡献人不存在，请重新选择',409);next.owners[key]=id}else delete next.owners[key]
      }else throw new InputError('未知团队操作')
      next.revision++;await this.save('settings.json',next);this.config=next;return {revision:next.revision}
    });this.configTail=work.catch(()=>{});return work
  }
  record:ContributionReporter=(kind,id,eventId=randomUUID())=>{
    if(!this.ready||!id)return
    const key=contributionKey(kind,id),hash=createHash('sha256').update(key+'\0'+eventId).digest('hex');if(this.seen.has(hash))return
    const now=this.clock(),day=dateKey(now),items=this.usage.days[day]??={};items[key]={count:(items[key]?.count??0)+1,lastAt:now.toISOString()};this.seen.add(hash);this.usage.seen.push(hash)
    if(this.usage.seen.length>50000)this.seen.delete(this.usage.seen.shift()!)
    this.dirty=true;if(!this.timer)this.timer=setTimeout(()=>{this.timer=undefined;void this.flush()},200)
  }
  async flush(){
    if(this.timer){clearTimeout(this.timer);this.timer=undefined}
    const work=this.usageTail.then(async()=>{if(!this.dirty)return;const value=structuredClone(this.usage);this.dirty=false;try{await this.save('usage.json',value);this.usageError=''}catch{this.dirty=true;this.usageError='部分统计尚未保存到磁盘，请检查存储空间；当前界面仍显示内存计数。'}});this.usageTail=work.catch(()=>{});await work
  }
  async close(){await this.configTail;await this.flush();this.ready=false}
}
