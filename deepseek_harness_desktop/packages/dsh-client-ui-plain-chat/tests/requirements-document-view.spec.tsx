// @vitest-environment jsdom
import React,{act} from 'react'
import {createRoot,type Root} from 'react-dom/client'
import {beforeEach,afterEach,it,expect,vi} from 'vitest'
import {RequirementDocumentView,basicRequirementPreview} from '../src/client/RequirementDocumentView.tsx'
import type {TemplateSource} from '../../dsh-capabilities/src/core/requirement-template.ts'
let host:HTMLDivElement,root:Root
const source:TemplateSource={id:'a',name:'报告.docx',kind:'docx',enabled:true,slots:[{id:'p0',index:0,part:'word/document.xml',text:'报告',style:'af7',heading:true,image:false,editable:true},...['维度','流程','收益','业务','扫码','提效'].map((text,i)=>({id:'p'+(i+1),index:i+1,part:'word/document.xml',text,style:'af7',heading:false,image:false,editable:true,table:1,row:Math.floor(i/3)+1,cell:i%3+1}))]}
beforeEach(()=>{(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;host=document.createElement('div');document.body.append(host);root=createRoot(host)})
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals()})
const flush=()=>new Promise(r=>setTimeout(r,5))
it('shows a real table, hides internal codes and keeps precise edit and change actions',async()=>{
 const edit=vi.fn(),compare=vi.fn();await act(async()=>{root.render(<RequirementDocumentView template={source} slots={source.slots} values={{p5:'二维码核验'}} original={false} note="备注" disabled={false} pendingIds={['p2']} onEdit={edit} onCompare={compare}/>);await flush()})
 expect(host.querySelectorAll('table')).toHaveLength(1);expect(host.querySelectorAll('tr')).toHaveLength(2);expect(host.querySelectorAll('tr')[0]!.querySelectorAll('td')).toHaveLength(3)
 expect(host.textContent).not.toContain('af7');expect(host.textContent).not.toContain('行 1');expect(host.textContent).toContain('二维码核验')
 await act(async()=>host.querySelector<HTMLButtonElement>('[data-block-id=p5] button[aria-label^="编辑"]')!.click());expect(edit).toHaveBeenCalledWith(source.slots.find(p=>p.id==='p5'))
 await act(async()=>host.querySelector<HTMLButtonElement>('[data-block-id=p5] button[aria-label="查看此处修改"]')!.click());expect(compare).toHaveBeenCalledWith('p5');expect(host.querySelector('[data-block-id=p2]')?.getAttribute('data-pending')).toBe('true')
})
it('uses resolved merged cells and images, and original view keeps the original image after a replacement',async()=>{
 const template={...source,asset:'asset'},layout=basicRequirementPreview(template);layout.body.push({type:'paragraph',id:'picture',heading:false,style:{},runs:[{image:'img',style:{},alt:'原图'}]});layout.images.img='data:image/png;base64,AA=='
 const table=layout.body[1];if(table?.type!=='table')throw Error('table');table.rows[0]!.cells[0]!.colSpan=2
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify(layout))));const props={taskId:'task',template,slots:[...source.slots,{id:'picture',index:9,part:'word/document.xml',text:'',style:'',heading:false,image:true,editable:true}],values:{picture:'待补新产品截图'},note:'',disabled:false,pendingIds:[],onEdit:vi.fn(),onCompare:vi.fn()}
 await act(async()=>{root.render(<RequirementDocumentView {...props} original={false}/>);await flush()});expect(host.querySelector('td')?.getAttribute('colspan')).toBe('2');expect(host.querySelector('img')).toBeNull();expect(host.textContent).toContain('待补新产品截图')
 await act(async()=>{root.render(<RequirementDocumentView {...props} original/>);await flush()});expect(host.querySelector('img')?.getAttribute('alt')).toBe('原图');expect(host.textContent).not.toContain('待补新产品截图')
})
it('rejects a late preview from a replaced template and keeps current document visible',async()=>{
 let finish:(value:Response)=>void=()=>{};const a={...source,asset:'a'},b={...source,id:'b',asset:'b'},old=basicRequirementPreview(a),current=basicRequirementPreview(b)
 current.body[0]={type:'paragraph',id:'p0',style:{},heading:true,runs:[{text:'新文档',style:{}}]}
 vi.stubGlobal('fetch',vi.fn().mockImplementationOnce(()=>new Promise<Response>(r=>finish=r)).mockResolvedValue(new Response(JSON.stringify(current))))
 const render=(template:TemplateSource)=>root.render(<RequirementDocumentView taskId="task" template={template} slots={template.slots} values={{}} original={false} note="" disabled={false} pendingIds={[]} onEdit={()=>{}} onCompare={()=>{}}/>)
 await act(async()=>{render(a);await flush()});await act(async()=>{render(b);await flush()});await act(async()=>{finish(new Response(JSON.stringify(old)));await flush()});expect(host.textContent).toContain('新文档')
})
