import {it,expect} from 'vitest'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {CapabilityStore} from '../src/host/store.ts'
it('removes an archived role irreversibly while retaining historical references and shared capabilities',async()=>{
 const root=await mkdtemp(join(tmpdir(),'role-removal-')),store=new CapabilityStore(root);await store.init()
 try{
  const role=store.snapshot().roles[0]!,caps=store.snapshot().capabilities
  await expect(store.command(store.snapshot().revision,{type:'role.remove',id:role.id})).rejects.toThrow('先归档')
  await store.command(store.snapshot().revision,{type:'role.archive',id:role.id})
  await store.command(store.snapshot().revision,{type:'role.restore',id:role.id})
  expect(store.snapshot().roles.find(r=>r.id===role.id)!.archivedAt).toBeUndefined()
  await store.command(store.snapshot().revision,{type:'role.archive',id:role.id})
  await store.command(store.snapshot().revision,{type:'role.remove',id:role.id})
  await store.close();await store.init()
  const record=store.snapshot().roles.find(r=>r.id===role.id)!
  expect(record.removedAt).toBeTruthy();expect(record.enabled).toBe(false)
  expect(record.versions).toEqual(role.versions);expect(record.draft).toEqual(role.draft)
  expect(store.snapshot().roles.filter(r=>!r.removedAt).some(r=>r.id===role.id)).toBe(false)
  expect(store.snapshot().capabilities).toEqual(caps)
  await expect(store.command(store.snapshot().revision,{type:'role.restore',id:role.id})).rejects.toThrow('永久移除')
  await expect(store.command(store.snapshot().revision,{type:'role.copy',id:role.id})).rejects.toThrow('永久移除')
 }finally{await store.close();await rm(root,{recursive:true,force:true,maxRetries:5})}
})
