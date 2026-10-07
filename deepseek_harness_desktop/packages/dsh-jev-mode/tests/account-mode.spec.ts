// @vitest-environment node
import {afterEach,expect,it,vi} from 'vitest'
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {defaults,config,connectionConfig,type JevConfig} from '../src/core/contract.ts'
import {accountCatalog,SelfOwnedBackend} from '../src/host/backend.ts'
import {accountKey,modelAccount} from '../src/host/model-account.ts'
import {JevService} from '../src/host/service.ts'
import {createHash} from 'node:crypto'
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
it('normalizes missing and legacy routing to the sole configured-model route',()=>{
  expect(config({...defaults,connectionMode:undefined}).connectionMode).toBe('account')
  expect(config({...defaults,connectionMode:'intranet'}).connectionMode).toBe('account')
  expect(config(choice).connectionMode).toBe('account')
  expect(()=>config({...choice,connectionMode:'anything'})).toThrow('连接方式')
})
it('resolves the same DeepSeek address and credential reference defaults without connecting',async()=>{
  const f=fixture();expect(modelAccount(f.ctx,choice.model)).toMatchObject({baseURL:'https://api.deepseek.com',credentialRef:'DEEPSEEK_API_KEY'})
  expect(()=>f.backend.ready(choice)).not.toThrow()
  const catalog=await accountCatalog(f.ctx);expect(catalog[0]).toMatchObject({available:true,models:[{id:choice.model}]})
  expect(f.stream).not.toHaveBeenCalled();expect(f.resolve).not.toHaveBeenCalled();expect(JSON.stringify(catalog)).not.toContain('private-key-test')
})
it('honors account and launch addresses without JEV-specific endpoint restrictions',()=>{
  const f=fixture();vi.stubEnv('DEEPSEEK_BASE_URL','https://api.deepseek.com');f.env.DEEPSEEK_BASE_URL='http://10.1.2.3/v1'
  expect(modelAccount(f.ctx,choice.model).baseURL).toBe('http://10.1.2.3/v1')
  f.profile.baseURL='http://127.0.0.1:1234/v1';expect(modelAccount(f.ctx,choice.model).baseURL).toBe('http://127.0.0.1:1234/v1')
  f.profile.baseURL='http://8.8.8.8/v1';expect(()=>f.backend.ready(choice)).not.toThrow()
  expect(f.stream).not.toHaveBeenCalled()
})
it('lets the credentials service own fallback and supports anonymous/custom inline credentials',async()=>{
  const f=fixture();f.env.DEEPSEEK_API_KEY='ambient-key';f.services.credentials.resolve=async()=>undefined
  expect(await accountKey(f.ctx,modelAccount(f.ctx,choice.model))).toBe('')
  delete f.services.credentials;expect(await accountKey(f.ctx,modelAccount(f.ctx,choice.model))).toBe('ambient-key')
  f.profile.apiKey='inline';expect(await accountKey(f.ctx,modelAccount(f.ctx,choice.model))).toBe('inline')
})
it('uses the registered chat adapter for both legacy and current configurations and returns only structured text',async()=>{
  const f=fixture();f.stream.mockImplementation(async function*(){yield {type:'reasoning-delta',text:'hidden-reasoning'} as any;yield {type:'text-delta',text:JSON.stringify(pass)};yield {type:'finish',reason:{kind:'stop'}}})
  const signal=new AbortController().signal
  expect(await f.backend.assess({stage:'begin',scope:'diagnostic',context:'hello',config:{...choice,reasoningEffort:'low'}},signal)).toEqual(pass)
  expect(f.stream.mock.calls[0]?.[0]).toMatchObject({provider:'deepseek-official',model:'deepseek-flash',reasoningEffort:'low',maxTokens:8192,signal})
  expect(f.stream.mock.calls[0]?.[0].tools).toBeUndefined()
  expect(await f.backend.assess({stage:'begin',scope:'diagnostic',context:'hello',config:{...choice,connectionMode:'intranet'}},signal)).toEqual(pass)
  expect(f.stream).toHaveBeenCalledTimes(2)
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
it('retains checks for unchanged model settings and invalidates changed account identity',async()=>{
  const f=fixture(),root=await mkdtemp(join(tmpdir(),'jev-accounts-'));roots.push(root)
  const store=new JevStore(root);await store.init();const service=new JevService(store,f.backend,c=>f.backend.ready(c),c=>f.backend.identity(c))
  await f.backend.refreshIdentity(choice);service.startDiagnostic(choice)
  await vi.waitFor(()=>expect(service.connection(choice).state).toBe('ready'))
  expect(service.connection(choice).state).toBe('ready')
  await service.update(0,{...choice,enabled:true});const run=service.begin('native:test')
  await service.update(1,{...choice,enabled:false,connectionMode:'intranet'})
  expect(run.snapshot.value.connectionMode).toBe('account');run.finish()
  const reload=new JevStore(root);await reload.init();expect(reload.snapshot().value.connectionMode).toBe('account')
  f.profile.baseURL='https://another-configured-host.example';expect(service.connection(choice).state).toBe('unverified')
  expect(JSON.stringify(store.history())).not.toContain('private-key-test')
})

it.each([undefined,'intranet'] as const)('migrates legacy routing %s without losing switches, order or the original file',async mode=>{
  const f=fixture(),root=await mkdtemp(join(tmpdir(),'jev-routing-'));roots.push(root)
  const value={...choice,connectionMode:mode,enabled:true,candidates:[{id:'first',model:choice.model,enabled:true,reasoningEffort:''},{id:'off',model:'deepseek-official/other',enabled:false,reasoningEffort:'low'}]}
  const original=JSON.stringify({schema:2,revision:7,value},null,2)
  await writeFile(join(root,'config.json'),original)
  const store=new JevStore(root);await store.init();const service=new JevService(store,f.backend,c=>f.backend.ready(c),c=>f.backend.identity(c))
  expect(store.snapshot()).toMatchObject({revision:7,value:{...value,connectionMode:'account'}})
  expect(await readFile(join(root,'config.json'),'utf8')).toBe(original)
  expect(service.status().connection?.state).toBe('unverified')
  const run=service.begin('native:migrated');await expect(run.check('begin','hello')).rejects.toThrow('先检查');run.finish();expect(f.stream).not.toHaveBeenCalled()
  await f.backend.refreshIdentity(store.snapshot().value);service.startDiagnostic(store.snapshot().value)
  await vi.waitFor(()=>expect(service.diagnosticStatus()?.status).toBe('passed'))
  await service.update(7,store.snapshot().value)
  expect(await readFile(join(root,'config.before-model-routing.json'),'utf8')).toBe(original)
  await service.update(8,{...store.snapshot().value,enabled:false})
  expect(await readFile(join(root,'config.before-model-routing.json'),'utf8')).toBe(original)
  const reload=new JevStore(root);await reload.init();expect(reload.requiresModelCheck()).toBe(false)
  expect(reload.snapshot().value).toMatchObject({enabled:false,connectionMode:'account',candidates:value.candidates})
  expect(new JevService(reload,f.backend,c=>f.backend.ready(c),c=>f.backend.identity(c)).connection(reload.snapshot().value).state).toBe('ready')
})
it('reuses persisted account checks but never treats strict transport checks as verified',async()=>{
  const f=fixture(),root=await mkdtemp(join(tmpdir(),'jev-validation-'));roots.push(root)
  const store=new JevStore(root);await store.init();await f.backend.refreshIdentity(choice)
  const key=(mode:'account'|'intranet')=>createHash('sha256').update(connectionConfig({...choice,connectionMode:mode})+'\n'+f.backend.identity(choice)).digest('hex')
  const result={id:'old-check',config:choice,startedAt:new Date().toISOString(),finishedAt:new Date().toISOString(),status:'passed' as const,message:'passed',elapsedMs:1,decision:pass as any}
  await store.validate(key('intranet'),result)
  const service=new JevService(store,f.backend,c=>f.backend.ready(c),c=>f.backend.identity(c))
  expect(service.connection(choice).state).toBe('unverified')
  await store.validate(key('account'),result);expect(service.connection(choice).state).toBe('ready')
  f.services.credentials.resolve=async()=>({value:'changed-secret'});await f.backend.refreshIdentity(choice)
  expect(service.connection(choice).state).toBe('unverified')
})
