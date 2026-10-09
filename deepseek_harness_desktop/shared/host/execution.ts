import { AsyncLocalStorage } from 'node:async_hooks'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, readdir, writeFile, rename, rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { ExecutionRecord, ExecutionEvent, ExecutionStatus, ExecutionPage } from '../types/execution.ts'
export type { ExecutionRecord, ExecutionPage } from '../types/execution.ts'
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
const context = new AsyncLocalStorage<ExecutionRun>()
const now = () => new Date().toISOString()
const clean = (s: string) => s.replace(/Bearer\s+\S+/gi,'Bearer [隐藏]').replace(/((?:api[_-]?key|authorization|token)\s*[:=]\s*)[^\s,;]+/gi,'$1[隐藏]')
export function execution() { return context.getStore() }
export function step(key: string, title: string, status: ExecutionStatus = 'done', detail?: string, extra: Partial<Pick<ExecutionEvent,'model'|'current'|'total'>> = {}) { execution()?.step(key,title,status,detail,extra) }
export class ExecutionRun {
  tail: Promise<void> = Promise.resolve()
  constructor(readonly record: ExecutionRecord, private store: ExecutionStore) {}
  private persist() { this.tail=this.tail.then(()=>this.store.save(this.record)).catch(()=>{this.record.warning='部分执行记录保存失败，请保留当前结果后检查磁盘';this.store.live.set(this.record.id,this.record)}) }
  step(key: string, title: string, status: ExecutionStatus, detail?: string, extra: Partial<ExecutionEvent> = {}) {
    const existing=this.record.events.find(e=>e.key===key),at=now();this.record.seq++
    if(existing)Object.assign(existing,extra,{seq:this.record.seq,title,status,updatedAt:at,...(detail!==undefined?{detail:clean(detail).slice(0,16000)}:{})})
    else this.record.events.push({id:randomUUID(),key,title,status,startedAt:at,updatedAt:at,...extra,...(detail!==undefined?{detail:clean(detail).slice(0,16000)}:{}),seq:this.record.seq})
    this.persist()
  }
  jev(value: NonNullable<ExecutionRecord['jev']>) { this.record.jev=value;this.persist() }
  async finish(value: {status:ExecutionStatus;summary?:string;result?:ExecutionRecord['result']}) {
    for(const event of this.record.events)if(event.status==='running'){event.status=value.status==='done'?'done':value.status;event.updatedAt=now();event.seq=++this.record.seq}
    Object.assign(this.record,value,{summary:value.summary?clean(value.summary):undefined,finishedAt:now()});this.persist();await this.tail
  }
}
export class ExecutionStore {
  readonly live = new Map<string,ExecutionRecord>()
  private pending = new Set<Promise<unknown>>()
  private writes = new Set<Promise<unknown>>()
  private deleted = new Set<string>()
  constructor(readonly root: string) {}
  private id(id:string){if(!UUID.test(id))throw new Error('执行记录标识无效');return id}
  private file(taskId:string,id:string){return join(this.root,this.id(taskId),this.id(id)+'.json')}
  save(record:ExecutionRecord){if(this.deleted.has(record.taskId))return Promise.resolve();const write=this.write(record);this.writes.add(write);void write.finally(()=>this.writes.delete(write)).catch(()=>{});return write}
  private async write(record:ExecutionRecord){const file=this.file(record.taskId,record.id);await mkdir(join(this.root,record.taskId),{recursive:true});const tmp=file+'.'+randomUUID()+'.tmp';try{await writeFile(tmp,JSON.stringify(record),{mode:0o600});await rename(tmp,file)}finally{await rm(tmp,{force:true}).catch(()=>{})}}
  async init(){await mkdir(this.root,{recursive:true});for(const dir of await readdir(this.root)){if(!UUID.test(dir))continue;for(const file of await readdir(join(this.root,dir))){if(!UUID.test(file.slice(0,-5))||!file.endsWith('.json'))continue;const record:ExecutionRecord=JSON.parse(await readFile(join(this.root,dir,file),'utf8'));if(record.status==='running'){record.status='interrupted';record.finishedAt=now();record.summary='工作台重启中断了本轮；已保存的结果保留，不自动重放';for(const e of record.events)if(e.status==='running'){e.status='interrupted';e.updatedAt=record.finishedAt;e.seq=++record.seq}await this.save(record)}}}}
  async list(taskId:string,offset=0,limit=10):Promise<ExecutionPage>{this.id(taskId);if(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(limit)||limit<1||limit>50)throw new Error('执行记录分页无效');let names:string[];try{names=await readdir(join(this.root,taskId))}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')names=[];else throw e}const records:ExecutionRecord[]=[];for(const name of names){if(!name.endsWith('.json')||!UUID.test(name.slice(0,-5)))continue;records.push(JSON.parse(await readFile(join(this.root,taskId,name),'utf8')))}for(const value of this.live.values())if(value.taskId===taskId){const i=records.findIndex(r=>r.id===value.id);if(i<0)records.push(structuredClone(value));else records[i]=structuredClone(value)}records.sort((a,b)=>b.startedAt.localeCompare(a.startedAt)||b.id.localeCompare(a.id));return {items:records.slice(offset,offset+limit),total:records.length,...(offset+limit<records.length?{nextOffset:offset+limit}:{})}}
  async get(taskId:string,id:string,afterSeq=0){if(!Number.isSafeInteger(afterSeq)||afterSeq<0)throw new Error('执行序号无效');const record:ExecutionRecord=this.live.get(id)?.taskId===taskId?structuredClone(this.live.get(id)!):JSON.parse(await readFile(this.file(taskId,id),'utf8'));return {...record,events:record.events.filter(e=>e.seq>afterSeq)}}
  async remove(taskId:string){this.id(taskId);this.deleted.add(taskId);await Promise.allSettled([...this.writes]);await rm(join(this.root,taskId),{recursive:true,force:true});for(const [id,r] of this.live)if(r.taskId===taskId)this.live.delete(id)}
  async drain(){await Promise.allSettled([...this.pending])}
  run<T>(taskId:string,meta:Partial<ExecutionRecord>&Pick<ExecutionRecord,'operation'|'input'>,work:()=>Promise<T>,finish:(value:T)=>{status:ExecutionStatus;summary?:string;result?:ExecutionRecord['result']}):Promise<T>{
    const pending=this.execute(taskId,meta,work,finish);this.pending.add(pending);void pending.finally(()=>this.pending.delete(pending)).catch(()=>{});return pending
  }
  private async execute<T>(taskId:string,meta:Partial<ExecutionRecord>&Pick<ExecutionRecord,'operation'|'input'>,work:()=>Promise<T>,finish:(value:T)=>{status:ExecutionStatus;summary?:string;result?:ExecutionRecord['result']}):Promise<T>{
    const record:ExecutionRecord={schema:1,id:meta.id??randomUUID(),taskId:this.id(taskId),operation:meta.operation,input:clean(meta.input),inputKind:meta.inputKind??'operation',startedAt:now(),status:'running',events:[],seq:0,model:meta.model,roleVersion:meta.roleVersion,mode:meta.mode};this.id(record.id)
    try{await this.save(record)}catch{record.warning='执行过程保存失败，请保留当前结果后检查磁盘';this.live.set(record.id,record)}const run=new ExecutionRun(record,this)
    return context.run(run,async()=>{try{const value=await work();await run.finish(finish(value));return value}catch(e){await run.finish({status:'failed',summary:e instanceof Error?e.message:String(e)});throw e}})
  }
}
