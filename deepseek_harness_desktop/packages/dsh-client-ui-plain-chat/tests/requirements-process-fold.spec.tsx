// @vitest-environment jsdom
import React,{act} from 'react'
import {createRoot,type Root} from 'react-dom/client'
import {beforeEach,afterEach,it,expect,vi} from 'vitest'
import {RequirementsWorkspace} from '../src/client/RequirementsWorkspace.tsx'
import {emptyTemplateWorkspace} from '../../dsh-capabilities/src/core/requirement-template.ts'
import {defaultRequirementSettings,emptyRequirementOverview,type RequirementTask} from '../../dsh-capabilities/src/core/requirements-model.ts'
let host:HTMLDivElement,root:Root,task:RequirementTask
const now='2026-10-26T13:38:49Z'
const json=(x:unknown)=>new Response(JSON.stringify(x))
const previous={schema:1,id:'old',taskId:'task',operation:'资料问答',input:'旧问题',inputKind:'user',startedAt:now,finishedAt:now,status:'failed',summary:'上一次模型选择错误',seq:1,events:[]}
function current(){return {...previous,id:task.run!.id,status:task.run!.status==='running'?'running':task.run!.status==='ready'?'done':task.run!.status==='error'?'failed':'stopped',finishedAt:task.run!.status==='running'?undefined:now,summary:'本轮回答已保存',seq:task.revision+1,events:[{id:'lookup',seq:task.revision+1,key:'knowledge',title:'检索外部知识库',status:'done',detail:'6 个证据片段',startedAt:now,updatedAt:now}]}}
beforeEach(()=>{
 (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;vi.useFakeTimers();sessionStorage.clear()
 task={schema:1,id:'task',revision:0,dataRevision:0,title:'测试',mode:'quick',roleId:'builtin-analyst',roleVersion:6,capabilityId:'requirements-analysis',capabilityVersion:1,authorityAt:1,roleGuidance:{name:'需求分析助手',duties:'',requirements:'',format:''},createdAt:now,updatedAt:now,settings:defaultRequirementSettings(),draft:'',overview:emptyRequirementOverview(),requirements:[],flows:[],rules:[],questions:[],materials:[],messages:[],events:[],versions:[],template:emptyTemplateWorkspace(),run:{id:'current',status:'running',templateAction:'ask',instruction:'访客怎么进园区？',model:'test/chat'} as any}
 task.template!.sources=[{id:'s',kind:'text',name:'资料.md',enabled:true,slots:[]}]
 host=document.createElement('div');document.body.append(host);root=createRoot(host)
 vi.stubGlobal('fetch',vi.fn(async(input:string,init?:RequestInit)=>{
  const url=String(input)
  if(url.includes('/config?'))return json({ready:true,message:'就绪',defaults:{model:'test/chat'}})
  if(url.endsWith('/knowledge/status'))return json({available:false,collections:[]})
  if(url.includes('/task/'))return json(task)
  if(url.includes('/executions?')){const q=new URL(url,'http://test').searchParams;return json(q.get('runId')?(q.get('runId')==='old'?previous:current()):{items:[current(),previous].map(({events,...r})=>r),total:2})}
  if(url.endsWith('/command')){const body=JSON.parse(String(init?.body));if(body.command.type==='template.run'){task.run={...task.run!,id:body.command.requestId,status:'running'};task.revision++}return json(task)}
  throw Error(url)
 }))
})
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();vi.useRealTimers()})
const outer=()=>host.querySelector<HTMLDetailsElement>('details[aria-label="本轮执行过程"]')!
async function toggle(value:boolean){await act(async()=>{outer().open=value;outer().dispatchEvent(new Event('toggle'))})}
async function advance(){await act(async()=>{await vi.advanceTimersByTimeAsync(2400)})}
async function start(){await act(async()=>root.render(<RequirementsWorkspace taskId="task" roleId="builtin-analyst" onLegacy={()=>{}}/>));await act(async()=>Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find(b=>b.textContent==='资料问答')!.click())}
it('folds the whole question process on completion, separates older errors and allows manual toggles',async()=>{
 await start();expect(outer().open).toBe(true);expect(outer().querySelector<HTMLDetailsElement>('[data-execution-run=current] details')?.open).toBe(true)
 expect(outer().querySelector('[data-execution-run=old]')?.closest('details')?.open).toBe(false)
 await toggle(false);task.revision++;await advance();expect(outer().open).toBe(false)
 await toggle(true);task.run!.status='ready';task.revision++;task.template!.answers.push({id:'a',question:'访客怎么进园区？',answer:'先预约，再审批和核验。',at:now,sources:[]});await advance()
 expect(outer().open).toBe(false);expect(outer().querySelector('[data-execution-run=current] details')?.hasAttribute('open')).toBe(false);expect(host.textContent).toContain('先预约，再审批和核验。')
 await toggle(true);await advance();expect(outer().open).toBe(true);await toggle(false)
})
it('starts a new question expanded after the previous completed process was collapsed',async()=>{
 task.run!.status='ready';await start();expect(outer().open).toBe(false)
 await act(async()=>{const input=host.querySelector<HTMLTextAreaElement>('[aria-label="资料问题"]')!;Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(input,'再问一次');input.dispatchEvent(new Event('input',{bubbles:true}))})
 await act(async()=>Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find(b=>b.textContent==='发送问题')!.click());expect(outer().open).toBe(true)
 await advance();expect(outer().querySelector<HTMLDetailsElement>('[data-execution-run="'+task.run!.id+'"] details')?.open).toBe(true)
})
