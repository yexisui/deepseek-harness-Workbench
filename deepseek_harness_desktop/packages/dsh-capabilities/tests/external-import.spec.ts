import {it,expect} from 'vitest'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {CapabilityStore} from '../src/host/store.ts'
import {CapabilityPackages, type ImportProgress} from '../src/host/packages.ts'
import {PackageRunner} from '../src/host/package-runner.ts'
import {packageZip} from '../src/host/package-archive.ts'
import type {ImportModel} from '../src/host/external-package.ts'
async function setup(model?:ImportModel){const dir=await mkdtemp(join(tmpdir(),'external-import-')),store=new CapabilityStore(dir);await store.init();const packs=new CapabilityPackages(store,()=> 'default/model',model);await packs.init();return{store,packs,cleanup:async()=>{await packs.close();await store.close();await rm(dir,{recursive:true,force:true,maxRetries:5})}}}
async function upload(packs:CapabilityPackages,files:Record<string,string>){const {token}=await packs.start('zip');await packs.put(token,'ability.zip',(async function*(){yield packageZip(new Map(Object.entries(files).map(([p,t])=>['wrapped/'+p,Buffer.from(t)])))})());return token}
async function finish(packs:CapabilityPackages,token:string){let state:ImportProgress;do{await new Promise(r=>setTimeout(r,5));state=packs.processStatus(token)}while(state.status==='running');return state}
const response=JSON.stringify({name:'脚本能力',description:'真实脚本',instructions:'输入value',needsModel:false,actions:[{id:'run',name:'计算',description:'value数字'}],files:{'adapter.cjs':"exports.execute=async({input,api})=>require(require('node:path').join(api.resourceRoot,'source/calc.cjs')).run(input.value)"}})
it('adapts arbitrary folder paths, uses original code, survives duplicate import and exports as a standard package',async()=>{
 let calls=0;const {store,packs,cleanup}=await setup(async()=>{calls++;return response})
 const runner=new PackageRunner(packs,async()=>{throw Error('Should not use model to calculate')});await runner.init()
 try{const {token}=await packs.start('folder');for(const [p,t]of Object.entries({'package.json':'{"name":"local-test"}','calc.cjs':'exports.run=x=>x*7'}))await packs.put(token,p,(async function*(){yield Buffer.from(t)})())
 await packs.processImport(token,true,'test');const done=await finish(packs,token);expect(done.status).toBe('done');const p=done.preview!,installed=await packs.install(token,p.hash,store.snapshot().revision,{trusted:true});expect(calls).toBe(1)
 const cap=store.snapshot().capabilities.find(c=>c.id===installed.id)!,v=cap.versions.at(-1)!;const run=await runner.start(cap.id,v.version,v.components[0]!.actions[0]!,{value:6});expect(await run.done).toBe(42)
 const exported=await packs.exportInstalled(cap.id,v.version),second=await packs.start('zip');await packs.put(second.token,'ability.zip',(async function*(){yield exported.bytes})());await packs.processImport(second.token,true,'same.zip');const again=(await finish(packs,second.token)).preview!;expect(calls).toBe(1);expect(again.existing?.duplicate).toBe(true)
 }finally{await runner.close();await cleanup()}
})
it('imports a plain Skill without AI adaptation using the shared default model at execution',async()=>{
 const {store,packs,cleanup}=await setup(async()=>{throw Error('AI must be off')});let prompt='';const runner=new PackageRunner(packs,async p=>{prompt=p;return '整理结果'});await runner.init()
 try{const token=await upload(packs,{'SKILL.md':'---\nname: summarize\ndescription: 整理文字\n---\n将输入整理成三条。'});await packs.processImport(token,false,'skill.zip');const p=(await finish(packs,token)).preview!;const installed=await packs.install(token,p.hash,store.snapshot().revision,{trusted:true});const c=store.snapshot().capabilities.find(c=>c.id===installed.id)!,v=c.versions.at(-1)!;expect(await(await runner.start(c.id,v.version,v.components[0]!.actions[0]!,{text:'示例'})).done).toBe('整理结果');expect(prompt).toContain('将输入整理成三条')
 }finally{await runner.close();await cleanup()}
})
it('keeps uploaded sources after an actual model failure and permits retry with unchanged production state',async()=>{
 let first=true;const {store,packs,cleanup}=await setup(async()=>{if(first){first=false;throw Error('temporary model failure')}return response})
 try{const before=store.snapshot(),token=await upload(packs,{'calc.cjs':'exports.run=x=>x*7'});await packs.processImport(token,true,'test.zip');expect((await finish(packs,token)).message).toContain('temporary model failure');expect(store.snapshot()).toEqual(before);await packs.processImport(token,true,'test.zip');expect((await finish(packs,token)).status).toBe('done')}finally{await cleanup()}
})
it('cancels model work without discarding the uploaded package',async()=>{
 const {packs,cleanup}=await setup(async(_p,_s,signal)=>new Promise((_r,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true})))
 try{const token=await upload(packs,{'a.txt':'text'});await packs.processImport(token,true,'test.zip');await new Promise(r=>setTimeout(r,40));const status=await packs.cancelProcessing(token);expect(status.status).toBe('error');expect(status.message).toContain('停止')}finally{await cleanup()}
})
it('does not send local private settings to the model or package them',async()=>{
 const {packs,cleanup}=await setup(async p=>{expect(p).not.toContain('secret-123');return response})
 try{const token=await upload(packs,{'.env':'KEY=secret-123','calc.cjs':'exports.run=x=>x'});await packs.processImport(token,true,'test.zip');const p=(await finish(packs,token)).preview!;expect(Object.keys(p.manifest.files).some(p=>p.includes('.env'))).toBe(false)}finally{await cleanup()}
})
it('regenerates on retry after an actual generated-code loading error',async()=>{
 let calls=0;const {store,packs,cleanup}=await setup(async()=>++calls===1?response.replace('exports.execute=async','exports.execute=INVALID async'):response)
 try{const token=await upload(packs,{'calc.cjs':'exports.run=x=>x*7'});await packs.processImport(token,true,'test.zip');let p=(await finish(packs,token)).preview!;await expect(packs.install(token,p.hash,store.snapshot().revision,{trusted:true})).rejects.toThrow();await packs.processImport(token,true,'test.zip');p=(await finish(packs,token)).preview!;await packs.install(token,p.hash,store.snapshot().revision,{trusted:true});expect(calls).toBe(2)}finally{await cleanup()}
})
