// @vitest-environment node
import {afterEach,expect,it,vi} from 'vitest'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {defaults,type Decision,type JevBackend} from '../src/core/contract.ts'
import {JevStore} from '../src/host/store.ts'
import {JevService} from '../src/host/service.ts'
const roots:string[]=[]
afterEach(async()=>{await Promise.all(roots.splice(0).map(root=>rm(root,{recursive:true,force:true})))})
const pass:Decision={decision:'allow',summary:'问候有依据',missing:[],checks:[{criterion:'问候',verdict:'supported',evidence:'用户明确要求'}]}
const candidate={...defaults,model:'lan/model'}
async function setup(assess:JevBackend['assess']=async()=>pass,identity=()=> 'account-v1'){
  const root=await mkdtemp(join(tmpdir(),'jev-diagnostic-'));roots.push(root)
  const store=new JevStore(root);await store.init();return {store,service:new JevService(store,{id:'self-owned',assess},()=>{},identity),root}
}
it('checks an unsaved model while off, persists validation and enables only the checked configuration',async()=>{
  const {service,store,root}=await setup()
  await expect(service.update(0,{...candidate,enabled:true})).rejects.toThrow('先检查')
  const check=service.startDiagnostic(candidate);expect(check.status).toBe('checking')
  await vi.waitFor(()=>expect(service.connection(candidate).state).toBe('ready'))
  expect(store.snapshot().value).toEqual(defaults);expect(store.history()).toEqual([])
  await service.update(0,{...candidate,enabled:true});expect(service.status().state).toBe('ready')
  await expect(service.update(1,{...candidate,model:'lan/other',enabled:true})).rejects.toThrow('先检查')
  const reload=new JevStore(root);await reload.init();const next=new JevService(reload,{id:'self-owned',assess:async()=>pass},()=>{},()=> 'account-v1')
  expect(next.status().connection?.state).toBe('ready');expect(next.status().connection?.checkedAt).toBeTruthy()
})
it('aborts the actual model request and never activates global mode during diagnostics',async()=>{
  let aborted=false
  const {service,store}=await setup((_input,signal)=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>{aborted=true;reject(signal.reason)},{once:true})))
  const job=service.startDiagnostic(candidate);expect(service.connection(candidate).state).toBe('checking')
  expect(()=>service.startDiagnostic(candidate)).toThrow('正在进行')
  await expect(service.cancelDiagnostic('wrong')).rejects.toThrow('不属于')
  const result=await service.cancelDiagnostic(job.id)
  expect(aborted).toBe(true);expect(result?.status).toBe('cancelled');expect(store.snapshot().value.enabled).toBe(false)
  await expect(service.update(0,{...candidate,enabled:true})).rejects.toThrow('先检查')
})
it('does not reuse validation after the account endpoint changes',async()=>{
  let endpoint='v1';const {service}=await setup(async()=>pass,()=>endpoint)
  service.startDiagnostic(candidate);await vi.waitFor(()=>expect(service.connection(candidate).state).toBe('ready'))
  endpoint='v2';expect(service.connection(candidate).state).toBe('unverified')
})
it('exposes a running phase and the immutable round snapshot, then removes it on completion',async()=>{
  let resolve!:(value:Decision)=>void
  const {service,store}=await setup(()=>new Promise(r=>{resolve=r}))
  await store.update(0,{...candidate,enabled:true});const run=service.begin('native:test')
  const checking=run.check('begin','hello');expect(service.status('native:test').active?.[0]?.phase).toBe('checking')
  await store.update(1,candidate);expect(service.status('native:test').active?.[0]?.enabled).toBe(true)
  resolve(pass);await checking;expect(service.status('native:test').active?.[0]?.phase).toBe('working')
  run.finish();expect(service.status().active).toEqual([])
})
it('returns a conversation record even after more than sixty checks elsewhere',async()=>{
  const {service,store}=await setup();await store.update(0,{...candidate,enabled:true})
  const old=service.begin('native:old');await old.check('begin','old');old.finish()
  for(let i=0;i<65;i++){const run=service.begin('native:new');await run.check('begin','new');run.finish()}
  expect(service.status('native:old').traces).toHaveLength(1)
})
it('keeps transport errors sanitized and refuses an inconclusive diagnostic',async()=>{
  const {service}=await setup(async()=>({...pass,decision:'clarify',summary:'需要更多信息'}))
  service.startDiagnostic(candidate);await vi.waitFor(()=>expect(service.connection(candidate).state).toBe('error'))
  expect(service.diagnosticStatus()?.message).toContain('未通过')
})
