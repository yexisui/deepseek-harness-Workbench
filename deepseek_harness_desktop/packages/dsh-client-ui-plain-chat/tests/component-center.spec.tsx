// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mkdtemp } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { CapabilityStore } from '../../dsh-capabilities/src/host/store.ts'
import { ComponentRegistryStore } from '../../dsh-capabilities/src/host/component-registry.ts'
import { components, type Snapshot } from '../../dsh-capabilities/src/core/model.ts'
import { registryCatalog } from '../../dsh-capabilities/src/core/component-registry.ts'
import { ComponentCenter } from '../src/client/ComponentCenter.tsx'
import { CapabilityEditor } from '../src/client/ManagedCenter.tsx'
import { capabilityClient } from '../src/client/capability-client.ts'
import { initialClassification } from '../../dsh-plugin-manager/src/core/classification.ts'

let root:Root,container:HTMLDivElement,store:CapabilityStore,registry:ComponentRegistryStore
let centerWidth:number,resizeCallbacks:(()=>void)[]
beforeEach(async()=>{
 ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;sessionStorage.clear();localStorage.clear()
 centerWidth=700;resizeCallbacks=[]
 vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(function(this:HTMLElement){return this.hasAttribute('data-component-center')?{width:centerWidth,height:600,top:100,bottom:700,left:0,right:centerWidth,x:0,y:100,toJSON(){}}:{width:0,height:0,top:0,bottom:0,left:0,right:0,x:0,y:0,toJSON(){}}})
 vi.stubGlobal('ResizeObserver',class{constructor(callback:()=>void){resizeCallbacks.push(callback)}observe(){}disconnect(){}})
 const directory=await mkdtemp(join(tmpdir(),'component-center-ui-'));store=new CapabilityStore(directory);await store.init();registry=new ComponentRegistryStore(directory,()=>store.snapshot(),async()=>[]);await registry.init()
 HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','')};HTMLDialogElement.prototype.close=function(){this.removeAttribute('open')}
 const snapshot=():Snapshot=>({compositionVersion:2,state:store.snapshot(),components:registryCatalog(registry.snapshot()),registry:registry.snapshot(),componentActivities:[],tasks:[],health:{checkedAt:null,installed:false,loaded:false,state:'unknown',message:'尚未检测',browsers:[]}})
 vi.stubGlobal('fetch',vi.fn(async(url:string,options?:RequestInit)=>{
  let value:unknown={};try{
   if(url.endsWith('/state'))value=snapshot()
   else if(url.endsWith('/meeting/config'))value={ready:false,message:'待配置'}
   else if(url.endsWith('/requirements/config'))value={ready:true,message:'待实际调用验证',defaults:{depth:'standard',questionStyle:'short',model:''}}
   else if(url.endsWith('/components/command'))value={registry:await registry.command(JSON.parse(String(options?.body)))}
   else if(url.endsWith('/components/preview')){const data=JSON.parse(String(options?.body));value=await registry.preview(data.id,data.action)}
   return {ok:true,json:async()=>value}
  }catch(error){return {ok:false,json:async()=>({error:(error as Error).message})}}
 }))
 await capabilityClient.refresh();container=document.createElement('div');document.body.append(container);root=createRoot(container);await act(async()=>root.render(<ComponentCenter/>))
})
afterEach(async()=>{await act(async()=>root.unmount());container.remove();await store.close();vi.restoreAllMocks();vi.unstubAllGlobals()})
const button=(name:string)=>Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(b=>b.textContent?.trim()===name)!
const click=async(name:string)=>act(async()=>{expect(button(name),name).toBeTruthy();button(name).click();await new Promise(resolve=>setTimeout(resolve,15))})
const resize=async(width:number)=>act(async()=>{centerWidth=width;resizeCallbacks.forEach(callback=>callback())})
const center=()=>container.querySelector<HTMLElement>('[data-component-center]')!
const list=()=>container.querySelector<HTMLElement>('[aria-label="组件清单"]')!
const detail=()=>container.querySelector<HTMLElement>('[data-center-detail]')!
async function input(label:string,value:string){await act(async()=>{const element=Array.from(document.querySelectorAll('label')).find(e=>e.textContent?.startsWith(label))!.querySelector('input,textarea') as HTMLInputElement;Object.getOwnPropertyDescriptor(element.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value')!.set!.call(element,value);element.dispatchEvent(new Event('input',{bubbles:true}));element.dispatchEvent(new Event('change',{bubbles:true}))})}
it('shows all six business components with separate adapted capability and plugin tags',()=>{expect(container.querySelectorAll('[role=listitem]')).toHaveLength(6);const first=container.querySelector('[role=listitem]')!;expect(first.textContent).toContain('适配能力开发工作区');expect(first.textContent).toContain('对应插件capabilities');expect(container.textContent).toContain('插件与依赖')})
it('saves catalog metadata, exposes it after reopening and preserves execution definitions',async()=>{const before=store.snapshot();await click('项目文件与开发对话');await click('整理信息');await input('组件名称','项目文件管理');await input('整理分类','开发工具');await click('保存信息');expect(registry.snapshot().metadata['developer-files']).toMatchObject({name:'项目文件管理',category:'开发工具'});expect(store.snapshot()).toEqual(before);expect(container.textContent).toContain('项目文件管理')})
it('previews retirement, supports restore and preserves published versions',async()=>{const before=store.snapshot();await click('项目文件与开发对话');await click('移入回收站');expect(document.body.textContent).toContain('含历史版本');await click('确认移入回收站');expect(registry.snapshot().metadata['developer-files'].retiredAt).toBeTruthy();expect(button('添加到能力').disabled).toBe(true);await click('恢复组件');await click('确认恢复组件');expect(registry.snapshot().metadata['developer-files'].retiredAt).toBeUndefined();expect(store.snapshot()).toEqual(before)})
it('registers a non-executable candidate without inventing runtime actions',async()=>{await click('＋ 添加组件');await input('组件名称','资料检索');await input('提供插件完整包名','@example/search');await click('登记候选组件');expect(registry.snapshot().candidates).toHaveLength(1);await click('资料检索');expect(button('添加到能力').disabled).toBe(true);await click('动作');expect(container.textContent).toContain('尚未接入可执行动作')})
it('shows the same component restriction as the backend before opening publication review',async()=>{
 const catalog=registry.snapshot();catalog.metadata['developer-files']={enabled:false}
 const data:Snapshot={compositionVersion:2,state:store.snapshot(),components,registry:catalog,tasks:[],health:{checkedAt:null,installed:false,loaded:false,state:'unknown',message:'待检测',browsers:[]}}
 await act(async()=>root.render(<CapabilityEditor id="developer-workspace" data={data} onClose={()=>{}} onSaved={()=>{}}/>))
 expect(button('检查并发布').disabled).toBe(true);expect(document.body.textContent).toContain('已全局停用');expect(button('保存草稿').disabled).toBe(false)
})
it('uses the management container width and preserves the open detail when crossing the breakpoint',async()=>{
 expect(center().dataset.layout).toBe('single');expect(list().hidden).toBe(false);expect(detail().hidden).toBe(true)
 await click('Git 变更与版本');expect(list().hidden).toBe(true);expect(detail().hidden).toBe(false)
 await resize(1100);expect(center().dataset.layout).toBe('wide');expect(list().hidden).toBe(false);expect(detail().hidden).toBe(false)
 await resize(700);expect(list().hidden).toBe(true);expect(detail().textContent).toContain('Git 变更与版本')
})
it('restores search, list scrolling and focus after returning from detail',async()=>{
 await act(async()=>{const field=container.querySelector<HTMLInputElement>('[aria-label="搜索组件"]')!;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(field,'Git 变更与版本');field.dispatchEvent(new Event('input',{bubbles:true}))})
 expect(list().querySelectorAll('[role=listitem]')).toHaveLength(1)
 list().scrollTop=180;await act(async()=>list().dispatchEvent(new Event('scroll',{bubbles:true})))
 await click('Git 变更与版本');await click('动作');await click('← 返回组件列表')
 expect(container.querySelector<HTMLInputElement>('[aria-label="搜索组件"]')!.value).toBe('Git 变更与版本');expect(list().scrollTop).toBe(180);expect(document.activeElement?.textContent).toBe('Git 变更与版本')
 await click('Git 变更与版本');expect(button('动作').getAttribute('aria-pressed')).toBe('true')
})
it('keeps editing inputs across a resize and changes the narrow detail selector without losing content',async()=>{
 await click('项目文件与开发对话');await click('整理信息');await input('组件名称','正在整理的名称');await resize(500)
 expect(document.querySelector<HTMLInputElement>('[role=dialog] input')?.value??Array.from(document.querySelectorAll('input')).find(e=>e.value==='正在整理的名称')?.value).toBe('正在整理的名称')
 await click('×')
 const picker=container.querySelector<HTMLSelectElement>('select[aria-label="组件详情栏目"]')!
 expect(picker.parentElement!.hidden).toBe(false)
 await act(async()=>{picker.value='actions';picker.dispatchEvent(new Event('change',{bubbles:true}))})
 expect(detail().textContent).toContain('已适配动作');await resize(700);expect(button('动作').getAttribute('aria-pressed')).toBe('true')
})
it('preserves per-component detail columns and does not show stale details for an empty filter',async()=>{
 await resize(1100);await click('项目文件与开发对话');await click('动作');await click('Git 变更与版本');await click('使用关系');await click('项目文件与开发对话')
 expect(button('动作').getAttribute('aria-pressed')).toBe('true')
 await act(async()=>{const field=container.querySelector<HTMLInputElement>('[aria-label="搜索组件"]')!;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(field,'不存在的组件');field.dispatchEvent(new Event('input',{bubbles:true}))})
 expect(detail().textContent).toContain('选择列表中的组件');expect(detail().querySelector('h3')).toBeNull()
})
it('restores plugin detail scrolling after its asynchronous inventory becomes ready',async()=>{
 await act(async()=>root.unmount())
 sessionStorage.setItem('workbench-component-center:root',JSON.stringify({selected:'developer-files',tab:'plugins',pane:'detail',scroll:{'developer-files:plugins':240}}))
 const originalFetch=globalThis.fetch;let finishInventory!:(value:unknown)=>void
 vi.stubGlobal('fetch',vi.fn((url:string,options?:RequestInit)=>{
  if(url.endsWith('/plugin-manager/inventory'))return new Promise(resolve=>{finishInventory=resolve})
  if(url.endsWith('/plugin-manager/pending'))return Promise.resolve({ok:true,json:async()=>({entries:[],origins:[]})})
  if(url.endsWith('/plugin-manager/classification'))return Promise.resolve({ok:true,json:async()=>({classification:initialClassification([])})})
  return originalFetch(url,options)
 }))
 await act(async()=>{root=createRoot(container);root.render(<ComponentCenter/>)})
 const body=detail().lastElementChild as HTMLElement
 expect(container.querySelector('[data-inventory-ready="false"]')).toBeTruthy();expect(body.scrollTop).toBe(0)
 await act(async()=>{finishInventory({ok:true,json:async()=>({entries:[]})});await new Promise(resolve=>setTimeout(resolve,20))})
 expect(container.querySelector('[data-inventory-ready="true"]')).toBeTruthy();expect(body.scrollTop).toBe(240)
})
