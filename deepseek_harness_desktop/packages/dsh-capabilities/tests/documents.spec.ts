import {describe,it,expect} from 'vitest'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {Readable} from 'node:stream'
import {DocumentsService} from '../src/host/documents.ts'
import {initialState} from '../src/core/model.ts'
import {documentCapability,documentRole,DOCUMENT_ROLE_ID} from '../src/core/documents-model.ts'
import {CapabilityStore} from '../src/host/store.ts'
describe('document sessions',()=>{
 it('persists working copies, rejects stale writers and keeps source-independent history',async()=>{
  const root=await mkdtemp(join(tmpdir(),'dsh-doc-test-')),state=initialState(),now=new Date().toISOString();state.capabilities.push(documentCapability(now));state.roles.push(documentRole(now));const service=new DocumentsService(root,()=>state)
  try{await service.init();const row=await service.create({roleId:DOCUMENT_ROLE_ID,filename:'验证.docx',conversationId:'conversation-test'}),data=Buffer.from([80,75,3,4,1,2,3])
   await service.upload(row.id,0,Readable.from([data]) as any);expect(await service.bytes(row.id)).toEqual(data)
   await expect(service.upload(row.id,0,Readable.from([data]) as any)).rejects.toThrow('已更新')
   await expect(service.create({roleId:DOCUMENT_ROLE_ID,filename:'old.doc'})).rejects.toThrow('.docx')
   state.roles.find(r=>r.id===DOCUMENT_ROLE_ID)!.enabled=false;await expect(service.create({roleId:DOCUMENT_ROLE_ID,filename:'new.docx'})).rejects.toThrow('未启用')
   // Revocation cannot prevent the user from retaining an already edited working copy.
   await service.upload(row.id,1,Readable.from([data]) as any)
   const restored=new DocumentsService(root,()=>state);await restored.init();expect(restored.list()[0]?.revision).toBe(2);expect(restored.list()[0]?.conversationId).toBe('conversation-test')
   await restored.command(row.id,'rename','新标题');expect(restored.list()[0]?.title).toBe('新标题');await restored.command(row.id,'remove',null);expect(restored.list()).toEqual([])
  }finally{await rm(root,{recursive:true,force:true})}
 })
 it('adds a real role/capability once without rewriting existing roles',async()=>{
  const root=await mkdtemp(join(tmpdir(),'dsh-doc-migration-'));const store=new CapabilityStore(root)
  try{await store.init();const first=store.snapshot();expect(first.roles.filter(r=>r.id===DOCUMENT_ROLE_ID)).toHaveLength(1);expect(first.capabilities.find(c=>c.id==='smart-document')?.draft.components[0]?.actions).toContain('edit-document');await store.close();const second=new CapabilityStore(root);try{await second.init();expect(second.snapshot()).toEqual(first)}finally{await second.close()}}
  finally{await store.close();await rm(root,{recursive:true,force:true})}
 })
})
