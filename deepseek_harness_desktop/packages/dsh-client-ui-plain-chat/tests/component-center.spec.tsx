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

let root:Root,container:HTMLDivElement,store:CapabilityStore,registry:ComponentRegistryStore
beforeEach(async()=>{
 ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;sessionStorage.clear();localStorage.clear()
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
async function input(label:string,value:string){await act(async()=>{const element=Array.from(document.querySelectorAll('label')).find(e=>e.textContent?.startsWith(label))!.querySelector('input,textarea') as HTMLInputElement;Object.getOwnPropertyDescriptor(element.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value')!.set!.call(element,value);element.dispatchEvent(new Event('input',{bubbles:true}));element.dispatchEvent(new Event('change',{bubbles:true}))})}
it('shows all six business components with separate adapted capability and plugin tags',()=>{expect(container.querySelectorAll('[role=listitem]')).toHaveLength(6);const first=container.querySelector('[role=listitem]')!;expect(first.textContent).toContain('适配能力开发工作区');expect(first.textContent).toContain('对应插件capabilities');expect(container.textContent).toContain('插件与依赖')})
it('saves catalog metadata, exposes it after reopening and preserves execution definitions',async()=>{const before=store.snapshot();await click('整理信息');await input('组件名称','项目文件管理');await input('整理分类','开发工具');await click('保存信息');expect(registry.snapshot().metadata['developer-files']).toMatchObject({name:'项目文件管理',category:'开发工具'});expect(store.snapshot()).toEqual(before);expect(container.textContent).toContain('项目文件管理')})
it('previews retirement, supports restore and preserves published versions',async()=>{const before=store.snapshot();await click('移入回收站');expect(document.body.textContent).toContain('含历史版本');await click('确认移入回收站');expect(registry.snapshot().metadata['developer-files'].retiredAt).toBeTruthy();expect(button('添加到能力').disabled).toBe(true);await click('恢复组件');await click('确认恢复组件');expect(registry.snapshot().metadata['developer-files'].retiredAt).toBeUndefined();expect(store.snapshot()).toEqual(before)})
it('registers a non-executable candidate without inventing runtime actions',async()=>{await click('＋ 添加组件');await input('组件名称','资料检索');await input('提供插件完整包名','@example/search');await click('登记候选组件');expect(registry.snapshot().candidates).toHaveLength(1);await click('资料检索');expect(button('添加到能力').disabled).toBe(true);await click('动作');expect(container.textContent).toContain('尚未接入可执行动作')})
it('shows the same component restriction as the backend before opening publication review',async()=>{
 const catalog=registry.snapshot();catalog.metadata['developer-files']={enabled:false}
 const data:Snapshot={compositionVersion:2,state:store.snapshot(),components,registry:catalog,tasks:[],health:{checkedAt:null,installed:false,loaded:false,state:'unknown',message:'待检测',browsers:[]}}
 await act(async()=>root.render(<CapabilityEditor id="developer-workspace" data={data} onClose={()=>{}} onSaved={()=>{}}/>))
 expect(button('检查并发布').disabled).toBe(true);expect(document.body.textContent).toContain('已全局停用');expect(button('保存草稿').disabled).toBe(false)
})
