// @vitest-environment jsdom
import React,{act} from 'react'
import {createRoot,type Root} from 'react-dom/client'
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {JevSettings,JevToggle,JevModelReturn,JevActivity} from '../src/ui/JevControls.tsx'
import {jevClient} from '../src/ui/client.ts'
import {defaults,descriptor,type JevStatus} from '../src/core/contract.ts'
import {diagnosticMatches} from '../src/ui/view-model.ts'
import {captureNavigation,openWorkbenchLink,pendingNavigation,returnNavigation} from '../../dsh-plugin-manager/src/client/workbench-navigation.ts'
let container:HTMLDivElement,root:Root,saved:JevStatus,requests:{url:string;body:any}[]
let connection='unverified'
const delay=()=>new Promise(r=>setTimeout(r,210))
it('keeps a row diagnostic current after switches and order change, but detects parameter changes',()=>{
  const row={id:'one',model:'lan/one',enabled:false,reasoningEffort:'' as const},current={...defaults,candidates:[row]},checked={...defaults,model:'lan/one'}
  expect(diagnosticMatches(checked,current)).toBe(true);expect(diagnosticMatches(checked,{...current,timeoutMs:10000})).toBe(false);expect(diagnosticMatches(checked,{...current,candidates:[]})).toBe(false)
})
beforeEach(async()=>{
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;sessionStorage.clear();connection='unverified';requests=[]
  saved={state:'off',message:'关闭',descriptor,config:{schema:1,revision:0,value:{...defaults,model:'lan/one'}},connection:{state:'unverified',message:'待检查'},traces:[],active:[]}
  vi.stubGlobal('fetch',vi.fn(async(url:any,options:any)=>{
    const body=options?.body?JSON.parse(options.body):undefined;requests.push({url:String(url),body})
    let response:any=saved
    if(String(url).endsWith('/accounts'))response=[{id:'lan',name:'内网账号',available:true,models:[{id:'lan/one',name:'模型一'},{id:'lan/two',name:'模型二',reasoning:['low']}]},{id:'cloud',name:'公网账号',available:false,models:[{id:'cloud/model',name:'公网模型'}],message:'账号未配置内网地址'}]
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
const pickerButton=()=>container.querySelector<HTMLButtonElement>('[aria-label="选择候选模型"]')!
const modelCheck=(model:string)=>container.querySelector<HTMLInputElement>('[data-model-option="'+model+'"] input')!
async function choose(model:string){if(pickerButton().getAttribute('aria-expanded')!=='true')await act(async()=>pickerButton().click());const option=modelCheck(model);expect(option.disabled).toBe(false);await act(async()=>option.click())}
async function add(model:string){await choose(model);await click('添加所选（1）')}
it('batches selections across providers in catalog order without saving or enabling them early',async()=>{
  await render();await choose('cloud/model');await click('内网账号');await choose('lan/two')
  expect(pickerButton().getAttribute('aria-expanded')).toBe('true');expect(button('添加')).toBeUndefined();expect(button('保存配置')).toBeUndefined()
  expect(requests.some(r=>r.url.endsWith('/config'))).toBe(false)
  await click('添加所选（2）');expect(pickerButton().getAttribute('aria-expanded')).toBe('false')
  expect(container.querySelector('[aria-label="启用 模型二"]')?.getAttribute('aria-checked')).toBe('false');expect(container.querySelector('[aria-label="启用 公网模型"]')?.getAttribute('aria-checked')).toBe('false')
  expect(container.textContent).toContain('并不表示密钥失效');expect(container.querySelector<HTMLButtonElement>('[aria-label="检查 公网模型"]')!.disabled).toBe(true)
  await click('保存配置');expect(saved.config.value.candidates?.map(c=>c.model)).toEqual(['lan/one','lan/two','cloud/model']);expect(saved.config.value.candidates?.map(c=>c.enabled)).toEqual([true,false,false])
  await render(null);await render();expect(container.querySelectorAll('[role="switch"]')).toHaveLength(3)
})
it('selects filtered results, clears checks and treats row and checkbox clicks identically',async()=>{
  await render();await act(async()=>pickerButton().click());await click('公网账号');await click('全选当前');expect(modelCheck('cloud/model').checked).toBe(true)
  await click('清空勾选');expect(modelCheck('cloud/model').checked).toBe(false)
  await act(async()=>container.querySelector<HTMLElement>('[data-model-option="cloud/model"] strong')!.click());expect(modelCheck('cloud/model').checked).toBe(true)
  await act(async()=>modelCheck('cloud/model').click());expect(modelCheck('cloud/model').checked).toBe(false)
  await click('全部账号');const input=container.querySelector<HTMLInputElement>('[placeholder="搜索账号或模型"]')!
  await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'模型二');input.dispatchEvent(new Event('input',{bubbles:true}))})
  await click('全选当前');expect(container.querySelectorAll('[data-model-option]')).toHaveLength(1);await click('添加所选（1）');await click('保存配置');expect(saved.config.value.candidates?.map(c=>c.model)).toEqual(['lan/one','lan/two'])
})
it('caps batch selection at twelve while allowing unchecking and retaining checks across a catalog refresh',async()=>{
  const original=globalThis.fetch
  vi.stubGlobal('fetch',vi.fn(async(url:any,options:any)=>String(url).endsWith('/accounts')?new Response(JSON.stringify([{id:'lan',name:'内网账号',available:true,models:Array.from({length:14},(_,i)=>({id:'lan/m'+i,name:'模型 '+i}))}])):original(url,options)))
  saved.config.value={...defaults,candidates:[]};await jevClient.refresh();await render();await act(async()=>pickerButton().click());await click('全选当前')
  expect(container.querySelectorAll('input[type="checkbox"]:checked')).toHaveLength(12);expect(modelCheck('lan/m12').disabled).toBe(true)
  await act(async()=>modelCheck('lan/m0').click());await choose('lan/m12');await click('刷新本地模型');expect(modelCheck('lan/m12').checked).toBe(true)
  await click('添加所选（12）');await click('保存配置');expect(saved.config.value.candidates).toHaveLength(12);expect(saved.config.value.candidates?.every(c=>!c.enabled)).toBe(true);expect(saved.config.value.candidates?.[0]?.model).toBe('lan/m1')
})
it('keeps loaded models selectable during a focus refresh and preserves the selected model on failure',async()=>{
  await render();const original=globalThis.fetch;let release!:()=>void;const gate=new Promise<void>(r=>{release=r});let reads=0
  vi.stubGlobal('fetch',vi.fn(async(url:any,options:any)=>{if(String(url).endsWith('/accounts')){reads++;await gate;throw Error('测试刷新失败')}return original(url,options)}))
  await act(async()=>{window.dispatchEvent(new Event('focus'));window.dispatchEvent(new Event('focus'))})
  expect(reads).toBe(1);expect(pickerButton().disabled).toBe(false)
  await choose('lan/two');expect(modelCheck('lan/two').checked).toBe(true);expect(button('添加所选（1）').disabled).toBe(false)
  await act(async()=>{release();await delay()});expect(container.textContent).toContain('测试刷新失败');expect(modelCheck('lan/two').checked).toBe(true)
  await click('添加所选（1）');expect(container.querySelector('[aria-label="启用 模型二"]')?.getAttribute('aria-checked')).toBe('false')
})
it('adds, enables, checks and saves a model, then restores that configuration on reopening',async()=>{
  saved.config.value={...defaults,candidates:[]};await jevClient.refresh();await render();await add('lan/two')
  const toggle=container.querySelector<HTMLButtonElement>('[aria-label="启用 模型二"]')!;expect(toggle.getAttribute('aria-checked')).toBe('false')
  await act(async()=>{toggle.click();await delay()});await click('检查启用模型');expect(requests.find(r=>r.url.endsWith('/check'))?.body.value.candidates[0].model).toBe('lan/two')
  connection='ready';saved.diagnostic={...saved.diagnostic!,status:'passed',message:'已通过'};await act(async()=>{await jevClient.refresh();await delay()});await act(async()=>{await delay()})
  const mode=container.querySelector<HTMLSelectElement>('select[aria-label="JEV 全局开关"]')!;expect(mode.options[1]!.disabled).toBe(false)
  await act(async()=>{mode.value='true';mode.dispatchEvent(new Event('change',{bubbles:true}));await delay()});await click('保存配置')
  expect(saved.config.value.enabled).toBe(true);expect(saved.config.value.candidates?.[0]).toMatchObject({model:'lan/two',enabled:true})
  await render(null);await render();expect(container.querySelector('[aria-label="启用 模型二"]')?.getAttribute('aria-checked')).toBe('true');expect(button('保存配置')).toBeUndefined()
})
it('supports keyboard selection, Escape and duplicate prevention in the model list',async()=>{
  await render();await act(async()=>pickerButton().click());const first=modelCheck('lan/two')
  await act(async()=>{first.focus();first.dispatchEvent(new KeyboardEvent('keydown',{key:'End',bubbles:true}))});expect(document.activeElement?.closest('[data-model-option]')?.getAttribute('data-model-option')).toBe('cloud/model')
  await act(async()=>{document.activeElement!.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))});expect(pickerButton().getAttribute('aria-expanded')).toBe('false');expect(document.activeElement).toBe(pickerButton())
  await add('lan/two');await act(async()=>pickerButton().click());expect(modelCheck('lan/two').disabled).toBe(true)
})
it('guides an unverified top switch to settings without saving enabled mode',async()=>{await render(<JevToggle/>);await act(async()=>container.querySelector<HTMLButtonElement>('[role="switch"]')!.click());expect(pendingNavigation('jev-mode')?.tab).toBe('configuration');expect(requests.some(r=>r.url.endsWith('/config'))).toBe(false)})
it('shows unavailable account reasons and checks unsaved configuration while global mode stays off',async()=>{
  await render();await add('cloud/model');expect(container.textContent).toContain('公网账号');expect(container.textContent).toContain('账号未配置内网地址');expect(container.textContent).not.toContain('待配置或不可用账号')
  await add('lan/two');expect(container.querySelector('[aria-label="启用 模型二"]')?.getAttribute('aria-checked')).toBe('false');await act(async()=>{container.querySelector<HTMLButtonElement>('[aria-label="检查 模型二"]')!.click();await delay()})
  expect(requests.find(r=>r.url.endsWith('/check'))?.body.value.model).toBe('lan/two');expect(saved.config.value.enabled).toBe(false);expect(saved.config.value.model).toBe('lan/one');expect(container.textContent).toContain('取消检查')
  await click('取消检查');expect(requests.find(r=>r.url.endsWith('/check/cancel'))?.body.id).toBe('test-check');expect(container.textContent).toContain('检查已取消')
})
it('retains inputs on conflict and rebases only edited fields onto the latest saved values',async()=>{
  await render();await add('lan/two')
  saved={...saved,config:{...saved.config,revision:1,value:{...saved.config.value,maxChecks:8}}};await act(async()=>jevClient.refresh())
  expect(button('保存配置').disabled).toBe(true);expect(container.textContent).toContain('草稿仍保留')
  await click('保留草稿，加载最新基准');await click('保存配置');expect(saved.config.value.candidates?.map(c=>c.model)).toEqual(['lan/one','lan/two']);expect(saved.config.value.candidates?.[1]?.enabled).toBe(false);expect(saved.config.value.maxChecks).toBe(8)
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
it('waits for asynchronous model rows before restoring a saved scroll position',async()=>{
  const original=globalThis.fetch;let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve})
  vi.stubGlobal('fetch',vi.fn(async(url:any,options:any)=>{if(String(url).endsWith('/accounts'))await gate;return original(url,options)}))
  container.style.overflowY='auto';let top=0
  Object.defineProperty(container,'scrollTop',{get:()=>top,set:(value:number)=>{top=container.textContent?.includes('模型一')?value:0},configurable:true})
  openWorkbenchLink({section:'jev-mode',restore:{section:'jev-mode',label:'JEV 模式',frames:[{kind:'jev-mode',section:'jev-mode',label:'JEV 模式',view:{scroll:420}}]}})
  await render();expect(top).toBe(0)
  await act(async()=>{release();await delay()});expect(top).toBe(420)
  top=180;container.dispatchEvent(new Event('scroll'));expect(captureNavigation()?.frames.at(-1)?.view.scroll).toBe(180)
})
it('blocks invalid limits with inline explanations instead of sending invalid JSON',async()=>{
  await render();const input=container.querySelector<HTMLInputElement>('input[type="number"]')!;await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'2');input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}))})
  expect(container.textContent).toContain('超时应为 5–120 秒');expect(button('保存配置').disabled).toBe(true);expect(button('检查启用模型').disabled).toBe(true)
})
it('queries the selected conversation independently and distinguishes a fixed round from global settings',async()=>{
  saved.active=[{id:'round',scope:'native:old',revision:0,enabled:true,model:'lan/one',startedAt:new Date().toISOString(),checkingSince:new Date().toISOString(),stage:'review',phase:'checking'}];saved.config.revision=1
  await render(<JevActivity scope="native:old"/>);expect(requests.some(r=>r.url.endsWith('state?scope=native%3Aold'))).toBe(true);expect(container.textContent).toContain('正在结果复核');expect(container.textContent).toContain('下一轮生效')
})

