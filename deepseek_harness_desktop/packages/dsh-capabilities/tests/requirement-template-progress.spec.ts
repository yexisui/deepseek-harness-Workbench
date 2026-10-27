import {it,expect,vi} from 'vitest'
import {runTemplate} from '../src/host/requirement-template-work.ts'
import {emptyTemplateWorkspace,type TemplateProgress} from '../src/core/requirement-template.ts'
import type {RequirementTask} from '../src/core/requirements-model.ts'

const input=(prompt:string)=>JSON.parse(prompt.slice(prompt.indexOf('\n')+1))
const output=(p:ReturnType<typeof input>)=>JSON.stringify({summary:'完成第'+p.part+'批',items:p.document.map((row:any)=>({id:row.id,after:'新产品 '+row.id}))})
function fixture(count=91){
 const w=emptyTemplateWorkspace();w.product='访客系统';w.brief='先预约，再核验。';w.knowledge={providerId:'test',collectionIds:['kb'],product:'',project:''}
 w.template={id:'template',name:'报告.docx',kind:'docx',enabled:true,slots:Array.from({length:count},(_,i)=>({id:'p'+i,part:'word/document.xml',index:i,text:'旧产品第'+i+'项',style:'',heading:false,image:false,editable:true}))}
 return {id:'task',dataRevision:1,template:w,roleGuidance:{},run:{id:'run',templateAction:'generate',instruction:'改成访客系统',model:'test/chat',baseRevision:1}} as unknown as RequirementTask
}
const evidence={id:'source',chunkId:'chunk',title:'业务资料',text:'先预约，再核验。',hash:'hash',locator:'预约',collectionId:'kb'}
const knowledge=()=>({status:vi.fn(),search:vi.fn(async()=>({sources:[evidence]}))} as any)
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms))
it('overlaps at most two batches, deduplicates retrieval and merges in document order',async()=>{
 const task=fixture(),kb=knowledge(),end:number[]=[],saved:TemplateProgress[]=[];let active=0,peak=0
 const result=await runTemplate(task,async prompt=>{const p=input(prompt);active++;peak=Math.max(peak,active);await sleep(p.part===1?50:5);active--;end.push(p.part);return output(p)},new AbortController().signal,kb,async p=>{saved.push(p)})
 expect(peak).toBe(2);expect(end).toEqual([2,3,1]);expect(kb.search).toHaveBeenCalledTimes(1)
 expect(result.workspace.proposals[0]!.groups.flatMap(g=>g.changes).map(c=>c.id)).toEqual(task.template!.template!.slots.map(p=>p.id))
 expect(result.workspace.values).toEqual({});expect(Object.keys(saved.at(-1)!.batches)).toHaveLength(3)
 expect(result.workspace.proposals[0]!.summary).toBe('完成第1批\n完成第2批\n完成第3批')
})
it('resumes only unfinished batches and reuses saved evidence without applying partial text',async()=>{
 const task=fixture(),kb=knowledge(),controller=new AbortController();let saved:TemplateProgress|undefined
 await expect(runTemplate(task,async(prompt,_model,signal)=>{
  const p=input(prompt);if(p.part===1)return output(p)
  return new Promise<string>((_resolve,reject)=>{if(signal!.aborted)reject(signal!.reason);else signal!.addEventListener('abort',()=>reject(signal!.reason),{once:true})})
 },controller.signal,kb,async p=>{saved=p;if(p.batches[0])controller.abort()})).rejects.toThrow()
 expect(Object.keys(saved!.batches)).toEqual(['0']);expect(task.template!.values).toEqual({})
 task.run!.templateProgress=JSON.parse(JSON.stringify(saved));const called:number[]=[]
 const result=await runTemplate(task,async prompt=>{const p=input(prompt);called.push(p.part);return output(p)},new AbortController().signal,kb)
 expect(called).toEqual([2,3]);expect(kb.search).toHaveBeenCalledTimes(1);expect(result.workspace.proposals[0]!.groups.flatMap(g=>g.changes)).toHaveLength(91)
})
it('shares one product search across different old chapters but still rejects invalid document positions',async()=>{
 const task=fixture();task.template!.template!.slots[45]!.heading=true;const kb=knowledge()
 await expect(runTemplate(task,async prompt=>{const p=input(prompt);return p.part===2?JSON.stringify({items:[{id:'made-up',after:'坏位置'}]}):output(p)},new AbortController().signal,kb)).rejects.toThrow('不存在或重复')
 expect(kb.search).toHaveBeenCalledTimes(1);expect(kb.search.mock.calls[0][0].query).not.toContain('旧产品第45项');expect(task.template!.proposals).toEqual([]);expect(task.template!.values).toEqual({})
})
it('uses persisted batch boundaries and requires no model calls when all batches are saved',async()=>{
 const task=fixture(2),kb=knowledge();let saved:TemplateProgress|undefined
 await runTemplate(task,async p=>output(input(p)),new AbortController().signal,kb,async p=>{saved=p})
 task.run!.templateProgress=saved;const model=vi.fn()
 const result=await runTemplate(task,model,new AbortController().signal,kb)
 expect(model).not.toHaveBeenCalled();expect(result.workspace.proposals[0]!.groups[0]!.changes).toHaveLength(2)
})
it('rejects non-XML control characters locally without rendering a throwaway document',async()=>{
 const task=fixture(1)
 await expect(runTemplate(task,async()=>JSON.stringify({items:[{id:'p0',after:'内容\u0001'}]}),new AbortController().signal,knowledge())).rejects.toThrow('无效控制字符')
 expect(task.template!.proposals).toEqual([])
})
it('saves retrieval before the first model response and reuses it after a failed first batch',async()=>{
 const task=fixture(1),kb=knowledge();let saved:TemplateProgress|undefined
 await expect(runTemplate(task,async()=>{expect(Object.values(saved!.retrieval)).toEqual([[evidence]]);throw Error('连接中断')},new AbortController().signal,kb,async p=>{saved=p})).rejects.toThrow('连接中断')
 expect(saved!.batches).toEqual({});task.run!.templateProgress=structuredClone(saved)
 const result=await runTemplate(task,async p=>output(input(p)),new AbortController().signal,kb)
 expect(kb.search).toHaveBeenCalledTimes(1);expect(result.workspace.proposals[0]!.groups[0]!.changes).toHaveLength(1)
 // A genuinely new request/scope must not borrow the former evidence snapshot.
 delete task.run!.templateProgress;task.run!.instruction='改成车辆系统';task.template!.knowledge!.collectionIds=['vehicles']
 await runTemplate(task,async p=>output(input(p)),new AbortController().signal,kb)
 expect(kb.search).toHaveBeenCalledTimes(2);expect(kb.search.mock.calls[1][0].scope.collectionIds).toEqual(['vehicles'])
})
it('binds short reference IDs and legacy quote variations to original evidence without another model call',async()=>{
 const task=fixture(3),kb=knowledge(),model=vi.fn(async prompt=>{
  const p=input(prompt),ref=p.references[0].content[0].ref
  return JSON.stringify({items:p.document.map((row:any,i:number)=>({id:row.id,after:'访客预约再核验',sources:i===0?[ref,ref]:i===1?[{ref}]:[{sourceId:'source',blockId:'chunk',quote:'改写过的不存在引文'}]}))})
 })
 const result=await runTemplate(task,model,new AbortController().signal,kb)
 expect(model).toHaveBeenCalledTimes(1);expect(kb.search).toHaveBeenCalledTimes(1)
 for(const change of result.workspace.proposals[0]!.groups.flatMap(g=>g.changes))expect(change.sources).toEqual([{sourceId:'source',blockId:'chunk',name:'业务资料 · 预约',quote:evidence.text}])
 expect(JSON.stringify(result.workspace.proposals)).not.toContain('改写过的不存在引文')
})
it('isolates unknown and malformed references while saving all parallel batches and recording a review note',async()=>{
 const task=fixture(),kb=knowledge();let saved:TemplateProgress|undefined
 const result=await runTemplate(task,async prompt=>{const p=input(prompt);return JSON.stringify({items:p.document.map((row:any,i:number)=>({id:row.id,after:'新业务 '+row.id,sources:i%3===0?['R999']:i%3===1?'not-an-array':[{sourceId:'unknown',blockId:'chunk',quote:'不能伪造出处'}]}))})},new AbortController().signal,kb,async p=>{saved=p})
 const proposal=result.workspace.proposals[0]!,changes=proposal.groups.flatMap(g=>g.changes)
 expect(changes).toHaveLength(91);expect(changes.every(c=>c.sources?.length===0)).toBe(true)
 expect(proposal.questions).toContain('部分资料引用未能定位，已保留正文并略过无效出处；相关内容请核对。')
 expect(Object.values(saved!.batches).every(b=>b.complete)).toBe(true);expect(Object.keys(saved!.batches)).toHaveLength(3)
})
it('continues from the user description on no hits but does not disguise a retrieval service error',async()=>{
 const task=fixture(1),kb=knowledge();kb.search.mockResolvedValue({sources:[]})
 const result=await runTemplate(task,async p=>output(input(p)),new AbortController().signal,kb)
 expect(result.workspace.proposals[0]!.evidence).toEqual([]);expect(result.workspace.proposals[0]!.questions.join()).toContain('知识库未找到相关资料')
 kb.search.mockRejectedValue(Error('服务不可用'));const model=vi.fn()
 await expect(runTemplate(task,model,new AbortController().signal,kb)).rejects.toThrow('服务不可用');expect(model).not.toHaveBeenCalled()
})
