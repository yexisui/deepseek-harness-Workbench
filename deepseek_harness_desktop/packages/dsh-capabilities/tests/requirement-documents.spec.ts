import {afterEach,it,expect,vi} from 'vitest'
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,relative} from 'node:path'
import {randomUUID} from 'node:crypto'
import {createRequire} from 'node:module'
import {RequirementsService} from '../src/host/requirements.ts'
import {runTemplate} from '../src/host/requirement-template-work.ts'
import {templateDraft} from '../src/core/requirement-template.ts'
import {initialState} from '../src/core/model.ts'
import {REQUIREMENTS_ROLE_ID,type RequirementTask} from '../src/core/requirements-model.ts'
import {inspectDocx} from '../src/host/requirement-docx.ts'
import {openRequirementOutput} from '../src/host/requirement-output.ts'
vi.mock('../src/host/requirement-output.ts',async importOriginal=>({...await importOriginal<any>(),openRequirementOutput:vi.fn()}))
const Zip=createRequire(import.meta.url)('pizzip'),roots:string[]=[],services:RequirementsService[]=[]
afterEach(async()=>{await Promise.all(services.splice(0).map(s=>s.close()));await Promise.all(roots.splice(0).map(r=>rm(r,{recursive:true,force:true})));vi.clearAllMocks()})
const input=(prompt:string)=>JSON.parse(prompt.slice(prompt.indexOf('\n')+1))
const response=(q:any)=>JSON.stringify({summary:'访客资料',items:q.document.map((r:any)=>({id:r.id,after:'访客 '+r.id}))})
async function setup(model=async(p:string)=>response(input(p)),count=3){
 const root=await mkdtemp(join(tmpdir(),'requirement-documents-'));roots.push(root)
 const state=initialState(new Date().toISOString()),service=new RequirementsService(root,model,()=>state,()=> 'test/chat');services.push(service);await service.init()
 const zip=new Zip();zip.file('[Content_Types].xml','<Types/>');zip.file('word/document.xml','<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+Array.from({length:count},(_,i)=>`<w:p><w:r><w:t>旧API业务${i}</w:t></w:r></w:p>`).join('')+'</w:body></w:document>')
 let task=await service.create({roleId:REQUIREMENTS_ROLE_ID,workflow:'template'});task=await service.importDocument(task.id,task.revision,'API报告.docx','template',zip.generate({type:'nodebuffer'}));task=await service.command(task.id,task.revision,{type:'template.save',product:'访客系统',brief:'预约后扫码入园',intent:'new-product'});return {root,state,service,task}
}
async function run(e:Awaited<ReturnType<typeof setup>>,action='generate',versionId?:string){const t=await e.service.get(e.task.id);await e.service.command(t.id,t.revision,{type:'template.run',action,instruction:'改为访客系统',versionId,requestId:randomUUID()});return finish(e.service,t.id)}
async function finish(s:RequirementsService,id:string){for(let i=0;i<500;i++){const t=await s.get(id);if(t.run?.status!=='running')return t;await new Promise(r=>setTimeout(r,5))}throw Error('not finished')}
it('repairs only missing blocks, including unchanged valid rows, and auto-saves an immutable Word version',async()=>{
 const requested:string[][]=[];const e=await setup(async p=>{const q=input(p);requested.push(q.document.map((r:any)=>r.id));if(requested.length===1)return JSON.stringify({items:[{id:q.document[0].id,after:q.document[0].text}]});return response(q)})
 const t=await run(e);expect(t.run?.status,t.run?.error).toBe('ready');expect(requested.map(x=>x.length)).toEqual([3,2]);expect(requested[1]).not.toContain(requested[0]![0]);expect(t.template!.versions).toHaveLength(2);expect(t.template!.versions[0]!.values).toEqual({})
 const v=t.template!.versions[1]!,opened=await e.service.openDocument(t.id,'open',v.id)
 expect(opened.path).toMatch(/V1_访客系统\.docx$/);expect(relative(e.root,opened.path)).not.toContain('..');expect(inspectDocx(await readFile(opened.path))).toEqual(inspectDocx(await e.service.exportDocument(t.id,v.id)));expect(openRequirementOutput).toHaveBeenCalledWith(opened.path)
 expect(inspectDocx(await e.service.exportDocument(t.id,t.template!.versions[0]!.id))[1]!.text).toBe('旧API业务1')
})
it('keeps partial blocks and other completed batches, reopens the draft, and resumes only missing positions',async()=>{
 const calls:any[]=[];const e=await setup(async p=>{const q=input(p);calls.push(q);return q.part===1?JSON.stringify({items:q.document.length===45?[{id:q.document[0].id,after:'已写好的预约规则'}]:[]}):response(q)},46)
 const t=await run(e);expect(t.run!.status).toBe('stopped');expect(t.template!.versions).toHaveLength(1);expect(t.template!.values).toEqual({});expect(t.run!.templateProgress!.batches[1]!.complete).toBe(true)
 const draft=templateDraft(t.template!,t.run!.templateProgress!,true);expect(draft.completed).toBe(2);expect(draft.pending).toHaveLength(44);expect(draft.values['word/document.xml#0']).toBe('已写好的预约规则');expect(draft.values['word/document.xml#1']).toContain('待补全');expect(JSON.stringify(draft.values)).not.toContain('旧API业务')
 await e.service.close();const resumed:string[][]=[],s=new RequirementsService(e.root,async p=>{const q=input(p);resumed.push(q.document.map((r:any)=>r.id));return response(q)},()=>e.state,()=> 'test/chat');services.push(s);await s.init();const reopened=await s.get(t.id);expect(reopened.run!.templateProgress).toEqual(t.run!.templateProgress)
 await s.command(t.id,reopened.revision,{type:'run.resume',runId:t.run!.id,requestId:randomUUID()});const done=await finish(s,t.id);expect(done.run!.status,done.run!.error).toBe('ready');expect(resumed).toHaveLength(1);expect(resumed[0]).toHaveLength(44);expect(done.template!.values['word/document.xml#0']).toBe('已写好的预约规则');expect(done.template!.versions).toHaveLength(2)
})
it('revises the selected old version into a new one without restoring over the current document first',async()=>{
 const inputs:any[]=[];const e=await setup(async p=>{const q=input(p);inputs.push(q);return response(q)})
 let t=await run(e);const v0=t.template!.versions[0]!,v1=structuredClone(t.template!.versions[1]!)
 t=await e.service.command(t.id,t.revision,{type:'template.edit',id:'word/document.xml#0',before:t.template!.values['word/document.xml#0'],after:'后续人工修改'});t=await e.service.command(t.id,t.revision,{type:'template.version'})
 t=await run(e,'revise',v0.id);expect(inputs.at(-1).document[0].text).toBe('旧API业务0');expect(t.template!.versions[1]).toEqual(v1);expect(t.template!.versions.at(-1)!.number).toBe(3);expect(t.template!.versions[2]!.values['word/document.xml#0']).toBe('后续人工修改')
})
it('does not overwrite externally edited Word files and rejects unknown actions or versions',async()=>{
 const e=await setup(),t=await run(e),v=t.template!.versions[1]!,opened=await e.service.openDocument(t.id,'open',v.id)
 await writeFile(opened.path,'external edit');await e.service.exportDocument(t.id,v.id);expect(await readFile(opened.path,'utf8')).toBe('external edit')
 await expect(e.service.openDocument(t.id,'open','../../bad')).rejects.toThrow('请选择');await expect(e.service.openDocument(t.id,'anything',v.id)).rejects.toThrow('操作无效');e.state.roles.find(r=>r.id===REQUIREMENTS_ROLE_ID)!.enabled=false;await expect(e.service.openDocument(t.id,'folder')).rejects.toThrow()
})
it('preserves a saved version when file output fails, then permits retry',async()=>{
 const e=await setup();await writeFile(join(e.root,'_outputs'),'not a directory');const t=await run(e);expect(t.run!.status).toBe('ready');expect(t.template!.versions[1]!.fileError).toContain('写入失败');expect(t.template!.values['word/document.xml#0']).toContain('访客')
 await rm(join(e.root,'_outputs'));const result=await e.service.openDocument(t.id,'open',t.template!.versions[1]!.id);expect(inspectDocx(await readFile(result.path))).toHaveLength(3)
})
it('keeps an unfinished document across an intervening question and resumes it afterwards',async()=>{
 let complete=false;const e=await setup(async p=>{const q=input(p);if(q.sources)return JSON.stringify({answer:'资料不足，待确认',sources:[]});return complete?response(q):JSON.stringify({items:[]})})
 let t=await run(e);const paused=t.run!,revision=t.dataRevision
 t=await run(e,'ask');expect(t.run!.status,t.run!.error).toBe('ready');expect(t.dataRevision).toBe(revision);expect(t.template!.draftRun!.id).toBe(paused.id)
 complete=true;await e.service.command(t.id,t.revision,{type:'run.resume',runId:paused.id,requestId:randomUUID()});t=await finish(e.service,t.id)
 expect(t.run!.status,t.run!.error).toBe('ready');expect(t.template!.versions).toHaveLength(2);expect(t.template!.answers).toHaveLength(1);expect(t.template!.draftRun).toBeUndefined()
})
