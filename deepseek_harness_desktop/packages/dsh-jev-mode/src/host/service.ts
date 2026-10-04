import { createHash, randomUUID } from 'node:crypto'
import { config, connectionConfig, JevError, descriptor, type Decision, type JevBackend, type JevConfig, type JevStatus, type JevTrace, type JevActiveRun, type JevConnection, type JevDiagnostic } from '../core/contract.ts'
import { JevStore } from './store.ts'
export class JevRun {
  readonly id=randomUUID()
  readonly snapshot: ReturnType<JevStore['snapshot']>
  private count=0
  private last:Decision|undefined
  constructor(private service:JevService,readonly scope:string){this.snapshot=service.store.snapshot();Object.freeze(this.snapshot.value);Object.freeze(this.snapshot);service.active.set(this.id,{id:this.id,scope,revision:this.snapshot.revision,enabled:this.enabled,model:this.snapshot.value.model,startedAt:new Date().toISOString(),phase:'working'})}
  get enabled(){return this.snapshot.value.enabled}
  finish(){this.service.active.delete(this.id)}
  guidance(){return this.last?`\nJEV 本轮附加审查（不能扩大岗位权限；事实仍须核对）：${JSON.stringify(this.last)}`:''}
  async check(stage:JevTrace['stage'],context:unknown,signal?:AbortSignal):Promise<Decision|undefined>{
    if(!this.enabled)return undefined
    const started=Date.now(),cfg=this.snapshot.value
    const active=this.service.active.get(this.id);if(active)Object.assign(active,{phase:'checking',stage,checkingSince:new Date(started).toISOString()})
    let result:Decision|undefined,status:JevTrace['status']='error',summary='JEV 检查未完成'
    try{
      signal?.throwIfAborted()
      if(++this.count>cfg.maxChecks)throw new JevError('JEV 本轮达到检查次数上限；当前自动动作已停止，可新开一轮')
      const backend=this.service.backends.get(cfg.backend);if(!backend)throw new JevError('官方 JEV 扩展接口已预留，尚未接入；不会调用官网')
      const raw=typeof context==='string'?context:JSON.stringify(context)
      if(raw.length>cfg.maxContextChars&&stage==='action')throw new JevError('JEV 动作证据超出上下文限制；未完整审查，当前自动动作已停止')
      const combined=AbortSignal.any([...(signal?[signal]:[]),AbortSignal.timeout(cfg.timeoutMs)])
      result=await backend.assess({stage,scope:this.scope,config:cfg,context:raw.length>cfg.maxContextChars?raw.slice(0,cfg.maxContextChars)+'\n[内容已截断，缺失内容不能作为通过依据]':raw},combined)
      combined.throwIfAborted()
      if(raw.length>cfg.maxContextChars&&result.decision==='allow')result={...result,decision:'clarify',summary:'检查上下文超出限制，无法确认完整结果。'+result.summary,missing:[...result.missing,'超出上下文上限的内容尚未核对']}
      this.last=result;status=result.decision==='allow'?'allowed':result.decision==='clarify'?'clarify':'blocked';summary=result.summary
      if(result.decision==='block'||stage==='action'&&result.decision!=='allow')throw new JevError('JEV 已停止当前自动步骤：'+summary)
      return result
    }catch(error){if(status==='error')summary=error instanceof JevError?error.message:signal?.aborted?'JEV 检查已取消':'JEV 检查失败或超时；当前自动步骤已停止';throw new JevError(status==='error'?summary:'JEV 已停止当前自动步骤：'+summary)}
    finally{if(active)Object.assign(active,{phase:'working',checkingSince:undefined,lastStatus:status});await this.service.store.record({id:randomUUID(),at:new Date().toISOString(),runId:this.id,scope:this.scope,stage,revision:this.snapshot.revision,config:cfg,status,summary,decision:result,elapsedMs:Date.now()-started})}
  }
}
export class JevService {
  readonly backends=new Map<JevConfig['backend'],JevBackend>()
  readonly active=new Map<string,JevActiveRun>()
  private diagnostic?: {key:string; result:JevDiagnostic; controller:AbortController; done:Promise<void>}
  constructor(readonly store:JevStore,backend:JevBackend,private readonly ready:(config:JevConfig)=>void,private readonly identity:(config:JevConfig)=>string=()=> ''){this.backends.set(backend.id,backend)}
  private key(value:JevConfig){return createHash('sha256').update(connectionConfig(value)+'\n'+this.identity(value)).digest('hex')}
  connection(value:JevConfig):JevConnection {
    try {
      if(!value.model)throw new JevError('请选择独立的内网决策模型')
      if(!this.backends.has(value.backend))throw new JevError('官方 JEV 扩展尚未接入')
      this.ready(value)
      const key=this.key(value),job=this.diagnostic
      if(job?.key===key&&job.result.status==='checking')return {state:'checking',message:'正在验证连接及结构化决策格式'}
      const last=this.store.validation(key)
      if(last){
        const runtime=this.store.history().filter(t=>connectionConfig(t.config)===connectionConfig(value)).at(-1)
        if(last.status==='passed'&&runtime?.status==='error'&&runtime.at>(last.finishedAt??''))return {state:'error',message:runtime.summary,checkedAt:runtime.at}
        return {state:last.status==='passed'?'ready':'error',message:last.message,checkedAt:last.finishedAt}
      }
      return {state:'unverified',message:'配置已填写，尚未通过连接及决策格式检查'}
    }catch(e){return {state:'unconfigured',message:e instanceof JevError?e.message:'模型账号暂不可用'}}
  }
  update(revision:number,value:unknown){return this.store.update(revision,value,candidate=>{if(candidate.enabled&&this.connection(candidate).state!=='ready')throw new JevError('请先检查此配置的内网模型，通过后再开启 JEV')})}
  startDiagnostic(raw:unknown):JevDiagnostic {
    const value=config(raw)
    if(this.diagnostic?.result.status==='checking')throw new JevError('已有模型检查正在进行，请等待或取消')
    this.ready(value)
    const backend=this.backends.get(value.backend);if(!backend)throw new JevError('官方 JEV 扩展尚未接入')
    const key=this.key(value),started=Date.now(),controller=new AbortController()
    const result:JevDiagnostic={id:randomUUID(),config:value,startedAt:new Date(started).toISOString(),status:'checking',message:'正在请求所选内网模型…',elapsedMs:0}
    const job={key,result,controller,done:Promise.resolve()};this.diagnostic=job
    job.done=(async()=>{
      const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(value.timeoutMs)])
      try{
        result.decision=await backend.assess({stage:'begin',scope:'diagnostic',config:{...value,enabled:true},context:'连通性测试：用户要求将“你好”作为问候语复述，不执行工具、不修改文件。'},signal)
        signal.throwIfAborted()
        if(result.decision.decision!=='allow')throw new JevError('模型已响应，但诊断未通过：'+result.decision.summary)
        result.status='passed';result.message='连接及决策格式检查通过；业务结果仍需逐次核对'
      }catch(e){result.status=controller.signal.aborted?'cancelled':'failed';result.message=controller.signal.aborted?'检查已取消':e instanceof JevError?e.message:signal.aborted?'检查超时，请核对服务或调整超时设置':'连接检查失败，请核对模型账号与服务'}
      result.finishedAt=new Date().toISOString();result.elapsedMs=Date.now()-started
      const completed=structuredClone(result);result.status='checking'
      try{await this.store.validate(key,completed);Object.assign(result,completed)}catch{result.status='failed';result.message='检查记录保存失败，请重试；不能启用未经保存确认的配置'}
    })()
    return structuredClone(result)
  }
  diagnosticStatus(){const d=this.diagnostic?.result;return d?structuredClone({...d,elapsedMs:d.status==='checking'?Date.now()-Date.parse(d.startedAt):d.elapsedMs}):undefined}
  async cancelDiagnostic(id:string){const job=this.diagnostic;if(!job||job.result.id!==id)throw new JevError('此检查已结束或不属于当前任务');if(job.result.status==='checking')job.controller.abort();await job.done;return this.diagnosticStatus()}
  async close(){if(this.diagnostic?.result.status==='checking')this.diagnostic.controller.abort();await this.diagnostic?.done;this.active.clear();await this.store.close()}
  begin(scope:string){return new JevRun(this,scope)}
  status(scope?:string):JevStatus {
    const config=this.store.snapshot(),connection=this.connection(config.value);let state:JevStatus['state']=config.value.enabled?(connection.state==='ready'?'ready':'unavailable'):'off',message=config.value.enabled?connection.message:'全局已关闭；保留模型设置，可独立检查连接'
    const last=this.store.history().at(-1)
    if(state==='ready'&&last?.revision===config.revision&&last.status==='error'){state='unavailable';message=last.summary}
    return {config,state,message,connection,diagnostic:this.diagnosticStatus(),active:[...this.active.values()].filter(r=>!scope||r.scope===scope).map(r=>({...r})),descriptor,traces:this.store.history(scope)}
  }
  /** Explicit extension point. Installing an official backend does not change the default. */
  registerBackend(backend:JevBackend){if(this.backends.has(backend.id))throw new JevError('JEV 后端已登记');this.backends.set(backend.id,backend);return()=>this.backends.delete(backend.id)}
  async text(scope:string,prompt:string,model:(prompt:string)=>Promise<string>,signal?:AbortSignal){const run=this.begin(scope);try{await run.check('begin',prompt,signal);const output=await model(prompt+run.guidance());const reviewed=await run.check('review',{input:prompt,output},signal);if(reviewed?.decision==='clarify')throw new JevError('JEV 结果需要确认，未自动采用：'+reviewed.summary);return output}finally{run.finish()}}
}
