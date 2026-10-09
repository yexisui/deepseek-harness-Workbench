import {it,expect} from 'vitest'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {CapabilityStore} from '../src/host/store.ts'
import {CapabilityPackages} from '../src/host/packages.ts'
it('exports every built-in capability and imports the same configuration without model calls or duplicate entries',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'workbench-export-')),store=new CapabilityStore(dir);await store.init();const packs=new CapabilityPackages(store,()=>'',async()=>{throw Error('No AI needed')});await packs.init()
 try{for(const cap of store.snapshot().capabilities){const original=store.snapshot(),file=await packs.exportInstalled(cap.id,undefined);expect(file.name).toBe(cap.draft.name+'.zip');expect(file.bytes.includes(Buffer.from('apiKey'))).toBe(false)
 const {token}=await packs.start('zip');await packs.put(token,'ability.zip',(async function*(){yield file.bytes})());await packs.processImport(token,true,file.name);while(packs.processStatus(token).status==='running')await new Promise(r=>setTimeout(r,5));const p=packs.processStatus(token).preview!;expect(p.manifest.protocol).toBe('dsh-workbench-capability-v1');const imported=await packs.install(token,p.hash,store.snapshot().revision,{trusted:true});expect(imported.id).toBe(cap.id);expect(imported.duplicate).toBe(true);expect(store.snapshot().capabilities).toEqual(original.capabilities)
 }}finally{await packs.close();await store.close();await rm(dir,{recursive:true,force:true,maxRetries:5})}
})
it('restores an exported configuration while preserving local models and task data',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'workbench-export-')),store=new CapabilityStore(dir);await store.init();const packs=new CapabilityPackages(store);await packs.init()
 try{const cap=store.snapshot().capabilities.find(c=>c.id==='browser')!,file=await packs.exportInstalled(cap.id,undefined);await store.command(store.snapshot().revision,{type:'capability.save',id:cap.id,definition:{...cap.draft,description:'changed'},publish:true,directSave:true});const {token}=await packs.start('zip');await packs.put(token,'ability.zip',(async function*(){yield file.bytes})());await packs.processImport(token,false,file.name);while(packs.processStatus(token).status==='running')await new Promise(r=>setTimeout(r,5));const p=packs.processStatus(token).preview!;await packs.install(token,p.hash,store.snapshot().revision);expect(store.snapshot().capabilities.find(c=>c.id===cap.id)!.draft).toEqual(cap.draft)}finally{await packs.close();await store.close();await rm(dir,{recursive:true,force:true,maxRetries:5})}
})
