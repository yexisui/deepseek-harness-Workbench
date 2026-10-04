// @vitest-environment jsdom
import React, {act} from 'react'
import {createRoot} from 'react-dom/client'
import {expect,it,vi} from 'vitest'
import {registerComponentInventory} from '../src/client/component-inventory-slot.tsx'
import {initialState,components} from '../../dsh-capabilities/src/core/model.ts'
import {initialClassification} from '../../dsh-plugin-manager/src/core/classification.ts'

it('keeps aggregate slot services and returns to the exact component through the shared inventory',async()=>{
 ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;sessionStorage.clear()
 function InventoryTree(){return <p>旧聚合清单</p>}
 const entries=[{component:InventoryTree,inject:()=>({list}),children:{stable:{}}}],owner=entries[0]!.inject,children=entries[0]!.children
 const rows=[{moduleName:'@linxin666/dsh-capabilities',entryId:'capabilities',enabled:true,fiberPhase:'active' as const},{moduleName:'unrelated',entryId:'other',enabled:true,fiberPhase:'active' as const}]
 const list=async()=>({entries:rows}),data={state:initialState(),components,tasks:[]},classification=initialClassification(rows)
 vi.stubGlobal('fetch',vi.fn(async(path:string)=>({ok:true,json:async()=>path.endsWith('/state')?data:path.endsWith('/pending')?{entries:[],origins:[]}:{classification}})))
 sessionStorage.setItem('workbench-capability-link',JSON.stringify({section:'plugins',componentId:'developer-files',moduleName:'@linxin666/dsh-capabilities'}))
 const dispose=registerComponentInventory({entries:()=>entries,subscribe:()=>()=>{}}),container=document.createElement('div');document.body.append(container);const root=createRoot(container)
 const Received=entries[0]!.component as React.ComponentType<any>,links:unknown[]=[];const listener=(event:Event)=>links.push((event as CustomEvent).detail);window.addEventListener('workbench-capability-link',listener)
 try{
  await act(async()=>{root.render(<Received list={list}/>);await new Promise(resolve=>setTimeout(resolve,20))})
  expect(entries[0]!.inject).toBe(owner);expect(entries[0]!.children).toBe(children)
  expect(container.textContent).not.toContain('unrelated');expect(container.textContent).toContain('当前组件：项目文件与开发对话')
  const back=Array.from(container.querySelectorAll('button')).find(button=>button.textContent==='← 返回组件中心')!;expect(back).toBeTruthy()
  await act(async()=>back.click());expect(links.at(-1)).toMatchObject({section:'component-center',componentId:'developer-files',tab:'plugins'})
 }finally{await act(async()=>root.unmount());container.remove();window.removeEventListener('workbench-capability-link',listener);dispose();sessionStorage.clear();vi.unstubAllGlobals()}
 expect(entries[0]!.component).toBe(InventoryTree)
})
