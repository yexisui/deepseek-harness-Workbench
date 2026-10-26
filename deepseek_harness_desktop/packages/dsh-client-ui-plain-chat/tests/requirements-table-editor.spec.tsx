/** @vitest-environment jsdom */
import React,{act} from 'react'
import {createRoot,type Root} from 'react-dom/client'
import {beforeEach,afterEach,it,expect,vi} from 'vitest'
import {RequirementTableEditor,type DocumentTable} from '../src/client/RequirementTableEditor.tsx'
import {RequirementDocumentView,basicRequirementPreview} from '../src/client/RequirementDocumentView.tsx'
import type {TemplateSource} from '../../dsh-capabilities/src/core/requirement-template.ts'
let host:HTMLDivElement,root:Root
const source:TemplateSource={id:'doc',name:'表格.docx',kind:'docx',enabled:true,slots:['期间','账单折算 Token','2026年7月','9,027,291.950'].map((text,i)=>({id:'p'+i,part:'word/document.xml',index:i,text,style:'',heading:false,image:false,editable:true,table:1,row:Math.floor(i/2)+1,cell:i%2+1}))}
beforeEach(()=>{host=document.createElement('div');document.body.append(host);root=createRoot(host)})
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals()})
const flush=()=>new Promise(r=>setTimeout(r,0))
async function fill(id:string,value:string){await act(async()=>{const input=host.querySelector<HTMLTextAreaElement>(`[data-edit-id="${id}"]`)!;Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}))})}
async function click(name:string){await act(async()=>{Array.from(host.querySelectorAll('button')).find(b=>b.textContent===name)!.click();await flush()})}
function setup(save=vi.fn().mockResolvedValue(undefined),close=vi.fn(),merged=false){const table=basicRequirementPreview(source).body[0] as DocumentTable;if(merged){table.rows[0]!.cells[0]!.colSpan=2;table.rows[0]!.cells[0]!.rowSpan=2}return {table,save,close,render:()=>root.render(<RequirementTableEditor table={table} slots={source.slots} values={{p3:'已采用的数值'}} images={{}} disabled={false} onSave={save} onClose={close}/>)}}
it('saves multiple cells together using accepted text and retains merge layout',async()=>{
 const e=setup(undefined,undefined,true);await act(async()=>e.render());expect(host.querySelector('td')?.colSpan).toBe(2);expect(host.querySelector('td')?.rowSpan).toBe(2)
 expect(host.querySelector<HTMLTextAreaElement>('[data-edit-id=p3]')?.value).toBe('已采用的数值');expect(Array.from(host.querySelectorAll('button')).find(b=>b.textContent==='保存修改')?.disabled).toBe(true)
 await fill('p0','预约月份');await fill('p3','1,200');await click('保存修改')
 expect(e.save).toHaveBeenCalledExactlyOnceWith([{id:'p0',before:'期间',after:'预约月份'},{id:'p3',before:'已采用的数值',after:'1,200'}]);expect(e.close).toHaveBeenCalledOnce()
})
it('cancel and Escape discard all inputs without sending a command',async()=>{
 const e=setup();await act(async()=>e.render());await fill('p0','临时改动');await click('取消');expect(e.save).not.toHaveBeenCalled();expect(e.close).toHaveBeenCalledOnce()
 await act(async()=>host.querySelector('[role=dialog]')!.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));expect(e.save).not.toHaveBeenCalled();expect(e.close).toHaveBeenCalledTimes(2)
})
it('keeps draft on failed save and prevents double submission or closing while saving',async()=>{
 let reject!:(e:Error)=>void;const e=setup(vi.fn(()=>new Promise<void>((_,r)=>reject=r)));await act(async()=>e.render());await fill('p2','新的月份');await click('保存修改');await click('正在保存…')
 await act(async()=>host.querySelector('[role=dialog]')!.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));expect(e.save).toHaveBeenCalledOnce();expect(e.close).not.toHaveBeenCalled()
 await act(async()=>{reject(new Error('内容已改变'));await flush()});expect(host.querySelector('[role=alert]')?.textContent).toContain('内容已改变');expect(host.querySelector<HTMLTextAreaElement>('[data-edit-id=p2]')?.value).toBe('新的月份');expect(e.close).not.toHaveBeenCalled()
})
it('opens the table editor from the document and hides it in original view',async()=>{
 const save=vi.fn().mockResolvedValue(undefined),render=(original=false)=>root.render(<RequirementDocumentView template={source} slots={source.slots} values={{}} original={original} note="" disabled={false} pendingIds={[]} onEdit={()=>{}} onCompare={()=>{}} onEditTable={save}/>);
 await act(async()=>render());await click('编辑表格');expect(host.querySelectorAll('[role=dialog] textarea')).toHaveLength(4);await fill('p1','访客数量');await click('保存修改');expect(save).toHaveBeenCalledOnce();expect(host.querySelector('[role=dialog]')).toBeNull();await act(async()=>render(true));expect(host.textContent).not.toContain('编辑表格')
})
