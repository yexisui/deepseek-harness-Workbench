import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { entryKey, type InventoryEntry } from '../src/core/classification.ts'
import { ClassificationStore } from '../src/host/classification-store.ts'
import { AiClassificationService, type AiClassificationAdapter } from '../src/host/ai-classification.ts'
import { workbenchClassificationAdapter } from '../src/host/ai-classification-adapter.ts'
const homes:string[]=[]
afterEach(()=>homes.splice(0).forEach(h=>rmSync(h,{recursive:true,force:true})))
function setup(count=2){
 const home=mkdtempSync(join(tmpdir(),'plugin-ai-'));homes.push(home)
 let entries:InventoryEntry[]=Array.from({length:count},(_,i)=>({moduleName:'@local/plugin-'+i,entryId:'include:plugin-'+i,enabled:false,fiberPhase:'pending-restart'}))
 const store=new ClassificationStore(home)
 const adapter:AiClassificationAdapter={firstModel:vi.fn(async()=>({provider:'configured',id:'first',name:'第一个模型'})),evidence:()=>({description:'用于网页读取'}),generate:vi.fn(async(_m,_s,p)=>JSON.stringify({results:JSON.parse(p).plugins.map((x:{id:string})=>({id:x.id,moduleId:'core-10',reason:'提供网页读取功能'}))}))}
 const service=new AiClassificationService(store,()=>entries,adapter)
 return {store,adapter,service,entries,setEntries:(e:InventoryEntry[])=>{entries=e}}
}
async function done(service:AiClassificationService){await vi.waitFor(()=>expect(service.status().job?.phase).not.toBe('running'));return service.status()}
it('classifies pending entries, persists custom paths, keeps source facts and supports restart undo',async()=>{
 const {store,service,entries}=setup();const c=store.read(entries);c.modules.find(m=>m.id==='core-10')!.name='网页自定义';store.save(c,entries)
 service.start('request-0001');const status=await done(service)
 expect(status.job?.phase).toBe('done');expect(status.report?.results.every(r=>r.status==='applied'&&r.target.includes('网页自定义'))).toBe(true)
 const reloaded=new ClassificationStore(join(store.file,'../..'));expect(reloaded.read(entries).assignments[entryKey(entries[0]!)]).toBe('core-10')
 expect(reloaded.undoAI('request-0001',entries).results.every(r=>r.status==='undone')).toBe(true)
 expect(reloaded.read(entries).assignments[entryKey(entries[0]!)]).toBe('');expect(entries[0]!.fiberPhase).toBe('pending-restart')
})
it('never submits assigned entries, ignores duplicate clicks and does not change catalog',async()=>{
 const {store,service,adapter,entries}=setup();const c=store.read(entries);c.assignments[entryKey(entries[0]!) ]='management';store.save(c,entries)
 service.start('request-0002');service.start('request-0003');await done(service)
 expect(adapter.generate).toHaveBeenCalledTimes(1);expect(JSON.parse(vi.mocked(adapter.generate).mock.calls[0]![2]).plugins).toHaveLength(1)
 expect(store.read(entries).assignments[entryKey(entries[0]!)]).toBe('management');expect(store.read(entries).modules).toEqual(c.modules)
})
it('retains invalid, duplicate, missing and explicitly uncertain responses as undefined',async()=>{
 const {store,service,adapter,entries}=setup(4)
 adapter.generate=async()=>JSON.stringify({results:[{id:'0',moduleId:'invented',reason:'x'},{id:'1',moduleId:'core-10',reason:'x'},{id:'1',moduleId:'core-10',reason:'x'},{id:'2',moduleId:null,reason:'信息不足'},{id:'unknown',moduleId:'core-10',reason:'x'}]})
 service.start('request-0004');const result=await done(service);expect(result.report?.results.every(r=>r.status==='unclassified')).toBe(true);expect(store.read(entries).assignments).toEqual({})
})
it('protects edits during analysis and a removed target category',async()=>{
 const {store,service,adapter,entries}=setup();let resolve!:(value:string)=>void
 adapter.generate=()=>new Promise(r=>{resolve=r});service.start('request-0005');await vi.waitFor(()=>expect(resolve).toBeTypeOf('function'))
 const c=store.read(entries);c.assignments[entryKey(entries[0]!)]='management';c.modules=c.modules.filter(m=>m.id!=='core-10');store.save(c,entries)
 resolve(JSON.stringify({results:[0,1].map(i=>({id:String(i),moduleId:'core-10',reason:'网页'}))}));const result=await done(service)
 expect(result.report?.results.every(r=>r.status==='skipped')).toBe(true);expect(store.read(entries).assignments[entryKey(entries[0]!)]).toBe('management')
})
it('undo does not overwrite a manual move away and back to the same target',async()=>{
 const {store,service,entries}=setup();service.start('request-0006');await done(service)
 const key=entryKey(entries[0]!);let c=store.read(entries);c.assignments[key]='management';store.save(c,entries);c=store.read(entries);c.assignments[key]='core-10';store.save(c,entries)
 const report=store.undoAI('request-0006',entries);expect(report.results[0]!.status).toBe('skipped');expect(report.results[1]!.status).toBe('undone');expect(store.read(entries).assignments[key]).toBe('core-10')
})
it('cancels ignored aborts without allowing late commits and tolerates cancel before start',async()=>{
 const {store,service,adapter,entries}=setup();let resolve!:(value:string)=>void
 adapter.generate=()=>new Promise(r=>{resolve=r});service.start('request-0007');await vi.waitFor(()=>expect(resolve).toBeTypeOf('function'))
 service.cancel('request-0007');resolve(JSON.stringify({results:[{id:'0',moduleId:'core-10',reason:'网页'}]}));await done(service)
 expect(service.status().job?.phase).toBe('cancelled');expect(store.read(entries).assignments).toEqual({})
 service.cancel('request-0008');expect(service.start('request-0008').phase).toBe('cancelled')
})
it('saves valid batches only and preserves classification on total failure',async()=>{
 const {store,service,adapter,entries}=setup(12);let n=0;const generate=adapter.generate
 adapter.generate=async(...args)=>{if(++n===2)throw Error('network');return generate(...args)}
 service.start('request-0009');const result=await done(service);expect(result.report?.results.filter(r=>r.status==='applied')).toHaveLength(10);expect(result.report?.results.filter(r=>r.status==='failed')).toHaveLength(2)
 const before=readFileSync(store.file,'utf8');adapter.generate=async()=>'{invalid';service.start('request-0010');await done(service);expect(service.status().job?.phase).toBe('failed');expect(readFileSync(store.file,'utf8')).toBe(before)
})
it('leaves newly imported entries for the next run and skips removed entries',async()=>{
 const {store,service,adapter,entries,setEntries}=setup();let resolve!:(value:string)=>void
 adapter.generate=()=>new Promise(r=>{resolve=r});service.start('request-0011');await vi.waitFor(()=>expect(resolve).toBeTypeOf('function'))
 const newEntry={...entries[0]!,moduleName:'new',entryId:'new'};setEntries([entries[1]!,newEntry]);resolve(JSON.stringify({results:[0,1].map(i=>({id:String(i),moduleId:'core-10',reason:'网页'}))}));await done(service)
 expect(store.read([newEntry]).assignments[entryKey(newEntry)]).toBeUndefined();expect(service.status().report!.results[0]!.status).toBe('skipped')
})
it('reports save errors without claiming completion or overwriting the old file',async()=>{
 const {store,service,entries}=setup();store.read(entries);const old=readFileSync(store.file,'utf8');vi.spyOn(store,'applyAI').mockImplementation(()=>{throw Error('保存失败')})
 service.start('request-0012');await done(service);expect(service.status().job?.phase).toBe('failed');expect(service.status().report).toBeUndefined();expect(readFileSync(store.file,'utf8')).toBe(old)
})
it('selects the first registered text model and streams through existing LLM without changing defaults',async()=>{
 const llm={listProviders:()=>[{id:'empty',name:'未就绪'},{id:'live',name:'现有账号'}],listModels:vi.fn(async(id:string)=>id==='empty'?[]:[{id:'image',name:'图像',inputModalities:['image']},{id:'first',name:'文本一'},{id:'second',name:'文本二'}]),stream:vi.fn(async function*(){yield {type:'text-delta',text:'{"results":[]}'};yield {type:'finish',reason:{kind:'stop'}}})}
 const adapter=workbenchClassificationAdapter({get:()=>llm} as never,process.cwd()),signal=new AbortController().signal
 const model=await adapter.firstModel(signal);expect(model.id).toBe('first');await adapter.generate(model,'system','prompt',signal)
 expect(llm.stream).toHaveBeenCalledWith(expect.objectContaining({provider:'live',model:'first',signal}));expect(llm.listModels).toHaveBeenCalledTimes(2)
})
it('does not invoke a fallback model after generation failure',async()=>{
 const {service,adapter}=setup();adapter.generate=vi.fn(async()=>{throw Error('failure')});service.start('request-0013');await done(service)
 expect(adapter.firstModel).toHaveBeenCalledTimes(1);expect(adapter.generate).toHaveBeenCalledTimes(1);expect(service.status().job?.phase).toBe('failed')
})

it('opts out of thinking only when the selected model advertises off',async()=>{
 const stream=vi.fn(async function*(){yield {type:'text-delta',text:'{"results":[]}'};yield {type:'finish',reason:{kind:'stop'}}}),resolveModelInfo=vi.fn(async()=>({reasoning:{efforts:[{id:'off'},{id:'high'}]}})),llm={stream,resolveModelInfo}
 const a=workbenchClassificationAdapter({get:()=>llm} as never,process.cwd()),m={provider:'p',id:'m',name:'M'},signal=new AbortController().signal
 await a.generate(m,'s','p',signal);expect(stream.mock.calls[0]).toEqual([expect.objectContaining({reasoningEffort:'off'})]);resolveModelInfo.mockResolvedValue({reasoning:{efforts:[{id:'high'}]}});await a.generate(m,'s','p',signal);expect(stream.mock.calls[1]).toEqual([expect.not.objectContaining({reasoningEffort:expect.anything()})])
})
it.each([[{kind:'max-tokens'},'长度上限'],[{kind:'error',failure:{code:'AUTH',status:401,message:'secret-provider-detail'}},'鉴权失败'],[{kind:'error',failure:{code:'RATE_LIMIT',status:429}},'限流'],[{kind:'error',failure:{code:'SERVER',status:503}},'暂时不可用']])('reports finish failure %j without accepting partial JSON',async(reason,expected)=>{
 const llm={stream:async function*(){yield {type:'text-delta',text:'{"results":[]}'};yield {type:'finish',reason}}},a=workbenchClassificationAdapter({get:()=>llm} as never,process.cwd())
 await expect(a.generate({provider:'p',id:'m',name:'M'},'s','p',new AbortController().signal)).rejects.toThrow(expected as string)
})
it('distinguishes invalid JSON and does not leak arbitrary exception contents',async()=>{
 const {service,adapter}=setup();adapter.generate=async()=>'{broken';service.start('format-0001');await done(service);expect(service.status().job?.error).toContain('JSON')
 adapter.generate=async()=>{throw Error('secret-provider-detail')};service.start('format-0002');await done(service);expect(service.status().job?.error).not.toContain('secret-provider-detail')
})
