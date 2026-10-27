// @vitest-environment jsdom
import {afterEach,beforeEach,it,expect,vi} from 'vitest'
import React,{act} from 'react'
import {createRoot,type Root} from 'react-dom/client'
import {RequirementsWorkspace} from '../src/client/RequirementsWorkspace.tsx'
import {exportRequirementDocument} from '../src/client/requirements-client.ts'
import {emptyTemplateWorkspace,templateDraft} from '../../dsh-capabilities/src/core/requirement-template.ts'
import {defaultRequirementSettings,emptyRequirementOverview,type RequirementTask} from '../../dsh-capabilities/src/core/requirements-model.ts'
let host:HTMLDivElement,root:Root,task:RequirementTask,writes:any[]
const at='2026-10-26T14:00:00Z',json=(x:unknown)=>new Response(JSON.stringify(x)),flush=()=>new Promise(r=>setTimeout(r,5))
beforeEach(()=>{
 (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;sessionStorage.clear();localStorage.clear();writes=[]
 task={schema:1,id:'task',revision:1,dataRevision:1,title:'API报告',mode:'quick',roleId:'builtin-analyst',roleVersion:6,capabilityId:'requirements-analysis',capabilityVersion:1,authorityAt:1,roleGuidance:{name:'需求分析助手',duties:'',requirements:'',format:''},createdAt:at,updatedAt:at,settings:defaultRequirementSettings(),draft:'',overview:emptyRequirementOverview(),requirements:[],flows:[],rules:[],questions:[],materials:[],messages:[],events:[],versions:[],template:{...emptyTemplateWorkspace(),product:'访客系统',brief:'预约后入园',values:{p1:'访客预约后扫码入园'},template:{id:'template-a',name:'API使用报告7.docx',kind:'docx',enabled:true,slots:[{id:'p1',part:'word/document.xml',index:0,text:'原API报告的内容',style:'',heading:false,image:false,editable:true}]},versions:[{id:'v0',number:0,label:'原始模板',at,values:{},note:''},{id:'v1',number:1,label:'生成初稿',at,values:{p1:'访客预约后扫码入园'},note:''}]}}
 host=document.createElement('div');document.body.append(host);root=createRoot(host)
 vi.stubGlobal('fetch',vi.fn(async(input:string,init?:RequestInit)=>{const url=String(input)
  if(url.includes('/config?'))return json({ready:true,defaults:{model:''}})
  if(url.includes('/knowledge/status'))return json({available:false,collections:[]})
  if(url.includes('/executions?'))return json({items:[],total:0})
  if(url.includes('/task/'))return json(task)
  const body=JSON.parse(String(init?.body??'{}'));writes.push({url,body})
  if(url.includes('/document/'))return json({path:'outputs/访客系统/V1.docx'})
  if(body.command?.type==='template.run'){delete task.template!.newDraft;task.run={id:body.command.requestId,status:'running',templateAction:body.command.action,instruction:body.command.instruction,model:'test/chat',operation:'revise',baseRevision:task.dataRevision,startedAt:at};task.revision++}
  if(body.command?.type==='run.resume'){task.run={...(task.template?.draftRun??task.run!),id:body.command.requestId,status:'running'};task.revision++}
  if(body.command?.type==='template.draft.new'){const old=task.run?.id===body.command.runId?task.run:task.template!.draftRun!;const snapshot=templateDraft(task.template!,old!.templateProgress!,true);(task.template!.endedDrafts??=[]).push({id:old!.id,at,title:task.template!.product,instruction:old!.instruction,model:old!.model,template:structuredClone(task.template!.template!),values:snapshot.values,note:snapshot.note,completedBatches:0,totalBatches:1});delete task.run;delete task.template!.draftRun;task.template!.newDraft={id:'new-draft'};task.revision++;task.dataRevision++}
  if(body.command?.type==='run.stop'){task.run={...task.run!,status:'stopped'};task.revision++}
  return json(task)
 }))
})
afterEach(async()=>{await act(async()=>root.unmount());host.remove();localStorage.clear();vi.unstubAllGlobals()})
const button=(label:string)=>Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find(b=>b.textContent?.trim()===label)!
const click=async(label:string)=>act(async()=>{expect(button(label),label).toBeTruthy();button(label).click();await flush()})
const render=async()=>act(async()=>{root.render(<RequirementsWorkspace roleId="builtin-analyst" taskId={task.id} onLegacy={()=>{}}/>);await flush()})
const version=(n:number|string)=>Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find(b=>b.querySelector('span')?.textContent==='V'+n)!

const revision=()=>{
 const w=task.template!;w.versions[1]!.major=1;w.versions[1]!.minor=0;w.versions[1]!.parentId='v0'
 w.versions.push({id:'v11',number:2,major:1,minor:1,parentId:'v1',label:'按要求修改',at,values:{p1:'访客预约自动通过后扫码入园'},note:''});w.values={...w.versions[2]!.values}
}
it('marks saved-version changes inline against their parent without writes or AI requests',async()=>{
 revision();await render();await click('查看修改 · 1处')
 expect(host.querySelector<HTMLSelectElement>('[aria-label="对比版本"]')!.value).toBe('v1')
 expect(host.querySelector('[data-block-id=p1] mark')?.textContent).toBe('自动通过')
 expect(host.querySelector('[data-block-id=p1] details')?.textContent).toContain('访客预约后扫码入园')
 await click('隐藏修改');expect(host.querySelector('[data-change-id]')).toBeNull();expect(writes).toEqual([])
})
it('selects a historical branch parent instead of the chronologically preceding edition',async()=>{
 revision();const w=task.template!;w.versions.push({id:'v2',number:3,major:2,minor:0,parentId:'v11',label:'生成初稿',at,values:{p1:'全新版本'},note:''},{id:'v12',number:4,major:1,minor:2,parentId:'v1',label:'按要求修改',at,values:{p1:'历史版本改写'},note:''});w.values={p1:'历史版本改写'}
 await render();await click('查看修改 · 1处');expect(host.querySelector<HTMLSelectElement>('[aria-label="对比版本"]')!.value).toBe('v1')
 await click('我的文档');await act(async()=>version(2).click());expect(host.querySelector<HTMLSelectElement>('[aria-label="对比版本"]')!.value).toBe('v11')
})
it('lets users pick a base and distinguishes identical versions and V0 without a parent',async()=>{
 revision();const w=task.template!;w.versions.push({id:'v12',number:3,major:1,minor:2,parentId:'v11',label:'保存版本',at,values:{...w.values},note:''})
 await render();await click('查看修改 · 0处');expect(host.textContent).toContain('两版内容相同 · 0处修改')
 const select=host.querySelector<HTMLSelectElement>('[aria-label="对比版本"]')!;await act(async()=>{select.value='v0';select.dispatchEvent(new Event('change',{bubbles:true}))});expect(host.querySelector('[data-change-id=p1]')).toBeTruthy()
 await click('我的文档');await act(async()=>version(0).click());expect(host.querySelector('[data-change-id]')).toBeNull();expect(host.textContent).toContain('请选择对比版本')
})
it('retains independent fold state and draft text on reopen and opens the right panel for historical editing',async()=>{
 revision();await render();const input=host.querySelector<HTMLTextAreaElement>('[aria-label="文档编写要求"]')!;
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(input,'保留本次输入');input.dispatchEvent(new Event('input',{bubbles:true}))})
 await act(async()=>{host.querySelector<HTMLButtonElement>('[aria-label="收起资料与目录"]')!.click();host.querySelector<HTMLButtonElement>('[aria-label="收起编写与文档"]')!.click()})
 const workspace=host.querySelector<HTMLElement>('[data-template-workspace]')!;expect(workspace.dataset.sources).toBe('closed');expect(workspace.dataset.assistant).toBe('closed');expect(input.value).toBe('保留本次输入');expect(writes).toEqual([])
 await act(async()=>root.unmount());root=createRoot(host);await render();expect(host.querySelector<HTMLElement>('[data-template-workspace]')!.dataset.assistant).toBe('closed')
 await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="展开编写与文档"]')!.click());await click('我的文档');await act(async()=>version(1).click());await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="收起编写与文档"]')!.click());await click('基于此版修改');expect(host.querySelector<HTMLElement>('[data-template-workspace]')!.dataset.assistant).toBe('open')
})
it('navigates beyond the selected section and reports grouped table edits and note deletions',async()=>{
 revision();const w=task.template!;w.template!.slots.push({id:'h2',part:'word/document.xml',index:1,text:'第二章',heading:true,editable:true,image:false,style:''},{id:'cell',part:'word/document.xml',index:2,text:'旧审批',heading:false,editable:true,image:false,style:'',table:1,row:1,cell:1});w.versions[1]!.note='旧备注';w.values.cell='自动审批';w.versions[2]!.values={...w.values}
 await render();await click('第二章');await click('查看修改 · 3处');expect(host.querySelector('[data-block-id=p1]')).toBeNull()
 const scroll=vi.fn();Object.defineProperty(Element.prototype,'scrollIntoView',{configurable:true,value:scroll});vi.stubGlobal('requestAnimationFrame',(f:()=>void)=>{setTimeout(f,0);return 0});vi.stubGlobal('CSS',{escape:(s:string)=>s})
 await click('下一处');expect(host.querySelector('[data-block-id=p1]')).toBeTruthy();expect(host.textContent).toContain('第 1 / 3 处');await act(async()=>{await flush()});expect(scroll).toHaveBeenCalled()
 expect(host.querySelector('td mark')?.textContent).toBe('自动');expect(host.querySelector('[data-block-id=document-note] details')?.textContent).toContain('旧备注')
})
it('keeps incomplete placeholders out of comparisons and bottom resume reachable with folded panels',async()=>{
 task.run={id:'paused',templateAction:'generate',operation:'document',status:'stopped',instruction:'继续写',model:'test/chat',startedAt:at,baseRevision:1,templateProgress:{plan:[['p1']],batches:{},retrieval:{},newProduct:true}}
 await render();await act(async()=>{host.querySelector<HTMLButtonElement>('[aria-label="收起资料与目录"]')!.click();host.querySelector<HTMLButtonElement>('[aria-label="收起编写与文档"]')!.click()});expect(button('查看修改').disabled).toBe(true);expect(host.querySelector('[data-change-id]')).toBeNull()
 const footer=host.querySelector('[aria-label="文档生成状态"]')!;await act(async()=>{footer.querySelector<HTMLButtonElement>('button')!.click();await flush()});expect(writes.at(-1).body.command.type).toBe('run.resume')
})
it('keeps QA active after folding the document helper and preserves normal export payload',async()=>{
 revision();await render();await click('查看修改 · 1处');await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="收起编写与文档"]')!.click());await click('资料问答');expect(host.querySelector('[aria-label="资料问答"]')).toBeTruthy();await click('模板文档');await click('打开 Word');expect(writes.at(-1).body).toEqual({action:'open',versionId:'v11'})
})
