import {spawn,type ChildProcessWithoutNullStreams} from 'node:child_process'
import {readFile,stat} from 'node:fs/promises'
import {join,resolve,relative,isAbsolute} from 'node:path'
import {randomUUID} from 'node:crypto'
import {InputError} from '../core/validation.ts'

export interface VectorEngine {call<T=any>(data:Record<string,unknown>,signal?:AbortSignal):Promise<T>;close():Promise<void>}
/** One supervised worker per workbench; no public HTTP management port. */
export class MilvusEngine implements VectorEngine {
 private child?:ChildProcessWithoutNullStreams
 private starting?:Promise<void>
 private pending=new Map<string,{resolve:(value:any)=>void;reject:(e:Error)=>void;cleanup:()=>void}>()
 private closed=false
 constructor(private tools:string){}
 private async start(){
  if(this.closed)throw new InputError('知识库存储已关闭',503)
  if(this.child)return
  if(this.starting)return this.starting
  this.starting=(async()=>{
   const root=join(this.tools,'milvus');let exe:string
   try{const info=JSON.parse((await readFile(join(root,'current.json'),'utf8')).replace(/^\uFEFF/,''));exe=resolve(root,info.python);const rel=relative(root,exe);if(!rel||rel.startsWith('..')||isAbsolute(rel)||!(await stat(exe)).isFile())throw Error()}catch{throw new InputError('知识库运行环境尚未安装，请运行工作台的一键部署补齐环境',503)}
   const child=spawn(exe,['-u',join(this.tools,'milvus-worker.py')],{windowsHide:true,stdio:'pipe',env:{...process.env,PYTHONIOENCODING:'utf-8',PYTHONDONTWRITEBYTECODE:'1',OMP_NUM_THREADS:'2'}})
   this.child=child;let buffer=''
   const fail=()=>{if(this.child===child)this.child=undefined;for(const p of this.pending.values()){p.cleanup();p.reject(new InputError('知识库存储进程已退出，请重试；已有资料保留',503))}this.pending.clear()}
   child.on('error',fail);child.on('exit',fail);child.stderr.on('data',()=>{})
   child.stdout.setEncoding('utf8');child.stdout.on('data',(chunk:string)=>{buffer+=chunk;if(buffer.length>64*1024*1024){child.kill();return}let at;while((at=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,at);buffer=buffer.slice(at+1);try{const value=JSON.parse(line),p=this.pending.get(value.id);if(!p)continue;this.pending.delete(value.id);p.cleanup();value.error?p.reject(new InputError(value.error,502)):p.resolve(value.result)}catch{child.kill()}}})
  })().finally(()=>{this.starting=undefined});return this.starting
 }
 async call<T=any>(data:Record<string,unknown>,signal:AbortSignal=AbortSignal.timeout(90_000)):Promise<T>{
  signal.throwIfAborted();await this.start();signal.throwIfAborted();const child=this.child!,id=randomUUID()
  return new Promise((resolve,reject)=>{const abort=()=>{const p=this.pending.get(id);if(!p)return;this.pending.delete(id);p.cleanup();reject(new InputError('知识库存储操作已取消或超时',408))};const timer=setTimeout(abort,90_000);const cleanup=()=>{clearTimeout(timer);signal.removeEventListener('abort',abort)};this.pending.set(id,{resolve,reject,cleanup});signal.addEventListener('abort',abort,{once:true});child.stdin.write(JSON.stringify({id,data})+'\n',e=>{if(e){this.pending.delete(id);cleanup();reject(new InputError('知识库存储不可用',503))}});if(signal.aborted)abort()})
 }
 async close(){this.closed=true;const child=this.child;if(!child)return;await new Promise<void>(resolve=>{const t=setTimeout(()=>{child.kill();resolve()},4000);child.once('exit',()=>{clearTimeout(t);resolve()});child.stdin.end()})}
}
