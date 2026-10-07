import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-llm'
import type {} from '@deepseek-ai/dsh-settings'
import { JevError, type JevBackend, type JevConfig, type JevModel, type JevAccount, candidates } from '../core/contract.ts'
import {WorkbenchModel} from './workbench-model.ts'
export class SelfOwnedBackend implements JevBackend {
  readonly id='self-owned'
  private workbench:WorkbenchModel
  constructor(ctx: Context) {this.workbench=new WorkbenchModel(ctx)}
  async refreshIdentity(config:JevConfig){
    for(const item of candidates(config))await this.workbench.refreshIdentity({...config,model:item.model})
  }
  ready(config:JevConfig) {this.workbench.account(config)}
  identity(config:JevConfig) {return this.workbench.identity(config)}
  assess(input: Parameters<JevBackend['assess']>[0],signal:AbortSignal) {return this.workbench.assess(input,signal)}
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
    let available=true,message='等待连接及决策格式检查'
    try{new WorkbenchModel(ctx).account({model:route.provider+'/configured-model'} as JevConfig)}catch(e){available=false;message=e instanceof JevError?e.message:'模型账号暂不可用'}
    result.push({id:route.provider,name:route.displayName,models,available,message})
  }
  return result
}
