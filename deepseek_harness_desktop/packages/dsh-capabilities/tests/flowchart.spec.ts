import {afterEach,expect,it} from 'vitest'
import {mkdtemp,rm,readFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {CapabilityStore} from '../src/host/store.ts'
import {CapabilityPackages} from '../src/host/packages.ts'
import {PackageRunner} from '../src/host/package-runner.ts'
import {packageResult,servePackageArtifact} from '../src/host/package-artifact.ts'
import {CapabilityRuntime} from '../src/host/runtime.ts'
import {packageZip,sha256} from '../src/host/package-archive.ts'
import {emptyRole} from '../src/core/model.ts'
import {catalogFor} from '../src/core/distribution.ts'
const base=process.env.DSH_FLOWCHART_ROOT??resolve(import.meta.dirname,'../../../../capability-packages/flowchart-generation'),cleanups:Array<()=>Promise<unknown>>=[]
afterEach(async()=>{for(const f of cleanups.splice(0).reverse())await f()})
async function environment(){
 const dir=await mkdtemp(join(tmpdir(),'flowchart-test-'));cleanups.push(()=>rm(dir,{recursive:true,force:true,maxRetries:5}))
 const store=new CapabilityStore(dir);await store.init();cleanups.push(()=>store.close())
 const packs=new CapabilityPackages(store,()=> 'test/model');await packs.init();cleanups.push(()=>packs.close())
 const fixtures=JSON.parse(await readFile(join(base,'tests/fixtures.json'),'utf8'));let response=fixtures.snake
 const runner=new PackageRunner(packs,async()=>JSON.stringify(response));await runner.init();cleanups.push(()=>runner.close())
 const manifest=JSON.parse(await readFile(join(base,'capability.json'),'utf8')),files=new Map<string,Buffer>();for(const name of Object.keys(manifest.files)){const bytes=await readFile(join(base,name));files.set(name,bytes);manifest.files[name]=sha256(bytes)}files.set('capability.json',Buffer.from(JSON.stringify(manifest)));
 const {token}=await packs.start('zip');await packs.put(token,'ability.zip',(async function*(){yield packageZip(files)})());const p=await packs.inspect(token);const{id}=await packs.install(token,p.hash,p.revision,{trusted:true})
 const cap=store.snapshot().capabilities.find(c=>c.id===id)!,version=cap.versions.at(-1)!,action=version.components[0]!.actions[0]!
 const saved=await store.command(store.snapshot().revision,{type:'role.save',definition:{...emptyRole(),name:'流程图测试岗位',capabilities:[{capabilityId:id,version:version.version,enabled:true}]},publish:true,directSave:true})
 const role=store.snapshot().roles.find(r=>r.id===saved.id)!,authority={roleId:role.id,version:role.versions.at(-1)!,sessionCreatedAt:Date.now()+1,sessionId:'session-one'}
 return{dir,store,packs,runner,id,version,action,role,authority,fixtures,setResponse:(v:unknown)=>{response=v},run:(input:unknown,sessionId='session-one')=>runner.start(id,version.version,action,input,{role:{...authority,sessionId}})}
}
it('imports to shared catalog, creates a real Worker image and local edit preserves other steps',async()=>{
 const e=await environment();expect(catalogFor(e.store.snapshot()).some(c=>c.name==='固定模板流程图')).toBe(true)
 const first=await e.run({mode:'create',style:'snake',content:'十二步流程'}),out:any=await first.done;expect(out.svg).toContain('领取任务')
 e.setResponse({operations:[{op:'text',id:'n2',text:'核对并整合升版记录'}]});const edited=await e.run({mode:'edit',instruction:'修改第三步',documentId:first.job.id}),result:any=await edited.done
 expect(result.document.nodes[2].text).toBe('核对并整合升版记录');expect(result.document.edges).toEqual(out.document.edges);expect(e.runner.get(first.job.id).output).toEqual(out)
 const summary:any=packageResult(edited.job.id,result,3082);expect(summary.previewUrl).toContain(edited.job.id);expect(summary.svg).toBeUndefined()
})
it('denies previous document access from another session and preserves old result after failed edit',async()=>{
 const e=await environment(),first=await e.run({mode:'create',style:'snake',content:'流程'});await first.done
 await expect((await e.run({mode:'read',documentId:first.job.id},'session-two')).done).rejects.toThrow('当前会话')
 await expect((await e.run({mode:'read'},'session-two')).done).rejects.toThrow('尚无')
 e.setResponse({operations:[{op:'text',id:'missing',text:'错误'}]});await expect((await e.run({mode:'edit',instruction:'改文字'})).done).rejects.toThrow('找不到')
 const read:any=await(await e.run({mode:'read'})).done;expect(read.document.nodes).toEqual(e.fixtures.snake.nodes)
})
it('loads persisted document after restart and refuses snake conversion of a branching graph',async()=>{
 const e=await environment();e.setResponse(e.fixtures.standard);const first=await e.run({mode:'create',style:'standard',content:'审核流程'});await first.done;await e.runner.close()
 const runner=new PackageRunner(e.packs,async()=>{throw Error('no model for rerender')});await runner.init();cleanups.push(()=>runner.close())
 const read=await runner.start(e.id,e.version.version,e.action,{mode:'read',documentId:first.job.id},{role:e.authority});expect((await read.done as any).document.title).toBe(e.fixtures.standard.title)
 await expect((await runner.start(e.id,e.version.version,e.action,{mode:'restyle',style:'snake',documentId:first.job.id},{role:e.authority})).done).rejects.toThrow('蛇形')
 expect(runner.get(first.job.id).status).toBe('done')
})
it('routes authenticated image/download/view with restrictive image policy',async()=>{
 const e=await environment(),run=await e.run({mode:'create',style:'snake',content:'流程'});await run.done
 for(const suffix of ['image.svg','download.svg','view']){let status=0,headers:any,body:any;const res={writeHead:(s:number,h:any)=>{status=s;headers=h},end:(b:any)=>{body=b}};servePackageArtifact(e.runner,run.job.id+'/'+suffix,res as any);expect(status).toBe(200);expect(headers['cache-control']).toBe('no-store');expect(String(body)).toContain(suffix==='view'?'下载 PNG':'<svg');if(suffix==='image.svg')expect(headers['content-security-policy']).toContain('sandbox')}
 expect(()=>servePackageArtifact(e.runner,'../../state.json',{} as any)).toThrow('不存在')
})
it('real managed-agent tool returns image references and stops after capability removal',async()=>{
 const e=await environment(),registered=new Map<string,any>(),agent={id:'agent-flow',ctx:{tools:{guard:()=>()=>{},register:(t:any)=>{registered.set(t.name,t);return()=>registered.delete(t.name)}},get:()=>undefined},session:{header:{createdAt:Date.now()+1,agentPreset:e.authority.version.preset},snapshotEvents:()=>[]}}
 const ctx={webServer:{port:3082},tools:{guard:()=>()=>{}},on:()=>()=>{},agents:{list:()=>[agent]},agentPresets:{composedPreset:()=>e.authority.version.preset}}
 const runtime=new CapabilityRuntime(ctx as any,e.store,{bskPath:'',bskHome:'',port:0});runtime.packageRunner=e.runner;await runtime.init();cleanups.push(()=>runtime.dispose())
 const args={capabilityId:e.id,action:e.action,input:JSON.stringify({mode:'create',style:'snake',content:'步骤'})},exec={name:'capability_action',arguments:args,callId:'flow-create',signal:new AbortController().signal,agent}
 const result=JSON.parse(await registered.get('capability_action').execute(args,exec));expect(result.previewUrl).toBe('http://127.0.0.1:3082/api/capabilities/packages/artifact/'+result.documentId+'/image.svg');expect(e.runner.get(result.documentId).sessionId).toBe(agent.id)
 await e.store.command(e.store.snapshot().revision,{type:'capability.toggle',id:e.id,enabled:false});await expect(registered.get('capability_action').execute(args,exec)).rejects.toThrow()
})
