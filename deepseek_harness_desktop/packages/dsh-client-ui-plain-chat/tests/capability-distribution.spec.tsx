// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { File as NodeFile } from 'node:buffer'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CapabilityStore } from '../../dsh-capabilities/src/host/store.ts'
import { CapabilityPackages } from '../../dsh-capabilities/src/host/packages.ts'
import { catalogFor } from '../../dsh-capabilities/src/core/distribution.ts'
import { packageZip, sha256 } from '../../dsh-capabilities/src/host/package-archive.ts'
import { capabilityClient, editorDrafts } from '../src/client/capability-client.ts'
import { ManagedCenter } from '../src/client/ManagedCenter.tsx'

let directory:string,store:CapabilityStore,packs:CapabilityPackages,host:HTMLDivElement,root:Root,downloaded:Buffer|undefined
const button=(name:string)=>Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(b=>b.textContent?.trim()===name||b.getAttribute('aria-label')===name)!
async function click(name:string){expect(button(name),name).toBeTruthy();await act(async()=>button(name).click())}
async function waitFor(test:()=>unknown){for(let i=0;i<80;i++){if(test())return;await act(async()=>{await new Promise(resolve=>setTimeout(resolve,10))})};expect(test()).toBeTruthy()}
function delivery(model=false){const code=Buffer.from('exports.execute=async({input})=>input');const m={schema:1,protocol:'dsh-worker-v1',id:'org.example.ui',version:'1.0.0',name:'文字整理',description:'整理输入内容',instructions:'输入文字运行',author:'UI制作者',license:'MIT',permissions:model?['node','model']:['node'],components:[{id:'text',name:'外部文字组件',entry:'runtime/main.cjs',actions:[{id:'process',name:'整理文字',description:'输入文字并获取结果'}]}],files:{'runtime/main.cjs':sha256(code)}};return new Map([['capability.json',Buffer.from(JSON.stringify(m))],['runtime/main.cjs',code]])}
async function selectFile(files:NodeFile[]){const input=document.querySelector<HTMLInputElement>('input[type=file]')!;Object.defineProperty(input,'files',{configurable:true,value:files});await act(async()=>input.dispatchEvent(new Event('change',{bubbles:true})));await waitFor(()=>!button('处理中…')&&(!!document.querySelector('[aria-label="能力包预览"]')||!!document.querySelector('[role=alert]')||!!document.querySelector('.importFile')||Array.from(document.querySelectorAll('p')).some(p=>p.textContent?.includes('仅导入可信来源'))))}

beforeEach(async()=>{
  ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;sessionStorage.clear();editorDrafts.clear();downloaded=undefined
  directory=await mkdtemp(join(tmpdir(),'package-ui-'));store=new CapabilityStore(directory);await store.init();packs=new CapabilityPackages(store,route=>route);await packs.init()
  HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','')};HTMLDialogElement.prototype.close=function(){this.removeAttribute('open')}
  vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{})
  URL.createObjectURL=vi.fn(()=> 'blob:export');URL.revokeObjectURL=vi.fn()
  vi.stubGlobal('fetch',vi.fn(async(raw:string,options?:RequestInit)=>{
    const url=new URL(raw,'http://localhost'),route=url.pathname,body=options?.method==='POST'?JSON.parse(String(options.body)):{}
    try{
      let value:unknown={}
      if(route.endsWith('/state')){const state=store.snapshot();value={state,components:catalogFor(state),packages:packs.health(),compositionVersion:2,tasks:[],health:{state:'unknown',message:'未检测',browsers:[],checkedAt:null,installed:false,loaded:false}}}
      else if(route.endsWith('/meeting/config'))value={ready:false,message:'待配置'}
      else if(route.endsWith('/requirements/config'))value={ready:false,message:'待配置',defaults:{depth:'standard',questionStyle:'short',model:''}}
      else if(route.endsWith('/packages/start'))value=await packs.start(body.kind)
      else if(route.includes('/packages/upload/')){const token=route.split('/').at(-1)!;if(options?.method==='DELETE')await packs.discard(token);else{const bytes=Buffer.from(await (options!.body as unknown as NodeFile).arrayBuffer());value=await packs.put(token,url.searchParams.get('path')!,(async function*(){yield bytes})())}}
      else if(route.endsWith('/packages/process'))value=await packs.processImport(body.token,body.ai,body.name)
      else if(route.includes('/packages/processing/'))value=packs.processStatus(route.split('/').at(-1)!)
      else if(route.endsWith('/packages/cancel-process'))value=await packs.cancelProcessing(body.token)
      else if(route.endsWith('/packages/inspect'))value=await packs.inspect(body.token)
      else if(route.endsWith('/packages/install'))value=await packs.install(body.token,body.hash,body.revision,body)
      else if(route.endsWith('/packages/configure'))value=await packs.configure(body.id,body.model,body.revision,body.enable)
      else if(route.startsWith('/api/capabilities/packages/download/')&&options?.method==='DELETE')await packs.discardDownload(route.split('/').at(-1)!)
      else if(route.endsWith('/packages/export-link')){value=await packs.prepareDownload(body);downloaded=(await packs.download((value as any).id)).bytes}
      else if(route.endsWith('/packages/export')){const result=body.token?await packs.exportPrepared(body.token,body.hash):await packs.exportInstalled(body.id,body.version);downloaded=result.bytes;return new Response(new Uint8Array(result.bytes),{headers:{'content-disposition':`attachment; filename="${result.name}"`}})}
      else if(route.endsWith('/packages/tasks'))value=[]
      else if(route.endsWith('/command'))value=await store.command(body.revision,body.command)
      return new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}})
    }catch(error){return new Response(JSON.stringify({error:(error as Error).message}),{status:400})}
  }))
  await capabilityClient.refresh();host=document.createElement('div');document.body.append(host);root=createRoot(host)
  await act(async()=>root.render(<ManagedCenter managementEntries/>))
})
afterEach(async()=>{await act(async()=>root.unmount());host.remove();await packs.close();await store.close();await rm(directory,{recursive:true,force:true});vi.restoreAllMocks();vi.unstubAllGlobals();editorDrafts.clear()})

it('shows only import/export main actions and imports a complete executable version without a draft publishing flow',async()=>{
  expect(button('＋ 创建能力')).toBeUndefined();expect(button('更多')).toBeUndefined();expect(button('组件库').closest('nav')).toBeTruthy()
  await click('导入能力');await selectFile([new NodeFile([new Uint8Array(packageZip(delivery()))],'ability.zip')])
  expect(button('导入').disabled).toBe(false);expect(document.body.textContent).toContain('ability.zip');expect(document.querySelector('[aria-label="能力包预览"]')).toBeNull()
  await click('导入');await waitFor(()=>!!button('运行动作'))
  const cap=store.snapshot().capabilities.find(c=>c.packageOrigin)!
  expect(cap.enabled).toBe(true);expect(cap.versions).toHaveLength(1);expect(document.querySelector('dialog')).toBeNull()
  await click('组件');expect(document.body.textContent).toContain('外部文字组件');await click('编辑组件组合')
  expect(document.body.textContent).toContain('整理文字');expect(document.querySelector('[data-composition-editor]')??document.querySelector('dialog')).toBeTruthy()
})
it('lists every current ability and exports directly without technical fields',async()=>{
 const before=store.snapshot();await click('导出能力')
 const select=document.querySelector<HTMLSelectElement>('select[aria-label="选择能力"]')!
 expect(Array.from(select.options).map(o=>o.value)).toEqual(before.capabilities.filter(c=>!c.removedAt&&!c.purgedAt).map(c=>c.id))
 expect(document.body.textContent).not.toContain('导出来源');expect(document.body.textContent).not.toContain('来源与交付清单')
 await click('导出');await waitFor(()=>!!downloaded);expect(downloaded!.readUInt32LE(0)).toBe(0x04034b50);expect(store.snapshot()).toEqual(before)
})
it('opens the existing identity on a repeated import instead of creating another capability',async()=>{
  const zip=packageZip(delivery()),session=await packs.start('zip');await packs.put(session.token,'ability.zip',(async function*(){yield zip})());const preview=await packs.inspect(session.token);await packs.install(preview.token,preview.hash,preview.revision,{trusted:true});await capabilityClient.refresh()
  await click('导入能力');await selectFile([new NodeFile([new Uint8Array(zip)],'ability.zip')]);expect(button('导入')).toBeTruthy();await click('导入');await waitFor(()=>!!button('运行动作'));expect(store.snapshot().capabilities.filter(c=>c.packageOrigin)).toHaveLength(1)
})
it('takes missing model configuration directly to the shared capability settings and enables after saving',async()=>{
  await click('导入能力');await selectFile([new NodeFile([new Uint8Array(packageZip(delivery(true)))],'ability.zip')]);await click('导入');await waitFor(()=>!!button('保存并启用'))
  expect(store.snapshot().capabilities.find(c=>c.packageOrigin)!.enabled).toBe(false)
  const input=Array.from(document.querySelectorAll<HTMLInputElement>('input')).find(n=>n.placeholder==='留空使用工作台默认模型')!
  await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'local/model');input.dispatchEvent(new Event('input',{bubbles:true}))})
  await click('保存并启用');await waitFor(()=>store.snapshot().capabilities.find(c=>c.packageOrigin)!.enabled)
  expect(store.snapshot().packageModels).toEqual({[store.snapshot().capabilities.find(c=>c.packageOrigin)!.id]:'local/model'})
})
it('accepts an external package before processing and preserves it when AI is unavailable',async()=>{
  const before=store.snapshot(),files=new Map([['README.md',Buffer.from('An external tool')]])
  await click('导入能力');await selectFile([new NodeFile([new Uint8Array(packageZip(files))],'external.zip')])
  expect(document.querySelector('[role=alert]')).toBeNull();expect(button('导入').disabled).toBe(false)
  expect(button('使用 AI 处理').getAttribute('aria-checked')).toBe('true')
  await click('导入');await waitFor(()=>!!document.querySelector('[role=alert]'))
  expect(document.querySelector('[role=alert]')?.textContent).toContain('原包已保留')
  expect(button('导入').disabled).toBe(false);expect(document.body.textContent).toContain('external.zip');expect(store.snapshot()).toEqual(before)
})

it('drops a ZIP, displays only its filename, then removes and permanently deletes the imported capability',async()=>{
  await click('导入能力')
  const file=new NodeFile([new Uint8Array(packageZip(delivery()))],'dropped-tool.zip')
  const zone=document.querySelector('[aria-label="选择或拖入能力包"]')!
  const event=new Event('drop',{bubbles:true,cancelable:true})
  Object.defineProperty(event,'dataTransfer',{value:{files:[file],items:[]}})
  await act(async()=>zone.dispatchEvent(event));await waitFor(()=>!!button('导入')&&!button('导入').disabled)
  expect(event.defaultPrevented).toBe(true);expect(document.body.textContent).toContain('dropped-tool.zip')
  expect(document.querySelector('[aria-label="能力包预览"]')).toBeNull()
  await click('导入');await waitFor(()=>!!button('运行动作'))
  const cap=store.snapshot().capabilities.find(c=>c.packageOrigin)!
  await store.command(store.snapshot().revision,{type:'capability.remove',id:cap.id})
  await store.command(store.snapshot().revision,{type:'capability.purge',ids:[cap.id]})
  expect(store.snapshot().capabilities.some(c=>c.id===cap.id)).toBe(false)
  expect(catalogFor(store.snapshot()).some(c=>c.provider==='org.example.ui')).toBe(false)
})
