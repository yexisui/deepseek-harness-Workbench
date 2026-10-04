// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
// Deterministic DNS keeps this socket test offline and compatible with IPv4-only sandboxes.
vi.mock('node:dns/promises',()=>({lookup:vi.fn(async()=>[{address:'127.0.0.1',family:4}])}))
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:http'
import { defaults, decision, type JevBackend, type Decision } from '../src/core/contract.ts'
import { JevStore } from '../src/host/store.ts'
import { JevService } from '../src/host/service.ts'
import { endpoint, intranetJson, privateAddress } from '../src/host/intranet.ts'
import { account } from '../src/host/backend.ts'
const roots:string[]=[]
afterEach(async()=>{await Promise.all(roots.splice(0).map(p=>rm(p,{recursive:true,force:true})))})
const allowed:Decision={decision:'allow',summary:'有输入依据',missing:[],checks:[{criterion:'目标与证据',verdict:'supported',evidence:'用户输入'}]}
async function setup(assess:JevBackend['assess']=async()=>allowed){const root=await mkdtemp(join(tmpdir(),'jev-test-'));roots.push(root);const store=new JevStore(root);await store.init();const service=new JevService(store,{id:'self-owned',assess},()=>{});return {root,store,service}}
describe('global persisted configuration and fixed turn snapshot',()=>{
  it('defaults off, retains decision model after role switching and restart',async()=>{const {root,store,service}=await setup();expect(service.status().state).toBe('off');await store.update(0,{...defaults,enabled:true,model:'intranet/qwen'});const before=service.begin('developer:1');await store.update(1,{...defaults,enabled:false,model:'intranet/qwen'});expect(before.enabled).toBe(true);expect(service.begin('requirements:2').enabled).toBe(false);const reload=new JevStore(root);await reload.init();expect(reload.snapshot().value.model).toBe('intranet/qwen');expect(reload.snapshot().value.enabled).toBe(false)})
  it('rejects a stale save instead of overwriting another view',async()=>{const {store}=await setup();await store.update(0,{...defaults,model:'lan/m'});await expect(store.update(0,defaults)).rejects.toThrow('已改变');expect(store.snapshot().value.model).toBe('lan/m')})
  it('preserves corrupt configuration and refuses initialization',async()=>{const {root}=await setup();const {writeFile}=await import('node:fs/promises');await writeFile(join(root,'config.json'),'broken');await expect(new JevStore(root).init()).rejects.toThrow('不能自动覆盖');expect(await readFile(join(root,'config.json'),'utf8')).toBe('broken')})
})
describe('bounded, truthful decisions',()=>{
  it('does zero model calls while off',async()=>{let calls=0;const {service}=await setup(async()=>{calls++;return allowed});await service.begin('chat').check('begin','hello');expect(calls).toBe(0)})
  it('prevents an uncertain action and records its real outcome',async()=>{const {store,service}=await setup(async()=>({...allowed,decision:'clarify',summary:'用户尚未确认'}));await store.update(0,{...defaults,enabled:true,model:'lan/m'});await expect(service.begin('developer:1').check('action',{write:'a.ts'})).rejects.toThrow('已停止');expect(store.history()[0]?.status).toBe('clarify');expect(store.history()[0]?.config.model).toBe('lan/m')})
  it('fails closed without trying an official backend',async()=>{let calls=0;const {store,service}=await setup(async()=>{calls++;throw Error('secret transport details')});await store.update(0,{...defaults,enabled:true,model:'lan/m'});await expect(service.begin('chat').check('begin','x')).rejects.toThrow('失败或超时');expect(store.history()[0]?.summary).not.toContain('secret');await store.update(1,{...defaults,enabled:true,backend:'official-reserved'});await expect(service.begin('chat').check('begin','x')).rejects.toThrow('尚未接入');expect(calls).toBe(1)})
  it('stops at the budget and never truncates an action into a pass',async()=>{let calls=0;const {store,service}=await setup(async()=>{calls++;return allowed});await store.update(0,{...defaults,enabled:true,model:'lan/m',maxChecks:3,maxContextChars:4000});const run=service.begin('chat');await expect(run.check('action','x'.repeat(4001))).rejects.toThrow('未完整审查');await run.check('begin','x');await run.check('review','x');await expect(run.check('action','x')).rejects.toThrow('上限');expect(calls).toBe(2)})
  it('rejects malformed or contradictory structured judgments',()=>{expect(()=>decision('hello')).toThrow('JSON');expect(()=>decision(JSON.stringify({...allowed,missing:['unknown']}))).toThrow('不一致');expect(()=>decision(JSON.stringify({...allowed,checks:[]}))).toThrow('结构无效')})
})
describe('intranet transport',()=>{
  it('cancels an in-flight HTTP request by closing its socket',async()=>{
    let arrived!:()=>void,closed!:()=>void
    const received=new Promise<void>(r=>{arrived=r}),disconnected=new Promise<void>(r=>{closed=r})
    const server=createServer((_req,res)=>{res.on('close',closed);arrived()});await new Promise<void>(r=>server.listen(0,'127.0.0.1',r))
    const controller=new AbortController(),port=(server.address() as any).port
    try{const request=intranetJson(endpoint(`http://127.0.0.1:${port}`),{},'',controller.signal);const rejected=expect(request).rejects.toThrow('取消');await received;controller.abort();await rejected;await disconnected}finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()))}
  })
  it('reads model choices from local settings without calling model discovery',()=>{const ctx={get:(name:string)=>name==='llm'?{listConfigurableProviders:()=>[{provider:'lan',settingsNs:'models',settingsPath:['lan']}],listModels:()=>{throw Error('Discovery must not run')}}:name==='settings'?{get:()=>({lan:{baseURL:'http://127.0.0.1/v1',models:[{id:'reasoner',name:'内网模型'}]}})}:undefined};expect(account(ctx as any,'lan/reasoner').models).toEqual([{id:'lan/reasoner',name:'内网模型'}])})
  it('rejects public IPs, credentials in URL and metadata/link-local ranges',()=>{for(const ip of ['8.8.8.8','169.254.169.254','100.64.0.1','2001:4860:4860::8888'])expect(privateAddress(ip)).toBe(false);for(const ip of ['127.0.0.1','10.1.2.3','172.16.1.1','192.168.1.1','::1','fd00::1'])expect(privateAddress(ip)).toBe(true);expect(()=>endpoint('https://api.typesafe.ai')).not.toThrow();expect(()=>endpoint('http://8.8.8.8/v1')).toThrow('公网');expect(()=>endpoint('http://user:key@127.0.0.1')).toThrow('凭据')})
  it('calls a real loopback server and refuses redirect without forwarding credentials',async()=>{
    let calls=0;const server=createServer((req,res)=>{calls++;if(req.url?.startsWith('/redirect')){res.writeHead(302,{location:'https://api.typesafe.ai'});res.end();return}expect(req.headers.authorization).toBe('Bearer internal-key');res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(allowed)}}]}))});await new Promise<void>(r=>server.listen(0,r));const port=(server.address() as any).port
    try{for(const host of ['127.0.0.1','localhost'])expect(decision(await intranetJson(endpoint(`http://${host}:${port}/v1`),{},'internal-key',new AbortController().signal))).toEqual(allowed);await expect(intranetJson(endpoint(`http://127.0.0.1:${port}/redirect`),{},'internal-key',new AbortController().signal)).rejects.toThrow('302');expect(calls).toBe(3)}finally{await new Promise<void>(r=>server.close(()=>r()))}
  })
})
