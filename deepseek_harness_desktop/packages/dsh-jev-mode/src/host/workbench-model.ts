import type {Context} from '@deepseek-ai/cordis'
import {createHash,randomUUID} from 'node:crypto'
import type {Message} from '@deepseek-ai/dsh-llm'
import {decision,JevError,JevTechnicalError,type JevBackend,type JevConfig} from '../core/contract.ts'
import {modelAccount,accountKey} from './model-account.ts'
import {reviewPrompt} from './review-prompt.ts'

/** Delegate transport and credentials to the configured chat adapter. */
export class WorkbenchModel {
  private credentials=new Map<string,string>()
  constructor(private ctx:Context){}
  account(config:JevConfig){
    const selected=modelAccount(this.ctx,config.model)
    if(!selected.llm.listProviders().some(p=>p.id===selected.provider)||typeof selected.llm.stream!=='function')throw new JevError('所选模型账号未启用，请到模型设置检查')
    return selected
  }
  async refreshIdentity(config:JevConfig){
    try{const selected=this.account(config);this.credentials.set(config.model,createHash('sha256').update(await accountKey(this.ctx,selected)).digest('hex'))}catch{this.credentials.delete(config.model)}
  }
  identity(config:JevConfig){const a=this.account(config);return JSON.stringify([a.provider,a.profile,a.baseURL,a.credentialRef,this.credentials.get(config.model)??'unresolved'])}
  async assess(input:Parameters<JevBackend['assess']>[0],signal:AbortSignal){
    const selected=this.account(input.config)
    let raw='',finished=false,key=''
    try{
      signal.throwIfAborted();key=await accountKey(this.ctx,selected);signal.throwIfAborted()
      const requested=input.config.reasoningEffort
      const info=requested?await selected.llm.resolveModelInfo(selected.provider,selected.model,signal):undefined
      const reasoningEffort=info?.reasoning?.efforts.find(e=>e.id===requested)?.id
      if(requested&&!reasoningEffort)throw new JevTechnicalError('此模型不支持所选思考强度，请改为模型默认或其他支持的强度')
      for await(const chunk of selected.llm.stream({provider:selected.provider,model:selected.model,system:reviewPrompt,
        messages:[{id:randomUUID() as Message['id'],role:'user',content:[{type:'text',text:JSON.stringify({stage:input.stage,scope:input.scope,data:input.context})}],source:{kind:'user'}}],
        maxTokens:8192,temperature:0,...(reasoningEffort?{reasoningEffort}:{}),signal})){
        signal.throwIfAborted()
        if(chunk.type==='text-delta')raw+=chunk.text
        if(raw.length>256*1024)throw new JevTechnicalError('JEV 返回超出限制')
        if(chunk.type==='finish'){
          finished=true
          if(chunk.reason.kind==='max-tokens')throw new JevTechnicalError('模型输出达到长度上限；请降低思考强度后重试')
          if(chunk.reason.kind==='error')throw modelFailure(chunk.reason.failure)
          if(chunk.reason.kind==='aborted')throw new JevTechnicalError('JEV 检查已取消或超时')
        }
      }
      signal.throwIfAborted()
      if(!finished)throw new JevTechnicalError('模型响应提前结束，请重试')
    }catch(e){throw e instanceof JevError?e:signal.aborted?new JevTechnicalError('JEV 检查已取消或超时'):modelFailure(e)}
    return decision(key?raw.split(key).join('[凭据已隐藏]'):raw)
  }
}
function modelFailure(error:unknown){
  const e=error as {code?:string;status?:number}|undefined
  const message=e?.status===401||e?.status===403||['AUTH','MISSING_CREDENTIAL','INVALID_CREDENTIAL'].includes(e?.code??'')?'模型账号鉴权失败，请检查账号凭据或权限':
    e?.status===402||['QUOTA','QUOTA_EXCEEDED'].includes(e?.code??'')?'模型账号额度不足，请检查余额或配额':
    e?.status===429||e?.code==='RATE_LIMIT'?'模型服务限流，请稍后重试':
    e?.status===404||e?.code==='MODEL_NOT_FOUND'?'账号不支持所选模型，请检查模型名称':
    e?.code==='TIMEOUT'?'模型请求超时，请检查连接或调整超时设置':(e?.status??0)>=500||e?.code==='SERVER'?'模型服务暂时不可用，请稍后重试':'模型调用失败，请检查账号、模型和连接设置'
  return new JevTechnicalError(message)
}
