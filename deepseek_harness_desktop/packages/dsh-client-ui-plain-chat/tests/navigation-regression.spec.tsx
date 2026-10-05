import { withAppearanceNavigation } from '../src/client/AppearanceNavigation.tsx'
import { ManagedRolesSection } from '../src/client/ManagedRoles.tsx'
// @vitest-environment jsdom
// Regression scenarios from the navigation review. Services use synthetic data and forbid writes.
import React, {act,useState} from 'react'
import {createRoot, type Root} from 'react-dom/client'
import {beforeEach,afterEach,it,expect,vi} from 'vitest'
import {ManagedCenter} from '../src/client/ManagedCenter.tsx'
import {ManagedRoleEditor} from '../src/client/ManagedRoles.tsx'
import {ComponentCenter} from '../src/client/ComponentCenter.tsx'
import {DeveloperProjectSettings} from '../src/client/DeveloperProjectSettings.tsx'
import {DeveloperAssistant} from '../src/client/DeveloperAssistant.tsx'
import {RequirementsAssistant} from '../src/client/RequirementsAssistant.tsx'
import {MeetingDemo} from '../src/client/MeetingDemo.tsx'
import {capabilityClient,editorDrafts,openCapabilityLink,lastCapabilityLink} from '../src/client/capability-client.ts'
import {CapabilityReferences, capabilityLink} from '../../dsh-plugin-manager/src/client/CapabilityReferences.tsx'
import {InventoryTree} from '../../dsh-plugin-manager/src/client/InventoryTree.tsx'
import {initialState,components,type Snapshot} from '../../dsh-capabilities/src/core/model.ts'
import {emptyRegistry} from '../../dsh-capabilities/src/core/component-registry.ts'
import {initialClassification} from '../../dsh-plugin-manager/src/core/classification.ts'
import {defaultRequirementSettings,emptyRequirementOverview} from '../../dsh-capabilities/src/core/requirements-model.ts'
let host:HTMLDivElement,root:Root,data:Snapshot,writes:string[]
const taskId='10000000-0000-4000-8000-000000000001'
const requirementsTask=()=>({schema:1,id:taskId,revision:1,dataRevision:1,title:'隔离导航检查',mode:'guided',roleId:'builtin-analyst',roleVersion:1,capabilityId:'requirements-analysis',capabilityVersion:1,authorityAt:1,roleGuidance:{name:'需求分析助手',duties:'',requirements:'',format:''},createdAt:'2026-10-04T00:00:00Z',updatedAt:'2026-10-04T00:00:00Z',settings:defaultRequirementSettings(),draft:'',overview:emptyRequirementOverview(),requirements:[],flows:[],rules:[],questions:[],materials:[],messages:[],events:[],versions:[]})
const buttons=(scope:ParentNode=document)=>Array.from(scope.querySelectorAll<HTMLButtonElement>('button'))
const button=(text:string,scope:ParentNode=document)=>buttons(scope).find(b=>b.textContent?.trim()===text||b.getAttribute('aria-label')===text)
const render=async(element:React.ReactNode)=>act(async()=>{root.render(element);await new Promise(r=>setTimeout(r,15))})
const remount=async(element:React.ReactNode)=>{await act(async()=>root.unmount());root=createRoot(host);await render(element)}
const click=async(text:string,scope:ParentNode=document)=>act(async()=>{expect(button(text,scope),text).toBeTruthy();button(text,scope)!.click();await new Promise(r=>setTimeout(r,15))})
async function fill(element:HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement,value:string){await act(async()=>{const proto=element.tagName==='SELECT'?HTMLSelectElement.prototype:element.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value')!.set!.call(element,value);element.dispatchEvent(new Event(element.tagName==='SELECT'?'change':'input',{bubbles:true}));await new Promise(r=>setTimeout(r,15))})}
const field=(label:string)=>Array.from(document.querySelectorAll('label')).find(e=>e.textContent?.startsWith(label))!.querySelector<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>('input,textarea,select')!
beforeEach(async()=>{
 (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;sessionStorage.clear();localStorage.clear();editorDrafts.clear();writes=[]
 data={compositionVersion:2,state:initialState(),components,registry:emptyRegistry(),tasks:[],componentActivities:[],health:{checkedAt:null,installed:true,loaded:true,state:'unknown',message:'未检测',browsers:[]}}
 HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','')};HTMLDialogElement.prototype.close=function(){this.removeAttribute('open')}
 vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(function(this:HTMLElement){return {width:this.hasAttribute('data-component-center')?700:0,height:600,top:100,bottom:700,left:0,right:700,x:0,y:100,toJSON(){}}})
 vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}})
 vi.stubGlobal('EventSource',class{addEventListener(){}close(){}})
 vi.stubGlobal('fetch',vi.fn(async(input:string,options?:RequestInit)=>{
  const url=new URL(String(input),'http://localhost'),route=url.pathname.split('/').at(-1)!
  if(options?.method==='POST'){writes.push(url.pathname);throw Error('Audit must not save or invoke business actions')}
  let result:any={}
  if(url.pathname.endsWith('/capabilities/state'))result=data
  else if(url.pathname.endsWith('/meeting/config'))result={ready:false,state:'unconfigured',message:'隔离配置',editable:true,endpoint:'http://qa/voice',asrModel:'qa',hasKey:false,configSource:'saved',revision:1}
  else if(url.pathname.endsWith('/requirements/config'))result={ready:true,message:'隔离配置',revision:4,maxTextChars:160000,defaults:{depth:'standard',questionStyle:'short',model:''}}
  else if(url.pathname.includes('/requirements/task/'))result=requirementsTask()
  else if(url.pathname.includes('/developer/')){
   const cwd=url.searchParams.get('cwd')??'C:/qa/one'
   result=({projects:[{path:'C:/qa/one',name:'第一项目'},{path:'C:/qa/two',name:'第二项目'}],project:{path:cwd,revision:0,commands:[{id:'check',name:cwd.endsWith('two')?'第二检查':'第一检查',command:'echo qa'}],editor:'none',candidates:[]},state:{root:cwd,git:true,branch:'main',head:'a'.repeat(40),index:'b'.repeat(64),fingerprint:'c'.repeat(64),files:[],operation:false},files:{files:[],excluded:[]},graph:{root:cwd,branch:'main',commits:[],hasMore:false},branches:{branches:[]},worktrees:{worktrees:[],tasks:[]}} as any)[route]??{}
  }
  else if(route==='inventory')result={entries:[],agentPresets:[]}
  else if(route==='pending')result={entries:[],origins:[]}
  else if(route==='classification')result={classification:initialClassification([])}
  return new Response(JSON.stringify(result),{headers:{'content-type':'application/json'}})
 }))
 await capabilityClient.refresh();host=document.createElement('div');document.body.append(host);root=createRoot(host)
})
afterEach(async()=>{await act(async()=>root.unmount());host.remove();expect(writes).toEqual([]);vi.restoreAllMocks();vi.unstubAllGlobals();editorDrafts.clear()})

it('NR01 offers component return consistently for browser and specialized capabilities',async()=>{
 for(const [capabilityId,componentId]of [['browser','browserskill'],['developer-workspace','developer-files']]){
  sessionStorage.setItem('workbench-capability-link',JSON.stringify({section:'capability-center',capabilityId,componentId,returnTo:'component-center'}));await remount(<ManagedCenter/>);expect(button('← 返回组件中心')).toBeTruthy()
 }
})

it('NR02 consumes the edit request so closing and reentering does not reopen the editor',async()=>{
 sessionStorage.setItem('workbench-capability-link',JSON.stringify({section:'capability-center',capabilityId:'developer-workspace',edit:true}));await render(<ManagedCenter/>);expect(document.querySelector('dialog')).toBeTruthy();await click('关闭编辑器');await remount(<ManagedCenter/>);expect(document.querySelector('dialog')).toBeNull()
})

it('NR03 preserves an unsaved requirement configuration on declined internal tab navigation',async()=>{
 await render(<ManagedCenter initialId="requirements-analysis"/>);await click('设置');await fill(field('默认整理深度'),'detailed')
 const confirm=vi.spyOn(window,'confirm').mockReturnValue(false);await click('组件')
 expect(confirm).toHaveBeenCalledOnce();expect(field('默认整理深度').value).toBe('detailed')
})
it('NR04 blocks global navigation while the user declines abandoning requirement configuration',async()=>{
 await render(<ManagedCenter initialId="requirements-analysis"/>);await click('设置');await fill(field('默认整理深度'),'detailed');const confirm=vi.spyOn(window,'confirm').mockReturnValue(false)
 await act(async()=>{openCapabilityLink({section:'capability-center',capabilityId:'developer-workspace',tab:'overview'});await new Promise(r=>setTimeout(r,15))});expect(confirm).toHaveBeenCalledOnce();expect(field('默认整理深度').value).toBe('detailed');expect(lastCapabilityLink()).toBeUndefined()
})

it('NR05 guards settings sidebar selection and close; confirmed departure discards only unsaved configuration',async()=>{
 function SettingsPanel({activeId,onSelect,onClose}:any){return <div role="dialog"><button onClick={()=>onSelect('other')}>Other section</button><button onClick={onClose}>Close settings</button>{activeId==='capability-center'?<ManagedCenter initialId="requirements-analysis"/>:<p>Other content</p>}</div>}
 function SettingsRoot(){const [activeId,setActive]=useState('capability-center'),[open,setOpen]=useState(true);return open?<SettingsPanel activeId={activeId} onSelect={setActive} onClose={()=>setOpen(false)}/>:<p>Closed</p>}
 const Guarded=withAppearanceNavigation(SettingsRoot,()=> '外观');await render(<Guarded/>);await click('设置');await fill(field('默认模型'),'qa-unsaved-model');const confirm=vi.spyOn(window,'confirm').mockReturnValue(false)
 await click('Other section');expect(field('默认模型').value).toBe('qa-unsaved-model');await click('Close settings');expect(field('默认模型').value).toBe('qa-unsaved-model');expect(confirm).toHaveBeenCalledTimes(2)
 confirm.mockReturnValue(true);await click('Other section');expect(host.textContent).toContain('Other content');await remount(<ManagedCenter initialId="requirements-analysis"/>);await click('设置');expect(field('默认模型').value).toBe('')
})

it('NR06 retains project A configuration when declining a switch to project B',async()=>{
 const editing=vi.fn();await render(<DeveloperProjectSettings onEditingChange={editing}/>);await fill(host.querySelector('[aria-label="配置的项目"]')!,'C:/qa/one');await fill(host.querySelector('[aria-label="检查名称 1"]')!,'未保存的检查名');const confirm=vi.spyOn(window,'confirm').mockReturnValue(false)
 await fill(host.querySelector('[aria-label="配置的项目"]')!,'C:/qa/two');expect(confirm).toHaveBeenCalledOnce();expect(host.querySelector<HTMLInputElement>('[aria-label="检查名称 1"]')!.value).toBe('未保存的检查名')
 confirm.mockReturnValue(true);await fill(host.querySelector('[aria-label="配置的项目"]')!,'C:/qa/two');expect(host.querySelector<HTMLInputElement>('[aria-label="检查名称 1"]')!.value).toBe('第二检查');expect(editing).toHaveBeenLastCalledWith(false)
})

it('NR07 returns from plugin management to the filled candidate registration form',async()=>{
 await render(<ComponentCenter/>);await click('＋ 添加组件');await fill(field('组件名称'),'待登记资料组件');await fill(field('提供插件完整包名'),'@qa/plugin');await click('前往插件管理 ↗');expect(lastCapabilityLink()?.origin?.section).toBe('component-center')
 await remount(<InventoryTree list={async()=>({entries:[]})}/>);await click('← 返回组件中心');await remount(<ComponentCenter/>);expect(field('组件名称').value).toBe('待登记资料组件');expect(field('提供插件完整包名').value).toBe('@qa/plugin')
})

it('NR08 preserves component context on plugin capability references',async()=>{
 await render(<CapabilityReferences moduleName="@linxin666/dsh-capabilities" componentId="developer-files" data={data}/>);await click('开发工作区 ↗');expect(lastCapabilityLink()).toMatchObject({section:'capability-center',capabilityId:'developer-workspace',componentId:'developer-files',returnTo:'component-center'})
})

it('NR09 preserves capability definition draft across an ordinary close and reopen',async()=>{
 await render(<ManagedCenter initialId="developer-workspace"/>);await click('编辑能力');await fill(field('能力名称'),'保留能力草稿');await click('关闭编辑器');await click('编辑能力');expect(field('能力名称').value).toBe('保留能力草稿')
})
it('NR10 preserves role draft across an embedded center and explicit return',async()=>{
 await render(<ManagedRoleEditor id="builtin-developer" onClose={()=>{}}/>);await fill(field('助手名称'),'保留岗位草稿');await click('查看能力及关联组件 ↗');await click('← 返回岗位，保留草稿');expect(field('助手名称').value).toBe('保留岗位草稿')
})
it('NR11 restores the requirement document workspace after remount',async()=>{
 const view=<RequirementsAssistant taskId={taskId} roleId="builtin-analyst" roleVersion={1} onCommit={()=>{}}/>;await render(view);await click('需求工作区');await click('需求文档');await remount(view)
 expect(host.querySelector('[aria-label="需求分析视图"] [aria-selected="true"]')?.textContent).toBe('需求工作区');expect(host.querySelector('[aria-label="需求工作区页面"] [aria-selected="true"]')?.textContent).toBe('需求文档')
})

it('NR12 restores meeting trace along with its existing snapshot',async()=>{
 let snapshot:any;const props={onSnapshot:(s:any)=>{snapshot=s}};await render(<MeetingDemo {...props}/>);await click('轨迹');await remount(<MeetingDemo initialState={snapshot} {...props}/>);expect(host.querySelector('[aria-selected="true"]')?.textContent).toBe('轨迹');expect(snapshot.trace).toContain('打开会议纪要助手')
})

it('NR13 restores developer main and version subtabs after remount',async()=>{
 const view=<DeveloperAssistant roleId="builtin-developer" draftKey="navigation-review" loadModels={async()=>[]} onCommit={()=>{}}/>;await render(view);await fill(host.querySelector('[aria-label="已有项目"]')!,'C:/qa/one');await click('版本');await click('分支与目录');await remount(view)
 expect(host.querySelector('[aria-label="开发助手主页签"] [aria-selected="true"]')?.textContent).toBe('版本');expect(host.querySelector('[aria-label="版本页面"] [aria-selected="true"]')?.textContent).toBe('分支与目录')
})

it('NR14 preserves component action tab across an ordinary local list return',async()=>{
 await render(<ComponentCenter/>);await click('Git 变更与版本');await click('动作');await click('← 返回组件列表');await click('Git 变更与版本');expect(button('动作')?.getAttribute('aria-pressed')).toBe('true')
})
it('NR15 hides plugin return when opened without a navigation origin',async()=>{
 await render(<InventoryTree list={async()=>({entries:[]})}/>);expect(lastCapabilityLink()).toBeUndefined();expect(button('← 返回能力中心')).toBeUndefined();expect(button('← 返回组件中心')).toBeUndefined()
})

it('NR16 consumes the old plugin locator and preserves the latest search on reentry',async()=>{
 sessionStorage.setItem('workbench-capability-link',JSON.stringify({section:'plugins',moduleName:'@qa/old-target'}));const view=<InventoryTree list={async()=>({entries:[]})}/>;await render(view);await fill(host.querySelector('input[type="search"]')!,'我的最新查找');await remount(view);expect(host.querySelector<HTMLInputElement>('input[type="search"]')!.value).toBe('我的最新查找')
})

it('NR17 restores usage and list origins instead of forcing component overview',async()=>{
 await render(<ComponentCenter/>);await click('项目文件与开发对话');await click('使用关系');await click('查看能力 ↗');await remount(<ManagedCenter/>);await click('← 返回组件中心');await remount(<ComponentCenter/>);expect(button('使用关系')?.getAttribute('aria-pressed')).toBe('true')
 await click('← 返回组件列表');await remount(<p>Other settings</p>);await remount(<ComponentCenter/>);expect(host.querySelector('[data-component-center]')?.getAttribute('data-pane')).toBe('list')
 const item=Array.from(host.querySelectorAll('article')).find(e=>e.textContent?.includes('项目文件与开发对话'))!;await click('开发工作区',item);await remount(<ManagedCenter/>);await click('← 返回组件中心');await remount(<ComponentCenter/>);expect(host.querySelector('[data-component-center]')?.getAttribute('data-pane')).toBe('list')
})

it('NR18 returns through plugin and capability pages one layer at a time',async()=>{
 await render(<ComponentCenter/>);await click('项目文件与开发对话');await click('使用关系');await click('查看能力 ↗');await remount(<ManagedCenter/>);await act(async()=>{openCapabilityLink({section:'plugins',moduleName:'@qa/plugin'});await new Promise(r=>setTimeout(r,15))});await remount(<InventoryTree list={async()=>({entries:[]})}/>);await click('← 返回能力中心');await remount(<ManagedCenter/>);expect(host.querySelector('[data-workflow-capability-detail]')?.getAttribute('data-workflow-capability-detail')).toBe('developer-workspace');await click('← 返回组件中心');await remount(<ComponentCenter/>);expect(button('使用关系')?.getAttribute('aria-pressed')).toBe('true')
})

it('NR19 restores the nested role, capability editor and component library after visiting plugins',async()=>{
 await render(<ManagedRoleEditor id="builtin-developer" onClose={()=>{}}/>);await fill(field('助手名称'),'岗位嵌套往返草稿');await click('查看能力及关联组件 ↗');await click('编辑能力');await click('管理组件库 ↗');await click('插件与依赖');await click('查看插件管理 ↗')
 await remount(<InventoryTree list={async()=>({entries:[]})}/>);await click('← 返回岗位编辑');await remount(<ManagedRolesSection selected="builtin-developer" onSelect={()=>{}}/>);expect(field('助手名称').value).toBe('岗位嵌套往返草稿');expect(button('插件与依赖')?.getAttribute('aria-pressed')).toBe('true');expect(document.querySelectorAll('dialog').length).toBe(4)
})

it('NR20 guards legacy direct navigation events before any mounted page changes',async()=>{
 await render(<ManagedCenter initialId="requirements-analysis"/>);await click('设置');await fill(field('默认模型'),'保留输入');const confirm=vi.spyOn(window,'confirm').mockReturnValue(false)
 await act(async()=>{window.dispatchEvent(new CustomEvent('workbench-capability-link',{detail:{section:'capability-center',capabilityId:'developer-workspace'}}));await new Promise(r=>setTimeout(r,15))});expect(confirm).toHaveBeenCalledOnce();expect(field('默认模型').value).toBe('保留输入')
})

it('NR21 restores plugin search after traversing component and capability details',async()=>{
 await render(<InventoryTree list={async()=>({entries:[]})}/>);await fill(host.querySelector('input[type="search"]')!,'我的来源查找');await act(async()=>{capabilityLink('component-center',undefined,undefined,{componentId:'developer-files',tab:'usage'});await new Promise(r=>setTimeout(r,15))});await remount(<ComponentCenter/>);await click('查看能力 ↗');await remount(<ManagedCenter/>);await click('← 返回组件中心');await remount(<ComponentCenter/>);await click('← 返回插件管理');await remount(<InventoryTree list={async()=>({entries:[]})}/>);expect(host.querySelector<HTMLInputElement>('input[type="search"]')!.value).toBe('我的来源查找');expect(button('← 返回组件中心')).toBeUndefined()
})

it('NR22 protects meeting configuration when declining global departure',async()=>{
 await render(<ManagedCenter initialId="meeting-transcription"/>);await click('设置');await click('编辑识别配置');await fill(host.querySelector('[aria-label="语音识别模型"]')!,'qa-unsaved-asr');const confirm=vi.spyOn(window,'confirm').mockReturnValue(false)
 await act(async()=>{openCapabilityLink({section:'plugins'});await new Promise(r=>setTimeout(r,15))});expect(confirm).toHaveBeenCalledOnce();expect(host.querySelector<HTMLInputElement>('[aria-label="语音识别模型"]')!.value).toBe('qa-unsaved-asr')
})
