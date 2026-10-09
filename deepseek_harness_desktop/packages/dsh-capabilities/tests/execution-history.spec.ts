import {afterEach,expect,it,vi} from 'vitest'
import {mkdtemp,rm,writeFile,readFile} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {tmpdir} from 'node:os'
import {randomUUID} from 'node:crypto'
import {Readable} from 'node:stream'
import type {IncomingMessage} from 'node:http'
import {ExecutionStore,step,execution} from '../../../shared/host/execution.ts'
import {MeetingService} from '../src/host/meeting.ts'
import {JevStore} from '../../dsh-jev-mode/src/host/store.ts'
import {JevService} from '../../dsh-jev-mode/src/host/service.ts'
import {defaults,JevTechnicalError,type Decision} from '../../dsh-jev-mode/src/core/contract.ts'
const roots:string[]=[],drains:(()=>Promise<unknown>)[]=[]
afterEach(async()=>{for(const drain of drains.splice(0))await drain();vi.unstubAllGlobals();for(const root of roots.splice(0)){if(!resolve(root).startsWith(resolve(tmpdir())+'\\'))throw Error('unsafe cleanup');await rm(root,{recursive:true,force:true})}})
async function root(){const p=await mkdtemp(join(tmpdir(),'execution-history-'));roots.push(p);return p}
async function until<T>(read:()=>Promise<T>,done:(x:T)=>boolean){for(let i=0;i<250;i++){const value=await read();if(done(value))return value;await new Promise(r=>setTimeout(r,10))}throw Error('timeout')}
it('retains independent result versions and pages more than 200 rounds across restart',async()=>{
 const dir=await root(),store=new ExecutionStore(dir),task=randomUUID();await store.init()
 for(let i=0;i<205;i++)await store.run(task,{operation:'测试轮次',input:String(i)},async()=>{step('read','读取资料');return i},value=>({status:'done',result:{kind:'test',text:String(value)}}))
 const reopened=new ExecutionStore(dir);await reopened.init();const ids=new Set<string>(),values=new Set<string>()
 for(let offset=0;offset<205;offset+=50){const p=await reopened.list(task,offset,50);expect(p.total).toBe(205);for(const r of p.items){ids.add(r.id);values.add(r.result!.text);expect(r.status).toBe('done')}}
 expect(ids.size).toBe(205);expect(values.size).toBe(205);await expect(store.list('../escape')).rejects.toThrow('标识')
})
it('updates stable events by sequence and marks a crashed run interrupted without replay',async()=>{
 const dir=await root(),store=new ExecutionStore(dir),task=randomUUID();await store.init();let oldSeq=0
 await store.run(task,{operation:'处理',input:'输入'},async()=>{step('model','等待模型','running');oldSeq=execution()!.record.seq;step('model','接收输出','done');step('save','保存','done')},()=>({status:'done'}))
 const saved=(await store.list(task)).items[0]!,delta=await store.get(task,saved.id,oldSeq)
 expect(delta.events).toHaveLength(2);expect(delta.events[0]!.id).toBe(saved.events[0]!.id)
 saved.status='running';saved.events[0]!.status='running';await store.save(saved)
 const restored=new ExecutionStore(dir);await restored.init();const run=await restored.get(task,saved.id)
 expect(run.status).toBe('interrupted');expect(run.events[0]!.status).toBe('interrupted');expect(run.result).toEqual(saved.result)
})
it('does not recreate a removed journal when a late operation finishes',async()=>{
 const store=new ExecutionStore(await root()),task=randomUUID();await store.init();let release!:()=>void
 const pending=store.run(task,{operation:'后台处理',input:'原任务'},async()=>{await new Promise<void>(r=>release=r);step('late','迟到步骤')},()=>({status:'done'}))
 await until(async()=>Boolean(release),x=>x);await store.remove(task);release();await pending;expect((await store.list(task)).items).toEqual([])
})
it('keeps business output with a visible warning when journal writes fail',async()=>{
 const store=new ExecutionStore(await root()),task=randomUUID();await store.init();const save=vi.spyOn(store,'save').mockRejectedValue(Error('fixture disk failure'))
 try{expect(await store.run(task,{operation:'处理',input:'test'},async()=>{step('save','业务结果已保存');return 'kept'},value=>({status:'done',result:{kind:'test',text:value}}))).toBe('kept');const record=(await store.list(task)).items[0]!;expect(record.warning).toContain('保存失败');expect(record.result?.text).toBe('kept')}finally{save.mockRestore()}
})
it('keeps candidate fallback and decisions in the business round after the global trace is evicted',async()=>{
 const dir=await root(),journal=new ExecutionStore(join(dir,'runs')),store=new JevStore(join(dir,'jev'));await journal.init();await store.init();drains.push(()=>store.close())
 await store.update(0,{...defaults,enabled:true,candidates:[{id:'first',model:'local/first',enabled:true,reasoningEffort:''},{id:'second',model:'local/second',enabled:true,reasoningEffort:''}]})
 const allow:Decision={decision:'allow',summary:'待办按待确认保留',checks:[],missing:[]}
 const jev=new JevService(store,{id:'self-owned',assess:async input=>{if(input.config.model==='local/first')throw new JevTechnicalError('fixture failure');return allow}},()=>{})
 const task=randomUUID();await journal.run(task,{operation:'纪要',input:'会议'},async()=>{const run=jev.begin('meeting:'+task);try{await run.check('review',{minutes:'待确认'})}finally{run.finish()}},()=>({status:'done'}))
 const original=(await journal.list(task)).items[0]!,trace=store.history()[0]!
 for(let i=0;i<201;i++)await store.record({...trace,id:randomUUID(),scope:'other'})
 expect(store.history().some(t=>t.id===trace.id)).toBe(false)
 const saved=await journal.get(task,original.id);expect(saved.jev?.enabled).toBe(true);expect(saved.events.filter(e=>e.key.includes('candidate')).map(e=>e.status)).toEqual(['failed','done']);expect(saved.events.find(e=>e.key==='jev-review-0')?.detail).toContain('待办按待确认保留')
})
for(const mode of ['quick','guided'] as const)it('records '+mode+' upload, confirmation and revisions without overwriting old results',async()=>{
 const dir=await root();vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({text:'陈浩周五修复权限问题。'}))))
 let title='第一版';const service=new MeetingService(dir,async()=>JSON.stringify({title,overview:'已讨论',decisions:[],actions:[],unknown:[]}),undefined,undefined,()=>({endpoint:'http://localhost/v1/audio/transcriptions',model:'fixture'}));await service.init();drains.push(()=>service.executions.drain())
 const task=await service.create({fileName:'fixture.wav',mode});await service.upload(task.id,Object.assign(Readable.from([Buffer.from('fixture audio')]),{complete:true}) as unknown as IncomingMessage)
 await until(()=>service.get(task.id),t=>t.status===(mode==='guided'?'transcribed':'ready'))
 await service.executions.drain()
 if(mode==='guided'){expect((await service.executions.list(task.id)).items[0]!.status).toBe('waiting');const rows=(await service.get(task.id)).segments;await service.generate(task.id,rows.map(r=>({...r,text:r.text+' 已核对'})));await until(()=>service.get(task.id),t=>t.status==='ready');await service.executions.drain()}
 const first=(await service.executions.list(task.id)).items.find(r=>r.result?.kind==='minutes')!
 title='第二版';await service.generate(task.id,undefined,'把待办放在前面');await until(()=>service.get(task.id),t=>t.status==='ready');await service.executions.drain()
 expect(JSON.parse((await service.executions.get(task.id,first.id)).result!.text).title).toBe('第一版');const history=await service.executions.list(task.id);expect(history.items).toHaveLength(3);expect(history.items.find(r=>r.input==='把待办放在前面')?.inputKind).toBe('user')
 if(mode==='guided')expect(history.items.some(r=>r.events.some(e=>e.key==='corrections'))).toBe(true)
})
it('stops the real model request while keeping saved minutes, transcript and task',async()=>{
 const dir=await root();let started=false
 const service=new MeetingService(dir,async(_p,_m,signal)=>{started=true;return new Promise((_resolve,reject)=>signal!.addEventListener('abort',()=>reject(Error('aborted')),{once:true}))},undefined,undefined,()=>({endpoint:'http://localhost/v1/audio/transcriptions',model:'fixture'}));await service.init();drains.push(()=>service.executions.drain())
 const task=await service.create({fileName:'fixture.wav',mode:'guided'}),old={title:'旧纪要',overview:'保留',decisions:[],actions:[],unknown:[]}
 await writeFile(join(dir,task.id+'.json'),JSON.stringify({...task,status:'ready',segments:[{id:'s1',start:null,end:null,speaker:'甲',text:'原文'}],minutes:old}))
 await service.generate(task.id);await until(async()=>started,v=>v);const stopped=await service.stop(task.id)
 expect(stopped.minutes).toEqual(old);expect(stopped.segments[0]?.text).toBe('原文');expect((await service.executions.list(task.id)).items[0]?.status).toBe('stopped');expect(JSON.parse(await readFile(join(dir,task.id+'.json'),'utf8')).minutes).toEqual(old)
})
