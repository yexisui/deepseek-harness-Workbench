import { afterEach, expect, it, vi } from 'vitest'
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { TeamContributions } from '../src/host/team-contributions.ts'
import { TeamSessionUsage } from '../src/host/team-session-usage.ts'
import { contributionCatalog, parseMemberImport } from '../src/core/team-contributions.ts'
import { ExecutionStore } from '../../../shared/host/execution.ts'
import { CapabilityStore } from '../src/host/store.ts'
import { CapabilityPackages } from '../src/host/packages.ts'
import { PackageRunner } from '../src/host/package-runner.ts'
import { packageZip } from '../src/host/package-archive.ts'
import { checkPackage } from '../src/host/package-archive.ts'
import { packageActionId } from '../src/core/distribution.ts'
import type { State } from '../src/core/model.ts'
const roots:string[]=[],stores:TeamContributions[]=[]
afterEach(async()=>{for(const s of stores.splice(0))await s.close();for(const root of roots.splice(0))await rm(root,{recursive:true,force:true})})
function state():State{return {capabilities:[{id:'browser',source:'builtin',enabled:true,draft:{name:'浏览器操作',description:'浏览网页'},versions:[]}],roles:[{id:'custom-role',enabled:true,draft:{name:'新助手',duties:'处理业务',color:'#4F73E8',capabilities:[{capabilityId:'browser',enabled:true}],skills:[{id:'skill-one',enabled:true,name:'sample'}]},versions:[]}]} as unknown as State}
async function setup(clock?:()=>Date){const home=await mkdtemp(join(tmpdir(),'team-contribution-'));roots.push(home);const current=state(),service=new TeamContributions(home,()=>current,clock);stores.push(service);await service.init();return {home,current,service}}
async function member(service:TeamContributions,id='001',name='测试成员'){await service.change({type:'members.save',revision:service.snapshot().revision,member:{employeeId:id,name,department:'业务部'}});return service.snapshot().members.find(m=>m.employeeId===id)!}
it('projects newly imported objects immediately and preserves owner through rename, disable and archive',async()=>{
 const {service,current,home}=await setup(),person=await member(service)
 await service.change({type:'owner.set',revision:1,key:'role:custom-role',memberId:person.id})
 current.roles[0]!.draft.name='更名后的助手';current.roles[0]!.enabled=false;current.roles[0]!.archivedAt=new Date().toISOString()
 const cap=structuredClone(current.capabilities[0]!);cap.id='new-import';cap.draft.name='新导入能力';current.capabilities.push(cap)
 await mkdir(join(home,'skill-management'));await writeFile(join(home,'skill-management/state.json'),JSON.stringify({revision:1,skills:[{id:'skill-one',name:'sample',description:'导入技能',scope:'global',enabled:true}]}))
 const snapshot=service.snapshot();expect(snapshot.entries.map(e=>e.name)).toContain('新导入能力');expect(snapshot.entries.find(e=>e.kind==='role')).toMatchObject({name:'更名后的助手',archived:true,enabled:false,related:['capability:browser','skill:skill-one']});expect(snapshot.owners['role:custom-role']).toBe(person.id)
 current.roles[0]!.removedAt=new Date().toISOString();expect(service.snapshot().entries.some(e=>e.kind==='role')).toBe(false)
})
it('imports atomically by employee ID, keeps identities and ownership, and rejects duplicates and stale edits',async()=>{
 const {service}=await setup(),person=await member(service)
 await service.change({type:'owner.set',revision:1,key:'capability:browser',memberId:person.id})
 await service.change({type:'members.import',revision:2,members:[{employeeId:'001',name:'更新姓名',department:'数字应用部'},{employeeId:'002',name:'第二人',department:''}]})
 expect(service.snapshot().members[0]).toMatchObject({id:person.id,name:'更新姓名'});expect(service.snapshot().owners['capability:browser']).toBe(person.id)
 await expect(service.change({type:'members.import',revision:3,members:[{employeeId:'003',name:'有效'},{employeeId:'003',name:'重复'}]})).rejects.toThrow('重复工号');expect(service.snapshot().members).toHaveLength(2)
 await expect(service.change({type:'owner.set',revision:2,key:'capability:browser',memberId:''})).rejects.toThrow('已在其他页面更新')
 await expect(service.change({type:'owner.set',revision:3,key:'capability:missing',memberId:person.id})).rejects.toThrow('条目已被移除')
 await service.change({type:'members.remove',revision:3,id:person.id});expect(service.snapshot().owners).toEqual({});expect(service.snapshot().entries).toHaveLength(2)
})
it('serializes concurrent changes so two writers cannot silently overwrite one another',async()=>{const {service}=await setup();const results=await Promise.allSettled(['A','B'].map(name=>service.change({type:'members.save',revision:0,member:{employeeId:name,name}})));expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(service.snapshot().members).toHaveLength(1)})
it('persists distinct metrics, deduplicates across restart, and uses inclusive local calendar days',async()=>{
 let date=new Date(2026,9,27,12),clock=()=>new Date(date);const {service,home,current}=await setup(clock)
 service.record('capability','browser','run1');service.record('capability','browser','run1');service.record('role','custom-role','run1');service.record('skill','skill-one','load1');await service.flush()
 date=new Date(2026,10,3,12);expect(service.snapshot('7').counts).toEqual({});expect(service.snapshot('30').counts['capability:browser']?.count).toBe(1)
 const next=new TeamContributions(home,()=>current,clock);stores.push(next);await next.init();next.record('capability','browser','run1');expect(next.snapshot('all').counts['capability:browser']?.count).toBe(1)
 next.record('capability','browser','run2');expect(next.snapshot('7').counts['capability:browser']?.count).toBe(1);await next.flush()
 const disk=await readFile(join(home,'team-contributions/usage.json'),'utf8');expect(disk).not.toContain('run1');expect(disk).not.toContain('prompt');expect(next.snapshot('all').members).toEqual([])
})
it('keeps corrupt files and explicitly reports unavailable state',async()=>{
 const {service,home,current}=await setup();await service.close();await writeFile(join(home,'team-contributions/usage.json'),'broken')
 const next=new TeamContributions(home,()=>current);stores.push(next);await next.init();next.record('capability','browser','x');expect(next.snapshot().warning).toContain('未采集');expect(await readFile(join(home,'team-contributions/usage.json'),'utf8')).toBe('broken')
 await writeFile(join(home,'team-contributions/settings.json'),'broken');const other=new TeamContributions(home,()=>current);stores.push(other);await other.init();expect(()=>other.snapshot()).toThrow('原文件未被覆盖');await expect(other.change({})).rejects.toThrow('原文件未被覆盖')
})
it('reports write failures without failing business recording and retries safely',async()=>{const {service}=await setup();const failure=vi.spyOn(service as any,'save').mockRejectedValue(Error('disk full'));service.record('capability','browser','first');await service.flush();expect(service.snapshot().warning).toContain('尚未保存');expect(service.snapshot().counts['capability:browser']?.count).toBe(1);failure.mockRestore();await service.flush();expect(service.snapshot().warning).toBe('')})
it('parses Excel TSV, BOM and escaped CSV; rejects malformed or oversized input',()=>{expect(parseMemberImport('\uFEFF工号,姓名,部门\n001,"林,南","数字""应用部"')).toEqual([{employeeId:'001',name:'林,南',department:'数字"应用部'}]);expect(parseMemberImport('工号\t姓名\t部门\r\n002\t李文\t测试部')[0]?.employeeId).toBe('002');expect(()=>parseMemberImport('姓名,部门\n测试,业务')).toThrow('第一行');expect(()=>parseMemberImport('工号,姓名,部门\n1,"坏,行')).toThrow('未闭合')})
it('does not count injected context, inherited history or failed skill loads',()=>{
 const record=vi.fn(),s=state(),version={...s.roles[0]!.draft,version:1,preset:'role-test'};s.roles[0]!.versions=[version] as any
 const session:any={id:'session',firstLiveSeq:10,header:{agentPreset:'role-test',cwd:'C:/work'}}
 // Resolve the managed preset shape through the public policy below; skill success is independent of role matching.
 const tracker=new TeamSessionUsage(()=>s,()=>[{id:'skill-one',name:'sample',scope:'global',enabled:true}] as any,record)
 const call=(seq:number,id:string)=>tracker.event(session,{seq,type:'tool/call',data:{name:'skill',arguments:'{"name":"sample"}',callId:id}} as any)
 const result=(seq:number,id:string,isError=false)=>tracker.event(session,{seq,type:'tool/result',data:{message:{content:[{toolCallId:id,isError}]}}} as any)
 call(1,'old');result(2,'old');call(10,'failed');result(11,'failed',true);call(12,'ok');result(13,'ok');result(14,'ok')
 tracker.event(session,{seq:15,type:'user/message',data:{source:{kind:'plugin'}}} as any)
 expect(record.mock.calls).toEqual([['skill','skill-one','session:ok']])
 tracker.event(session,{seq:16,type:'user/message',data:{source:{kind:'user'}}} as any)
 expect(record).toHaveBeenLastCalledWith('role','custom-role','session:16')
})
it('automatically discovers a newly installed package and counts its real worker execution without registration',async()=>{
 const home=await mkdtemp(join(tmpdir(),'team-real-import-'));roots.push(home)
 const store=new CapabilityStore(join(home,'capabilities'));await store.init();const packs=new CapabilityPackages(store);await packs.init();const runner=new PackageRunner(packs,async()=>{throw Error('No model needed')});await runner.init()
 const team=new TeamContributions(home,()=>store.snapshot());stores.push(team);await team.init();runner.reportUsage=team.record
 try{
  const dir=join(home,'author');await mkdir(join(dir,'runtime'),{recursive:true});await writeFile(join(dir,'runtime/main.cjs'),"exports.execute=async({input})=>({answer:input.value+1})")
  await writeFile(join(dir,'capability.json'),JSON.stringify({schema:1,protocol:'dsh-worker-v1',id:'org.test.team',version:'1.0.0',name:'自动同步测试能力',description:'真实导入测试',instructions:'返回值加一',author:'测试',license:'MIT',permissions:['node'],components:[{id:'main',name:'主组件',entry:'runtime/main.cjs',actions:[{id:'run',name:'运行',description:'返回结果'}]}],files:{'runtime/main.cjs':'auto'}}))
  const pack=await checkPackage(dir,true),zip=packageZip(pack.files),{token}=await packs.start('zip');await packs.put(token,'ability.zip',(async function*(){yield zip})());const preview=await packs.inspect(token),installed=await packs.install(token,preview.hash,preview.revision,{trusted:true,draft:'keep'})
  expect(team.snapshot().entries.some(e=>e.id===installed.id&&e.name==='自动同步测试能力')).toBe(true);expect(team.snapshot().counts['capability:'+installed.id]).toBeUndefined()
  const run=await runner.start(installed.id,1,packageActionId('org.test.team','main','run'),{value:3});expect(await run.done).toEqual({answer:4});expect(team.snapshot().counts['capability:'+installed.id]?.count).toBe(1)
  await store.command(store.snapshot().revision,{type:'capability.toggle',id:installed.id,enabled:false});await expect(runner.start(installed.id,1,packageActionId('org.test.team','main','run'),{})).rejects.toThrow('未获授权');expect(team.snapshot().counts['capability:'+installed.id]?.count).toBe(1)
 }finally{await runner.close();await packs.close();await store.close()}
})
it('reports actual execution starts while identifying nested stages and never counts opening history',async()=>{
 const {home}=await setup(),store=new ExecutionStore(join(home,'executions')),events:any[]=[];await store.init();store.onStart=e=>events.push(e)
 await store.run(randomUUID(),{operation:'顶层',input:'private input',usage:{roleId:'custom-role',capabilityIds:['browser']}},async()=>store.run(randomUUID(),{operation:'自动阶段',input:'private input',usage:{roleId:'custom-role',capabilityIds:['browser']}},async()=>true,()=>({status:'done'})),()=>({status:'done'}))
 expect(events.map(e=>e.nested)).toEqual([false,true]);expect(JSON.stringify(events)).not.toContain('private input');expect(events.every(e=>e.roleId==='custom-role')).toBe(true)
})
