// @vitest-environment node
import {beforeEach,afterEach,expect,it,vi} from 'vitest'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {Readable} from 'node:stream'
const state=vi.hoisted(()=>({root:''}))
vi.mock('../../../shared/host/dsh-home.ts',()=>({dshHome:()=>state.root}))
import {apply} from '../src/index.ts'
import {defaults} from '../src/core/contract.ts'
let handler:any,disposers:(()=>unknown)[],rejection:number|undefined
beforeEach(async()=>{state.root=await mkdtemp(join(tmpdir(),'jev-route-'));disposers=[];rejection=undefined;const ctx={provide:vi.fn(),on:()=>()=>{},get:()=>undefined,connection:{requestRejection:()=>rejection},webServer:{register:(route:any)=>{handler=route.handler;return()=>{}}},effect:(fn:()=>()=>unknown)=>{disposers.push(fn())}};await apply(ctx as any)})
afterEach(async()=>{for(const fn of disposers.reverse())await fn();if(!resolve(state.root).startsWith(resolve(tmpdir())))throw Error('Unsafe cleanup');await rm(state.root,{recursive:true,force:true})})
function request(path:string,method='GET',value?:unknown){let reads=0;const req=new Readable({read(){reads++;this.push(JSON.stringify(value??{}));this.push(null)}});Object.assign(req,{url:path,method,headers:{host:'127.0.0.1:9001',origin:'http://127.0.0.1:9001','content-type':'application/json'}});let code=0,body:any;const res={writeHead:(status:number)=>{code=status},end:(text:string)=>{body=JSON.parse(text)}};return{req,res,read:()=>({code,body,reads})}}
it('authenticates both read and mutation before reading a request body',async()=>{rejection=401;const r=request('/api/jev-mode/config','POST',{revision:0,value:defaults});await handler(r.req,r.res);expect(r.read().code).toBe(401);expect(r.read().reads).toBe(0)})
it('accepts unchecked enablement, retains real configuration errors and rejects stale revisions',async()=>{
  const enabled=request('/api/jev-mode/config','POST',{revision:0,value:{...defaults,enabled:true,model:'lan/m'}})
  await handler(enabled.req,enabled.res);expect(enabled.read().code).toBe(200)
  expect(enabled.read().body.config.value.enabled).toBe(true);expect(enabled.read().body.state).toBe('unavailable')
  const saved=request('/api/jev-mode/config','POST',{revision:1,value:{...defaults,model:'lan/m'}})
  await handler(saved.req,saved.res);expect(saved.read().code).toBe(200);expect(saved.read().body.state).toBe('off');expect(saved.read().body.connection.state).toBe('unconfigured')
  const stale=request('/api/jev-mode/config','POST',{revision:0,value:defaults});await handler(stale.req,stale.res);expect(stale.read().code).toBe(409)
  const get=request('/api/jev-mode/state');await handler(get.req,get.res);expect(get.read().body.config.value).toEqual({...defaults,model:'lan/m'});expect(JSON.stringify(get.read().body)).not.toContain('apiKey')
})
