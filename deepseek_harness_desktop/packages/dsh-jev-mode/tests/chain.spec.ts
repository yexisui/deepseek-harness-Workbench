// @vitest-environment node
import {afterEach,expect,it,vi} from 'vitest'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createServer} from 'node:http'
import {defaults,JevTechnicalError,JevError,type Decision,type JevBackend,type JevConfig} from '../src/core/contract.ts'
import {JevStore} from '../src/host/store.ts'
import {JevService} from '../src/host/service.ts'
import {SelfOwnedBackend} from '../src/host/backend.ts'
const roots:string[]=[]
afterEach(async()=>{vi.restoreAllMocks();await Promise.all(roots.splice(0).map(root=>rm(root,{recursive:true,force:true})))})
const pass:Decision={decision:'allow',summary:'有依据',missing:[],checks:[{criterion:'问候',verdict:'supported',evidence:'用户要求'}]}
const cfg:JevConfig={...defaults,enabled:true,candidates:['off','one','two','three'].map((id,i)=>({id,model:'lan/'+id,enabled:i>0,reasoningEffort:''})),totalTimeoutMs:90000}
async function setup(assess:JevBackend['assess'],ready:(value:JevConfig)=>void=()=>{},identity:(value:JevConfig)=>string=()=> ''){
  const root=await mkdtemp(join(tmpdir(),'jev-chain-'));roots.push(root);const store=new JevStore(root);await store.init();await store.update(0,cfg)
  return {root,store,service:new JevService(store,{id:'self-owned',assess},ready,identity)}
}
it('skips disabled rows, falls back after technical errors and stops at the first valid judgment',async()=>{
  const calls:string[]=[],{service,store}=await setup(async({config})=>{calls.push(config.model);if(config.model==='lan/one')throw new JevTechnicalError('HTTP 503');return pass})
  await service.begin('native:test').check('begin','hello');expect(calls).toEqual(['lan/one','lan/two'])
  expect(store.history()[0]?.attempts?.map(a=>a.status)).toEqual(['skipped','error','allowed'])
})
it.each(['clarify','block'] as const)('stops an action on a valid %s instead of asking the next model',async kind=>{
  const assess=vi.fn(async()=>({...pass,decision:kind})),{service,store}=await setup(assess)
  await expect(service.begin('developer:test').check('action','write')).rejects.toThrow('已停止');expect(assess).toHaveBeenCalledTimes(1)
  expect(store.history()[0]?.status).toBe(kind==='block'?'blocked':'clarify')
})
it('skips an ineligible account without issuing its request',async()=>{
  const assess=vi.fn<JevBackend['assess']>(async()=>pass),{service,store}=await setup(assess,v=>{if(v.model==='lan/one')throw new JevError('所选模型账号未启用')})
  await service.begin('native:test').check('begin','hello');expect(assess.mock.calls[0]?.[0].config.model).toBe('lan/two');expect(store.history()[0]?.attempts?.[1]?.status).toBe('skipped')
})
it('cancellation aborts the chain, including an adapter that ignores its signal',async()=>{
  const assess=vi.fn(()=>new Promise<Decision>(()=>{})),{service,store}=await setup(assess),controller=new AbortController()
  const run=service.begin('native:test'),pending=run.check('begin','hello',controller.signal);controller.abort()
  await expect(pending).rejects.toThrow('取消');expect(assess).toHaveBeenCalledTimes(1);expect(store.history()[0]?.attempts?.at(-1)?.status).toBe('cancelled')
})
it('honors per-model timeout and total chain deadline',async()=>{
  const signals:AbortController[]=[];vi.spyOn(AbortSignal,'timeout').mockImplementation(()=>{const c=new AbortController();signals.push(c);return c.signal})
  const assess=vi.fn(()=>new Promise<Decision>(()=>{})),{service,store}=await setup(assess),pending=service.begin('native:test').check('begin','hello')
  signals[1]!.abort(new DOMException('timeout','TimeoutError'));await vi.waitFor(()=>expect(assess).toHaveBeenCalledTimes(2));signals[0]!.abort(new DOMException('timeout','TimeoutError'))
  await expect(pending).rejects.toThrow('总超时');expect(assess).toHaveBeenCalledTimes(2);expect(store.history()[0]?.attempts?.filter(a=>a.status==='error')).toHaveLength(2)
})
it('does not retry unknown internal errors or exceed the round model-call budget',async()=>{
  const assess=vi.fn(async()=>{throw new JevTechnicalError('HTTP 429')}),{service,store}=await setup(assess)
  await store.update(1,{...cfg,maxChecks:3});const run=service.begin('native:test');await expect(run.check('begin','hello')).rejects.toThrow('全部');await expect(run.check('review','hello')).rejects.toThrow('上限');expect(assess).toHaveBeenCalledTimes(3)
  const other=await setup(async()=>{throw Error('secret')});await expect(other.service.begin('native').check('begin','hello')).rejects.toThrow('失败或超时');expect(JSON.stringify(other.store.history())).not.toContain('secret')
})
it('keeps the running candidate snapshot while the saved order and switches change',async()=>{
  let release!:(v:Decision)=>void;const {service,store}=await setup(()=>new Promise(r=>{release=r})),run=service.begin('native:test'),pending=run.check('begin','hello')
  await store.update(1,{...cfg,candidates:[...cfg.candidates!].reverse().map(c=>({...c,enabled:false}))});expect(run.snapshot.value.candidates?.[1]?.model).toBe('lan/one');expect(Object.isFrozen(run.snapshot.value.candidates?.[1])).toBe(true)
  release(pass);await pending;expect(store.history()[0]?.attempts?.at(-1)?.model).toBe('lan/one');expect(service.begin('native:new').snapshot.value.candidates?.every(c=>!c.enabled)).toBe(true)
})
it('validates candidates separately and preserves checks across reordering and switch changes',async()=>{
  let identity='v1';const {service,store}=await setup(async({config})=>{if(config.model==='lan/one')throw new JevTechnicalError('HTTP 503');return pass},()=>{},()=>identity)
  service.startDiagnostic({...cfg,enabled:false});await vi.waitFor(()=>expect(service.diagnosticStatus()?.status).toBe('passed'))
  const reversed={...cfg,candidates:[...cfg.candidates!].reverse()};expect(service.connection(reversed).state).toBe('ready');expect(service.connection(reversed).candidates?.find(c=>c.id==='one')?.state).toBe('error')
  await service.update(1,reversed);expect(store.snapshot().value.enabled).toBe(true)
  expect(service.connection({...cfg,candidates:cfg.candidates!.map(c=>({...c,enabled:false}))}).state).toBe('unconfigured')
  identity='v2';expect(service.connection(reversed).state).toBe('unverified');await expect(service.update(2,reversed)).rejects.toThrow('先检查')
})
it('falls back through real HTTP 503 and invalid JSON to a configured-model success without rerunning a business action',async()=>{
  const called:string[]=[],server=createServer((req,res)=>{called.push(req.url!);if(req.url?.startsWith('/one')){res.writeHead(503);res.end();return}res.end(JSON.stringify({choices:[{message:{content:req.url?.startsWith('/two')?'invalid':JSON.stringify(pass)}}]}))})
  await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const port=(server.address() as any).port
  try{
    const routes=['one','two','three'].map(id=>({provider:id,settingsNs:id,settingsPath:[]})),ctx:any={get:(name:string)=>name==='llm'?{listConfigurableProviders:()=>routes,listProviders:()=>routes.map(r=>({id:r.provider})),stream:async function*({provider,signal}:any){
      const res=await fetch('http://127.0.0.1:'+port+'/'+provider+'/chat/completions',{signal});if(!res.ok)throw {status:res.status}
      const body:any=await res.json();yield {type:'text-delta',text:body.choices[0].message.content};yield {type:'finish',reason:{kind:'stop'}}
    }}:name==='settings'?{get:(id:string)=>({baseURL:'http://127.0.0.1:'+port+'/'+id})}:undefined},backend=new SelfOwnedBackend(ctx)
    const {store}=await setup(async()=>pass),service=new JevService(store,backend,c=>backend.ready(c));await store.update(1,{...cfg,candidates:routes.map(r=>({id:r.provider,model:r.provider+'/model',enabled:true,reasoningEffort:''}))})
    const business=vi.fn(async()=> '你好');expect(await service.text('native:test','复述你好',business)).toBe('你好');expect(business).toHaveBeenCalledTimes(1)
    expect(called).toEqual(['/one/chat/completions','/two/chat/completions','/three/chat/completions','/one/chat/completions','/two/chat/completions','/three/chat/completions'])
  }finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()))}
})
