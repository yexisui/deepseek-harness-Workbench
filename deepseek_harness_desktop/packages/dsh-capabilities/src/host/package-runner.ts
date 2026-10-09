import { Worker } from 'node:worker_threads'
import { randomUUID } from 'node:crypto'
import { open, readFile, readdir, rename, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { allowedActions, wasRevoked } from '../core/policy.ts'
import { latest, type Action, type RoleVersion } from '../core/model.ts'
import { packageActionId, packageComponentId } from '../core/distribution.ts'
import { InputError, text } from '../core/validation.ts'
import { plainMkdir } from './package-archive.ts'
import type { CapabilityPackages } from './packages.ts'

export type PackageJob = { id:string; capabilityId:string; version:number; action:Action; createdAt:number; finishedAt?:number; status:'running'|'stopping'|'stopped'|'done'|'error'; output?:unknown; error?:string; roleId?:string; roleVersion?:number }
export type PackageAuthority = { roleId:string; version:RoleVersion; sessionCreatedAt:number }
const workerSource = String.raw`
const {parentPort,workerData}=require('node:worker_threads');
let sequence=0; const waiting=new Map();
parentPort.on('message',m=>{const p=waiting.get(m.id);if(p){waiting.delete(m.id);m.error?p.reject(new Error(m.error)):p.resolve(m.value)}});
const api={resourceRoot:workerData.resourceRoot,model:(prompt)=>new Promise((resolve,reject)=>{const id=++sequence;waiting.set(id,{resolve,reject});parentPort.postMessage({type:'model',id,prompt})})};
(async()=>{const mod=require(workerData.entry);if(typeof mod.execute!=='function')throw new Error('组件需要导出 execute({action,input,api})');const result=await mod.execute({action:workerData.action,input:workerData.input,api});const json=JSON.stringify(result===undefined?null:result);if(json.length>512000)throw new Error('能力结果超过 512 KiB');parentPort.postMessage({type:'result',value:JSON.parse(json)});})().catch(e=>parentPort.postMessage({type:'error',error:String(e&&e.message||e).slice(0,2000)}));
`

/** Each call owns one worker. Author-trusted Node code is not presented as a permissions sandbox. */
export class PackageRunner {
  private jobs = new Map<string,PackageJob>()
  private active = new Map<string,{controller:AbortController;done:Promise<unknown>;allowed:()=>boolean}>()
  private unsubscribe?:()=>void
  private closed = false
  constructor(readonly packages:CapabilityPackages, private modelCall:(prompt:string,model:string,signal:AbortSignal)=>Promise<string>) {}
  private get directory(){return join(this.packages.store.directory,'package-tasks')}
  async init(){
    plainMkdir(this.directory)
    for(const name of await readdir(this.directory))if(/^[a-f0-9-]{36}\.json$/.test(name)){
      const value=JSON.parse(await readFile(join(this.directory,name),'utf8')) as PackageJob
      if(value.id+'.json'!==name)throw new Error('能力任务记录损坏')
      if(value.status==='running'||value.status==='stopping'){value.status='stopped';value.error='服务已重启，任务未自动重放';value.finishedAt=Date.now();await this.persist(value)}
      this.jobs.set(value.id,value)
    }
    this.unsubscribe=this.packages.store.subscribe(()=>{for(const run of this.active.values())if(!run.allowed())run.controller.abort(new Error('能力或岗位权限已撤销'))})
  }
  list(id?:string){return [...this.jobs.values()].filter(j=>!id||j.capabilityId===id).sort((a,b)=>b.createdAt-a.createdAt).slice(0,100).map(j=>({...j,output:undefined}))}
  get(id:string){const j=this.jobs.get(id);if(!j)throw new InputError('能力任务不存在',404);return structuredClone(j)}
  activities(){return [...this.jobs.values()].filter(j=>j.status==='running'||j.status==='stopping').map(j=>({id:j.id,name:this.packages.store.snapshot().capabilities.find(c=>c.id===j.capabilityId)?.draft.name??j.capabilityId,kind:'package',status:j.status,roleId:j.roleId,roleVersion:j.roleVersion,componentIds:[packageComponentId(j.action.split(':')[1]!,j.action.split(':')[2]!)]}))}
  private async persist(job:PackageJob){const path=join(this.directory,job.id+'.json'), temp=path+'.'+randomUUID()+'.tmp', file=await open(temp,'wx',0o600);try{await file.writeFile(JSON.stringify(job));await file.sync()}finally{await file.close()};try{await rename(temp,path)}catch(e){await unlink(temp).catch(()=>{});throw e}}
  private authority(capabilityId:string,version:number,action:Action,createdAt:number,role?:PackageAuthority){
    const state=this.packages.store.snapshot(),cap=state.capabilities.find(c=>c.id===capabilityId),v=cap?.versions.find(v=>v.version===version)
    if(!cap?.enabled||cap.removedAt||!v?.packageHash||!v.components.some(p=>p.actions.includes(action)&&state.componentRestrictions?.[p.componentId]?.enabled!==false))return false
    if((state.revokedAt?.[`capability:${capabilityId}`]??-1)>=createdAt||v.components.some(p=>(state.componentRestrictions?.[p.componentId]?.revokedAt??-1)>=createdAt))return false
    if(cap.versions.filter(v=>v.version>=version).some(v=>!v.components.some(p=>p.actions.includes(action))))return false
    if(role){const binding=role.version.capabilities.find(b=>b.capabilityId===capabilityId&&b.enabled&&b.version===version);return !!binding&&!wasRevoked(state,role.roleId,{...role.version,capabilities:[binding]},role.sessionCreatedAt)&&allowedActions(state,role.roleId,role.version).includes(action)}
    return true
  }
  async start(capabilityId:string,version:number,action:Action,input:unknown,options:{signal?:AbortSignal;role?:PackageAuthority}={}){
    if(this.closed)throw new InputError('能力执行器已关闭',503)
    if(this.active.size>=4)throw new InputError('最多同时运行 4 个外部能力任务，请先停止或等待现有任务',409)
    if(JSON.stringify(input)?.length>256000)throw new InputError('输入超过 256 KiB',413)
    const state=this.packages.store.snapshot(),cap=state.capabilities.find(c=>c.id===capabilityId),v=cap?.versions.find(v=>v.version===version),createdAt=Date.now()
    if(!options.role&&latest(cap?.versions??[])?.version!==version)throw new InputError('能力版本已更新，请刷新后再运行',409)
    const allowed=()=>this.authority(capabilityId,version,action,createdAt,options.role)
    if(!allowed()||!v?.packageHash)throw new InputError('此动作未获授权，或能力已经停用',403)
    const release=state.packageReleases?.[v.packageHash],part=release?.manifest.components.find(c=>c.actions.some(a=>packageActionId(release.manifest.id,c.id,a.id)===action)),declared=part?.actions.find(a=>packageActionId(release!.manifest.id,part.id,a.id)===action)
    if(!release||!part||!declared)throw new InputError('此版本未声明该执行动作',403)
    if(release.manifest.permissions.includes('model')&&!this.packages.model(capabilityId))throw new InputError('请先配置工作台模型')
    const controller=new AbortController(),signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal
    const job:PackageJob={id:randomUUID(),capabilityId,version,action,createdAt,status:'running',...(options.role?{roleId:options.role.roleId,roleVersion:options.role.version.version}:{})}
    this.jobs.set(job.id,job)
    // Reserve capacity before any asynchronous verification, and recheck authority after every await.
    let settle!:()=>void; const pending=new Promise<void>(resolve=>{settle=resolve})
    this.active.set(job.id,{controller,done:pending,allowed})
    const done=(async()=>{
      try{
        await this.persist(job)
        if(!await this.packages.verify(v.packageHash!))throw new Error('能力文件缺失或校验失败，请重新导入正确版本')
        if(signal.aborted||!allowed())throw new Error('任务已停止或权限已撤销')
        const root=this.packages.directory(v.packageHash!)
        job.output=await this.executeWorker({entry:join(root,part.entry),resourceRoot:join(root,'resources'),action:declared.id,input},signal,release.manifest.permissions.includes('model'),this.packages.model(capabilityId),allowed)
        if(signal.aborted||!allowed())throw new Error('任务已停止或权限已撤销')
        job.status='done'
      }catch(e){job.status=signal.aborted||!allowed()?'stopped':'error';job.error=e instanceof Error?e.message:String(e);delete job.output}
      finally{job.finishedAt=Date.now();try{await this.persist(job)}finally{this.active.delete(job.id);settle()}}
      if(job.status!=='done')throw new Error(job.error??'能力任务未完成')
      return job.output
    })()
    // HTTP callers poll a durable job; tool callers await the same settlement.
    void done.catch(()=>{})
    return {job:structuredClone(job),done}
  }
  private executeWorker(data:{entry:string;resourceRoot:string;action:string;input:unknown},signal:AbortSignal,allowModel:boolean,model:string,allowed:()=>boolean):Promise<unknown>{
    return new Promise((resolve,reject)=>{
      const worker=new Worker(workerSource,{eval:true,workerData:data,env:{},stdout:true,stderr:true,resourceLimits:{maxOldGenerationSizeMb:128,maxYoungGenerationSizeMb:32,stackSizeMb:4}})
      let finished=false,calls=0,inflight=false,logBytes=0
      const modelAbort=new AbortController(),combined=AbortSignal.any([signal,modelAbort.signal])
      const finish=(error?:Error,value?:unknown)=>{if(finished)return;finished=true;clearTimeout(timeout);signal.removeEventListener('abort',stop);modelAbort.abort();void worker.terminate().then(()=>error?reject(error):resolve(value),reject)}
      const stop=()=>finish(new Error('任务已停止或权限已撤销'))
      const timeout=setTimeout(()=>finish(new Error('能力执行超过 180 秒，已停止')),180000)
      const log=(chunk:Buffer)=>{logBytes+=chunk.length;if(logBytes>256000)finish(new Error('组件日志输出过多，已停止'))}
      worker.stdout?.on('data',log);worker.stderr?.on('data',log)
      signal.addEventListener('abort',stop,{once:true});if(signal.aborted)stop()
      worker.on('error',e=>finish(e));worker.on('exit',code=>{if(!finished)finish(new Error(`组件提前退出（${code}）`))})
      worker.on('message',async message=>{
        if(finished)return
        if(!allowed()||signal.aborted){stop();return}
        if(message?.type==='result'){finish(undefined,message.value);return}
        if(message?.type==='error'){finish(new Error(String(message.error).slice(0,2000)));return}
        if(message?.type!=='model'){finish(new Error('组件返回了未知协议消息'));return}
        try{
          if(!allowModel)throw new Error('能力未声明工作台模型权限')
          if(!model)throw new Error('请先配置工作台模型')
          if(inflight||++calls>10)throw new Error('每个动作最多顺序调用模型 10 次')
          const prompt=text(message.prompt,'模型输入',32000,true);inflight=true
          const value=await this.modelCall(prompt,model,combined)
          if(!finished&&allowed()&&!signal.aborted)worker.postMessage({id:message.id,value})
        }catch(e){if(!finished)worker.postMessage({id:message.id,error:e instanceof Error?e.message:String(e)})}
        finally{inflight=false}
      })
    })
  }
  async stop(id:string){const run=this.active.get(id);if(!run)return this.get(id);const job=this.jobs.get(id)!;job.status='stopping';run.controller.abort();await run.done;return this.get(id)}
  async close(){this.closed=true;this.unsubscribe?.();await Promise.all([...this.active.keys()].map(id=>this.stop(id)))}
}
