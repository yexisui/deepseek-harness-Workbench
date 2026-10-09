import { execution, step } from '../../../../shared/host/execution.ts'
import { createHash, randomUUID } from 'node:crypto'
import { config, candidates, hasEnabledModel, candidateConfig, connectionConfig, type JevAttempt, JevError, descriptor, type Decision, type JevBackend, type JevConfig, type JevStatus, type JevTrace, type JevActiveRun, type JevConnection, type JevDiagnostic } from '../core/contract.ts'
import { candidateChain } from './candidate-chain.ts'
import { JevStore } from './store.ts'
export class JevRun {
  readonly id=randomUUID()
  readonly snapshot: ReturnType<JevStore['snapshot']>
  private count=0
  private calls=0
  private last:Decision|undefined
  constructor(private service:JevService,readonly scope:string){this.snapshot=service.store.snapshot();this.snapshot.value.candidates?.forEach(Object.freeze);if(this.snapshot.value.candidates)Object.freeze(this.snapshot.value.candidates);Object.freeze(this.snapshot.value);Object.freeze(this.snapshot);service.active.set(this.id,{id:this.id,scope,revision:this.snapshot.revision,enabled:this.enabled,model:this.snapshot.value.model,startedAt:new Date().toISOString(),phase:'working'})}
  get enabled(){return this.snapshot.value.enabled}
  finish(){this.service.active.delete(this.id)}
  guidance(){return this.last?`\nJEV 本轮附加审查（不能扩大岗位权限；事实仍须核对）：${JSON.stringify(this.last)}`:''}
  async check(stage:JevTrace['stage'],context:unknown,signal?:AbortSignal):Promise<Decision|undefined>{
    if(!this.enabled){execution()?.jev({enabled:false,revision:this.snapshot.revision,runId:this.id});return undefined}
    const started=Date.now(),cfg=this.snapshot.value
    execution()?.jev({enabled:this.enabled,revision:this.snapshot.revision,runId:this.id})
    const eventKey='jev-'+stage+'-'+this.count
    step(eventKey,stage==='begin'?'JEV前置评估':stage==='review'?'JEV结果复核':'JEV动作检查','running')
    const active=this.service.active.get(this.id);if(active)Object.assign(active,{phase:'checking',stage,checkingSince:new Date(started).toISOString()})
    const attempts:JevAttempt[]=[]
    let result:Decision|undefined,status:JevTrace['status']='error',summary='JEV 检查未完成'
    try{
      signal?.throwIfAborted()
      if(++this.count>cfg.maxChecks)throw new JevError('JEV 本轮达到检查次数上限；当前自动动作已停止，可新开一轮')
      const backend=this.service.backends.get(cfg.backend);if(!backend)throw new JevError('官方 JEV 扩展接口已预留，尚未接入；不会调用官网')
      const raw=typeof context==='string'?context:JSON.stringify(context)
      if(raw.length>cfg.maxContextChars&&stage==='action')throw new JevError('JEV 动作证据超出上下文限制；未完整审查，当前自动动作已停止')
      result=await candidateChain({config:cfg,stage,scope:this.scope,backend,signal,attempts,ready:this.service.ready,
        context:raw.length>cfg.maxContextChars?raw.slice(0,cfg.maxContextChars)+'\n[内容已截断，缺失内容不能作为通过依据]':raw,
        consume:()=>{if(++this.calls>cfg.maxChecks)throw new JevError('JEV 本轮模型调用达到次数上限；当前自动动作已停止')},
        completed:async(_cfg,attempt)=>{step(eventKey+'-candidate-'+attempt.position,'审查候选 '+attempt.position,attempt.status==='error'?'failed':attempt.status==='cancelled'?'stopped':attempt.status==='allowed'?'done':'review',attempt.summary,{model:attempt.model})},
        progress:(attempt,total)=>{step(eventKey+'-candidate-'+attempt.position,'审查候选 '+attempt.position+'/'+total,'running','等待审查模型响应',{model:attempt.model});if(active)Object.assign(active,{model:attempt.model,candidatePosition:attempt.position,candidateTotal:total})}})
      if(raw.length>cfg.maxContextChars&&result.decision==='allow')result={...result,decision:'clarify',summary:'检查上下文超出限制，无法确认完整结果。'+result.summary,missing:[...result.missing,'超出上下文上限的内容尚未核对']}
      this.last=result;status=result.decision==='allow'?'allowed':result.decision==='clarify'?'clarify':'blocked';summary=result.summary
      if(result.decision==='block'||stage==='action'&&result.decision!=='allow')throw new JevError('JEV 已停止当前自动步骤：'+summary)
      return result
    }catch(error){if(status==='error')summary=error instanceof JevError?error.message:signal?.aborted?'JEV 检查已取消':'JEV 检查失败或超时；当前自动步骤已停止';throw new JevError(status==='error'?summary:'JEV 已停止当前自动步骤：'+summary)}
    finally{step(eventKey,stage==='begin'?'JEV前置评估':stage==='review'?'JEV结果复核':'JEV动作检查',signal?.aborted?'stopped':status==='allowed'?'done':status==='error'?'failed':'review',summary+(result?'\n'+result.checks.map(c=>c.criterion+'：'+c.verdict+'；'+c.evidence).join('\n')+'\n'+result.missing.map(x=>'待确认：'+x).join('\n'):''));if(active)Object.assign(active,{phase:'working',checkingSince:undefined,lastStatus:status});await this.service.store.record({id:randomUUID(),at:new Date().toISOString(),runId:this.id,scope:this.scope,stage,revision:this.snapshot.revision,config:cfg,status,summary,decision:result,attempts,elapsedMs:Date.now()-started})}
  }
}
export class JevService {
  readonly backends=new Map<JevConfig['backend'],JevBackend>()
  readonly active=new Map<string,JevActiveRun>()
  private diagnostic?: {keys:Map<string,string>; result:JevDiagnostic; controller:AbortController; done:Promise<void>}
  constructor(readonly store:JevStore,backend:JevBackend,readonly ready:(config:JevConfig)=>void,private readonly identity:(config:JevConfig)=>string=()=> ''){this.backends.set(backend.id,backend)}
  private key(value:JevConfig){return createHash('sha256').update(connectionConfig(value)+'\n'+this.identity(value)).digest('hex')}
  private singleConnection(value:JevConfig):JevConnection {
    try {
      if(!value.model)throw new JevError('请选择独立的决策模型')
      if(!this.backends.has(value.backend))throw new JevError('官方 JEV 扩展尚未接入')
      this.ready(value)
      const key=this.key(value),job=this.diagnostic
      if(job?.result.status==='checking'&&job.keys.get(value.model)===key)return {state:'checking',message:'正在验证连接及结构化决策格式'}
      const last=this.store.validation(key)
      if(last){
        const runtime=this.store.history().flatMap(t=>{const row=candidates(t.config).find(c=>c.model===value.model);if(!row||connectionConfig(candidateConfig(t.config,row))!==connectionConfig(value))return [];const a=t.attempts?.find(a=>a.model===value.model);return a?[{at:t.at,status:a.status,summary:a.summary}]:t.config.candidates?[]:[t]}).at(-1)
        if(last.status==='passed'&&runtime?.status==='error'&&runtime.at>(last.finishedAt??''))return {state:'error',message:runtime.summary,checkedAt:runtime.at}
        return {state:last.status==='passed'?'ready':'error',message:last.status==='passed'?'检查通过':last.message,checkedAt:last.finishedAt}
      }
      return {state:'unverified',message:'尚未检查，可直接调用'}
    }catch(e){return {state:'unconfigured',message:e instanceof JevError?e.message:'模型账号暂不可用'}}
  }
  connection(value:JevConfig):JevConnection {
    if(value.candidates===undefined)return this.singleConnection(value)
    const rows=candidates(value),states=rows.map(row=>({id:row.id,...this.singleConnection(candidateConfig(value,row))}))
    const enabled=states.filter(s=>rows.find(r=>r.id===s.id)?.enabled),ready=enabled.filter(s=>s.state==='ready').length
    if(!enabled.length)return {state:'unconfigured',message:'候选模型全部关闭',candidates:states}
    if(enabled.some(s=>s.state==='checking'))return {state:'checking',message:'正在检查候选模型',candidates:states}
    return {state:ready?'ready':enabled.some(s=>s.state==='unverified')?'unverified':'error',message:ready?'已启用 '+enabled.length+' 项，其中 '+ready+' 项检查通过':'按候选顺序直接调用；检查为可选测试',candidates:states}
  }
  update(revision:number,value:unknown){return this.store.update(revision,value,candidate=>{if(candidate.enabled&&!hasEnabledModel(candidate))throw new JevError('请至少开启一个候选模型')})}
  startDiagnostic(raw:unknown):JevDiagnostic {
    const value=config(raw)
    if(this.diagnostic?.result.status==='checking')throw new JevError('已有模型检查正在进行，请等待或取消')
    const rows=candidates(value);if(!rows.some(c=>c.enabled))throw new JevError('请先开启候选项，或使用该行的“检查”按钮')
    const backend=this.backends.get(value.backend);if(!backend)throw new JevError('官方 JEV 扩展尚未接入')
    const keys=new Map<string,string>();for(const row of rows.filter(r=>r.enabled)){try{keys.set(row.model,this.key(candidateConfig(value,row)))}catch{}}
    const started=Date.now(),controller=new AbortController()
    const result:JevDiagnostic={id:randomUUID(),config:value,startedAt:new Date(started).toISOString(),status:'checking',message:'正在请求所选模型…',elapsedMs:0,attempts:[]}
    const job={keys,result,controller,done:Promise.resolve()};this.diagnostic=job
    job.done=(async()=>{
      const signal=controller.signal
      try{
        result.decision=await candidateChain({config:value,stage:'begin',scope:'diagnostic',backend,signal,attempts:result.attempts!,ready:this.ready,diagnostic:true,
          context:'连通性测试：用户要求将“你好”作为问候语复述，不执行工具、不修改文件。',
          progress:(attempt,total)=>{result.message='正在检查第 '+attempt.position+'/'+total+' 项 · '+attempt.model},
          completed:async(cfg,attempt,decision)=>{
            const completed:JevDiagnostic={id:result.id,config:cfg,startedAt:result.startedAt,finishedAt:new Date().toISOString(),status:attempt.status==='allowed'?'passed':attempt.status==='cancelled'?'cancelled':'failed',message:attempt.status==='allowed'?'检查通过':decision?'模型已响应，但诊断未通过：'+decision.summary:attempt.summary,elapsedMs:attempt.elapsedMs,decision}
            const key=keys.get(cfg.model);if(!key||key!==this.key(cfg))throw new JevError('检查期间模型账号已变更，请重新检查')
            try{await this.store.validate(key,completed)}catch{throw new JevError('检查记录保存失败，请重试')}
          }})
        signal.throwIfAborted()
        if(result.decision.decision!=='allow')throw new JevError('模型已响应，但诊断未通过：'+result.decision.summary)
        result.status='passed';result.message='检查通过'
      }catch(e){result.status=controller.signal.aborted?'cancelled':'failed';result.message=controller.signal.aborted?'检查已取消':e instanceof JevError?e.message:signal.aborted?'检查超时，请核对服务或调整超时设置':'连接检查失败，请核对模型账号与服务'}
      result.finishedAt=new Date().toISOString();result.elapsedMs=Date.now()-started
    })()
    return structuredClone(result)
  }
  diagnosticStatus(){const d=this.diagnostic?.result;return d?structuredClone({...d,elapsedMs:d.status==='checking'?Date.now()-Date.parse(d.startedAt):d.elapsedMs}):undefined}
  async cancelDiagnostic(id:string){const job=this.diagnostic;if(!job||job.result.id!==id)throw new JevError('此检查已结束或不属于当前任务');if(job.result.status==='checking')job.controller.abort();await job.done;return this.diagnosticStatus()}
  async close(){if(this.diagnostic?.result.status==='checking')this.diagnostic.controller.abort();await this.diagnostic?.done;this.active.clear();await this.store.close()}
  begin(scope:string){return new JevRun(this,scope)}
  status(scope?:string):JevStatus {
    const config=this.store.snapshot(),connection=this.connection(config.value)
    // Optional diagnostic history does not grant or revoke execution.
    const callable=this.backends.has(config.value.backend)&&candidates(config.value).some(row=>{if(!row.enabled)return false;try{this.ready(candidateConfig(config.value,row));return true}catch{return false}})
    const state:JevStatus['state']=config.value.enabled?(callable?'ready':'unavailable'):'off',message=config.value.enabled?(callable?'按候选顺序调用已开启模型':'没有可执行的启用模型，请核对模型配置'):'全局已关闭；保留模型设置，可独立检查连接'
    return {config,state,message,connection,diagnostic:this.diagnosticStatus(),active:[...this.active.values()].filter(r=>!scope||r.scope===scope).map(r=>({...r})),descriptor,traces:this.store.history(scope)}
  }
  /** Explicit extension point. Installing an official backend does not change the default. */
  registerBackend(backend:JevBackend){if(this.backends.has(backend.id))throw new JevError('JEV 后端已登记');this.backends.set(backend.id,backend);return()=>this.backends.delete(backend.id)}
  async text(scope:string,prompt:string,model:(prompt:string)=>Promise<string>,signal?:AbortSignal){const run=this.begin(scope);try{await run.check('begin',prompt,signal);const output=await model(prompt+run.guidance());const reviewed=await run.check('review',{input:prompt,output},signal);if(reviewed?.decision==='clarify')throw new JevError('JEV 结果需要确认，未自动采用：'+reviewed.summary);return output}finally{run.finish()}}
}
