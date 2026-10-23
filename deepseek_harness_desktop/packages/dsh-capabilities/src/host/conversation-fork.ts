import { readFile, writeFile, rename, mkdir, cp, rm } from 'node:fs/promises'
import { InputError } from '../core/validation.ts'
export function forkIdentity<T extends {id:string;title?:string;createdAt:string;updatedAt:string}>(source:T,id:string):T & {forkedFrom:string} {
  if(!/^[a-f0-9-]{36}$/i.test(id)||source.id===id)throw new InputError('分叉请求标识无效')
  const at=new Date().toISOString()
  return {...structuredClone(source),id,title:(source.title||'对话').slice(0,110)+' · 分叉',createdAt:at,updatedAt:at,forkedFrom:source.id}
}
export async function existingFork<T>(file:string,source:string):Promise<T|undefined>{
  try{const row=JSON.parse(await readFile(file,'utf8'));if(row.forkedFrom!==source)throw new InputError('分叉标识已被占用',409);return row}
  catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return;throw e}
}
export async function writeFork(file:string,row:unknown){const tmp=file+'.fork.tmp';try{await writeFile(tmp,JSON.stringify(row));await rename(tmp,file)}finally{await rm(tmp,{force:true})}}
export async function copyForkDirectory(source:string,target:string){await mkdir(target,{recursive:true});await cp(source,target,{recursive:true,filter:p=>!p.endsWith('.tmp')}).catch(e=>{if(e.code!=='ENOENT')throw e})}
export type ForkAdapter=(source:string,target:string)=>Promise<{id:string}>
/** Types register once. Adding a role never needs another fork handler. */
export class ConversationForks {
 private owners=new Map<string,string>();private adapters=new Map<string,ForkAdapter>();private pending=new Map<string,Promise<{id:string}>>()
 register(kind:string,adapter:ForkAdapter){if(this.adapters.has(kind))throw Error('Duplicate conversation adapter: '+kind);this.adapters.set(kind,adapter)}
 async fork(kind:string,id:string,requestId:string){
  if(!/^[a-f0-9-]{36}$/i.test(requestId))throw new InputError('分叉请求标识无效')
  const adapter=this.adapters.get(kind);if(!adapter)throw new InputError('该对话类型未登记分叉适配',400)
  const owner=kind+':'+id,previous=this.owners.get(requestId);if(previous&&previous!==owner)throw new InputError('分叉标识已被占用',409);this.owners.set(requestId,owner)
  const key=owner+':'+requestId;let work=this.pending.get(key)
  if(!work){work=adapter(id,requestId);this.pending.set(key,work);void work.finally(()=>{this.pending.delete(key);this.owners.delete(requestId)}).catch(()=>{})}
  return {kind,...await work}
 }
}
