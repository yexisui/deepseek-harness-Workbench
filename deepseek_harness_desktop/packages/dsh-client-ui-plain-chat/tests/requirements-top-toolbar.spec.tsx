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

const workspace=()=>host.querySelector<HTMLElement>('[data-template-workspace]')!;
const more=()=>act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="更多文档操作"]')!.click());
const action=async(label:string)=>act(async()=>{const button=Array.from(host.querySelectorAll<HTMLButtonElement>('[data-document-actions] button')).find(b=>b.textContent===label)!;expect(button).toBeTruthy();button.click();await flush()});
it('defaults existing templates to compact and new empty tasks to expanded guidance',async()=>{
 await render();expect(workspace().dataset.tools).toBe('closed');expect(host.querySelector('header')!.hidden).toBe(true);
 expect(host.querySelector('[aria-label="文档工具栏"]')!.parentElement).toBe(workspace());
 await act(async()=>root.unmount());root=createRoot(host);delete task.template!.template;await render();expect(workspace().dataset.tools).toBe('open');
 expect(JSON.parse(localStorage.getItem('workbench-template-layout:task')!)).not.toHaveProperty('toolsCollapsed');expect(writes).toEqual([]);
});
it('remembers explicit per-conversation expansion without saving business data',async()=>{
 revision();await render();await click('展开工具');expect(workspace().dataset.tools).toBe('open');expect(host.querySelector('header')!.hidden).toBe(false);
 await act(async()=>root.unmount());root=createRoot(host);await render();expect(workspace().dataset.tools).toBe('open');await click('收起工具');
 expect(JSON.parse(localStorage.getItem('workbench-template-layout:task')!).toolsCollapsed).toBe(true);expect(writes).toEqual([]);
});
it('preserves document scroll and unsaved composing input while collapsing',async()=>{
 await render();const input=host.querySelector<HTMLTextAreaElement>('[aria-label="文档编写要求"]')!;
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(input,'保留编辑内容');input.dispatchEvent(new Event('input',{bubbles:true}))});
 const scroll=host.querySelector('[data-document-view]')?.parentElement??host.querySelector('main>section>div:last-child')!;scroll.scrollTop=150;
 await click('展开工具');await click('收起工具');expect(scroll.scrollTop).toBe(150);expect(input.value).toBe('保留编辑内容');expect(writes).toEqual([]);
});
it('closes more actions with Escape or outside click and restores keyboard focus',async()=>{
 await render();await more();expect(host.querySelector('[data-document-actions]')).toBeTruthy();
 await act(async()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
 expect(host.querySelector('[data-document-actions]')).toBeNull();expect(document.activeElement?.getAttribute('aria-label')).toBe('更多文档操作');
 await more();await act(async()=>document.body.dispatchEvent(new Event('pointerdown',{bubbles:true})));expect(host.querySelector('[data-document-actions]')).toBeNull();expect(writes).toEqual([]);
});
it('keeps historical editing and return actions available from the compact menu',async()=>{
 revision();await render();await click('我的文档');await act(async()=>version(1).click());await more();await action('基于此版修改');expect(host.textContent).toContain('基于 V1 修改');expect(host.querySelector('[data-document-actions]')).toBeNull();
 await more();await action('返回当前正文');expect(host.querySelector('[aria-label="文档工具栏"]')!.textContent).toContain('V1.1');expect(writes).toEqual([]);
});
it('switches QA from more actions and restores compact document view',async()=>{
 await render();await more();await action('资料问答');expect(workspace().dataset.mode).toBe('qa');expect(workspace().dataset.tools).toBe('open');
 await click('模板文档');expect(workspace().dataset.tools).toBe('closed');await more();await action('使用说明');expect(host.querySelector('[role="dialog"]')).toBeTruthy();expect(writes).toEqual([]);
});
it('leaves unsaved content and generation failure and resume visible in compact mode',async()=>{
 task.template!.values={p1:'手动未保存'};task.run={id:'failed',templateAction:'generate',operation:'document',status:'error',instruction:'写完整',model:'test/chat',error:'连接中断',startedAt:at,baseRevision:1};
 await render();expect(workspace().dataset.tools).toBe('closed');expect(host.querySelector('[data-unsaved=true]')!.textContent).toContain('尚未存为版本');expect(button('保存版本').disabled).toBe(false);
 const alert=host.querySelector('[role="alert"]')!;expect(alert.textContent).toContain('连接中断');expect(alert.closest('[hidden]')).toBeNull();expect(host.querySelector('[aria-label="文档生成状态"]')!.textContent).toContain('继续补全');
});
it('hides the comparison row with markings and keeps inferred source details on demand',async()=>{
 await render();await click('查看修改 · 1处');expect(host.querySelector('[aria-label="正文修改导航"]')!.parentElement).toBe(workspace());
 const info=host.querySelector('[aria-label="对比来源说明"]')?.parentElement as HTMLDetailsElement;expect(info).toBeTruthy();expect(info.open).toBe(false);
 await click('隐藏修改');expect(host.querySelector('[aria-label="正文修改导航"]')).toBeNull();expect(writes).toEqual([]);
});
