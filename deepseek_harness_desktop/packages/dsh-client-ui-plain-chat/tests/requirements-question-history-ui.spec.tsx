// @vitest-environment jsdom
import React,{act,useState} from 'react'
import {createRoot,type Root} from 'react-dom/client'
import {beforeEach,afterEach,it,expect,vi} from 'vitest'
import {RequirementQuestionHistory} from '../src/client/RequirementQuestionHistory.tsx'
import {RequirementsWorkspace} from '../src/client/RequirementsWorkspace.tsx'
import {noKnowledge,type KnowledgeScope} from '../../dsh-capabilities/src/core/knowledge.ts'
import {emptyTemplateWorkspace} from '../../dsh-capabilities/src/core/requirement-template.ts'
import {defaultRequirementSettings,emptyRequirementOverview,type RequirementTask} from '../../dsh-capabilities/src/core/requirements-model.ts'

let host:HTMLDivElement,root:Root,writes:any[],config:any,task:RequirementTask,failCommand:boolean, outcome:'ready'|'error',pendingResponse:undefined|((value:Response)=>void),delayResponse:boolean
const scope:KnowledgeScope={providerId:'workbench-knowledge',collectionIds:['lib-a','lib-b']}
const libraries={...noKnowledge,available:true,configured:true,providerId:'workbench-knowledge',collections:[{id:'lib-a',name:'蟹黄堡向量资料包'},{id:'lib-b',name:'Word报告测试'},{id:'lib-c',name:'第三个知识库'}]}
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status})
beforeEach(()=>{
 (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;sessionStorage.clear();writes=[];failCommand=false;outcome='ready';pendingResponse=undefined;delayResponse=false
 config={ready:true,message:'就绪',modelConfigured:true,roleVersion:6,knowledgeScope:scope,defaults:{depth:'standard',questionStyle:'short',model:''},revision:0,maxTextChars:60000}
 task={schema:1,id:'10000000-0000-4000-8000-000000000001',revision:0,dataRevision:0,title:'测试',mode:'quick',roleId:'builtin-analyst',roleVersion:6,capabilityId:'requirements-analysis',capabilityVersion:1,authorityAt:1,roleGuidance:{name:'需求分析助手',duties:'',requirements:'',format:''},createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),settings:defaultRequirementSettings(),draft:'',overview:emptyRequirementOverview(),requirements:[],flows:[],rules:[],questions:[],materials:[],messages:[],events:[],versions:[],template:emptyTemplateWorkspace()}
 host=document.createElement('div');document.body.append(host);root=createRoot(host)
 HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','')};HTMLDialogElement.prototype.close=function(){this.removeAttribute('open')}
 vi.stubGlobal('fetch',vi.fn(async(input:string,init?:RequestInit)=>{
  const url=String(input)
  if(url.endsWith('/knowledge/status'))return json(libraries)
  if(url.includes('/config?'))return json(config)
  if(url.includes('/executions?'))return json({items:[],total:0})
  if(url.includes('/task/'))return json(task)
  if(init?.method==='POST'){
   const body=JSON.parse(String(init.body));writes.push({url,body})
   if(url.endsWith('/create')){task.template!.knowledge=structuredClone(config.knowledgeScope);return json(task)}
   if(failCommand)return json({error:'保存失败，请重试'},503)
   if(body.command.type==='template.knowledge')task.template!.knowledge=body.command.scope
   if(body.command.type==='template.run'){
    task.run={id:body.command.requestId,templateAction:'ask',status:outcome,instruction:body.command.instruction,startedAt:new Date().toISOString(),error:outcome==='error'?'模型暂未响应':undefined} as never
    task.messages.push({id:'question',runId:body.command.requestId,role:'user',text:body.command.instruction,createdAt:new Date().toISOString(),questionRun:{status:outcome,error:task.run?.error,sources:{libraries:[{id:'lib-a',name:'蟹黄堡向量资料包'},{id:'lib-b',name:'Word报告测试'}],files:[]}}})
    if(outcome==='ready')task.template!.answers.push({id:body.command.requestId,runId:body.command.requestId,question:body.command.instruction,answer:'当前v2共26克，分两次，每次13克。',sources:[],at:new Date().toISOString()})
    if(delayResponse)return new Promise<Response>(resolve=>pendingResponse=resolve)
   }
   task.revision++;return json(task)
  }
  throw Error('Unexpected '+url)
 }))
})
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();vi.unstubAllGlobals()})
const flush=()=>new Promise(r=>setTimeout(r,5))
const render=async(node:React.ReactNode)=>act(async()=>{root.render(node);await flush()})
const button=(label:string)=>Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(b=>b.textContent?.trim()===label||b.getAttribute('aria-label')===label)!
const click=async(label:string)=>act(async()=>{expect(button(label),label).toBeTruthy();button(label).click();await flush()})
async function question(text='当前v2多少克？'){await act(async()=>{const input=host.querySelector<HTMLTextAreaElement>('[aria-label="资料问题"]')!;Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(input,text);input.dispatchEvent(new Event('input',{bubbles:true}));await flush()})}

function seedHistory(){
 task.template!.knowledge={...scope,collectionIds:['lib-b']}
 task.messages=[{id:'one',runId:'run-one',role:'user',text:'当前v2多少克？',createdAt:'2026-10-26T01:00:00Z',questionRun:{status:'ready',sources:{libraries:[{id:'lib-a',name:'蟹黄堡向量资料包'}],files:['补充.md']}}},{id:'two',runId:'run-two',role:'user',text:'失败的问题',createdAt:'2026-10-26T02:00:00Z',questionRun:{status:'error',error:'模型暂未响应'}}]
 task.template!.answers=[{id:'answer',runId:'run-one',question:'当前v2多少克？',answer:'26克，分两次每次13克。',sources:[{sourceId:'source',blockId:'block',name:'01-当前配方.md',quote:'海浪酱26克'}],at:'2026-10-26T01:00:02Z'}]
}
it('shows original question, references and citations; retry only fills the question and closes history',async()=>{
 seedHistory();const retry=vi.fn();await render(<RequirementQuestionHistory task={task} disabled={false} onRetry={retry}/>);await click('历史记录')
 const items=()=>Array.from(document.querySelectorAll<HTMLButtonElement>('dialog li button'))
 expect(items()).toHaveLength(2);expect(items()[0].textContent).toContain('失败的问题');expect(items()[1].textContent).toContain('已回答')
 await act(async()=>items()[1].click());expect(document.querySelector('dialog')!.textContent).toContain('当时引用：蟹黄堡向量资料包、补充.md');expect(document.querySelector('dialog')!.textContent).toContain('海浪酱26克');expect(document.querySelector('dialog details')!.hasAttribute('open')).toBe(false)
 await click('再次提问');expect(retry).toHaveBeenCalledExactlyOnceWith('当前v2多少克？');expect(document.querySelector('dialog')).toBeNull();expect(task.template!.knowledge!.collectionIds).toEqual(['lib-b']);expect(writes).toEqual([])
})
it('retains failed history, allows reading during a run, and handles empty history, X and Escape',async()=>{
 const retry=vi.fn();await render(<RequirementQuestionHistory disabled={false} onRetry={retry}/>);await click('历史记录');expect(document.querySelector('dialog')!.textContent).toContain('暂无问答记录');await click('关闭历史记录')
 seedHistory();await render(<RequirementQuestionHistory task={task} disabled onRetry={retry}/>);await click('历史记录');await act(async()=>document.querySelector<HTMLButtonElement>('dialog li button')!.click());expect(document.querySelector('dialog')!.textContent).toContain('模型暂未响应');expect(button('再次提问').disabled).toBe(true)
 await click('← 返回列表');await act(async()=>document.querySelector('dialog')!.dispatchEvent(new Event('cancel',{cancelable:true})));expect(document.querySelector('dialog')).toBeNull();expect(retry).not.toHaveBeenCalled();expect(writes).toEqual([])
})
it('retains the question after the server accepts a run which then fails',async()=>{
 outcome='error';await render(<RequirementsWorkspace roleId="builtin-analyst" draftKey="failure-history" onLegacy={()=>{}}/>);await click('资料问答');await question();await click('发送问题')
 expect(host.querySelector<HTMLTextAreaElement>('[aria-label="资料问题"]')?.value).toBe('当前v2多少克？');expect(host.textContent).toContain('上次问答未完成');expect(button('发送问题').disabled).toBe(false)
 await click('历史记录');await act(async()=>document.querySelector<HTMLButtonElement>('dialog li button')!.click());expect(document.querySelector('dialog')!.textContent).toContain('模型暂未响应');await click('再次提问');expect(writes.filter(w=>w.body.command?.type==='template.run')).toHaveLength(1)
})
it('clears a successfully answered question but preserves a new draft typed while awaiting the response',async()=>{
 await render(<RequirementsWorkspace roleId="builtin-analyst" draftKey="success-history" onLegacy={()=>{}}/>);await click('资料问答');await question();await click('发送问题');expect(host.querySelector<HTMLTextAreaElement>('[aria-label="资料问题"]')?.value).toBe('')
 delayResponse=true;await question('第二个问题');await click('发送问题');expect(pendingResponse).toBeTypeOf('function');await question('提前输入的第三个问题');await act(async()=>{pendingResponse!(json(task));await flush()});expect(host.querySelector<HTMLTextAreaElement>('[aria-label="资料问题"]')?.value).toBe('提前输入的第三个问题')
})
