import {it,expect} from 'vitest'
import {createRequire} from 'node:module'
import {mkdtemp,rm} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {tmpdir} from 'node:os'
import {buildRequirementPreview} from '../src/host/requirement-preview.ts'
import {inspectDocx} from '../src/host/requirement-docx.ts'
import {RequirementsService} from '../src/host/requirements.ts'
import {initialState} from '../src/core/model.ts'
import type {PreviewNode} from '../src/core/requirement-preview.ts'
const Zip=createRequire(import.meta.url)('pizzip')
const p=(text:string,props='')=>`<w:p>${props}<w:r><w:t>${text}</w:t></w:r></w:p>`
const cell=(text:string,props='')=>`<w:tc><w:tcPr>${props}</w:tcPr>${p(text)}</w:tc>`
function fixture(){const z=new Zip();z.file('word/document.xml',`<w:document><w:body>${p('报告标题','<w:pPr><w:pStyle w:val="af7"/></w:pPr>')}<w:p/><w:tbl><w:tblGrid><w:gridCol w:w="2000"/><w:gridCol w:w="1000"/><w:gridCol w:w="1000"/></w:tblGrid><w:tr><w:trPr><w:tblHeader/></w:trPr>${cell('合并标题','<w:gridSpan w:val="2"/><w:shd w:fill="DDEEFF"/>')}${cell('第三列')}</w:tr><w:tr>${cell('纵向合并','<w:vMerge w:val="restart"/>')}${cell('A')}${cell('B')}</w:tr><w:tr>${cell('','<w:vMerge/>')}${cell('C')}${cell('D')}</w:tr></w:tbl><w:p><w:r><w:t>图片</w:t><w:drawing><wp:extent cx="952500" cy="476250"/><wp:docPr descr="示例插图"/><a:blip r:embed="r1"/></w:drawing></w:r></w:p></w:body></w:document>`);z.file('word/styles.xml','<w:styles><w:style w:styleId="base"><w:rPr><w:rFonts w:eastAsia="宋体"/><w:sz w:val="22"/></w:rPr></w:style><w:style w:styleId="af7"><w:basedOn w:val="base"/><w:pPr><w:jc w:val="center"/></w:pPr><w:rPr><w:b/></w:rPr></w:style></w:styles>');z.file('word/_rels/document.xml.rels','<Relationships><Relationship Id="r1" Target="media/a.png"/></Relationships>');z.file('word/media/a.png',Buffer.from('png'));return z}
const bytes=(z=fixture())=>z.generate({type:'nodebuffer'}) as Buffer
const paragraphs=(nodes:PreviewNode[]):any[]=>nodes.flatMap(n=>n.type==='paragraph'?[n]:n.rows.flatMap(r=>r.cells.flatMap(c=>paragraphs(c.nodes))))
it('renders actual rows, column widths and horizontal/vertical merges instead of independent cell cards',()=>{
 const input=bytes(),model=buildRequirementPreview(input,'asset',inspectDocx(input)),table=model.body.find(n=>n.type==='table')!
 expect(table.type).toBe('table');if(table.type!=='table')throw Error('table')
 expect(table.columns).toEqual([2000,1000,1000]);expect(table.rows[0]!.header).toBe(true)
 expect(table.rows[0]!.cells[0]).toMatchObject({colSpan:2,background:'#DDEEFF'})
 expect(table.rows[1]!.cells[0]!.rowSpan).toBe(2);expect(table.rows[2]!.cells).toHaveLength(2)
 expect(paragraphs(model.body).map(p=>p.runs.map((r:any)=>r.text||'').join('')).filter(Boolean)).toEqual(['报告标题','合并标题','第三列','纵向合并','A','B','C','D','图片'])
})
it('resolves style IDs and embeds only local raster images, without changing original bytes or paragraph anchors',()=>{
 const input=bytes(),before=Buffer.from(input),slots=inspectDocx(input),model=buildRequirementPreview(input,'asset',slots),nodes=paragraphs(model.body)
 expect(nodes[0]).toMatchObject({id:'word/document.xml#0',style:{font:'宋体',size:11,bold:true,align:'center'}})
 expect(nodes.find(n=>n.runs.some((r:any)=>r.text==='合并标题')).id).toBe(slots.find(s=>s.text==='合并标题')!.id)
 expect(nodes.at(-1).runs.find((r:any)=>r.image)).toMatchObject({width:100,height:50,alt:'示例插图'})
 expect(model.images['word/media/a.png']).toMatch(/^data:image\/png;base64,/);expect(input).toEqual(before)
})
it('does not load external or active image content and rejects entity expansion',()=>{
 const z=fixture();z.file('word/_rels/document.xml.rels','<Relationships><Relationship Id="r1" Target="https://example.com/private.png" TargetMode="External"/></Relationships>');let input=bytes(z)
 expect(buildRequirementPreview(input,'x',inspectDocx(input)).images).toEqual({})
 z.file('word/_rels/document.xml.rels','<Relationships><Relationship Id="r1" Target="media/a.svg"/></Relationships>');z.file('word/media/a.svg','<svg onload="alert(1)"/>');input=bytes(z)
 expect(buildRequirementPreview(input,'x',inspectDocx(input)).images).toEqual({})
 z.file('word/styles.xml','<!DOCTYPE styles [<!ENTITY x SYSTEM "file:///secret">]><w:styles/>');input=bytes(z)
 expect(()=>buildRequirementPreview(input,'x',inspectDocx(input))).toThrow('XML')
})
it('previews existing tasks without changing their versions, values, original export or revision',async()=>{
 const root=await mkdtemp(join(tmpdir(),'requirements-preview-')),service=new RequirementsService(root,async()=>'',()=>initialState(new Date().toISOString()));await service.init()
 try{let task=await service.create({roleId:'builtin-analyst',workflow:'template'});task=await service.importDocument(task.id,task.revision,'模板.docx','template',bytes());const before=await service.get(task.id),output=await service.exportDocument(task.id),view=await service.previewDocument(task.id);expect(view.body.some(n=>n.type==='table')).toBe(true);expect(await service.get(task.id)).toEqual(before);expect(await service.exportDocument(task.id)).toEqual(output)}
 finally{await service.close();if(resolve(root).startsWith(resolve(tmpdir())+'\\requirements-preview-'))await rm(root,{recursive:true,force:true})}
})
