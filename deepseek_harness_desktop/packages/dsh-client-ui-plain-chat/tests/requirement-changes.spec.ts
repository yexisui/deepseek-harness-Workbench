import {it,expect} from 'vitest'
import {comparisonBase,documentChanges,textChangeSpan,NOTE_BLOCK} from '../src/client/requirement-changes.ts'
import type {TemplateSlot,TemplateVersion} from '../../dsh-capabilities/src/core/requirement-template.ts'
const slot=(id:string,text:string,extra:Partial<TemplateSlot>={}):TemplateSlot=>({id,text,part:'word/document.xml',index:0,style:'',heading:false,image:false,editable:true,...extra})
const version=(id:string,number:number,extra:Partial<TemplateVersion>={}):TemplateVersion=>({id,number,label:'custom',at:'2026-10-27',values:{},note:'',...extra})
it('compares a branch against its actual parent and unsaved edits against the saved snapshot',()=>{
 const versions=[version('v0',0),version('v1',1,{major:1,minor:0,parentId:'v0'}),version('v2',2,{major:2,minor:0,parentId:'v1'}),version('v1.1',3,{major:1,minor:1,parentId:'v1'})]
 expect(comparisonBase(versions,versions[3],false).version?.id).toBe('v1')
 expect(comparisonBase(versions,versions[3],true).version?.id).toBe('v1.1')
 expect(comparisonBase(versions,versions[0],false).version).toBeUndefined()
})
it('labels legacy inference and does not guess ancestry for unknown history',()=>{
 const versions=[version('v0',0),version('v1',1,{label:'生成初稿'}),version('revision',2,{label:'按要求修改'}),version('custom',3)]
 expect(comparisonBase(versions,versions[2],false)).toMatchObject({version:{id:'v1'},inferred:true})
 expect(comparisonBase(versions,versions[3],false).version).toBeUndefined()
})
it('uses both snapshots instead of original template and counts one changed table cell once',()=>{
 const slots=[slot('p','模板'),slot('a','旧甲',{table:1,row:1,cell:1}),slot('b','旧乙',{table:1,row:1,cell:1}),slot('c','旧丙',{table:1,row:1,cell:2})]
 const result=documentChanges(slots,{p:'第一版',a:'新增',b:'',c:'旧丙'},'新增备注',{p:'第一版',a:'',b:'待删'},'')
 expect(result.groups).toHaveLength(2);expect(result.byId.has('p')).toBe(false)
 expect(result.groups[0]?.changes.map(c=>c.kind)).toEqual(['added','deleted']);expect(result.groups[1]?.id).toBe(NOTE_BLOCK)
 expect(result.byId.get('a')?.group).toBe(result.byId.get('b')?.group)
})
it('includes reversion to template text and removed notes and preserves whitespace differences',()=>{
 const result=documentChanges([slot('p','原文'),slot('q','空格')],{p:'原文',q:'空格 '},'',{p:'改写'},'人工备注')
 expect(result.groups).toHaveLength(3);expect(result.byId.get('p')?.change).toMatchObject({before:'改写',after:'原文'})
 expect(result.byId.get(NOTE_BLOCK)?.change.kind).toBe('deleted')
})
it('orders header, body, notes and footer to match the document',()=>{
 const result=documentChanges([slot('p','p'),slot('f','f',{part:'word/footer1.xml'}),slot('h','h',{part:'word/header1.xml'})],{p:'P',f:'F',h:'H'},'note',{},'')
 expect(result.groups.map(g=>g.id)).toEqual(['h','p',NOTE_BLOCK,'f'])
})
it('extracts Unicode-safe additions, replacements and deletions without marking unchanged text',()=>{
 expect(textChangeSpan('访客😀需要审批。','访客😀自动通过。')).toEqual({prefix:'访客😀',removed:'需要审批',added:'自动通过',suffix:'。'})
 expect(textChangeSpan('扫码入园','扫码后入园')).toMatchObject({prefix:'扫码',added:'后',removed:'',suffix:'入园'})
 expect(textChangeSpan('扫码后入园','扫码入园')).toMatchObject({prefix:'扫码',added:'',removed:'后',suffix:'入园'})
})
