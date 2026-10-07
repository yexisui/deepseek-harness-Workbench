import {candidates,candidateConfig,JevError,JevTechnicalError,type Decision,type JevAttempt,type JevBackend,type JevConfig,type JevTrace} from '../core/contract.ts'

/** Bound even adapters that fail to settle promptly after cancellation. */
export function abortable<T>(work:()=>Promise<T>,signal:AbortSignal):Promise<T>{
  signal.throwIfAborted()
  return new Promise((resolve,reject)=>{
    const abort=()=>reject(signal.reason);signal.addEventListener('abort',abort,{once:true})
    try{work().then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort))}catch(e){signal.removeEventListener('abort',abort);reject(e)}
  })
}

export async function candidateChain(input:{
  config:JevConfig;stage:JevTrace['stage'];scope:string;context:string;backend:JevBackend;
  signal?:AbortSignal;attempts:JevAttempt[];ready:(value:JevConfig)=>void;
  consume?:()=>void;progress?:(attempt:JevAttempt,total:number)=>void;
  diagnostic?:boolean;completed?:(config:JevConfig,attempt:JevAttempt,decision?:Decision)=>Promise<void>;
}):Promise<Decision>{
  const rows=candidates(input.config),total=AbortSignal.timeout(input.config.totalTimeoutMs??(input.config.candidates?90000:input.config.timeoutMs))
  const chainSignal=AbortSignal.any([total,...(input.signal?[input.signal]:[])])
  let accepted:Decision|undefined
  for(let index=0;index<rows.length;index++){
    if(chainSignal.aborted)throw new JevError(input.signal?.aborted?'JEV 检查已取消':'JEV 候选链达到总超时，当前自动步骤已停止')
    const row=rows[index]!,cfg=candidateConfig(input.config,row),attempt:JevAttempt={candidateId:row.id,model:row.model,position:index+1,status:'skipped',summary:'已关闭，跳过',elapsedMs:0}
    input.attempts.push(attempt)
    if(!row.enabled)continue
    try{input.ready(cfg)}catch(e){attempt.summary=e instanceof JevError?e.message:'模型账号暂不可用，跳过';continue}
    try{input.consume?.()}catch(e){attempt.status='error';attempt.summary=e instanceof JevError?e.message:'本轮调用次数已用尽';throw e}
    const started=Date.now(),perAttempt=AbortSignal.timeout(cfg.timeoutMs),signal=AbortSignal.any([chainSignal,perAttempt])
    Object.assign(attempt,{status:'checking',summary:'正在检查'});input.progress?.(attempt,rows.length)
    let result:Decision|undefined,fatal=false
    try{
      result=await abortable(()=>input.backend.assess({config:cfg,stage:input.stage,scope:input.scope,context:input.context},signal),signal)
      signal.throwIfAborted()
      Object.assign(attempt,{status:result.decision==='allow'?'allowed':result.decision==='block'?'blocked':'clarify',summary:result.summary})
      if(!accepted||result.decision==='allow')accepted=result
    }catch(e){
      attempt.status=input.signal?.aborted?'cancelled':'error'
      attempt.summary=input.signal?.aborted?'JEV 检查已取消':total.aborted?'JEV 候选链达到总超时':perAttempt.aborted?'此模型检查超时':e instanceof JevError?e.message:'JEV 检查失败或超时；当前自动步骤已停止'
      // Unknown programming/service errors are not silently treated as provider failures.
      fatal=chainSignal.aborted||!perAttempt.aborted&&!(e instanceof JevTechnicalError)
    }
    attempt.elapsedMs=Date.now()-started
    await input.completed?.(cfg,attempt,result)
    if(fatal)throw new JevError(attempt.summary)
    if(result&&!input.diagnostic)return result
  }
  if(accepted)return accepted
  throw new JevError(input.attempts.some(a=>a.status==='error')?'全部启用模型检查失败，当前自动步骤已停止':'没有可执行的启用模型，请添加并开启可用的模型')
}
