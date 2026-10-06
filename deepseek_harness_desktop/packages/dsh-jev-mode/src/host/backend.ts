import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-llm'
import type {} from '@deepseek-ai/dsh-settings'
import { decision, JevError, JevTechnicalError, type JevBackend, type JevConfig, type JevModel, type JevAccount, candidates } from '../core/contract.ts'
import { createHash } from 'node:crypto'
import { endpoint, intranetJson } from './intranet.ts'
import {modelAccount,accountKey} from './model-account.ts'
import {WorkbenchModel} from './workbench-model.ts'
import {reviewPrompt} from './review-prompt.ts'
export function account(ctx:Context,modelRoute:string){
  const selected=modelAccount(ctx,modelRoute)
  if(selected.profile.api&&!['openai-completions','openai-chat-completions','deepseek'].includes(selected.profile.api))throw new JevError('严格内网模式支持 Chat Completions 协议；此账号协议尚未适配')
  const url=endpoint(selected.baseURL)
  if(selected.provider==='deepseek-official'&&url.hostname==='api.deepseek.com')throw new JevError('当前为严格内网模式；此 DeepSeek 账号使用公网服务，请切换为“复用模型账号”，或在模型设置中配置内网地址')
  return {...selected,url}
}
export class SelfOwnedBackend implements JevBackend {
  readonly id='self-owned'
  private workbench:WorkbenchModel
  constructor(private ctx: Context) {this.workbench=new WorkbenchModel(ctx)}
  private credentialHashes=new Map<string,string>()
  async refreshIdentity(config:JevConfig){
    for(const item of candidates(config)){
      if(config.connectionMode==='account'){await this.workbench.refreshIdentity({...config,model:item.model});continue}
      try{const selected=account(this.ctx,item.model);this.credentialHashes.set(item.model,createHash('sha256').update(await this.resolveKey(selected)).digest('hex'))}catch{this.credentialHashes.delete(item.model)}
    }
  }
  private resolveKey(selected:ReturnType<typeof account>){return accountKey(this.ctx,selected)}
  ready(config:JevConfig) {if(config.connectionMode==='account')this.workbench.account(config);else account(this.ctx,config.model)}
  identity(config:JevConfig) {if(config.connectionMode==='account')return this.workbench.identity(config);const a=account(this.ctx,config.model);return JSON.stringify([a.url.href,a.key,a.credentialRef,this.credentialHashes.get(config.model)??'unresolved'])}
  async assess(input: Parameters<JevBackend['assess']>[0],signal:AbortSignal) {
    if(input.config.connectionMode==='account')return this.workbench.assess(input,signal)
    const selected=account(this.ctx,input.config.model)
    let key:string;try{key=await this.resolveKey(selected)}catch{throw new JevTechnicalError('模型凭据当前无法读取，请检查账号配置')}
    const raw=await intranetJson(selected.url,{model:selected.model,stream:false,temperature:0,max_tokens:2000,...(input.config.reasoningEffort?{reasoning_effort:input.config.reasoningEffort}:{}),messages:[
      {role:'system',content:reviewPrompt},
      {role:'user',content:JSON.stringify({stage:input.stage,scope:input.scope,data:input.context})},
    ]},key,signal).catch(e=>{throw e instanceof JevError?e:new JevTechnicalError('内网模型请求参数或连接异常')})
    return decision(key?raw.split(key).join('[凭据已隐藏]'):raw)
  }
}

/** Local catalog only. Ineligible accounts remain visible; dormant built-ins do not. */
export async function accountCatalog(ctx:Context):Promise<JevAccount[]>{
  const llm=ctx.get('llm'),settings=ctx.get('settings');if(!llm||!settings)return []
  const live=new Set((llm.listProviders?.()??[]).map(p=>p.id)),result:JevAccount[]=[]
  for(const route of llm.listConfigurableProviders()){
    let profile:any=settings.get(route.settingsNs);for(const key of route.settingsPath)profile=profile?.[key]
    if(!live.has(route.provider)&&!route.declared&&!profile?.apiKey)continue
    let models:JevModel[]=Array.isArray(profile?.models)?profile.models.filter((m:any)=>m&&typeof m.id==='string'&&m.id.length<=250).map((m:any)=>({id:route.provider+'/'+m.id,name:typeof m.name==='string'?m.name.slice(0,250):m.id,...(m.reasoning===false?{reasoning:[]}:Array.isArray(m.reasoningEfforts)?{reasoning:m.reasoningEfforts.filter((v:unknown)=>['low','medium','high'].includes(String(v)))}:{})})):[]
    // These bundled adapters read resolved settings/catalog models only (no discovery).
    // Do not invoke listModels on arbitrary adapters, which may access the network.
    if(!models.length&&(route.provider==='deepseek-official'||route.settingsNs==='llm-pi-ai')&&live.has(route.provider)){
      try{models=(await llm.listModels(route.provider)).map(m=>({id:route.provider+'/'+m.id,name:m.name??m.id}))}catch{}
    }
    let available=true,message='等待内网连接检查'
    try{account(ctx,route.provider+'/configured-model')}catch(e){available=false;message=e instanceof JevError?e.message:'模型账号暂不可用'}
    let configured={available:true,message:'使用已有模型账号，等待连接检查'}
    try{new WorkbenchModel(ctx).account({model:route.provider+'/configured-model'} as JevConfig)}catch(e){configured={available:false,message:e instanceof JevError?e.message:'模型账号暂不可用'}}
    result.push({id:route.provider,name:route.displayName,models,available,message,configured})
  }
  return result
}
