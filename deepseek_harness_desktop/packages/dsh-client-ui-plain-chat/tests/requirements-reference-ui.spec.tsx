// @vitest-environment jsdom
import React,{act,useState} from 'react'
import {createRoot,type Root} from 'react-dom/client'
import {beforeEach,afterEach,it,expect,vi} from 'vitest'
import {KnowledgeSources} from '../src/client/KnowledgeSources.tsx'
import {RequirementsWorkspace} from '../src/client/RequirementsWorkspace.tsx'
import {noKnowledge,type KnowledgeScope} from '../../dsh-capabilities/src/core/knowledge.ts'
import {emptyTemplateWorkspace} from '../../dsh-capabilities/src/core/requirement-template.ts'
import {defaultRequirementSettings,emptyRequirementOverview,type RequirementTask} from '../../dsh-capabilities/src/core/requirements-model.ts'

let host:HTMLDivElement,root:Root,writes:any[],config:any,task:RequirementTask,failCommand:boolean
const scope:KnowledgeScope={providerId:'workbench-knowledge',collectionIds:['lib-a','lib-b']}
const libraries={...noKnowledge,available:true,configured:true,providerId:'workbench-knowledge',collections:[{id:'lib-a',name:'蟹黄堡向量资料包'},{id:'lib-b',name:'Word报告测试'},{id:'lib-c',name:'第三个知识库'}]}
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status})
beforeEach(()=>{
 (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;sessionStorage.clear();writes=[];failCommand=false
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
   if(body.command.type==='template.run')task.template!.answers.push({id:'answer',question:body.command.instruction,answer:'当前v2共26克，分两次，每次13克。',sources:[],at:new Date().toISOString()})
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
function Controlled({onChange=async()=>{}}:{onChange?:(value?:KnowledgeScope)=>Promise<void>}){const [value,setValue]=useState<KnowledgeScope|undefined>(scope);return <KnowledgeSources scope={value} product="" disabled={false} allowed onChange={async next=>{await onChange(next);setValue(next)}}/>}
it('shows reference rows, removes only one reference and can undo or clear the last one',async()=>{
 const changed=vi.fn(async()=>{});await render(<Controlled onChange={changed}/>);expect(host.querySelectorAll('li')).toHaveLength(2);expect(button('仅用本次文件')).toBeUndefined()
 await click('移除引用：蟹黄堡向量资料包');expect(changed).toHaveBeenLastCalledWith({...scope,collectionIds:['lib-b']});expect(host.querySelectorAll('li')).toHaveLength(1)
 await click('撤销');expect(changed).toHaveBeenLastCalledWith(scope);expect(host.querySelectorAll('li')).toHaveLength(2)
 await click('移除引用：蟹黄堡向量资料包');await click('移除引用：Word报告测试');expect(changed).toHaveBeenLastCalledWith(undefined);expect(host.textContent).toContain('暂未引用知识库');expect(button('查看知识库设置')).toBeTruthy();expect(writes).toEqual([])
})
it('adds without replacing existing references; cancel, X and Escape do not change scope',async()=>{
 const changed=vi.fn(async()=>{});await render(<Controlled onChange={changed}/>);await click('添加知识库')
 const boxes=()=>Array.from(document.querySelectorAll<HTMLInputElement>('dialog input[type=checkbox]'))
 expect(boxes().slice(0,2).every(b=>b.checked&&b.disabled)).toBe(true);expect(button('确认加入').disabled).toBe(true)
 await act(async()=>boxes()[2].click());await click('取消');expect(changed).not.toHaveBeenCalled()
 await click('添加知识库');await act(async()=>boxes()[2].click());await click('取消知识库选择');expect(changed).not.toHaveBeenCalled()
 await click('添加知识库');await act(async()=>document.querySelector('dialog')!.dispatchEvent(new Event('cancel',{cancelable:true})));expect(document.querySelector('dialog')).toBeNull();expect(changed).not.toHaveBeenCalled()
 await click('添加知识库');await act(async()=>boxes()[2].click());await click('确认加入');expect(changed).toHaveBeenCalledExactlyOnceWith({...scope,collectionIds:['lib-a','lib-b','lib-c']});expect(writes).toEqual([])
})
it('keeps references on a failed save and blocks duplicate removal while saving',async()=>{
 let reject!:(e:Error)=>void;const changed=vi.fn(()=>new Promise<void>((_,r)=>reject=r));await render(<Controlled onChange={changed}/>);await click('移除引用：蟹黄堡向量资料包');expect(button('移除引用：Word报告测试').disabled).toBe(true);await click('移除引用：Word报告测试');expect(changed).toHaveBeenCalledTimes(1)
 await act(async()=>{reject(Error('保存失败'));await flush()});expect(host.querySelectorAll('li')).toHaveLength(2);expect(host.textContent).toContain('保存失败');expect(button('撤销')).toBeUndefined()
})
it('preserves remote scope filters on removal and additive selection',async()=>{
 const changed=vi.fn(async()=>{}),remote={...scope,product:'产品甲',project:'项目甲'};await render(<KnowledgeSources scope={remote} product="产品乙" disabled={false} allowed onChange={changed}/>);await click('移除引用：Word报告测试');expect(changed).toHaveBeenLastCalledWith({...remote,collectionIds:['lib-a']})
 await click('添加知识库');await act(async()=>Array.from(document.querySelectorAll<HTMLInputElement>('dialog input[type=checkbox]'))[2].click());await click('确认加入');expect(changed).toHaveBeenLastCalledWith({...remote,collectionIds:['lib-a','lib-b','lib-c']})
})
it('lets a fresh temporary workspace send a knowledge-only question without creating on mount',async()=>{
 await render(<RequirementsWorkspace roleId="builtin-analyst" draftKey="fresh" onLegacy={()=>{}}/>);expect(host.textContent).toContain('蟹黄堡向量资料包');expect(writes).toEqual([])
 await click('资料问答');await question();expect(button('发送问题').disabled).toBe(false);await click('发送问题')
 expect(writes).toHaveLength(2);expect(writes[0].body).toMatchObject({roleVersion:6,workflow:'template'});expect(writes[1].body.command).toMatchObject({type:'template.run',action:'ask',instruction:'当前v2多少克？'});expect(host.textContent).toContain('当前v2共26克');expect(task.template?.knowledge).toEqual(scope)
})
it('does not reapply role defaults to an existing task or after removing the last reference',async()=>{
 await render(<RequirementsWorkspace roleId="builtin-analyst" taskId={task.id} onLegacy={()=>{}}/>);await click('资料问答');await question();expect(host.querySelector('[aria-label="本次外部知识库"]')?.textContent).toContain('0 个知识库');expect(button('发送问题').disabled).toBe(true)
 await act(async()=>{window.dispatchEvent(new Event('focus'));await flush()});expect(button('发送问题').disabled).toBe(true);expect(host.textContent).toContain('请先添加参考资料或知识库')
 await click('添加知识库');await act(async()=>document.querySelector<HTMLInputElement>('dialog input[type=checkbox]')!.click());await click('确认加入');expect(button('发送问题').disabled).toBe(false)
 await click('移除引用：蟹黄堡向量资料包');await act(async()=>{window.dispatchEvent(new Event('focus'));await flush()});expect(button('发送问题').disabled).toBe(true);expect(task.template?.knowledge).toBeUndefined();expect(writes.some(w=>w.url.endsWith('/create'))).toBe(false)
})
it('retains question and scope after send fails and queries the explicitly selected role version',async()=>{
 failCommand=true;await render(<RequirementsWorkspace roleId="builtin-analyst" roleVersion={6} onLegacy={()=>{}}/>);expect(vi.mocked(fetch).mock.calls.some(([url])=>String(url).includes('roleVersion=6'))).toBe(true)
 await click('资料问答');await question();await click('发送问题');expect(host.querySelector<HTMLTextAreaElement>('[aria-label="资料问题"]')?.value).toBe('当前v2多少克？');expect(host.textContent).toContain('保存失败，请重试');expect(button('发送问题').disabled).toBe(false)
})
