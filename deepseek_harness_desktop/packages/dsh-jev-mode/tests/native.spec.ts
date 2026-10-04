// @vitest-environment node
import {afterEach,expect,it,vi} from 'vitest'
import {mkdtemp,rm} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {tmpdir} from 'node:os'
import {JevStore} from '../src/host/store.ts'
import {JevService} from '../src/host/service.ts'
import {defaults,type Decision} from '../src/core/contract.ts'
import {installNative} from '../src/host/native.ts'
import {fence} from '../src/host/http.ts'
const roots:string[]=[]
afterEach(async()=>{for(const p of roots.splice(0)){if(!resolve(p).startsWith(resolve(tmpdir())))throw Error('Unsafe cleanup');await rm(p,{recursive:true,force:true})}})
it('fixes mode for a turn, checks native tools, preserves prior denials, and resumes with current global settings',async()=>{
 const root=await mkdtemp(join(tmpdir(),'jev-native-'));roots.push(root);const store=new JevStore(root);await store.init();await store.update(0,{...defaults,enabled:true,model:'lan/m'})
 const allow:Decision={decision:'allow',summary:'有依据',missing:[],checks:[{criterion:'目标',verdict:'supported',evidence:'输入'}]},calls:string[]=[]
 const service=new JevService(store,{id:'self-owned',assess:async input=>{calls.push(input.stage);return input.stage==='review'?{...allow,decision:'clarify',summary:'测试没有执行证据'}:allow}},()=>{})
 const hooks:Record<string,any>={},ctx={on:(name:string,fn:any)=>{hooks[name]=fn;return()=>delete hooks[name]}}
 const dispose=installNative(ctx as any,service),signal=new AbortController().signal,events:any[]=[],agent={id:'session-1',session:{snapshotEvents:()=>events},steer:vi.fn()}
 const messages=[{role:'user',content:[{type:'text',text:'解释文件'}]}]
 const step=()=>hooks['agent/pre-step']({agent,turn:1,messages,signal},async()=>({kind:'enter',messages}))
 expect((await step()).messages).toHaveLength(2);await store.update(1,{...defaults,enabled:false,model:'lan/m'})
 await step();expect(calls).toEqual(['begin'])
 const exec={agent,name:'read_file',arguments:{path:'a.ts'},signal}
 expect(await hooks['tools/pre-execute'](exec,async()=>({kind:'deny',reason:'岗位不允许'}))).toEqual({kind:'deny',reason:'岗位不允许'});expect(calls).toHaveLength(1)
 expect((await hooks['tools/pre-execute'](exec,async()=>({kind:'allow'}))).kind).toBe('allow')
 events.push({type:'assistant/message',data:{text:'已完成'}});await hooks['agent/turn-stopping']({agent,turn:1,signal});await hooks['agent/turn-stopping']({agent,turn:1,signal});expect(agent.steer).toHaveBeenCalledTimes(1)
 expect((await hooks['tools/pre-execute'](exec,async()=>({kind:'allow'}))).kind).toBe('deny')
 hooks['agent/status']({agent,status:'idle'});expect((await hooks['agent/pre-step']({agent,turn:2,messages,signal},async()=>({kind:'enter',messages}))).messages.at(-1).content[0].text).toContain('已关闭')
 expect(calls).toEqual(['begin','action','review']);expect(store.history().every(t=>t.config.enabled&&t.config.model==='lan/m')).toBe(true);dispose();expect(Object.keys(hooks)).toHaveLength(0)
})
it('rejects cross-origin setting writes and non-JSON requests',()=>{expect(()=>fence({method:'POST',headers:{host:'localhost:8080',origin:'https://evil.example','content-type':'application/json'}} as any)).toThrow('跨站');expect(()=>fence({method:'POST',headers:{host:'localhost:8080','content-type':'text/plain'}} as any)).toThrow('JSON');expect(()=>fence({method:'POST',headers:{host:'localhost:8080',origin:'http://localhost:8080','content-type':'application/json'}} as any)).not.toThrow()})
