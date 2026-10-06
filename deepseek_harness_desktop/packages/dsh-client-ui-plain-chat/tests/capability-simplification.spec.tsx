// @vitest-environment jsdom
import React, {act} from 'react'
import {createRoot,type Root} from 'react-dom/client'
import {beforeEach,afterEach,it,expect,vi} from 'vitest'
import {initialState,components,latest,type Snapshot} from '../../dsh-capabilities/src/core/model.ts'
import {ManagedCenter} from '../src/client/ManagedCenter.tsx'
import {capabilityClient,editorDrafts,openCapabilityLink} from '../src/client/capability-client.ts'
import {capabilityPresentation} from '../src/client/capability-presentation.ts'
let host:HTMLDivElement,root:Root,data:Snapshot,commands:any[],failRequirements:boolean
const button=(name:string)=>Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(b=>b.textContent?.trim()===name||b.getAttribute('aria-label')===name)!
const click=async(name:string)=>{expect(button(name),name).toBeTruthy();await act(async()=>{button(name).click()})}
const rows=()=>Array.from(host.querySelectorAll('[data-managed-capability]')).map(n=>n.getAttribute('data-managed-capability'))
const render=async(id?:string)=>act(async()=>root.render(<ManagedCenter initialId={id}/>))
async function input(value:string){await act(async()=>{const node=host.querySelector<HTMLInputElement>('[aria-label="搜索能力"]')!;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(node,value);node.dispatchEvent(new Event('input',{bubbles:true}))})}
async function check(label:string){await act(async()=>{const node=Array.from(host.querySelectorAll('label')).find(n=>n.textContent===label);expect(node,label).toBeTruthy();node!.querySelector('input')!.click()})}
beforeEach(async()=>{
 (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;sessionStorage.clear();editorDrafts.clear();commands=[];failRequirements=false
 data={compositionVersion:2,state:initialState(),components,tasks:[],health:{state:'disconnected',checkedAt:null,installed:true,loaded:true,message:'需要连接浏览器',browsers:[]}}
 HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','')};HTMLDialogElement.prototype.close=function(){this.removeAttribute('open')}
 vi.stubGlobal('fetch',vi.fn(async(url:string,options?:RequestInit)=>{
  let value:any={};if(url.endsWith('/state'))value=data
  else if(url.endsWith('/meeting/config'))value={ready:false,state:'unconfigured',message:'识别接口待配置',editable:false}
  else if(url.endsWith('/requirements/config')){if(failRequirements)return new Response(JSON.stringify({error:'读取失败'}),{status:500});value={ready:true,message:'默认模型已配置',modelConfigured:true,revision:1,maxTextChars:160000,defaults:{depth:'standard',questionStyle:'short',model:''}}}
  else if(url.includes('/developer/projects'))value=[]
  else if(url.endsWith('/command')){const command=JSON.parse(String(options?.body)).command;commands.push(command);if(command.type==='capability.pin'){data.state.capabilities.find(c=>c.id===command.id)!.pinned=command.pinned;data.state.revision++}value={id:command.id}}
  return new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}})
 }))
 await capabilityClient.refresh();host=document.createElement('div');document.body.append(host);root=createRoot(host)
})
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();vi.unstubAllGlobals();editorDrafts.clear()})

it('offers only two persistent list tabs and moves removal and recycle operations out of the list',async()=>{
 await render();expect(rows()).toHaveLength(4)
 expect(Array.from(host.querySelectorAll('[aria-label="能力列表"] button')).map(n=>n.textContent)).toEqual(['全部','收藏'])
 expect(button('组件中心 ↗')).toBeUndefined();expect(button('回收站')).toBeTruthy();expect(button('导入能力')).toBeTruthy();expect(button('导出能力')).toBeTruthy();expect(button('＋ 创建能力')).toBeUndefined();expect(button('移除能力：浏览器操作')).toBeUndefined()
 expect(host.textContent).not.toContain('内置能力');expect(host.textContent).not.toContain('已收藏');expect(host.textContent).not.toContain('录音会发送')
 await click('管理能力：浏览器操作');expect(button('移除能力：浏览器操作')).toBeTruthy()
 expect(Array.from(host.querySelectorAll('[aria-label="能力详情"] button')).map(n=>n.textContent)).toEqual(['设置','组件','使用情况'])
})
it('pins without opening details and combines search, favourites and independent filters',async()=>{
 await render();await click('收藏能力：会议录音转写');expect(button('编辑能力')).toBeUndefined();expect(commands).toEqual([{type:'capability.pin',id:'meeting-transcription',pinned:true}])
 await click('收藏');await input('录音');await click('筛选');await check('需要配置或连接');expect(rows()).toEqual(['meeting-transcription'])
 await check('项目内检测');expect(rows()).toEqual(['meeting-transcription'])
 await input('不存在');expect(rows()).toEqual([]);await click('清空搜索和筛选');expect(rows()).toEqual(['browser','meeting-transcription'])
})
it('keeps unknown states separate from missing configuration and retains project-specific detection',async()=>{
 data.health.state='unknown';failRequirements=true;await capabilityClient.refresh();await render()
 expect(host.querySelector('[data-managed-capability="requirements-analysis"]')?.textContent).toContain('状态未知')
 await click('筛选');await check('需要配置或连接');expect(rows()).toEqual(['meeting-transcription'])
 await check('需要配置或连接');await check('检测中或状态未知');expect(rows()).toEqual(['browser','requirements-analysis'])
 await check('检测中或状态未知');await check('项目内检测');expect(rows()).toEqual(['developer-workspace'])
})
it('shows the published name and status separately from a missing-component draft',async()=>{
 const cap=data.state.capabilities[0]!;cap.draft={...cap.draft,name:'尚未发布的名称',components:[]};data.health.state='ready'
 await capabilityClient.refresh();await render();const row=host.querySelector('[data-managed-capability="browser"]')!
 expect(row.textContent).toContain('浏览器操作');expect(row.textContent).toContain('有未发布修改');expect(row.textContent).toContain('可使用');expect(row.textContent).not.toContain('尚未发布的名称')
 await input('尚未发布的名称');expect(rows()).toEqual(['browser']);await click('管理能力：浏览器操作');expect(host.textContent).toContain('当前展示已发布版本')
 expect(data.state.capabilities[0]!.draft.components).toEqual([])
})
it('maps old defaults links using service descriptors and opens old instructions links',async()=>{
 await render()
 await act(async()=>{openCapabilityLink({section:'capability-center',capabilityId:'browser',tab:'defaults'})})
 expect(button('组件').getAttribute('aria-pressed')).toBe('true')
 await act(async()=>{openCapabilityLink({section:'capability-center',capabilityId:'requirements-analysis',tab:'defaults'})})
 expect(button('设置').getAttribute('aria-pressed')).toBe('true');expect(host.querySelector('[aria-label="需求分析默认配置"]')).toBeTruthy()
 await act(async()=>{openCapabilityLink({section:'capability-center',capabilityId:'browser',tab:'instructions'})})
 expect(host.querySelector<HTMLDetailsElement>('[data-capability-instructions]')!.open).toBe(true)
 expect(commands).toEqual([])
})
it('restores list search and filters after a separate recycle search and detail visit',async()=>{
 const removed=structuredClone(data.state.capabilities[0]!);removed.id='removed-browser';removed.removedAt=new Date().toISOString();data.state.capabilities.push(removed)
 await capabilityClient.refresh();await render();await input('浏览器');await click('筛选');await check('需要配置或连接');await click('收起筛选');await click('回收站 1')
 expect((host.querySelector('[aria-label="搜索能力"]') as HTMLInputElement).value).toBe('');await input('移除搜索');await click('← 返回能力列表')
 expect((host.querySelector('[aria-label="搜索能力"]') as HTMLInputElement).value).toBe('浏览器');expect(rows()).toEqual(['browser'])
 await click('管理能力：浏览器操作');await click('← 全部能力');expect(rows()).toEqual(['browser']);expect(button('清除筛选')).toBeTruthy()
})
it('labels draft-only role references without inventing a published role version',async()=>{
 const role=data.state.roles[0]!;role.versions=[];role.draft.capabilities=[{capabilityId:'browser',version:1,enabled:true}]
 await capabilityClient.refresh();await render('browser');await click('使用情况');expect(host.textContent).toContain('仅草稿关联');expect(host.textContent).not.toContain('已发布岗位 v1')
})
it('applies lifecycle and component precedence before service health',()=>{
 const cap=structuredClone(data.state.capabilities[0]!);data.health.state='ready';cap.versions=[]
 expect(capabilityPresentation(data,cap).group).toBe('draft');cap.enabled=false;expect(capabilityPresentation(data,cap).label).toBe('已停用')
 cap.enabled=true;cap.versions=structuredClone(data.state.capabilities[0]!.versions);data.state.componentRestrictions={browserskill:{enabled:false} as any}
 expect(capabilityPresentation(data,cap).label).toBe('组件已停用')
 const meeting=data.state.capabilities.find(c=>c.id==='meeting-transcription')!
 expect(capabilityPresentation(data,meeting,latest(meeting.versions),{ready:true,message:'接口已配置'}).label).toBe('已配置')
 expect(capabilityPresentation(data,meeting,latest(meeting.versions),{ready:false,error:'网络读取失败'}).group).toBe('unknown')
})
