// @vitest-environment jsdom
import React,{act} from 'react'
import {createRoot,type Root} from 'react-dom/client'
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {JevSettings,JevToggle,JevModelReturn,JevActivity} from '../src/ui/JevControls.tsx'
import {jevClient} from '../src/ui/client.ts'
import {defaults,descriptor,type JevStatus} from '../src/core/contract.ts'
import {captureNavigation,openWorkbenchLink,pendingNavigation,returnNavigation} from '../../dsh-plugin-manager/src/client/workbench-navigation.ts'
let container:HTMLDivElement,root:Root,saved:JevStatus,requests:{url:string;body:any}[]
let connection='unverified'
const delay=()=>new Promise(r=>setTimeout(r,210))
beforeEach(async()=>{
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;sessionStorage.clear();connection='unverified';requests=[]
  saved={state:'off',message:'关闭',descriptor,config:{schema:1,revision:0,value:{...defaults,model:'lan/one'}},connection:{state:'unverified',message:'待检查'},traces:[],active:[]}
  vi.stubGlobal('fetch',vi.fn(async(url:any,options:any)=>{
    const body=options?.body?JSON.parse(options.body):undefined;requests.push({url:String(url),body})
    let response:any=saved
    if(String(url).endsWith('/accounts'))response=[{id:'lan',name:'内网账号',available:true,models:[{id:'lan/one',name:'模型一'},{id:'lan/two',name:'模型二',reasoning:['low']}]},{id:'cloud',name:'公网账号',available:false,models:[],message:'账号未配置内网地址'}]
    if(String(url).endsWith('/connection'))response={state:connection,message:'本地检查状态'}
    if(String(url).endsWith('/config')){saved={...saved,config:{schema:1,revision:saved.config.revision+1,value:body.value}};response=saved}
    if(String(url).endsWith('/check')){saved={...saved,diagnostic:{id:'test-check',config:body.value,status:'checking',startedAt:new Date().toISOString(),elapsedMs:0,message:'正在请求'}};response=saved.diagnostic}
    if(String(url).endsWith('/check/cancel')){saved={...saved,diagnostic:{...saved.diagnostic!,status:'cancelled',message:'检查已取消'}};response=saved.diagnostic}
    return new Response(JSON.stringify(response))
  }))
  container=document.createElement('div');document.body.append(container);root=createRoot(container);jevClient.clearSaveError();await jevClient.refresh()
})
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals();vi.restoreAllMocks();sessionStorage.clear()})
async function render(node:React.ReactNode=<JevSettings/>){await act(async()=>{root.render(node);await delay()})}
const button=(text:string)=>Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(b=>b.textContent===text)!
async function click(text:string){const b=button(text);expect(b).toBeTruthy();await act(async()=>{b.click();await delay()})}
it('guides an unverified top switch to settings without saving enabled mode',async()=>{await render(<JevToggle/>);await act(async()=>container.querySelector<HTMLButtonElement>('[role="switch"]')!.click());expect(pendingNavigation('jev-mode')?.tab).toBe('configuration');expect(requests.some(r=>r.url.endsWith('/config'))).toBe(false)})
it('shows unavailable account reasons and checks unsaved configuration while global mode stays off',async()=>{
  await render();expect(container.textContent).toContain('公网账号');expect(container.textContent).toContain('账号未配置内网地址')
  const model=Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(b=>b.textContent?.startsWith('模型二'))!;await act(async()=>model.click());await click('检查内网模型')
  expect(requests.find(r=>r.url.endsWith('/check'))?.body.value.model).toBe('lan/two');expect(saved.config.value.enabled).toBe(false);expect(saved.config.value.model).toBe('lan/one');expect(container.textContent).toContain('取消检查')
  await click('取消检查');expect(requests.find(r=>r.url.endsWith('/check/cancel'))?.body.id).toBe('test-check');expect(container.textContent).toContain('检查已取消')
})
it('retains inputs on conflict and rebases only edited fields onto the latest saved values',async()=>{
  await render();const model=Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(b=>b.textContent?.startsWith('模型二'))!;await act(async()=>model.click())
  saved={...saved,config:{...saved.config,revision:1,value:{...saved.config.value,maxChecks:8}}};await act(async()=>jevClient.refresh())
  expect(button('保存配置').disabled).toBe(true);expect(container.textContent).toContain('草稿仍保留')
  await click('保留草稿，加载最新基准');await click('保存配置');expect(saved.config.value.model).toBe('lan/two');expect(saved.config.value.maxChecks).toBe(8)
})
it('restores the about tab and expansion after model settings, consuming the navigation once',async()=>{
  await render();await click('模块与扩展');const technical=Array.from(container.querySelectorAll('details')).find(d=>d.textContent?.includes('技术信息与能力边界'))!;await act(async()=>{technical.open=true;technical.dispatchEvent(new Event('toggle'))})
  await click('管理模型账号 ↗');expect(pendingNavigation('models')?.origin?.section).toBe('jev-mode')
  await render(<JevModelReturn><div>模型设置</div></JevModelReturn>);expect(pendingNavigation('models')).toBeUndefined();await click('← 返回 JEV 模式');await render()
  expect(container.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe('模块与扩展');expect(container.querySelector('details')?.open).toBe(true);expect(pendingNavigation('jev-mode')).toBeUndefined()
})
it('supports tab keyboard navigation and a real configuration action in the about page',async()=>{
  await render();const tab=container.querySelector<HTMLButtonElement>('[role="tab"]')!;await act(async()=>{tab.focus();tab.dispatchEvent(new KeyboardEvent('keydown',{key:'End',bubbles:true}))})
  expect(document.activeElement?.textContent).toBe('模块与扩展');expect(container.textContent).toContain('Jev 官方服务 · 尚未接入');expect(container.querySelector('[role="tabpanel"]')?.getAttribute('aria-labelledby')).toBe('jev-tab-about');await click('配置与检查');expect(container.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe('配置与状态')
})
it('blocks invalid limits with inline explanations instead of sending invalid JSON',async()=>{
  await render();const input=container.querySelector<HTMLInputElement>('input[type="number"]')!;await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'2');input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}))})
  expect(container.textContent).toContain('超时应为 5–120 秒');expect(button('保存配置').disabled).toBe(true);expect(button('检查内网模型').disabled).toBe(true)
})
it('queries the selected conversation independently and distinguishes a fixed round from global settings',async()=>{
  saved.active=[{id:'round',scope:'native:old',revision:0,enabled:true,model:'lan/one',startedAt:new Date().toISOString(),checkingSince:new Date().toISOString(),stage:'review',phase:'checking'}];saved.config.revision=1
  await render(<JevActivity scope="native:old"/>);expect(requests.some(r=>r.url.endsWith('state?scope=native%3Aold'))).toBe(true);expect(container.textContent).toContain('正在结果复核');expect(container.textContent).toContain('下一轮生效')
})

