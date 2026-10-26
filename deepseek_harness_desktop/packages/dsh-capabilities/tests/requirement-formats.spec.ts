import {it,expect,vi,afterEach} from 'vitest'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {randomUUID} from 'node:crypto'
import {createRequire} from 'node:module'
import {RequirementsService} from '../src/host/requirements.ts'
import {initialState} from '../src/core/model.ts'
import {REQUIREMENTS_ROLE_ID} from '../src/core/requirements-model.ts'
import {convertRequirementDocument} from '../src/host/requirement-pdf.ts'
vi.mock('../src/host/requirement-pdf.ts',async original=>({...await original<object>(),convertRequirementDocument:vi.fn()}))
const roots:string[]=[],services:RequirementsService[]=[],Zip=createRequire(import.meta.url)('pizzip')
function doc(title='旧报告'){const z=new Zip();z.file('word/document.xml',`<w:document><w:body><w:p><w:r><w:t>${title}</w:t></w:r></w:p></w:body></w:document>`);return z.generate({type:'nodebuffer'}) as Buffer}
async function setup(){const root=await mkdtemp(join(tmpdir(),'requirements-formats-'));roots.push(root);const state=initialState(new Date().toISOString()),service=new RequirementsService(root,async()=>'',()=>state);services.push(service);await service.init();const t=await service.create({roleId:REQUIREMENTS_ROLE_ID,workflow:'template'});return {service,state,t}}
afterEach(async()=>{await Promise.all(services.splice(0).map(s=>s.close()));await Promise.all(roots.splice(0).map(r=>rm(r,{recursive:true,force:true})));vi.resetAllMocks()})
it('removes a template, preserves knowledge, sources, answers and edited document history, and restores after reopen',async()=>{
 const {service,t}=await setup();let task=await service.importDocument(t.id,t.revision,'API报告7.docx','template',doc());
 task=await service.importDocument(t.id,task.revision,'业务.md','source',Buffer.from('访客预约'))
 task=await service.command(t.id,task.revision,{type:'template.edit',id:'word/document.xml#0',before:'旧报告',after:'新产品'})
 task=await service.command(t.id,task.revision,{type:'template.note',note:'人工备注'})
 const sourceId=task.template!.sources[0]!.id,templateId=task.template!.template!.id
 task=await service.command(t.id,task.revision,{type:'template.remove',id:templateId})
 expect(task.template!.template).toBeUndefined();expect(task.template!.values).toEqual({});expect(task.template!.sources[0]!.id).toBe(sourceId)
 const history=(await service.get(t.id)).template!.documents![0]!
 expect(history.values['word/document.xml#0']).toBe('新产品');expect(history.note).toBe('人工备注')
 task=await service.command(t.id,task.revision,{type:'template.document.restore',id:history.id})
 expect(task.template!.template!.id).toBe(templateId);expect(task.template!.values['word/document.xml#0']).toBe('新产品')
 task=await service.command(t.id,task.revision,{type:'template.remove',id:sourceId});expect(task.template!.sources).toEqual([]);expect(task.template!.template!.id).toBe(templateId)
})
it('replaces only after parsing succeeds and protects old content from bad, stale and unconfirmed replacements',async()=>{
 const {service,t}=await setup();let task=await service.importDocument(t.id,t.revision,'A.docx','template',doc()),id=task.template!.template!.id
 await expect(service.importDocument(t.id,task.revision,'B.docx','template',doc())).rejects.toMatchObject({status:409})
 await expect(service.importDocument(t.id,task.revision,'坏.docx','template',Buffer.from('bad'),id)).rejects.toThrow('无法读取')
 expect((await service.get(t.id)).template!.template!.id).toBe(id)
 task=await service.importDocument(t.id,task.revision,'B.docx','template',doc('新报告'),id)
 expect(task.template!.template!.name).toBe('B.docx');expect(task.template!.documents![0]!.template.id).toBe(id)
 expect(task.template!.versions).toHaveLength(1);expect(task.template!.values).toEqual({})
 await expect(service.command(t.id,task.revision-1,{type:'template.remove',id:task.template!.template!.id})).rejects.toMatchObject({status:409})
})
it('imports PDF template/reference, exports both formats and preserves original PDF when unchanged',async()=>{
 const {service,t}=await setup(),pdf=Buffer.from('%PDF-1.7\nlocal test'),converted=doc('PDF正文')
 vi.mocked(convertRequirementDocument).mockResolvedValue(converted)
 let task=await service.importDocument(t.id,t.revision,'API报告7.pdf','template',pdf)
 expect(task.template!.template).toMatchObject({kind:'pdf',name:'API报告7.pdf'});expect(await service.exportDocument(t.id)).toEqual(converted)
 expect(await service.exportDocument(t.id,undefined,'pdf')).toEqual(pdf)
 task=await service.importDocument(t.id,task.revision,'参考.pdf','source',pdf);expect(task.template!.sources[0]!.kind).toBe('pdf')
 task=await service.command(t.id,task.revision,{type:'template.edit',id:'word/document.xml#0',before:'PDF正文',after:'新正文'})
 vi.mocked(convertRequirementDocument).mockResolvedValue(Buffer.from('%PDF-new'))
 expect(await service.exportDocument(t.id,undefined,'pdf')).toEqual(Buffer.from('%PDF-new'))
 expect(convertRequirementDocument).toHaveBeenLastCalledWith(expect.any(Buffer),'docx','pdf')
 expect(await service.exportDocument(t.id,task.template!.versions[0]!.id,'pdf')).toEqual(pdf)
 await expect(service.exportDocument(t.id,undefined,'zip' as any)).rejects.toThrow('格式')
})
it('failed PDF conversion does not remove the old template or commit a partial reference',async()=>{
 const {service,t}=await setup();const task=await service.importDocument(t.id,t.revision,'A.docx','template',doc())
 vi.mocked(convertRequirementDocument).mockRejectedValue(Error('转换失败'))
 await expect(service.importDocument(t.id,task.revision,'B.pdf','template',Buffer.from('%PDF-1.7'),task.template!.template!.id)).rejects.toThrow('转换失败')
 expect((await service.get(t.id)).template).toEqual(task.template)
 await expect(service.importDocument(t.id,task.revision,'假.pdf','source',Buffer.from('bad'))).rejects.toThrow('有效的PDF')
 expect((await service.get(t.id)).template!.sources).toEqual([])
})
