import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { RequirementsService } from '../src/host/requirements.ts'
import { initialState, type State } from '../src/core/model.ts'
import { REQUIREMENTS_CAPABILITY_ID, REQUIREMENTS_ROLE_ID, type RequirementTask, type RequirementCommand } from '../src/core/requirements-model.ts'

const roots:string[]=[],services:RequirementsService[]=[]
afterEach(async()=>{
  for(const service of services.splice(0))await service.close()
  for(const root of roots.splice(0)){if(!resolve(root).startsWith(resolve(tmpdir())+'\\')&&!resolve(root).startsWith(resolve(tmpdir())+'/'))throw Error('Unsafe cleanup');await rm(root,{recursive:true,force:true})}
})
async function setup(model:(prompt:string,route:string,signal?:AbortSignal)=>Promise<string>=async()=>JSON.stringify({summary:'已梳理，请核对。',items:[]})) {
  const root=await mkdtemp(join(tmpdir(),'dsh-requirements-'));roots.push(root)
  const state:State=initialState()
  const service=new RequirementsService(root,model,()=>state,route=>route||'test/model');services.push(service);await service.init()
  const task=await service.create({roleId:REQUIREMENTS_ROLE_ID,mode:'guided',title:'报销需求'})
  const command=async(task:RequirementTask,c:RequirementCommand)=>service.command(task.id,task.revision,c)
  return {root,state,service,task,command}
}
async function finished(service:RequirementsService,id:string) {
  for(let i=0;i<100;i++){const task=await service.get(id);if(task.run?.status!=='running')return task;await new Promise(r=>setTimeout(r,5))}
  throw Error('Test model did not finish')
}
const basic={title:'提交申请',description:'员工提交完整申请后进入审批。',acceptance:'提交后保存申请并显示待审批。',actor:'员工'}

it('cancels the actual analysis when its component is globally stopped and retains the saved draft',async()=>{
 let signal:AbortSignal|undefined
 const env=await setup(async(_prompt,_route,provided)=>{signal=provided;return new Promise((_resolve,reject)=>provided!.addEventListener('abort',()=>reject(new Error('已停止')),{once:true}))})
 const started=await env.command(env.task,{type:'run',operation:'analyze',requestId:randomUUID(),instruction:'整理业务目标'})
 expect((await env.service.componentActivities())[0].componentIds).toEqual(['requirements-service'])
 await env.service.stopComponents(['requirements-service'])
 expect(signal?.aborted).toBe(true);expect((await env.service.get(started.id)).run?.status).toBe('stopped');expect((await env.service.get(started.id)).title).toBe('报销需求')
})

describe('persistent requirements workflow',()=>{
  it('creates one persisted record for repeated draft requests and never overwrites newer work on retry',async()=>{
    const env=await setup(),requestId=randomUUID()
    const request={roleId:REQUIREMENTS_ROLE_ID,requestId,mode:'guided',title:'预约草稿',draft:'希望统一管理会议室预约'}
    const [first,repeated]=await Promise.all([env.service.create(request),env.service.create(request)])
    expect(first.id).toBe(requestId);expect(repeated).toEqual(first)
    expect((await env.service.get(first.id)).draft).toBe(request.draft)
    const changed=await env.command(first,{type:'save',draft:'新增设备借用要求'})
    await env.service.close()
    const reopened=new RequirementsService(env.root,async()=>'',()=>env.state);services.push(reopened);await reopened.init()
    expect(await reopened.create(request)).toEqual(changed)
    expect((await reopened.list()).total).toBe(2)
    await expect(reopened.create({...request,requestId:'../../outside'})).rejects.toThrow('创建请求标识')
    await expect(reopened.create({...request,requestId:randomUUID(),draft:'x'.repeat(60001)})).rejects.toThrow('输入草稿')
    expect((await reopened.list()).total).toBe(2)
    env.state.roles.find(r=>r.id===REQUIREMENTS_ROLE_ID)!.enabled=false
    await expect(reopened.create(request)).rejects.toThrow('岗位未发布')
  })
  it('changes future analysis mode while preserving confirmed work, document versions and pending suggestions',async()=>{
    const env=await setup(async()=>JSON.stringify({summary:'待采用的补充',items:[{kind:'requirement',value:{...basic,title:'查看办理进度'}}]}))
    let task=await env.command(env.task,{type:'requirement.save',requirement:basic})
    task=await env.command(task,{type:'requirement.status',ids:[task.requirements[0]!.id],status:'confirmed'})
    task=await env.command(task,{type:'version.create',selectedIds:[task.requirements[0]!.id],note:'首轮确认'})
    task=await env.command(task,{type:'document.generate',depth:'standard'})
    task=await env.command(task,{type:'run',operation:'clarify',instruction:'提出补充需求',requestId:randomUUID()})
    task=await finished(env.service,task.id)
    const before=structuredClone(task)
    task=await env.command(task,{type:'save',mode:'quick'})
    expect(task.mode).toBe('quick');expect(task.dataRevision).toBe(before.dataRevision)
    for(const key of ['requirements','materials','questions','flows','rules','versions','messages','proposal','document'] as const)expect(task[key]).toEqual(before[key])
    expect(task.requirements[0]!.status).toBe('confirmed');expect(task.requirements).toHaveLength(2)
  })
  it('requires stopping the active run before changing its analysis mode',async()=>{
    const env=await setup(async(_p,_m,signal)=>new Promise((_resolve,reject)=>signal?.addEventListener('abort',()=>reject(new Error('stopped')))))
    let task=await env.command(env.task,{type:'run',operation:'clarify',instruction:'澄清目标',requestId:randomUUID()})
    await expect(env.command(task,{type:'save',mode:'quick'})).rejects.toMatchObject({status:409})
    expect((await env.service.get(task.id)).mode).toBe('guided')
    task=await env.command(task,{type:'run.stop'})
    expect((await env.command(task,{type:'save',mode:'quick'})).mode).toBe('quick')
  })
  it('reports service availability independently of the built-in role and applies role checks when requested',async()=>{
    const env=await setup()
    env.state.roles.find(r=>r.id===REQUIREMENTS_ROLE_ID)!.enabled=false
    expect(env.service.availability().ready).toBe(true)
    expect(env.service.availability(REQUIREMENTS_ROLE_ID).ready).toBe(false)
    env.state.capabilities.find(c=>c.id===REQUIREMENTS_CAPABILITY_ID)!.enabled=false
    expect(env.service.availability().ready).toBe(false)
  })
  it('saves work and defaults across restart, rejects conflicting edits, paginates without deleting tasks',async()=>{
    const env=await setup();let t=await env.command(env.task,{type:'requirement.save',requirement:basic})
    await expect(env.command(env.task,{type:'save',title:'旧页面覆盖'})).rejects.toThrow('已更新')
    t=await env.command(t,{type:'save',draft:'尚未发送的描述'})
    await env.service.configure(0,{depth:'detailed',questionStyle:'short',model:'test/selected'})
    const second=await env.service.create({roleId:REQUIREMENTS_ROLE_ID,title:'第二份分析'})
    expect((await env.service.list(0,1)).total).toBe(2)
    expect((await env.service.list(1,1)).items).toHaveLength(1)
    await env.service.close()
    const reopened=new RequirementsService(env.root,async()=>'',()=>env.state,r=>r||'test/model');services.push(reopened);await reopened.init()
    expect((await reopened.get(t.id)).draft).toBe('尚未发送的描述')
    expect((await reopened.get(t.id)).requirements[0]?.description).toBe(basic.description)
    expect((await reopened.get(second.id)).title).toBe('第二份分析')
    expect(reopened.availability().defaults.model).toBe('test/selected')
  })
  it('automatically applies model output while validating evidence and retaining suggestion provenance',async()=>{
    const env=await setup(async prompt=>{
      const input=JSON.parse(prompt.slice(prompt.indexOf('\n输入（最近30条消息，先前已整理事实在结构化条目内）：\n')+'\n输入（最近30条消息，先前已整理事实在结构化条目内）：\n'.length))
      return JSON.stringify({summary:'整理出两条候选需求。',items:[{kind:'requirement',value:{...basic,status:'confirmed',sources:[{messageId:input.messages.at(-1).id,quote:'员工可以提交申请'}]}},{kind:'requirement',value:{...basic,title:'额外建议',sources:[{materialId:'invented',revision:1,quote:'虚构依据'}]}}]})
    })
    let t=await env.command(env.task,{type:'run',operation:'analyze',instruction:'员工可以提交申请',requestId:randomUUID()});t=await finished(env.service,t.id)
    expect(t.requirements).toHaveLength(2);expect(t.run?.status,t.run?.error).toBe('ready');expect(t.proposal?.items).toHaveLength(2)
    expect(t.proposal!.items.every(i=>i.accepted)).toBe(true)
    expect(t.requirements[0]?.status).toBe('pending');expect(t.requirements[0]?.origin).toBe('source')
    expect(t.requirements).toHaveLength(2);expect(t.requirements[1]?.origin).toBe('assistant');expect(t.requirements[1]?.sources).toEqual([])
    await expect(env.command(t,{type:'requirement.save',requirement:{...basic,sources:[{materialId:'invented',quote:'bad'}]}})).rejects.toThrow('来源引用')
  })
  it('does not apply a proposal over a user edit and deduplicates a repeated run request',async()=>{
    let resolveModel!:(s:string)=>void,calls=0
    const env=await setup(async()=>{calls++;return await new Promise<string>(r=>{resolveModel=r})})
    const request={type:'run' as const,operation:'analyze' as const,instruction:'整理申请功能',requestId:randomUUID()}
    let t=await env.command(env.task,request)
    const repeated=await env.command(env.task,request);expect(repeated.run?.id).toBe(request.requestId);expect(calls).toBe(1)
    t=await env.command(t,{type:'requirement.save',requirement:{...basic,title:'用户手工新增'}})
    resolveModel(JSON.stringify({summary:'分析完成',items:[{kind:'requirement',value:basic}]}));t=await finished(env.service,t.id)
    expect(t.run?.status).toBe('error');expect(t.run?.error).toContain('已被编辑')
    expect((await env.service.get(t.id)).requirements[0]?.title).toBe('用户手工新增')
  })
  it('normalizes model prose arrays and null fields while keeping manual inputs strict',async()=>{
    const env=await setup(async()=>JSON.stringify({summary:'请核对整理结果。',items:[
      {kind:'requirement',value:{...basic,preconditions:null,steps:['填写申请','提交'],acceptance:['申请保存成功','状态显示待审批']}},
      {kind:'flow',value:{name:'提交',actor:'员工',action:['填写','发送'],condition:null}},
      {kind:'overview',value:{roles:['员工','审批人'],background:null}},
    ]}))
    let t=await env.command(env.task,{type:'run',operation:'analyze',instruction:'整理需求',requestId:randomUUID()});t=await finished(env.service,t.id)
    expect(t.run?.status,t.run?.error).toBe('ready')
    expect(t.requirements[0]?.acceptance).toBe('申请保存成功\n状态显示待审批')
    expect(t.flows[0]?.action).toBe('填写\n发送');expect(t.overview.roles).toBe('员工\n审批人')
    await expect(env.command(t,{type:'requirement.save',requirement:{...basic,acceptance:['invalid'] as never}})).rejects.toThrow('acceptance')
  })
  it('enforces acceptance and blocking questions before confirmation, with immutable scoped versions',async()=>{
    const env=await setup();let t=await env.command(env.task,{type:'requirement.save',requirement:{title:'提交'}})
    const id=t.requirements[0]!.id
    await expect(env.command(t,{type:'requirement.status',ids:[id],status:'confirmed'})).rejects.toThrow('验收标准')
    t=await env.command(t,{type:'requirement.save',requirement:{...basic,id,status:'confirmed'}})
    expect(t.requirements[0]?.status).toBe('pending')
    t=await env.command(t,{type:'question.save',question:{question:'审批人是谁？',blocking:true,requirementIds:[id]}})
    await expect(env.command(t,{type:'requirement.status',ids:[id],status:'confirmed'})).rejects.toThrow('关键问题')
    t=await env.command(t,{type:'question.answer',id:t.questions[0]!.id,answer:'部门负责人'})
    await expect(env.command(t,{type:'requirement.status',ids:[id],status:'confirmed'})).rejects.toThrow('关键问题')
    t=await env.command(t,{type:'question.status',id:t.questions[0]!.id,status:'resolved'})
    t=await env.command(t,{type:'requirement.status',ids:[id],status:'confirmed'})
    t=await env.command(t,{type:'version.create',selectedIds:[id],note:'基础需求'})
    const original=JSON.stringify(t.versions[0])
    t=await env.command(t,{type:'requirement.save',requirement:{id,...basic,description:'修改后的审批规则'}})
    expect(t.requirements[0]?.status).toBe('review');expect(JSON.stringify(t.versions[0])).toBe(original)
    t=await env.command(t,{type:'requirement.save',requirement:{...basic,title:'另一个范围'}})
    t=await env.command(t,{type:'version.restore',id:t.versions[0]!.id})
    expect(t.requirements).toHaveLength(2);expect(t.requirements[0]?.description).toBe(basic.description);expect(t.requirements[0]?.status).toBe('review')
  })
  it('preserves source revisions and refreshes generated documents after an edit',async()=>{
    const env=await setup();let t=await env.command(env.task,{type:'material.save',material:{name:'原说明',kind:'text',text:'员工提交报销申请。'}})
    const material=t.materials[0]!
    t=await env.command(t,{type:'requirement.save',requirement:{...basic,sources:[{materialId:material.id,revision:1,quote:'员工提交报销申请。'}]}})
    t=await env.command(t,{type:'requirement.status',ids:[t.requirements[0]!.id],status:'confirmed'})
    t=await env.command(t,{type:'document.generate',depth:'standard'})
    expect(t.document?.dataRevision).toBe(t.dataRevision)
    t=await env.command(t,{type:'material.save',material:{id:material.id,name:'新说明',kind:'text',text:'财务人员代提交报销申请。'}})
    expect(t.materials[0]?.history[0]?.text).toBe('员工提交报销申请。');expect(t.requirements[0]?.status).toBe('review');expect(t.document!.dataRevision).toBe(t.dataRevision)
    t=await env.command(t,{type:'material.remove',id:material.id,removed:true})
    expect(t.requirements[0]?.sources[0]?.revision).toBe(1)
  })
  it('stops late results and never recreates a removed task',async()=>{
    let resolveModel!:(s:string)=>void
    const env=await setup(async()=>await new Promise<string>(r=>{resolveModel=r}))
    let t=await env.command(env.task,{type:'run',operation:'clarify',instruction:'设计审批流程',requestId:randomUUID()})
    t=await env.command(t,{type:'run.stop'});resolveModel(JSON.stringify({summary:'迟到结果',items:[]}))
    expect((await finished(env.service,t.id)).run?.status).toBe('stopped')
    t=await env.command(t,{type:'run',operation:'clarify',instruction:'再次分析',requestId:randomUUID()})
    await env.service.remove(t.id);resolveModel(JSON.stringify({summary:'不应恢复',items:[]}));await new Promise(r=>setTimeout(r,15))
    await expect(env.service.get(t.id)).rejects.toThrow('不存在');expect((await env.service.list()).total).toBe(0)
  })
  it('applies current authorization and permanent session revocation while keeping old results readable',async()=>{
    const env=await setup();let t=await env.command(env.task,{type:'requirement.save',requirement:basic})
    const cap=env.state.capabilities.find(c=>c.id===REQUIREMENTS_CAPABILITY_ID)!
    cap.enabled=false;env.state.revokedAt={['capability:'+cap.id]:Date.now()}
    await expect(env.command(t,{type:'run',operation:'analyze',instruction:'分析',requestId:randomUUID()})).rejects.toThrow('停用')
    cap.enabled=true
    await expect(env.command(t,{type:'run',operation:'analyze',instruction:'分析',requestId:randomUUID()})).rejects.toThrow('撤销')
    t=await env.command(t,{type:'document.generate',depth:'brief'});expect(t.document?.markdown).toContain(basic.title)
  })
  it('keeps authority tied to the published version even when an incomplete capability draft is saved',async()=>{
    const env=await setup();env.state.capabilities.find(c=>c.id===REQUIREMENTS_CAPABILITY_ID)!.draft.components=[]
    const t=await env.command(env.task,{type:'run',operation:'clarify',instruction:'需要报销系统',requestId:randomUUID()})
    expect((await finished(env.service,t.id)).run?.status).toBe('ready')
  })
  it('recovers interrupted runs and rejects traversal and oversized material without model calls',async()=>{
    const env=await setup(async()=>await new Promise<string>(()=>{}))
    let t=await env.command(env.task,{type:'run',operation:'clarify',instruction:'继续访谈',requestId:randomUUID()})
    await env.service.close()
    const fresh=new RequirementsService(env.root,async()=>'',()=>env.state,r=>r||'test/model');services.push(fresh);await fresh.init()
    t=await fresh.get(t.id);expect(t.run?.status).toBe('interrupted')
    await expect(fresh.get('../config')).rejects.toThrow('标识无效')
    await expect(fresh.command(t.id,t.revision,{type:'material.save',material:{name:'too large',kind:'text',text:'a'.repeat(60001)}})).rejects.toThrow('过长')
    expect(JSON.parse(await readFile(join(env.root,`${t.id}.json`),'utf8')).run.status).toBe('interrupted')
  })
  it('preserves requirement references when splitting and merging',async()=>{
    const env=await setup();let t=await env.command(env.task,{type:'requirement.save',requirement:basic});const original=t.requirements[0]!.id
    t=await env.command(t,{type:'question.save',question:{question:'细节待确认',requirementIds:[original]}})
    t=await env.command(t,{type:'requirement.split',id:original,titles:['填写申请','提交申请']})
    const split=t.requirements.filter(r=>!r.removed).map(r=>r.id)
    expect(t.questions[0]?.requirementIds).toEqual(split)
    t=await env.command(t,{type:'requirement.merge',ids:split,title:'完整申请流程'})
    const merged=t.requirements.find(r=>!r.removed)!;expect(t.questions[0]?.requirementIds).toEqual([merged.id]);expect(merged.replaces).toEqual(split)
  })
})
