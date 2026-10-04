import { randomUUID } from 'node:crypto'
import { JevError, descriptor, type Decision, type JevBackend, type JevConfig, type JevStatus, type JevTrace } from '../core/contract.ts'
import { JevStore } from './store.ts'
export class JevRun {
  readonly id=randomUUID()
  readonly snapshot: ReturnType<JevStore['snapshot']>
  private count=0
  private last:Decision|undefined
  constructor(private service:JevService,readonly scope:string){this.snapshot=service.store.snapshot()}
  get enabled(){return this.snapshot.value.enabled}
  guidance(){return this.last?`\nJEV 本轮附加审查（不能扩大岗位权限；事实仍须核对）：${JSON.stringify(this.last)}`:''}
  async check(stage:JevTrace['stage'],context:unknown,signal?:AbortSignal):Promise<Decision|undefined>{
    if(!this.enabled)return undefined
    const started=Date.now(),cfg=this.snapshot.value
    let result:Decision|undefined,status:JevTrace['status']='error',summary='JEV 检查未完成'
    try{
      signal?.throwIfAborted()
      if(++this.count>cfg.maxChecks)throw new JevError('JEV 本轮达到检查次数上限；当前自动动作已停止，可新开一轮')
      const backend=this.service.backends.get(cfg.backend);if(!backend)throw new JevError('官方 JEV 扩展接口已预留，尚未接入；不会调用官网')
      const raw=typeof context==='string'?context:JSON.stringify(context)
      if(raw.length>cfg.maxContextChars&&stage==='action')throw new JevError('JEV 动作证据超出上下文限制；未完整审查，当前自动动作已停止')
      const combined=AbortSignal.any([...(signal?[signal]:[]),AbortSignal.timeout(cfg.timeoutMs)])
      result=await backend.assess({stage,scope:this.scope,config:cfg,context:raw.length>cfg.maxContextChars?raw.slice(0,cfg.maxContextChars)+'\n[内容已截断，缺失内容不能作为通过依据]':raw},combined)
      combined.throwIfAborted();this.last=result;status=result.decision==='allow'?'allowed':result.decision==='clarify'?'clarify':'blocked';summary=result.summary
      if(result.decision==='block'||stage==='action'&&result.decision!=='allow')throw new JevError('JEV 已停止当前自动步骤：'+summary)
      return result
    }catch(error){if(status==='error')summary=error instanceof JevError?error.message:signal?.aborted?'JEV 检查已取消':'JEV 检查失败或超时；当前自动步骤已停止';throw new JevError(status==='error'?summary:'JEV 已停止当前自动步骤：'+summary)}
    finally{await this.service.store.record({id:randomUUID(),at:new Date().toISOString(),runId:this.id,scope:this.scope,stage,revision:this.snapshot.revision,config:cfg,status,summary,decision:result,elapsedMs:Date.now()-started})}
  }
}
export class JevService {
  readonly backends=new Map<JevConfig['backend'],JevBackend>()
  constructor(readonly store:JevStore,backend:JevBackend,private readonly ready:(config:JevConfig)=>void){this.backends.set(backend.id,backend)}
  begin(scope:string){return new JevRun(this,scope)}
  status(scope?:string):JevStatus {
    const config=this.store.snapshot();let state:JevStatus['state']=config.value.enabled?'ready':'off',message=config.value.enabled?'内网决策后端已配置；连接以实际检查结果为准':'已关闭；保留独立模型设置'
    if(config.value.enabled)try{if(!this.backends.has(config.value.backend))throw new JevError('官方 JEV 扩展尚未接入');this.ready(config.value)}catch(e){state='unavailable';message=(e as Error).message}
    return {config,state,message,descriptor,traces:this.store.history(scope)}
  }
  /** Explicit extension point. Installing an official backend does not change the default. */
  registerBackend(backend:JevBackend){if(this.backends.has(backend.id))throw new JevError('JEV 后端已登记');this.backends.set(backend.id,backend);return()=>this.backends.delete(backend.id)}
  async text(scope:string,prompt:string,model:(prompt:string)=>Promise<string>,signal?:AbortSignal){const run=this.begin(scope);await run.check('begin',prompt,signal);const output=await model(prompt+run.guidance());const reviewed=await run.check('review',{input:prompt,output},signal);if(reviewed?.decision==='clarify')throw new JevError('JEV 结果需要确认，未自动采用：'+reviewed.summary);return output}
}
