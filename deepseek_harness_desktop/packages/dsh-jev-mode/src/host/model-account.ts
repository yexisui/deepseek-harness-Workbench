import type {Context} from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-llm'
import type {} from '@deepseek-ai/dsh-settings'
import {JevError, type JevModel} from '../core/contract.ts'

export function launchValue(ctx:Context,name:string):string|undefined {
  const environment=ctx.get('launchEnvironment' as never) as unknown as {get(name:string):{value:string}|undefined}|undefined
  return environment ? environment.get(name)?.value : process.env[name]
}
/** Resolve account facts locally. Never discover models or connect while opening settings. */
export function modelAccount(ctx:Context,modelRoute:string){
  const slash=modelRoute.indexOf('/')
  if(slash<1||!modelRoute.slice(slash+1))throw new JevError('请为 JEV 选择一个决策模型')
  const provider=modelRoute.slice(0,slash),model=modelRoute.slice(slash+1),llm=ctx.get('llm'),settings=ctx.get('settings')
  const route=llm?.listConfigurableProviders().find(p=>p.provider===provider)
  if(!route||route.error||!settings)throw new JevError('JEV 所选工作台模型账号尚不可用')
  let profile:any=settings.get(route.settingsNs)
  for(const key of route.settingsPath)profile=profile?.[key]
  if(!profile||typeof profile!=='object')throw new JevError('无法解析 JEV 模型账号')
  const deepseek=provider==='deepseek-official'
  const baseURL=profile.baseURL??profile.baseUrl??(deepseek?launchValue(ctx,'DEEPSEEK_BASE_URL')??'https://api.deepseek.com':'')
  const credentialRef=typeof profile.apiKeyEnv==='string'?profile.apiKeyEnv:deepseek?'DEEPSEEK_API_KEY':''
  const key=typeof profile.apiKey==='string'?profile.apiKey:''
  const models:JevModel[]=Array.isArray(profile.models)?profile.models.filter((m:any)=>m&&typeof m.id==='string'&&m.id.length<=250).map((m:any)=>({id:provider+'/'+m.id,name:typeof m.name==='string'?m.name.slice(0,250):m.id,...(m.reasoning===false?{reasoning:[]}:Array.isArray(m.reasoningEfforts)?{reasoning:m.reasoningEfforts.filter((v:unknown)=>['low','medium','high'].includes(String(v)))}:{})})):[]
  return {provider,model,llm:llm!,profile,baseURL,credentialRef,key,models}
}
export async function accountKey(ctx:Context,selected:{key:string;credentialRef:string}){
  if(selected.key)return selected.key
  if(!selected.credentialRef)return ''
  const credentials=ctx.get('credentials' as never) as unknown as {resolve(ref:string):Promise<{value:string}|undefined>}|undefined
  // Match the host: when the credentials service exists it owns environment fallback.
  return credentials?(await credentials.resolve(selected.credentialRef))?.value??'':launchValue(ctx,selected.credentialRef)??''
}
