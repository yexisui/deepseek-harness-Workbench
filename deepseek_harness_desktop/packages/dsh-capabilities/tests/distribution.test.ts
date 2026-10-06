import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, readFile, rm, writeFile, access, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { CapabilityStore } from '../src/host/store.ts'
import { CapabilityPackages } from '../src/host/packages.ts'
import { PackageRunner } from '../src/host/package-runner.ts'
import { checkPackage, packageZip, sha256 } from '../src/host/package-archive.ts'
import { catalogFor, packageActionId, packageComponentId } from '../src/core/distribution.ts'
import { emptyRole, latest } from '../src/core/model.ts'
import { allowedActions } from '../src/core/policy.ts'
import { CapabilityRuntime } from '../src/host/runtime.ts'

const cleanups:Array<()=>Promise<unknown>>=[]
afterEach(async()=>{for(const cleanup of cleanups.splice(0).reverse())await cleanup()})
async function environment(){
  const root=await mkdtemp(join(tmpdir(),'capability-distribution-'));cleanups.push(()=>rm(root,{recursive:true,force:true}))
  const store=new CapabilityStore(join(root,'receiver'));await store.init();cleanups.push(()=>store.close())
  const packs=new CapabilityPackages(store,route=>route);await packs.init();cleanups.push(()=>packs.close())
  const runner=new PackageRunner(packs,async(prompt)=>'MODEL:'+prompt);await runner.init();cleanups.push(()=>runner.close())
  return{root,store,packs,runner}
}
async function fixture(root:string,version='1.0.0',code="exports.execute=async({input})=>'V1:'+String(input).toUpperCase()",model=false,id='org.example.text'){
  const dir=join(root,'author-'+version+'-'+Math.random().toString(16).slice(2));await mkdir(join(dir,'runtime'),{recursive:true});await writeFile(join(dir,'runtime','main.cjs'),code)
  await writeFile(join(dir,'capability.json'),JSON.stringify({schema:1,protocol:'dsh-worker-v1',id,version,name:'外部文字工具',description:'测试真实分发',instructions:'选择转换动作并输入文本。',author:'测试制作者',license:'MIT',permissions:model?['node','model']:['node'],components:[{id:'text',name:'文字组件',entry:'runtime/main.cjs',actions:[{id:'convert',name:'转换',description:'接收文本并返回结果'}]}],files:{'runtime/main.cjs':'auto'}}))
  return checkPackage(dir,true)
}
async function upload(packs:CapabilityPackages,zip:Buffer){const{token}=await packs.start('zip');await packs.put(token,'ability.zip',(async function*(){yield zip})());return packs.inspect(token)}
async function install(env:Awaited<ReturnType<typeof environment>>,version='1.0.0',code?:string,model=false){const pack=await fixture(env.root,version,code,model),preview=await upload(env.packs,packageZip(pack.files));const result=await env.packs.install(preview.token,preview.hash,preview.revision,{trusted:true,draft:'keep'});return{...result,preview,pack}}
const action=packageActionId('org.example.text','text','convert')

describe('portable capability distribution',()=>{
  it('rejects a provider that cannot load before authority commit and serializes asset rollback against a retry',async()=>{
    const env=await environment(),invalid=await fixture(env.root,'0.1.0','exports.execute=42'),bad=await upload(env.packs,packageZip(invalid.files)),before=env.store.snapshot()
    await expect(env.packs.install(bad.token,bad.hash,bad.revision,{trusted:true})).rejects.toThrow('execute')
    expect(env.store.snapshot()).toEqual(before);await expect(access(env.packs.directory(invalid.hash))).rejects.toThrow()
    const good=await fixture(env.root),a=await upload(env.packs,packageZip(good.files)),b=await upload(env.packs,packageZip(good.files));let attempts=0
    env.store.prepareCommit=async()=>{if(++attempts===1)throw Error('first commit fails');return undefined}
    const outcomes=await Promise.allSettled([env.packs.install(a.token,a.hash,a.revision,{trusted:true}),env.packs.install(b.token,b.hash,b.revision,{trusted:true})])
    expect(outcomes[0]!.status).toBe('rejected');expect(outcomes[1]!.status).toBe('fulfilled')
    const cap=env.store.snapshot().capabilities.find(c=>c.packageOrigin)!
    expect(await(await env.runner.start(cap.id,1,action,'serialized')).done).toBe('V1:SERIALIZED')
    const ticket=await env.packs.prepareDownload({id:cap.id,version:1}),download=await env.packs.download(ticket.id)
    expect(download.bytes.readUInt32LE(0)).toBe(0x04034b50)
    await env.packs.discardDownload(ticket.id);await expect(env.packs.download(ticket.id)).rejects.toThrow('过期')
  })
  it('registers a real managed-agent tool without BrowserSkill and denies forged or revoked role calls',async()=>{
    const env=await environment(),installed=await install(env)
    const saved=await env.store.command(env.store.snapshot().revision,{type:'role.save',definition:{...emptyRole(),name:'外部能力岗位',capabilities:[{capabilityId:installed.id,version:1,enabled:true}]},publish:true})
    const role=env.store.snapshot().roles.find(r=>r.id===saved.id)!,version=role.versions[0]!,registered=new Map<string,any>()
    const agent={id:'external-agent',ctx:{tools:{guard:()=>()=>{},register:(tool:any)=>{registered.set(tool.name,tool);return()=>registered.delete(tool.name)}},get:()=>undefined},session:{header:{createdAt:Date.now()-1000,agentPreset:version.preset},snapshotEvents:()=>[]}}
    const ctx={tools:{guard:()=>()=>{}},on:()=>()=>{},agents:{list:()=>[agent]},agentPresets:{composedPreset:()=>version.preset}}
    const runtime=new CapabilityRuntime(ctx as never,env.store,{bskPath:'',bskHome:'',port:0});runtime.packageRunner=env.runner;await runtime.init();cleanups.push(()=>runtime.dispose())
    expect(runtime.health.loaded).toBe(false);expect(registered.has('capability_action')).toBe(true)
    const args={capabilityId:installed.id,action,input:JSON.stringify('from role')},exec={name:'capability_action',arguments:args,callId:'call-one',signal:new AbortController().signal,agent}
    expect(await registered.get('capability_action').execute(args,exec)).toBe(JSON.stringify('V1:FROM ROLE'))
    expect(runtime.authorize({...exec,arguments:{...args,capabilityId:'browser'}} as never)).toContain('未授权')
    await env.store.command(env.store.snapshot().revision,{type:'role.save',id:role.id,definition:{...role.draft,capabilities:[{capabilityId:installed.id,version:1,enabled:true,actions:[]}]},publish:true})
    expect(runtime.authorize(exec as never)).toBeTruthy()
    await expect(registered.get('capability_action').execute(args,exec)).rejects.toThrow()
  })
  it('exports an external delivery folder, imports into a clean receiver, executes code and restarts without the source',async()=>{
    const author=await environment(),receiver=await environment(),pack=await fixture(author.root)
    const {token}=await author.packs.start('folder')
    for(const [path,bytes]of pack.files)await author.packs.put(token,path,(async function*(){yield bytes})())
    const preview=await author.packs.inspect(token), exported=await author.packs.exportPrepared(token,preview.hash)
    const received=await upload(receiver.packs,exported.bytes)
    const imported=await receiver.packs.install(received.token,received.hash,received.revision,{trusted:true})
    const cap=receiver.store.snapshot().capabilities.find(c=>c.id===imported.id)!
    expect(cap.enabled).toBe(true);expect(cap.source).toBe('local');expect(receiver.store.snapshot().roles.every(r=>!r.draft.capabilities.some(b=>b.capabilityId===cap.id))).toBe(true)
    expect(catalogFor(receiver.store.snapshot()).some(c=>c.id===packageComponentId('org.example.text','text'))).toBe(true)
    for (const name of await readdir(author.root)) if (name.startsWith('author-')) await rm(join(author.root,name),{recursive:true,force:true}) // No developer source remains.
    const task=await receiver.runner.start(cap.id,1,action,'hello');expect(await task.done).toBe('V1:HELLO')
    const zip=await receiver.packs.exportInstalled(cap.id,1);expect(zip.bytes.length).toBeGreaterThan(200)
    const duplicate=await receiver.packs.install(received.token,received.hash,received.revision,{trusted:true});expect(duplicate.duplicate).toBe(true)
    await receiver.runner.close();await receiver.packs.close();await receiver.store.close()
    const reloaded=new CapabilityStore(join(receiver.root,'receiver'));await reloaded.init();cleanups.push(()=>reloaded.close())
    const packages=new CapabilityPackages(reloaded);await packages.init();cleanups.push(()=>packages.close())
    const runner=new PackageRunner(packages,async()=>{throw Error('unused')});await runner.init();cleanups.push(()=>runner.close())
    expect(await (await runner.start(cap.id,1,action,'restart')).done).toBe('V1:RESTART')
    expect(runner.get(task.job.id).status).toBe('done')
  })
  it('pins role execution to old code, preserves drafts, and rolls back without rebinding roles',async()=>{
    const env=await environment(),first=await install(env)
    const saved=await env.store.command(env.store.snapshot().revision,{type:'role.save',definition:{...emptyRole(),name:'文字岗位',capabilities:[{capabilityId:first.id,version:1,enabled:true}]},publish:true})
    const role=env.store.snapshot().roles.find(r=>r.id===saved.id)!,roleVersion=latest(role.versions)!
    const cap=env.store.snapshot().capabilities.find(c=>c.id===first.id)!
    await env.store.command(env.store.snapshot().revision,{type:'capability.save',id:cap.id,definition:{...cap.draft,name:'本地未发布名称'},publish:false})
    const next=await install(env,'2.0.0',"exports.execute=async({input})=>'V2:'+input")
    const current=env.store.snapshot().capabilities.find(c=>c.id===first.id)!
    expect(current.draft.name).toBe('本地未发布名称');expect(current.packageOrigin!.draftBackups).toHaveLength(1)
    expect(env.store.snapshot().roles.find(r=>r.id===role.id)!.versions).toHaveLength(1)
    expect(await(await env.runner.start(first.id,1,action,'old',{role:{roleId:role.id,version:roleVersion,sessionCreatedAt:Date.now()-1000}})).done).toBe('V1:OLD')
    expect(await(await env.runner.start(first.id,2,action,'new')).done).toBe('V2:new')
    await env.packs.rollback(first.id,1,env.store.snapshot().revision)
    expect(env.store.snapshot().capabilities.find(c=>c.id===first.id)!.enabled).toBe(false)
    await env.store.command(env.store.snapshot().revision,{type:'capability.toggle',id:first.id,enabled:true})
    await new Promise(resolve=>setTimeout(resolve,3))
    expect(await(await env.runner.start(first.id,3,action,'back')).done).toBe('V1:BACK')
    expect(next.id).toBe(first.id)
  })
  it('requires configuration, does not export it, and brokers the existing model with real worker RPC',async()=>{
    const env=await environment(),installed=await install(env,'1.0.0',"exports.execute=async({input,api})=>api.model(input)",true)
    expect(env.store.snapshot().capabilities.find(c=>c.id===installed.id)!.enabled).toBe(false)
    await expect(env.store.command(env.store.snapshot().revision,{type:'capability.toggle',id:installed.id,enabled:true})).rejects.toThrow('模型')
    await env.packs.configure(installed.id,'local/model',env.store.snapshot().revision,true)
    expect(await(await env.runner.start(installed.id,1,action,'question')).done).toBe('MODEL:question')
    const zip=await env.packs.exportInstalled(installed.id,1);expect(zip.bytes.includes(Buffer.from('local/model'))).toBe(false)
  })
  it('terminates an infinite worker and revokes an in-flight call on capability removal',async()=>{
    const env=await environment(),installed=await install(env,'1.0.0',"exports.execute=async()=>{while(true){}}")
    const first=await env.runner.start(installed.id,1,action,'')
    await new Promise(resolve=>setTimeout(resolve,60));await env.runner.stop(first.job.id)
    await expect(first.done).rejects.toThrow();expect(env.runner.get(first.job.id).status).toBe('stopped')
    const second=await env.runner.start(installed.id,1,action,'')
    await env.store.command(env.store.snapshot().revision,{type:'capability.remove',id:installed.id})
    await expect(second.done).rejects.toThrow();expect(env.runner.get(second.job.id).status).toBe('stopped')
    await env.store.command(env.store.snapshot().revision,{type:'capability.restore',id:installed.id})
    await expect(env.runner.start(installed.id,1,action,'')).rejects.toThrow('未获授权')
  })
  it('rolls assets back on a failed authority commit and rejects stale concurrent installation',async()=>{
    const env=await environment(),pack=await fixture(env.root),preview=await upload(env.packs,packageZip(pack.files)),before=env.store.snapshot()
    env.store.prepareCommit=async()=>{throw new Error('simulated preset failure')}
    await expect(env.packs.install(preview.token,preview.hash,preview.revision,{trusted:true})).rejects.toThrow('simulated')
    expect(env.store.snapshot()).toEqual(before);await expect(access(env.packs.directory(pack.hash))).rejects.toThrow()
    env.store.prepareCommit=async()=>undefined
    await env.store.command(before.revision,{type:'capability.pin',id:'browser',pinned:false})
    await expect(env.packs.install(preview.token,preview.hash,preview.revision,{trusted:true})).rejects.toThrow('清单已更新')
    const refreshed=await env.packs.inspect(preview.token)
    await expect(env.packs.install(refreshed.token,refreshed.hash,refreshed.revision,{trusted:true})).resolves.toMatchObject({duplicate:false})
  })
  it('blocks tampering, unknown protocols, conflicting version content and ZIP traversal',async()=>{
    const env=await environment(),installed=await install(env),pack=await fixture(env.root,'1.0.0',"exports.execute=async()=>42")
    await expect(upload(env.packs,packageZip(pack.files))).rejects.toThrow('同一作品版本')
    const corrupt=await fixture(env.root,'3.0.0');corrupt.files.set('runtime/main.cjs',Buffer.from('tampered'))
    await expect(upload(env.packs,packageZip(corrupt.files))).rejects.toThrow('文件校验失败')
    expect(()=>packageZip(new Map([['../escape',Buffer.from('no')]]))).toThrow()
    const wrong=await fixture(env.root,'4.0.0');const m=JSON.parse(wrong.files.get('capability.json')!.toString());m.protocol='future';wrong.files.set('capability.json',Buffer.from(JSON.stringify(m)))
    // Release finished upload sessions before another one (the bound is intentional).
    await env.packs.discard(installed.preview.token)
    await expect(upload(env.packs,packageZip(wrong.files))).rejects.toThrow('不支持此能力包协议')
    await writeFile(join(env.packs.directory(installed.pack.hash),'runtime/main.cjs'),'exports.execute=()=>"changed"')
    await expect((await env.runner.start(installed.id,1,action,'')).done).rejects.toThrow('校验失败')
    await expect(env.packs.exportInstalled(installed.id,1)).rejects.toThrow('文件校验失败')
  })
  it('keeps incomplete drafts private, blocks invalid publication, and protects historical role references',async()=>{
    const env=await environment(),installed=await install(env),cap=env.store.snapshot().capabilities.find(c=>c.id===installed.id)!
    await env.store.command(env.store.snapshot().revision,{type:'capability.save',id:cap.id,definition:{...cap.draft,components:[]},publish:false})
    expect(await(await env.runner.start(cap.id,1,action,'draft')).done).toBe('V1:DRAFT')
    await expect(env.store.command(env.store.snapshot().revision,{type:'capability.save',id:cap.id,definition:{...cap.draft,components:[]},publish:true})).rejects.toThrow('尚未添加组件')
    const role=await env.store.command(env.store.snapshot().revision,{type:'role.save',definition:{...emptyRole(),name:'历史岗位',capabilities:[{capabilityId:cap.id,version:1,enabled:true}]},publish:true})
    await env.store.command(env.store.snapshot().revision,{type:'capability.remove',id:cap.id})
    await expect(env.store.command(env.store.snapshot().revision,{type:'capability.purge',ids:[cap.id]})).rejects.toThrow('历史版本引用')
    const r=env.store.snapshot().roles.find(r=>r.id===role.id)!
    expect(allowedActions(env.store.snapshot(),r.id,r.versions[0]!)).toEqual([])
  })
  it('exports local edits as a new derived identity and keeps the original author package immutable',async()=>{
    const env=await environment(),installed=await install(env),cap=env.store.snapshot().capabilities.find(c=>c.id===installed.id)!
    await env.store.command(env.store.snapshot().revision,{type:'capability.save',id:cap.id,definition:{...cap.draft,name:'我的修改'},publish:true})
    const exported=await env.packs.exportInstalled(cap.id,2),preview=await upload(env.packs,exported.bytes)
    expect(preview.manifest.id).not.toBe(installed.pack.manifest.id);expect(preview.manifest.derivedFrom?.hash).toBe(installed.pack.hash)
    expect(preview.manifest.name).toBe('我的修改');expect(preview.existing).toBeUndefined()
  })
})
