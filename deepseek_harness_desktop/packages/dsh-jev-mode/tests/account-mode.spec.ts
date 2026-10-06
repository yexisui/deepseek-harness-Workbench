// @vitest-environment node
import {afterEach,expect,it,vi} from 'vitest'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {defaults,config,type JevConfig} from '../src/core/contract.ts'
import {account,accountCatalog,SelfOwnedBackend} from '../src/host/backend.ts'
import {accountKey,modelAccount} from '../src/host/model-account.ts'
import {JevService} from '../src/host/service.ts'
import {JevStore} from '../src/host/store.ts'
const roots:string[]=[]
afterEach(async()=>{vi.unstubAllEnvs();await Promise.all(roots.splice(0).map(r=>rm(r,{recursive:true,force:true})))})
const pass={decision:'allow',summary:'有依据',missing:[],checks:[{criterion:'问候',verdict:'supported',evidence:'用户要求'}]}
const choice:JevConfig={...defaults,model:'deepseek-official/deepseek-flash',connectionMode:'account'}
function fixture(profile:any={}){
  const stream=vi.fn(async function*(_options:any){yield {type:'text-delta',text:JSON.stringify(pass)};yield {type:'finish',reason:{kind:'stop'}}})
  const llm={stream,listProviders:()=>[{id:'deepseek-official'}],listConfigurableProviders:()=>[{provider:'deepseek-official',displayName:'DeepSeek',settingsNs:'llm-deepseek',settingsPath:[]}],listModels:vi.fn(async()=>[{id:'deepseek-flash',name:'Flash'}]),resolveModelInfo:vi.fn(async()=>({reasoning:{efforts:[{id:'low'}]}}))}
  const env:Record<string,string>={},resolve=vi.fn(async()=>({value:'private-key-test'}))
  const services:any={llm,settings:{get:()=>profile},launchEnvironment:{get:(name:string)=>env[name]===undefined?undefined:{value:env[name]}},credentials:{resolve}}
  const ctx:any={get:(name:string)=>services[name]}
  return {ctx,profile,env,llm,stream,services,resolve,backend:new SelfOwnedBackend(ctx)}
}
it('keeps old configurations strictly intranet and validates explicit connection modes',()=>{
  expect(config(defaults).connectionMode).toBeUndefined()
  expect(config(choice).connectionMode).toBe('account')
  expect(()=>config({...choice,connectionMode:'anything'})).toThrow('连接方式')
})
it('resolves the same DeepSeek address and credential reference defaults without connecting',async()=>{
  const f=fixture();expect(modelAccount(f.ctx,choice.model)).toMatchObject({baseURL:'https://api.deepseek.com',credentialRef:'DEEPSEEK_API_KEY'})
  expect(()=>account(f.ctx,choice.model)).toThrow('复用模型账号')
  expect(()=>f.backend.ready(choice)).not.toThrow()
  const catalog=await accountCatalog(f.ctx);expect(catalog[0]).toMatchObject({available:false,configured:{available:true},models:[{id:choice.model}]})
  expect(f.stream).not.toHaveBeenCalled();expect(f.resolve).not.toHaveBeenCalled();expect(JSON.stringify(catalog)).not.toContain('private-key-test')
})
it('honors launch snapshots and explicit internal endpoints, never silently falling back to public',()=>{
  const f=fixture();vi.stubEnv('DEEPSEEK_BASE_URL','https://api.deepseek.com');f.env.DEEPSEEK_BASE_URL='http://10.1.2.3/v1'
  expect(account(f.ctx,choice.model).url.href).toBe('http://10.1.2.3/v1/chat/completions')
  f.profile.baseURL='http://127.0.0.1:1234/v1';expect(account(f.ctx,choice.model).url.port).toBe('1234')
  f.profile.baseURL='http://8.8.8.8/v1';expect(()=>account(f.ctx,choice.model)).toThrow('公网')
  expect(f.stream).not.toHaveBeenCalled()
})
it('lets the credentials service own fallback and supports anonymous/custom inline credentials',async()=>{
  const f=fixture();f.env.DEEPSEEK_API_KEY='ambient-key';f.services.credentials.resolve=async()=>undefined
  expect(await accountKey(f.ctx,modelAccount(f.ctx,choice.model))).toBe('')
  delete f.services.credentials;expect(await accountKey(f.ctx,modelAccount(f.ctx,choice.model))).toBe('ambient-key')
  f.profile.apiKey='inline';expect(await accountKey(f.ctx,modelAccount(f.ctx,choice.model))).toBe('inline')
})
it('uses the registered chat adapter only in explicit account mode and returns only structured text',async()=>{
  const f=fixture();f.stream.mockImplementation(async function*(){yield {type:'reasoning-delta',text:'hidden-reasoning'} as any;yield {type:'text-delta',text:JSON.stringify(pass)};yield {type:'finish',reason:{kind:'stop'}}})
  const signal=new AbortController().signal
  expect(await f.backend.assess({stage:'begin',scope:'diagnostic',context:'hello',config:{...choice,reasoningEffort:'low'}},signal)).toEqual(pass)
  expect(f.stream.mock.calls[0]?.[0]).toMatchObject({provider:'deepseek-official',model:'deepseek-flash',reasoningEffort:'low',maxTokens:8192,signal})
  expect(f.stream.mock.calls[0]?.[0].tools).toBeUndefined()
  await expect(f.backend.assess({stage:'begin',scope:'diagnostic',context:'hello',config:{...choice,connectionMode:'intranet'}},signal)).rejects.toThrow('严格内网')
  expect(f.stream).toHaveBeenCalledTimes(1)
})
it('rejects unsupported reasoning before model transport and respects pre-cancellation',async()=>{
  const f=fixture(),input={stage:'begin' as const,scope:'diagnostic',context:'hello',config:{...choice,reasoningEffort:'high' as const}}
  await expect(f.backend.assess(input,new AbortController().signal)).rejects.toThrow('思考强度')
  const controller=new AbortController();controller.abort();await expect(f.backend.assess(input,controller.signal)).rejects.toThrow('取消')
  expect(f.stream).not.toHaveBeenCalled()
})
it.each([
  [{kind:'error',failure:{status:401,message:'private-key-test'}},'鉴权'],
  [{kind:'error',failure:{status:429}},'限流'],
  [{kind:'max-tokens'},'长度上限'],
  [{kind:'aborted'},'取消'],
])('sanitizes terminal adapter failures %j',async(reason,text)=>{
  const f=fixture();f.stream.mockImplementation(async function*(){yield {type:'finish',reason} as any})
  await expect(f.backend.assess({stage:'begin',scope:'diagnostic',context:'hello',config:choice},new AbortController().signal)).rejects.toThrow(text)
})
it('rejects an incomplete stream even when its text looks like a valid decision',async()=>{
  const f=fixture();f.stream.mockImplementation(async function*(){yield {type:'text-delta',text:JSON.stringify(pass)}})
  await expect(f.backend.assess({stage:'begin',scope:'diagnostic',context:'hello',config:choice},new AbortController().signal)).rejects.toThrow('提前结束')
})
it('keeps account-mode validation, persistence and round snapshots separate from strict mode',async()=>{
  const f=fixture(),root=await mkdtemp(join(tmpdir(),'jev-accounts-'));roots.push(root)
  const store=new JevStore(root);await store.init();const service=new JevService(store,f.backend,c=>f.backend.ready(c),c=>f.backend.identity(c))
  await f.backend.refreshIdentity(choice);service.startDiagnostic(choice)
  await vi.waitFor(()=>expect(service.connection(choice).state).toBe('ready'))
  expect(service.connection({...choice,connectionMode:'intranet'}).state).toBe('unconfigured')
  await service.update(0,{...choice,enabled:true});const run=service.begin('native:test')
  await service.update(1,{...choice,enabled:false,connectionMode:'intranet'})
  expect(run.snapshot.value.connectionMode).toBe('account');run.finish()
  const reload=new JevStore(root);await reload.init();expect(reload.snapshot().value.connectionMode).toBe('intranet')
  f.profile.baseURL='https://another-configured-host.example';expect(service.connection(choice).state).toBe('unverified')
  expect(JSON.stringify(store.history())).not.toContain('private-key-test')
})
