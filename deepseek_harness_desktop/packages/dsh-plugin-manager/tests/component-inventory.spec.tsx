// @vitest-environment jsdom
import React from 'react'
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, it, expect, vi } from 'vitest'
import { InventoryTree } from '../src/client/InventoryTree.tsx'
import { CapabilityReferences } from '../src/client/CapabilityReferences.tsx'
import { entryKey, initialClassification, type InventoryEntry } from '../src/core/classification.ts'
import { components, initialState, type Snapshot } from '../../dsh-capabilities/src/core/model.ts'
import { emptyRegistry } from '../../dsh-capabilities/src/core/component-registry.ts'
const row=(moduleName:string,entryId=moduleName):InventoryEntry=>({moduleName,entryId,enabled:true,fiberPhase:'active'})
const rows=[row('@deepseek-ai/dsh-agent','include:agent'),row('@deepseek-ai/dsh-tools','include:tools'),row('@linxin666/dsh-capabilities','workbench-capabilities'),row('@linxin666/dsh-capabilities/browser','browser-authority'),row('unrelated','test')]
const data:Snapshot={compositionVersion:2,state:initialState(),components,tasks:[],registry:emptyRegistry(),health:{checkedAt:null,installed:true,loaded:true,state:'unknown',message:'未检测',browsers:[]}}
beforeEach(()=>{localStorage.clear();sessionStorage.clear();const classification=initialClassification(rows);classification.groups[0]!.name='自定义底层分类';vi.stubGlobal('fetch',vi.fn(async(path:string)=>new Response(JSON.stringify(path.endsWith('/state')?data:path.endsWith('/pending')?{entries:[],origins:[]}:{classification}))))})
afterEach(()=>{cleanup();vi.unstubAllGlobals()})
it('reuses saved taxonomy and only counts current component rows, including its preset scope',async()=>{render(<InventoryTree compact componentId="browserskill" componentData={data} list={async()=>({entries:rows,agentPresets:[{id:'browser',name:'浏览器预设',rows:[row('@linxin666/dsh-capabilities/browser','seat')]},{id:'other',name:'其他预设',rows:[row('unrelated')]}]})}/>);const group=await screen.findByRole('button',{name:/自定义底层分类/});expect(group.getAttribute('aria-expanded')).toBe('true');expect(screen.getByRole('button',{name:/当前组件相关插件/}).textContent).toContain('3');expect(screen.queryByRole('button',{name:'管理分类'})).toBeNull();expect(screen.queryByRole('option',{name:'其他预设'})).toBeNull();expect(screen.queryByText('unrelated')).toBeNull();expect(screen.getByRole('button',{name:/Agent 执行与上下文/}).getAttribute('aria-expanded')).toBe('false')})
it('searches within the component and restores module folds on clear',async()=>{render(<InventoryTree compact componentId="browserskill" componentData={data} list={async()=>({entries:rows})}/>);await screen.findByRole('button',{name:/当前组件相关插件/});fireEvent.change(screen.getByRole('searchbox'),{target:{value:'dsh-agent'}});expect(screen.getByText('运行支持 · 必需')).toBeTruthy();expect(screen.queryByText('dsh-capabilities')).toBeNull();fireEvent.change(screen.getByRole('searchbox'),{target:{value:''}});expect(screen.getByRole('button',{name:/Agent 执行与上下文/}).getAttribute('aria-expanded')).toBe('false')})
it('unions parent package references and keeps child export references distinct',()=>{const first=render(<CapabilityReferences moduleName="@linxin666/dsh-capabilities" data={data}/>);expect(screen.getByText(/关联能力 3/)).toBeTruthy();first.unmount();render(<CapabilityReferences moduleName="@linxin666/dsh-capabilities/browser" data={data}/>);expect(screen.getByText(/关联能力 1/)).toBeTruthy();expect(screen.queryByText('开发工作区 ↗')).toBeNull()})
it('restores component plugin search, preset choice and identity/reference folds after leaving the detail',async()=>{
 const list=async()=>({entries:rows,agentPresets:[{id:'first',name:'第一预设',rows:[row('@linxin666/dsh-capabilities/browser','first-seat')]},{id:'second',name:'第二预设',rows:[row('@linxin666/dsh-capabilities/browser','second-seat')]}]})
 const view=<InventoryTree compact componentId="browserskill" componentData={data} list={list}/>,first=render(view)
 await screen.findByRole('combobox',{name:'会话插件预设'})
 fireEvent.change(screen.getByRole('combobox',{name:'会话插件预设'}),{target:{value:'second'}})
 fireEvent.change(screen.getByRole('searchbox'),{target:{value:'dsh-capabilities/browser'}})
 const details=first.container.querySelector('[data-plugin-scope=global] [data-entry-id="browser-authority"]')!.querySelectorAll('details')
 for(const item of details){item.open=true;fireEvent(item,new Event('toggle'))}
 await waitFor(()=>expect(JSON.parse(sessionStorage.getItem('component-plugin-view:browserskill')!).opened['references:global:browser-authority']).toBe(true))
 first.unmount();const reopened=render(view)
 await screen.findByRole('combobox',{name:'会话插件预设'})
 expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('dsh-capabilities/browser')
 expect((screen.getByRole('combobox',{name:'会话插件预设'}) as HTMLSelectElement).value).toBe('second')
 expect(Array.from(reopened.container.querySelector('[data-plugin-scope=global] [data-entry-id="browser-authority"]')!.querySelectorAll('details')).every(item=>item.open)).toBe(true)
 reopened.unmount();render(<InventoryTree compact componentId="developer-files" componentData={data} list={list}/>)
 await screen.findByRole('button',{name:/当前组件相关插件/});expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('')
})
