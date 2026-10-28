import {afterEach,it,expect} from 'vitest'
import {mkdtemp,rm,readFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {randomUUID} from 'node:crypto'
import {createRequire} from 'node:module'
import {RequirementsService} from '../src/host/requirements.ts'
import {initialState} from '../src/core/model.ts'
import {REQUIREMENTS_ROLE_ID,type RequirementTask,type RequirementCommand} from '../src/core/requirements-model.ts'
import {inspectDocx,renderTemplate} from '../src/host/requirement-docx.ts'
const require=createRequire(import.meta.url),Zip=require('pizzip'),roots:string[]=[],services:RequirementsService[]=[]
afterEach(async()=>{await Promise.all(services.splice(0).map(s=>s.close()));await Promise.all(roots.splice(0).map(r=>rm(r,{recursive:true,force:true})))})
function fixture(){const zip=new Zip();zip.file('[Content_Types].xml','<Types/>');zip.file('word/styles.xml','<styles>KEEP</styles>');zip.file('word/media/image1.png',Buffer.from('keep-image'));zip.file('word/header1.xml','<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:r><w:t>产品A需求说明</w:t></w:r></w:p></w:hdr>');zip.file('word/document.xml',`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>产品A</w:t></w:r></w:p><w:p><w:pPr><w:spacing w:after="80"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>原</w:t></w:r><w:r><w:t>功能</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>指标</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>99%</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:p><w:r><w:drawing><image/></w:drawing></w:r></w:p><w:p><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:t>1</w:t></w:r></w:p><w:sectPr><w:pgSz w:w="11906"/></w:sectPr></w:body></w:document>`);return zip.generate({type:'nodebuffer'}) as Buffer}
async function setup(model:(prompt:string,model:string,signal?:AbortSignal)=>Promise<string>=async()=>JSON.stringify({summary:'调整正文',items:[{id:'word/document.xml#1',after:'新功能',reason:'业务调整'}]})){
 const root=await mkdtemp(join(tmpdir(),'requirement-template-'));roots.push(root);const state=initialState(new Date().toISOString())
 const service=new RequirementsService(root,model,()=>state,route=>route||'test/model');services.push(service);await service.init();let task=await service.create({roleId:REQUIREMENTS_ROLE_ID,workflow:'template'})
 task=await service.importDocument(task.id,task.revision,'参考.docx','template',fixture());return {root,state,service,task}
}
const cmd=(e:Awaited<ReturnType<typeof setup>>,t:RequirementTask,c:RequirementCommand)=>e.service.command(t.id,t.revision,c)
it('saves a table in one revision, exports all changed cells and restores the saved version',async()=>{
 const e=await setup(),changes=[{id:'word/document.xml#2',before:'指标',after:'预约月份'},{id:'word/document.xml#3',before:'99%',after:'1200'}]
 let t=await cmd(e,e.task,{type:'template.editMany',changes});expect(t.revision).toBe(e.task.revision+1)
 const exported=inspectDocx(await e.service.exportDocument(t.id));for(const c of changes)expect(exported.find(p=>p.id===c.id)?.text).toBe(c.after)
 expect(new Zip(await e.service.exportDocument(t.id)).file('word/styles.xml').asText()).toBe(new Zip(fixture()).file('word/styles.xml').asText())
 t=await cmd(e,t,{type:'template.version'});expect(t.template?.versions.at(-1)?.values).toMatchObject(Object.fromEntries(changes.map(c=>[c.id,c.after])))
 t=await cmd(e,t,{type:'template.restore',id:t.template!.versions[0]!.id});expect(t.template?.values).toEqual({})
})
it('never partially saves a table on stale cells, invalid targets or duplicate entries',async()=>{
 const e=await setup(),valid={id:'word/document.xml#2',before:'指标',after:'新标题'},before=await e.service.get(e.task.id)
 for(const bad of [{id:'word/document.xml#3',before:'过期内容',after:'100%'},{id:'word/document.xml#1',before:'原功能',after:'非表格'},{...valid}]){
  await expect(cmd(e,e.task,{type:'template.editMany',changes:[valid,bad]})).rejects.toThrow();expect(await e.service.get(e.task.id)).toEqual(before)
 }
})
it('table batches keep existing edit authorization and cannot overwrite a newer task revision',async()=>{
 const e=await setup(),changes=[{id:'word/document.xml#2',before:'指标',after:'新标题'}],t=await cmd(e,e.task,{type:'template.note',note:'后续编辑'})
 await expect(cmd(e,e.task,{type:'template.editMany',changes})).rejects.toMatchObject({status:409})
 e.state.roles.find(r=>r.id===REQUIREMENTS_ROLE_ID)!.enabled=false;await expect(cmd(e,t,{type:'template.editMany',changes})).rejects.toThrow();expect((await e.service.get(t.id)).template?.values).toEqual({})
})
async function finished(service:RequirementsService,id:string){for(let i=0;i<200;i++){const t=await service.get(id);if(t.run?.status!=='running')return t;await new Promise(r=>setTimeout(r,5))}throw Error('Model did not settle')}
async function revision(e:Awaited<ReturnType<typeof setup>>,t=e.task){await cmd(e,t,{type:'template.run',action:'revise',instruction:'调整功能',requestId:randomUUID()});return finished(e.service,t.id)}
it('persists completed batches across pause and restart, then resumes without duplicate generation',async()=>{
 const called:number[]=[],model=async(prompt:string,_model:string,signal?:AbortSignal)=>{
  const p=JSON.parse(prompt.slice(prompt.indexOf('\n')+1));called.push(p.part)
  if(p.part!==1)return new Promise<string>((_resolve,reject)=>{if(signal!.aborted)reject(signal!.reason);else signal!.addEventListener('abort',()=>reject(signal!.reason),{once:true})})
  return JSON.stringify({items:p.document.map((x:any)=>({id:x.id,after:'新业务 '+x.id}))})
 }
 const e=await setup(model),zip=new Zip(fixture());zip.file('word/document.xml','<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+Array.from({length:100},(_,i)=>'<w:p><w:r><w:t>内容'+i+'</w:t></w:r></w:p>').join('')+'</w:body></w:document>')
 let t=await e.service.importDocument(e.task.id,e.task.revision,'大模板.docx','template',zip.generate({type:'nodebuffer'}),e.task.template!.template!.id)
 t=await cmd(e,t,{type:'template.run',action:'revise',instruction:'修改所有内容',requestId:randomUUID()});const originalRevision=t.revision
 for(let i=0;i<200;i++){const current=await e.service.get(t.id);if(current.run?.templateProgress?.batches[0])break;await new Promise(r=>setTimeout(r,5))}
 const before=await e.service.get(t.id);expect(before.run?.templateProgress?.batches[0]).toBeDefined();expect(before.revision).toBe(originalRevision)
 t=await cmd(e,t,{type:'run.stop',runId:t.run!.id});expect(t.template!.proposals).toHaveLength(0);expect(t.run?.templateProgress?.batches[0]).toBeDefined()
 await e.service.close()
 const resumedCalls:number[]=[],service=new RequirementsService(e.root,async prompt=>{const p=JSON.parse(prompt.slice(prompt.indexOf('\n')+1));resumedCalls.push(p.part);return JSON.stringify({items:p.document.map((x:any)=>({id:x.id,after:'新业务 '+x.id}))})},()=>e.state,()=> 'test/model');services.push(service);await service.init()
 const requestId=randomUUID(),previous=t;await service.command(t.id,t.revision,{type:'run.resume',runId:t.run!.id,requestId});t=await finished(service,t.id)
 expect(t.run?.status,t.run?.error).toBe('ready');expect(resumedCalls).toEqual([2,3]);expect(t.template!.proposals[0]!.groups.flatMap(g=>g.changes)).toHaveLength(101)
 expect(Object.keys(t.template!.values)).toHaveLength(101);expect(t.template!.versions).toHaveLength(2);expect(t.run!.templateProgress).toBeUndefined()
 await service.command(previous.id,previous.revision,{type:'run.resume',runId:previous.run!.id,requestId});expect(resumedCalls).toEqual([2,3])
})
it('does not resume over edits or with revoked access, and ignores a stale stop for another run',async()=>{
 const e=await setup(async(_p,_m,signal)=>new Promise((_resolve,reject)=>signal!.addEventListener('abort',()=>reject(Error('paused')),{once:true})))
 let t=await cmd(e,e.task,{type:'template.run',action:'revise',instruction:'修改',requestId:randomUUID()})
 t=await cmd(e,t,{type:'run.stop',runId:t.run!.id});const paused=t
 t=await cmd(e,t,{type:'template.note',note:'人工编辑'})
 await expect(cmd(e,t,{type:'run.resume',runId:paused.run!.id,requestId:randomUUID()})).rejects.toThrow('暂停后资料或正文已修改')
 await expect(cmd(e,t,{type:'run.stop',runId:randomUUID()})).rejects.toThrow('任务已切换')
 expect((await e.service.get(t.id)).template!.note).toBe('人工编辑')
 e.state.roles.find(r=>r.id===REQUIREMENTS_ROLE_ID)!.enabled=false
 await expect(cmd(e,t,{type:'run.resume',runId:paused.run!.id,requestId:randomUUID()})).rejects.toThrow()
})
it('reads body/table/header and protects fields without touching the original bytes',async()=>{const e=await setup();expect(e.task.template?.template?.slots).toHaveLength(7);expect(e.task.template?.template?.slots[3]).toMatchObject({table:1,row:1,cell:2,text:'99%'});expect(e.task.template?.template?.slots.find(s=>s.index===5&&s.part==='word/document.xml')?.editable).toBe(false);expect(await e.service.exportDocument(e.task.id)).toEqual(fixture())})
it('automatically saves model changes, preserves other ZIP parts and can revert the accepted group',async()=>{const e=await setup();let t=await revision(e);expect(t.run?.status,t.run?.error).toBe('ready');expect(t.template?.values).toEqual({'word/document.xml#1':'新功能'});const p=t.template!.proposals[0]!,g=p.groups[0]!;expect(g.status).toBe('accepted');t=await cmd(e,t,{type:'template.note',note:'人工备注'});t=await cmd(e,t,{type:'template.version'});const output=new Zip(await e.service.exportDocument(t.id)),original=new Zip(fixture());for(const n of Object.keys(original.files).filter(n=>n!=='word/document.xml'))expect(output.file(n).asNodeBuffer()).toEqual(original.file(n).asNodeBuffer());expect(output.file('word/document.xml').asText()).toContain('<w:rPr><w:b/></w:rPr>');t=await cmd(e,t,{type:'template.review',proposalId:p.id,groupIds:[g.id],action:'revert'});expect(t.template?.values[g.changes[0]!.id]).toBe('原功能');expect(t.template?.note).toBe('人工备注');expect(t.template?.versions).toHaveLength(3)})
it('rejects local rollback after a human edits the same paragraph and keeps their work',async()=>{const e=await setup();let t=await revision(e);const p=t.template!.proposals[0]!,g=p.groups[0]!;expect(g.status).toBe('accepted');t=await cmd(e,t,{type:'template.edit',id:'word/document.xml#1',before:'新功能',after:'人工确认功能'});await expect(cmd(e,t,{type:'template.review',proposalId:p.id,groupIds:[g.id],action:'revert'})).rejects.toMatchObject({status:409});expect((await e.service.get(t.id)).template?.values['word/document.xml#1']).toBe('人工确认功能')})
it('handles escaped text and line breaks while preserving section settings',async()=>{const e=await setup();const t=await cmd(e,e.task,{type:'template.edit',id:'word/document.xml#1',before:'原功能',after:'A & B < C\n新功能'});const bytes=await e.service.exportDocument(t.id);expect(inspectDocx(bytes).find(p=>p.id==='word/document.xml#1')?.text).toBe('A & B < C\n新功能');expect(new Zip(bytes).file('word/document.xml').asText()).toContain('<w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr>')})
it('blocks stale edits, unknown IDs, changing the template and invalid source kinds',async()=>{const e=await setup();await expect(cmd(e,e.task,{type:'template.edit',id:'word/document.xml#1',before:'不存在',after:'改'})).rejects.toMatchObject({status:409});await expect(cmd(e,e.task,{type:'template.edit',id:'word/document.xml#5',before:'1',after:'改'})).rejects.toThrow('不能直接编辑');await expect(e.service.importDocument(e.task.id,e.task.revision,'另一个.docx','template',fixture())).rejects.toThrow('更换模板');await expect(e.service.importDocument(e.task.id,e.task.revision,'x.exe','source',Buffer.from('x'))).rejects.toThrow('支持DOCX')})
it('requires new product facts and removes old images from the generated new-product candidate',async()=>{let prompt='';const e=await setup(async p=>{prompt=p;const input=JSON.parse(p.slice(p.indexOf('\n')+1));return JSON.stringify({summary:'根据新产品资料编写',questions:['参数待确认'],items:input.document.map((x:any)=>({id:x.id,after:x.image?'沿用旧图':'产品B '+x.id,reason:'替换旧产品内容'}))})});await expect(cmd(e,e.task,{type:'template.run',action:'generate',instruction:'生成',requestId:randomUUID()})).rejects.toThrow('填写新产品');let t=await cmd(e,e.task,{type:'template.save',product:'产品B',brief:'仓库盘点，支持离线使用。',intent:'new-product'});await cmd(e,t,{type:'template.run',action:'generate',instruction:'沿用结构和风格',requestId:randomUUID()});t=await finished(e.service,t.id);expect(t.run?.status,t.run?.error).toBe('ready');expect(prompt).toContain('不能把旧产品的参数');const p=t.template!.proposals[0]!;expect(p.groups.flatMap(g=>g.changes).find(c=>c.id==='word/document.xml#4')?.after).toContain('待补充：产品B');expect(p.groups.every(g=>g.status==='accepted')).toBe(true);const xml=new Zip(await e.service.exportDocument(t.id)).file('word/document.xml').asText();expect(xml).not.toContain('<w:drawing>');expect(xml).toContain('产品B')})
it('retains incomplete new-product text as a draft and does not publish a half-replaced version',async()=>{let calls=0;const e=await setup(async()=>JSON.stringify({items:calls++===0?[{id:'word/document.xml#1',after:'新功能'}]:[]}));let t=await cmd(e,e.task,{type:'template.save',product:'B',brief:'新产品业务',intent:'new-product'});await cmd(e,t,{type:'template.run',action:'generate',instruction:'生成',requestId:randomUUID()});t=await finished(e.service,t.id);expect(calls).toBe(2);expect(t.run?.status).toBe('stopped');expect(t.run?.templateProgress?.batches[0]?.changes[0]?.after).toBe('新功能');expect(t.template?.versions).toHaveLength(1);expect(t.template?.proposals).toHaveLength(0);expect(t.template?.values).toEqual({})})
it('uses active reference sources for real questions, validates citations and never changes text',async()=>{const e=await setup(async p=>{const input=JSON.parse(p.slice(p.indexOf('\n')+1)),source=input.sources.find((x:any)=>x.name==='产品B.md');return JSON.stringify({answer:'支持离线使用。',sources:[{sourceId:source.id,blockId:'text#0',quote:'支持离线使用'}]})});let t=await e.service.importDocument(e.task.id,e.task.revision,'产品B.md','source',Buffer.from('支持离线使用'));await cmd(e,t,{type:'template.run',action:'ask',instruction:'支持离线吗',requestId:randomUUID()});t=await finished(e.service,t.id);expect(t.run?.status,t.run?.error).toBe('ready');expect(t.template?.answers[0]?.sources[0]?.quote).toBe('支持离线使用');expect(t.template?.values).toEqual({})})
it('rejects invented citations and model block IDs without changing saved data',async()=>{const e=await setup(async()=>JSON.stringify({answer:'错误回答',sources:[{sourceId:'missing',blockId:'none',quote:'没有依据'}]}));await cmd(e,e.task,{type:'template.run',action:'ask',instruction:'问题',requestId:randomUUID()});let t=await finished(e.service,e.task.id);expect(t.run?.status).toBe('error');expect(t.template?.answers).toHaveLength(0);expect(t.template?.values).toEqual({})})
it('keeps versions immutable, restores as new, and forks with independent content and shared immutable assets',async()=>{const e=await setup();let t=await cmd(e,e.task,{type:'template.edit',id:'word/document.xml#1',before:'原功能',after:'新功能'});t=await cmd(e,t,{type:'template.version'});const old=t.template!.versions[0]!.id;t=await cmd(e,t,{type:'template.restore',id:old});expect(t.template?.versions).toHaveLength(3);expect(t.template?.versions[1]?.values['word/document.xml#1']).toBe('新功能');const fork=await e.service.fork(t.id,randomUUID());await cmd(e,fork,{type:'template.edit',id:'word/document.xml#1',before:'原功能',after:'分叉独立内容'});expect((await e.service.get(t.id)).template?.values).toEqual({});await e.service.remove(t.id);expect(inspectDocx(await e.service.exportDocument(fork.id)).find(p=>p.id==='word/document.xml#1')?.text).toBe('分叉独立内容')})
it('does not publish model output after stop or overwrite edits made during generation',async()=>{let release!:(v:string)=>void;const e=await setup(async()=>new Promise<string>(r=>{release=r}));let t=await cmd(e,e.task,{type:'template.run',action:'revise',instruction:'修改',requestId:randomUUID()});while(!release)await new Promise(r=>setTimeout(r,1));t=await cmd(e,t,{type:'template.edit',id:'word/document.xml#1',before:'原功能',after:'人工变化'});release(JSON.stringify({summary:'AI变化',items:[{id:'word/document.xml#1',after:'AI内容'}]}));t=await finished(e.service,t.id);expect(t.run?.status).toBe('error');expect(t.template?.values['word/document.xml#1']).toBe('人工变化');expect(t.template?.proposals).toHaveLength(0)})
it('requires existing requirements role authorization for new document changes',async()=>{const e=await setup();e.state.roles.find(r=>r.id===REQUIREMENTS_ROLE_ID)!.enabled=false;await expect(cmd(e,e.task,{type:'template.note',note:'x'})).rejects.toThrow('需求分析');expect((await e.service.get(e.task.id)).template?.note).toBe('')})
it('reopens persisted workspace and does not start another model request for a retry token',async()=>{let calls=0;const e=await setup(async()=>{calls++;return JSON.stringify({summary:'调整',items:[{id:'word/document.xml#1',after:'新功能'}]})});const requestId=randomUUID();let t=await cmd(e,e.task,{type:'template.run',action:'revise',instruction:'修改',requestId});t=await finished(e.service,t.id);await cmd(e,e.task,{type:'template.run',action:'revise',instruction:'修改',requestId});expect(calls).toBe(1);await e.service.close();const reopened=new RequirementsService(e.root,async()=>'',()=>e.state);services.push(reopened);await reopened.init();expect((await reopened.get(t.id)).template).toEqual(t.template)})

it('keeps paragraph page breaks and template furniture while generated documents use A4',async()=>{
 const e=await setup(),zip=new Zip(fixture()),originalDocument=zip.file('word/document.xml').asText().replace('<w:t>原</w:t>','<w:t>原</w:t><w:br w:type="page"/>').replace('<w:pgSz w:w="11906"/>','<w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1000" w:left="1200" w:bottom="900" w:right="1100"/>')
 zip.file('word/document.xml',originalDocument);zip.file('word/settings.xml','<w:settings><w:zoom w:percent="90"/></w:settings>');zip.file('word/footer1.xml','<w:ftr><w:p><w:r><w:t>模板页脚</w:t></w:r></w:p></w:ftr>')
 const input=zip.generate({type:'nodebuffer'});let t=await e.service.importDocument(e.task.id,e.task.revision,'分页模板.docx','template',input,e.task.template!.template!.id)
 expect(await e.service.exportDocument(t.id)).toEqual(input)
 const target=t.template!.template!.slots.find(p=>p.id==='word/document.xml#1')!;t=await cmd(e,t,{type:'template.edit',id:target.id,before:target.text,after:'新产品功能'})
 const output=new Zip(await e.service.exportDocument(t.id)),xml=output.file('word/document.xml').asText()
 expect(xml).toContain('<w:br w:type="page"/>');expect(xml).toContain('<w:pgSz w:w="11906" w:h="16838"/>');expect(xml).toContain('<w:pgMar w:top="1000" w:left="1200" w:bottom="900" w:right="1100"/>')
 for(const name of ['word/styles.xml','word/header1.xml','word/footer1.xml'])expect(output.file(name).asText()).toBe(zip.file(name).asText())
 expect(output.file('word/settings.xml').asText()).toContain('<w:updateFields w:val="true"/>')
})
