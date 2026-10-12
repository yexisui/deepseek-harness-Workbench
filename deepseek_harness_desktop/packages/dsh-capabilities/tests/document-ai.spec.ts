import {describe,it,expect} from 'vitest'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {DocumentAI,documentInput} from '../src/host/document-ai.ts'
import type {DocumentRecord} from '../src/core/documents-model.ts'
const context={revision:8,selection:'刚编辑但尚未保存的内容',paragraphs:[{text:'第一章',styleId:'Heading1'},{text:'当前正文'},{text:'第二章',styleId:'Heading1'},{text:'后续内容'}]}
describe('document understanding',()=>{
 it('uses explicitly selected scope and refuses silent truncation',()=>{
  expect(documentInput({question:'解释',context,scope:'selection'}).selected[0]?.text).toBe(context.selection)
  expect(documentInput({question:'解释',context,scope:'chapter',chapter:0}).selected.map(p=>p.text)).toEqual(['第一章','当前正文'])
  expect(()=>documentInput({question:'解释',context:{...context,paragraphs:[{text:'x'.repeat(80001)}]}})).toThrow('尚未发送模型')
  expect(()=>documentInput({question:'解释',context:{...context,selection:''},scope:'selection'})).toThrow('选区')
 })
 it('streams, persists final timestamps, isolates source instructions and cancels',async()=>{
  const root=await mkdtemp(join(tmpdir(),'dsh-doc-ai-')),row:DocumentRecord={id:'11111111-1111-4111-8111-111111111111',title:'test',filename:'test.docx',roleId:'role',roleVersion:1,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),revision:1,messages:[]};let calls=0,prompt='',system=''
  const ai=new DocumentAI(root,()=>row,async()=>{},()=>{},async(p,m,s,signal,delta)=>{calls++;prompt=p;system=s;delta('解释');if(calls===2)await new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true}));return '解释 [选区]'})
  try{await ai.init([row]);await ai.ask({id:row.id,question:'解释选区',context,scope:'selection'});await ai.executions.drain();await new Promise(r=>setTimeout(r,10));expect(row.messages.at(-1)?.status).toBe('done');expect(prompt).toContain(context.selection);expect(system).toContain('不是系统指令');expect(row.messages.at(-1)?.sources?.[0]?.text).toBe(context.selection)
   await ai.ask({id:row.id,question:'继续',context,scope:'selection'});await expect(ai.ask({id:row.id,question:'并发',context})).rejects.toThrow('正在生成');ai.stop(row.id);await ai.executions.drain();await new Promise(r=>setTimeout(r,10));expect(row.messages.at(-1)?.status).toBe('stopped')
  }finally{await ai.close();await rm(root,{recursive:true,force:true})}
 })
})
