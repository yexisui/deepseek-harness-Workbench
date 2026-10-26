// @vitest-environment jsdom
import {afterEach,beforeEach,it,expect,vi} from 'vitest'
import React,{act} from 'react'
import {createRoot,type Root} from 'react-dom/client'
import {RequirementsWorkspace} from '../src/client/RequirementsWorkspace.tsx'
import {emptyTemplateWorkspace} from '../../dsh-capabilities/src/core/requirement-template.ts'
import {editTemplate} from '../../dsh-capabilities/src/host/requirement-template-work.ts'
import {defaultRequirementSettings,emptyRequirementOverview,type RequirementTask} from '../../dsh-capabilities/src/core/requirements-model.ts'
let host:HTMLDivElement,root:Root,task:RequirementTask,writes:any[],failUpload:boolean
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status}),flush=()=>new Promise(r=>setTimeout(r,5))
beforeEach(()=>{
 (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;sessionStorage.clear();writes=[];failUpload=false
 task={schema:1,id:'10000000-0000-4000-8000-000000000001',revision:0,dataRevision:0,title:'API报告',mode:'quick',roleId:'builtin-analyst',roleVersion:6,capabilityId:'requirements-analysis',capabilityVersion:1,authorityAt:1,roleGuidance:{name:'需求分析助手',duties:'',requirements:'',format:''},createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),settings:defaultRequirementSettings(),draft:'',overview:emptyRequirementOverview(),requirements:[],flows:[],rules:[],questions:[],materials:[],messages:[],events:[],versions:[],template:{...emptyTemplateWorkspace(),template:{id:'template-a',name:'API使用报告7.docx',kind:'docx',enabled:true,slots:[{id:'p1',part:'word/document.xml',index:0,text:'旧报告',style:'',heading:false,image:false,editable:true}]}}}
 task.template!.versions=[{id:'v0',number:0,label:'原始模板',at:task.createdAt,values:{},note:''}]
 host=document.createElement('div');document.body.append(host);root=createRoot(host)
 HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','')};HTMLDialogElement.prototype.close=function(){this.removeAttribute('open')}
 vi.stubGlobal('fetch',vi.fn(async(input:string,init?:RequestInit)=>{const url=String(input)
  if(url.includes('/config?'))return json({ready:true,defaults:{model:''}})
  if(url.includes('/knowledge/status'))return json({available:false,configured:false,collections:[]})
  if(url.includes('/executions?'))return json({items:[],total:0})
  if(url.includes('/task/'))return json(task)
  writes.push({url,init})
  if(init?.method==='PUT'){if(failUpload)return json({error:'无法读取PDF'},400);task.template!.template={...task.template!.template!,name:'新模板.pdf',kind:'pdf'};task.revision++;return json(task)}
  if(init?.method==='POST'){editTemplate(task,JSON.parse(String(init.body)).command);task.revision++;return json(task)}
  return new Response('file')
 }))
})
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();vi.unstubAllGlobals()})
const button=(text:string)=>Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(b=>b.textContent?.trim()===text||b.getAttribute('aria-label')===text)!
const click=async(text:string)=>act(async()=>{expect(button(text),text).toBeTruthy();button(text).click();await flush()})
const render=async()=>act(async()=>{root.render(<RequirementsWorkspace roleId="builtin-analyst" taskId={task.id} onLegacy={()=>{}}/>);await flush()})
async function pick(){await act(async()=>{const input=host.querySelector<HTMLInputElement>('[aria-label="选择模板文件"]')!;Object.defineProperty(input,'files',{value:[new File(['%PDF'],'新模板.pdf')],configurable:true});input.dispatchEvent(new Event('change',{bubbles:true}));await flush()})}
it('offers PDF/Word input and output, and cancel/remove/restore preserve the document',async()=>{
 await render();expect(button('更换模板').disabled).toBe(false);await click('导出 ▾');expect(button('导出 PDF')).toBeTruthy();expect(host.querySelector('[aria-label="选择模板文件"]')?.getAttribute('accept')).toContain('.pdf')
 await click('移除：API使用报告7.docx');await click('取消');expect(writes).toEqual([])
 await click('移除：API使用报告7.docx');await click('确认移除');expect(task.template!.template).toBeUndefined()
 await click('我的文档');await click('恢复此文档');expect(task.template!.template!.name).toBe('API使用报告7.docx')
})
it('choosing another file is only staged until confirmed; failed conversion keeps the old template and allows retry',async()=>{
 await render();await pick();expect(writes).toEqual([]);await click('取消');expect(task.template!.template!.name).toBe('API使用报告7.docx')
 await pick();failUpload=true;await click('确认更换');expect(document.querySelector('[role=dialog]')).toBeTruthy();expect(task.template!.template!.name).toBe('API使用报告7.docx');expect(document.querySelector('[role=dialog]')?.textContent).toContain('无法读取PDF')
 failUpload=false;await click('确认更换');expect(task.template!.template!.kind).toBe('pdf');expect(writes.at(-1).url).toContain('replace=template-a');expect(document.querySelector('[role=dialog]')).toBeNull()
})
