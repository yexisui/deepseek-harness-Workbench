// @vitest-environment jsdom
import {afterEach,beforeEach,it,expect,vi} from 'vitest'
import React,{act} from 'react'
import {createRoot,type Root} from 'react-dom/client'
import {RequirementsWorkspace} from '../src/client/RequirementsWorkspace.tsx'
import {emptyTemplateWorkspace,templateDraft} from '../../dsh-capabilities/src/core/requirement-template.ts'
import {defaultRequirementSettings,emptyRequirementOverview,type RequirementTask} from '../../dsh-capabilities/src/core/requirements-model.ts'
let host:HTMLDivElement,root:Root,task:RequirementTask,writes:any[]
const at='2026-10-26T14:00:00Z',json=(x:unknown)=>new Response(JSON.stringify(x)),flush=()=>new Promise(r=>setTimeout(r,5))
beforeEach(()=>{
 (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;sessionStorage.clear();writes=[]
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
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals()})
const button=(label:string)=>Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find(b=>b.textContent?.trim()===label)!
const click=async(label:string)=>act(async()=>{expect(button(label),label).toBeTruthy();button(label).click();await flush()})
const render=async()=>act(async()=>{root.render(<RequirementsWorkspace roleId="builtin-analyst" taskId={task.id} onLegacy={()=>{}}/>);await flush()})
const version=(n:number)=>Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find(b=>b.querySelector('span')?.textContent==='V'+n)!
it('opens each version inline without restoring it and retains the original left-side controls',async()=>{
 await render();expect(host.querySelector('[data-block-id=p1] p')?.textContent).toBe('访客预约后扫码入园');await click('我的文档')
 expect(button('比较版本')).toBeUndefined();expect(button('更换模板')).toBeTruthy();expect(button('添加参考资料')).toBeTruthy();expect(button('查看知识库设置')).toBeTruthy()
 await act(async()=>version(0).click());expect(host.querySelector('[data-block-id=p1] p')?.textContent).toBe('原API报告的内容');expect(writes).toEqual([])
 expect(host.querySelector<HTMLButtonElement>('[aria-label^="编辑："]')).toBeNull()
 await click('基于此版修改');await click('按模板生成初稿');expect(writes.at(-1).body.command.versionId).toBe('v0')
})
it('opens Word and its folder through explicit scoped actions and uses one export menu',async()=>{
 await render();await click('我的文档');await act(async()=>version(0).click());await click('打开 Word');expect(writes.at(-1).body).toEqual({action:'open',versionId:'v0'})
 await click('打开文件夹');expect(writes.at(-1).body).toEqual({action:'folder'});await click('导出 ▾');expect(button('导出 Word')).toBeTruthy();expect(button('导出 PDF')).toBeTruthy()
})
it('shows partial draft placeholders and completed text without changing saved values',async()=>{
 task.run={id:'partial',templateAction:'generate',operation:'document',status:'stopped',instruction:'改写',model:'test/chat',startedAt:at,baseRevision:1,templateProgress:{plan:[['p1']],batches:{},retrieval:{},newProduct:true}}
 await render();await click('我的文档');const draft=Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find(b=>b.textContent?.includes('未完成草稿'))!;await act(async()=>draft.click())
 expect(host.querySelector('[data-block-id=p1] p')?.textContent).toContain('待补全');expect(button('打开 Word').disabled).toBe(true);expect(button('继续补全')).toBeTruthy();expect(task.template!.values.p1).toBe('访客预约后扫码入园')
})

it.each(['stopped','interrupted','error'] as const)('keeps the %s draft resume action in the bottom bar across document panels',async(status)=>{
 task.run={id:'saved-progress',templateAction:'generate',operation:'document',status,instruction:'沿用格式改写',model:'test/chat',startedAt:at,baseRevision:1,templateProgress:{plan:[['p1']],batches:{},retrieval:{},newProduct:true}}
 await render()
 const footer=host.querySelector<HTMLElement>('section[aria-label="文档生成状态"]')!
 expect(footer).toBeTruthy();expect(footer.parentElement?.dataset.templateWorkspace).toBe('true');expect(footer.closest('main')).toBeNull()
 expect(button('按模板生成初稿')).toBeUndefined();expect(button('按要求修改')).toBeUndefined()
 for(const tab of ['我的文档','编写']){await click(tab);expect(footer.querySelector('button')?.textContent).toBe('继续补全');expect(Array.from(host.querySelectorAll('button')).filter(b=>b.textContent==='继续补全')).toHaveLength(tab==='编写'?2:1)}
 const progress=structuredClone(task.run!.templateProgress)
 await click('继续补全');expect(writes.at(-1).body.command).toMatchObject({type:'run.resume',runId:'saved-progress'});expect(task.run!.templateProgress).toEqual(progress)
 expect(button('继续补全')).toBeUndefined();expect(footer.querySelector('button')?.textContent).toBe('暂停生成')
 expect(host.querySelector('[aria-label="文档生成操作"] button')?.textContent).toBe('暂停生成');expect(button('按模板生成初稿')).toBeUndefined()
 await click('暂停生成');expect(footer.querySelector('button')?.textContent).toBe('继续补全');expect(host.querySelector('[role=tab][aria-selected=true]')?.textContent).toBeTruthy();expect(host.querySelector('[aria-label="文档生成操作"]')?.textContent).toContain('新开一版')
})

it('resumes the saved document draft after a separate question without starting a new document',async()=>{
 task.template!.draftRun={id:'document-draft',templateAction:'generate',operation:'document',status:'stopped',instruction:'继续写文档',model:'test/chat',startedAt:at,baseRevision:1,templateProgress:{plan:[['p1']],batches:{},retrieval:{},newProduct:true}}
 task.run={id:'later-question',templateAction:'ask',operation:'document',status:'ready',instruction:'怎么入园',model:'test/chat',startedAt:at,baseRevision:1}
 await render();await click('继续补全');expect(writes.at(-1).body.command).toMatchObject({type:'run.resume',runId:'document-draft'});expect(writes.some(w=>w.body.command?.type==='template.run')).toBe(false)
})

it('new edition removes both old resume controls, keeps a read-only draft, and survives reopening',async()=>{
 task.run={id:'old-draft',templateAction:'generate',operation:'document',status:'stopped',instruction:'旧要求',model:'test/chat',startedAt:at,baseRevision:1,templateProgress:{plan:[['p1']],batches:{},retrieval:{},newProduct:true}}
 await render();await click('编写');await click('新开一版')
 expect(writes.at(-1).body.command).toEqual({type:'template.draft.new',runId:'old-draft'})
 expect(button('继续补全')).toBeUndefined();expect(host.querySelector('[aria-label="文档生成状态"]')).toBeNull();expect(button('开始生成').disabled).toBe(true)
 expect(host.querySelector<HTMLTextAreaElement>('[aria-label="文档编写要求"]')!.value).toBe('');expect(host.textContent).toContain('新一版，准备开始')
 await click('我的文档');const archived=Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find(b=>b.textContent?.includes('访客系统 · 已结束'))!;await act(async()=>archived.click())
 expect(host.querySelector('[data-block-id=p1] p')?.textContent).toContain('待补全');expect(button('打开 Word').disabled).toBe(true);expect(host.querySelector('[aria-label^="编辑："]')).toBeNull();expect(button('继续补全')).toBeUndefined()
 await act(async()=>{root.unmount();root=createRoot(host)});await render();expect(button('继续补全')).toBeUndefined();expect(button('开始生成').disabled).toBe(true)
 const field=host.querySelector<HTMLTextAreaElement>('[aria-label="文档编写要求"]')!
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(field,'普通访客自动审批');field.dispatchEvent(new Event('input',{bubbles:true}));await flush()})
 // Reopening keeps the new text, but never restores the old task's text.
 await act(async()=>{root.unmount();root=createRoot(host)});await render();expect(host.querySelector<HTMLTextAreaElement>('[aria-label="文档编写要求"]')!.value).toBe('普通访客自动审批')
 await click('开始生成');expect(writes.at(-1).body.command).toMatchObject({type:'template.run',action:'generate',instruction:'普通访客自动审批'});expect(task.run!.templateProgress).toBeUndefined();expect(task.run!.id).not.toBe('old-draft')
 expect(task.template!.endedDrafts).toHaveLength(1);expect(button('继续补全')).toBeUndefined();expect(button('暂停生成')).toBeTruthy()
})
it('offers a fresh edition when changed data makes the previous checkpoint stale',async()=>{
 task.run={id:'stale',templateAction:'generate',operation:'document',status:'stopped',instruction:'原要求',model:'test/chat',startedAt:at,baseRevision:0,templateProgress:{plan:[['p1']],batches:{},retrieval:{},newProduct:true}}
 await render();await click('编写');expect(button('继续补全').disabled).toBe(true);expect(button('新开一版').disabled).toBe(false);await click('新开一版');expect(button('继续补全')).toBeUndefined()
})
