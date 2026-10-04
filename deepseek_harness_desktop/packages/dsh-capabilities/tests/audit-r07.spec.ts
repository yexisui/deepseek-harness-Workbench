import { expect, it } from 'vitest'
import { mkdtemp } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { CapabilityStore } from '../src/host/store.ts'
import { MEETING_ROLE_ID } from '../src/core/default-roles.ts'
import { roleForPreset, allowedActions } from '../src/core/policy.ts'
import { protectManagedCopy } from '../src/host/native-preset-adapter.ts'
it('copies a published developer role into an independent draft and publishes an authorized identity',async()=>{
 const store=new CapabilityStore(await mkdtemp(join(tmpdir(),'audit-r07-')));await store.init()
 try {
 const original=store.snapshot().roles.find(r=>r.id==='builtin-developer')!
 await store.command(0,{type:'role.save',id:original.id,definition:{...original.draft,name:'秘密草稿'},publish:false})
 const result=await store.command(1,{type:'role.copy',id:original.id}), copy=result.state.roles.find(r=>r.id===result.id)!
 expect(copy.versions).toEqual([]);expect(copy.draft.name).toBe(original.versions.at(-1)!.name+' 副本')
 const published=await store.command(2,{type:'role.save',id:copy.id,definition:copy.draft,publish:true}), version=published.state.roles.find(r=>r.id===copy.id)!.versions[0]!
 expect(roleForPreset(published.state,version.preset)?.role.id).toBe(copy.id)
 expect(allowedActions(published.state,copy.id,version)).toContain('develop')
 expect(published.state.roles.find(r=>r.id===original.id)!.versions).toEqual(original.versions)
 await expect(store.command(3,{type:'role.copy',id:MEETING_ROLE_ID})).rejects.toThrow('专用流程')
 } finally {await store.close()}
})
it('refuses orphaned native copies and reserved target ids while forwarding ordinary native copies',async()=>{
 const calls:string[][]=[], service={async copy(from:string,id:string){calls.push([from,id])}}, original=service.copy
 const dispose=protectManagedCopy(service)
 await expect(service.copy('workbench-role-builtin-developer-v1','copy')).rejects.toThrow('复制岗位')
 await expect(service.copy('native','workbench-role-spoof-v1')).rejects.toThrow('复制岗位')
 await service.copy('native','custom');expect(calls).toEqual([['native','custom']]);dispose();expect(service.copy).toBe(original)
})
