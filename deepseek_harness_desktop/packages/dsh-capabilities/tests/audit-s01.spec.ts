import { expect, it } from 'vitest'
import { mkdtemp } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { CapabilityStore } from '../src/host/store.ts'
import { roleForPreset, wasRevoked } from '../src/core/policy.ts'
it('archives and restores roles without deleting historical authority or resurrecting old tasks after restart',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'audit-s01-')), store=new CapabilityStore(directory);await store.init()
 const before=store.snapshot(),role=before.roles[0]!,old=role.versions[0]!
 try {
 const archived=await store.command(0,{type:'role.archive',id:role.id})
 expect(archived.state.roles[0]).toMatchObject({enabled:false,versions:role.versions,archivedAt:expect.any(String)})
 expect(roleForPreset(archived.state,old.preset)?.version).toEqual(old)
 await expect(store.command(1,{type:'role.toggle',id:role.id,enabled:true})).rejects.toThrow('先恢复')
 await expect(store.command(1,{type:'role.save',id:role.id,definition:role.draft,publish:true})).rejects.toThrow('先恢复')
 await store.command(1,{type:'role.restore',id:role.id})
 expect(store.snapshot().roles[0]!.enabled).toBe(false)
 await store.command(2,{type:'role.toggle',id:role.id,enabled:true})
 const at=store.snapshot().revokedAt!['role:'+role.id]!
 expect(wasRevoked(store.snapshot(),role.id,old,at-1)).toBe(true)
 } finally {await store.close()}
 const reopened=new CapabilityStore(directory);await reopened.init()
 try {expect(reopened.snapshot().roles[0]!.versions).toEqual(role.versions);expect(reopened.snapshot().roles[0]!.archivedAt).toBeUndefined()} finally {await reopened.close()}
})
