import {mkdir,readFile,writeFile,rename} from 'node:fs/promises'
import {join} from 'node:path'
import {InputError,object,text} from '../core/validation.ts'
export type AssistantArchive = {id:string;title:string;role:string;archived:boolean;archivedAt:string;removed?:boolean;sourceKey?:string;localSnapshot?:Record<string,unknown>}
function sourceKey(row:Record<string,unknown>|undefined){
 const meeting=row?.meeting as {jobId?:unknown}|undefined
 return typeof row?.codeTaskId==='string'?'code:'+row.codeTaskId:typeof meeting?.jobId==='string'?'meeting:'+meeting.jobId:undefined
}
export class AssistantArchives {
 private state:{revision:number;entries:Record<string,AssistantArchive>}={revision:0,entries:{}}
 private tail:Promise<unknown>=Promise.resolve()
 constructor(private root:string){}
 async init(){await mkdir(this.root,{recursive:true});try{this.state=JSON.parse(await readFile(join(this.root,'assistant-archives.json'),'utf8'))}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e}}
 snapshot(){return structuredClone(this.state)}
 change(input:unknown){const run=this.tail.then(async()=>{
  const body=object(input),requestedId=text(body.id,'对话',160,true),incoming=body.localSnapshot===undefined?undefined:object(body.localSnapshot),key=sourceKey(incoming)
  const id=(key?Object.values(this.state.entries).find(entry=>(entry.sourceKey??sourceKey(entry.localSnapshot))===key)?.id:undefined)??requestedId;if(!/^[\w-]+$/.test(id))throw new InputError('对话标识无效')
  const old=this.state.entries[id]
  // Restoration leaves a tombstone: importing another browser's old flag cannot archive it again.
  if(body.migrate===true&&old)return this.snapshot()
  if(typeof body.archived!=='boolean')throw new InputError('归档状态无效')
  if(old?.removed)throw new InputError('对话已删除',404)
  if(!body.archived&&!body.removed&&!old)throw new InputError('归档记录不存在',404)
  const snapshot=body.removed?undefined:body.localSnapshot===undefined?old?.localSnapshot:object(body.localSnapshot)
  if(snapshot&&(![id,requestedId].includes(String(snapshot.id))||!['draft','demo'].includes(String(snapshot.kind))))throw new InputError('对话副本不匹配')
  const entry:AssistantArchive={id,sourceKey:key??old?.sourceKey,title:text(body.title??old?.title,'名称',240,true),role:text(body.role??old?.role,'助手',160,true),archived:body.removed?false:body.archived,archivedAt:body.archived?new Date().toISOString():old?.archivedAt??new Date().toISOString(),...(body.removed?{removed:true}:{}),...(snapshot?{localSnapshot:{...structuredClone(snapshot),id}}:{})}
  const next={revision:this.state.revision+1,entries:{...this.state.entries,[id]:entry}},file=join(this.root,'assistant-archives.json')
  await writeFile(file+'.tmp',JSON.stringify(next));await rename(file+'.tmp',file);this.state=next;return this.snapshot()
 });this.tail=run.catch(()=>{});return run}
}
