import {it,expect,vi} from 'vitest'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {initialState} from '../src/core/model.ts'
import {documentCapability,documentRole,DOCUMENT_ROLE_ID} from '../src/core/documents-model.ts'
import {knowledgeCapability} from '../src/core/knowledge-module.ts'
import {DocumentsService} from '../src/host/documents.ts'
import type {KnowledgeRequest} from '../src/core/knowledge.ts'

it('persists per-document selections, preserves role defaults and sends the selected scope to retrieval',async()=>{
 const root=await mkdtemp(join(tmpdir(),'document-scope-')),state=initialState(),now=new Date().toISOString(),role=documentRole(now)
 state.capabilities.push(documentCapability(now),knowledgeCapability(now));role.versions[0]!.capabilities.push({capabilityId:'external-knowledge',version:1,enabled:true,knowledgeScope:{providerId:'test',collectionIds:['default']}});state.roles.push(role)
 const requests:KnowledgeRequest[]=[],model=vi.fn(async()=>'依据 [K1] 回答'),adapter={status:async()=>({configured:true,verified:true,label:'测试资料',message:''}),search:async(request:KnowledgeRequest)=>{requests.push(request);return {sources:[{id:'a',title:'选定资料',text:'选定资料正文'}]}}}
 let service=new DocumentsService(root,()=>state,model,()=>adapter)
 const body=(id:string)=>({id,question:'检查内容',scope:'document',useKnowledge:true,context:{revision:0,paragraphs:[{text:'文档原文'}],selection:''}})
 try{
  await service.init();const row=await service.create({roleId:DOCUMENT_ROLE_ID,filename:'测试.docx'})
  expect(await service.knowledgeStatus(row.id)).toMatchObject({allowed:true,scope:{collectionIds:['default']}})
  await service.command(row.id,'knowledge-scope',{providerId:'test',collectionIds:['chosen','chosen']})
  expect(role.versions[0]!.capabilities.at(-1)!.knowledgeScope?.collectionIds).toEqual(['default'])
  await service.ai.ask(body(row.id));await vi.waitFor(()=>expect(service.get(row.id).messages.at(-1)?.status).toBe('done'))
  expect(requests[0]?.scope).toEqual({providerId:'test',collectionIds:['chosen']});expect(model).toHaveBeenCalledTimes(1)
  await service.close();service=new DocumentsService(root,()=>state,model,()=>adapter);await service.init()
  expect(service.get(row.id).knowledgeScope?.collectionIds).toEqual(['chosen']);expect(service.get(row.id).messages).toHaveLength(2)
  await service.command(row.id,'knowledge-scope',null)
  expect(await service.knowledgeStatus(row.id)).toMatchObject({scope:null})
  await expect(service.ai.ask(body(row.id))).rejects.toThrow('请选择本次引用');expect(requests).toHaveLength(1)
  await service.ai.ask({...body(row.id),useKnowledge:false});await vi.waitFor(()=>expect(service.get(row.id).messages.at(-1)?.status).toBe('done'));expect(requests).toHaveLength(1)
  state.roles.find(r=>r.id===DOCUMENT_ROLE_ID)!.enabled=false
  expect(await service.knowledgeStatus(row.id)).toMatchObject({allowed:false})
  await expect(service.command(row.id,'knowledge-scope',{collectionIds:['chosen']})).rejects.toThrow('未启用')
 }finally{await service.close();await rm(root,{recursive:true,force:true})}
})

it('keeps running retrieval scope fixed and prevents saving a replacement during generation',async()=>{
 const root=await mkdtemp(join(tmpdir(),'document-scope-running-')),state=initialState(),now=new Date().toISOString(),role=documentRole(now)
 state.capabilities.push(documentCapability(now),knowledgeCapability(now));role.versions[0]!.capabilities.push({capabilityId:'external-knowledge',version:1,enabled:true});state.roles.push(role)
 let release!:()=>void;const held=new Promise<void>(r=>release=r),requests:KnowledgeRequest[]=[]
 const service=new DocumentsService(root,()=>state,async()=>{await held;return '完成'},()=>({status:async()=>({configured:true,verified:true,label:'测试',message:''}),search:async request=>{requests.push(request);return {sources:[{id:'a',title:'资料',text:'依据'}]}}}))
 try{await service.init();const row=await service.create({roleId:DOCUMENT_ROLE_ID,filename:'生成中.docx'});await service.command(row.id,'knowledge-scope',{collectionIds:['first']});await service.ai.ask({id:row.id,question:'问题',scope:'document',useKnowledge:true,context:{revision:0,paragraphs:[{text:'原文'}],selection:''}})
  await expect(service.command(row.id,'knowledge-scope',{collectionIds:['second']})).rejects.toThrow('当前回答完成')
  expect(service.get(row.id).knowledgeScope?.collectionIds).toEqual(['first']);release();await vi.waitFor(()=>expect(service.get(row.id).messages.at(-1)?.status).toBe('done'));expect(requests[0]?.scope?.collectionIds).toEqual(['first'])
 }finally{release();await service.close();await rm(root,{recursive:true,force:true})}
})
