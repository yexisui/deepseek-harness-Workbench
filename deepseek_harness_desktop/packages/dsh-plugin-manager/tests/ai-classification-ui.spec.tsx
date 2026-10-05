// @vitest-environment jsdom
import React from 'react'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { InventoryTree } from '../src/client/InventoryTree.tsx'
import { initialClassification, entryKey } from '../src/core/classification.ts'
import type { ClassificationJob, ClassificationReport } from '../src/core/ai-classification.ts'
const entries=[{entryId:'include:custom',moduleName:'@custom/browser',enabled:false,fiberPhase:'pending-restart'}]
beforeEach(()=>{localStorage.clear();sessionStorage.clear()})
afterEach(()=>{cleanup();vi.unstubAllGlobals()})
function setup(compact=false){
 let classification=initialClassification(entries),job:ClassificationJob|undefined,report:ClassificationReport|undefined
 const calls:string[]=[]
 vi.stubGlobal('fetch',vi.fn(async(url:string,init?:RequestInit)=>{
   calls.push(url)
   if(url.endsWith('/pending'))return new Response(JSON.stringify({entries:[],origins:[]}))
   if(url.endsWith('/capabilities/state'))return new Response('{}')
   if(url.endsWith('/ai/status'))return new Response(JSON.stringify({job,report}))
   if(url.endsWith('/ai/start')){job={id:JSON.parse(init!.body as string).id,phase:'running',total:1,processed:0,model:'第一个模型'};return new Response(JSON.stringify(job))}
   if(url.endsWith('/ai/cancel')){job={...job!,phase:'cancelled'};return new Response(JSON.stringify({job,report}))}
   if(url.endsWith('/ai/undo')){report={...report!,undone:true,results:report!.results.map(r=>({...r,status:'undone'}))};classification.assignments={};job={...job!,report};return new Response(JSON.stringify({job,report}))}
   return new Response(JSON.stringify({classification}))
 }))
 const view=render(<InventoryTree list={async()=>({entries,agentPresets:[]})} compact={compact}/>)
 return {view,calls,complete:()=>{classification.assignments[entryKey(entries[0]!) ]='core-10';report={id:job!.id,model:job!.model,createdAt:new Date().toISOString(),results:[{key:entryKey(entries[0]!),name:'@custom/browser',moduleId:'core-10',target:'底层插件 → 联网搜索与网页读取',reason:'提供网页读取',status:'applied'}]};job={...job!,phase:'done',processed:1,report}}}
}
it('shows an independent action beside undefined, saves feedback and supports undo',async()=>{
 const t=setup();fireEvent.click(await screen.findByRole('button',{name:/全局插件/}))
 const fold=screen.getByRole('button',{name:'展开未定义区'});expect(fold.getAttribute('aria-expanded')).toBe('false')
 fireEvent.click(screen.getByRole('button',{name:'AI 自动分类'}));await screen.findByText(/使用：第一个模型/)
 expect(fold.getAttribute('aria-expanded')).toBe('false');expect((screen.getByRole('button',{name:'管理分类'}) as HTMLButtonElement).disabled).toBe(true)
 t.complete();await waitFor(()=>expect(screen.getByText('已分类 1 项')).toBeTruthy(),{timeout:3500})
 fireEvent.click(screen.getByText('查看分类结果'));expect(screen.getByText('底层插件 → 联网搜索与网页读取')).toBeTruthy()
 fireEvent.click(screen.getByRole('button',{name:'撤销本次分类'}));await screen.findByText('已撤销 1 项')
})
it('blocks AI during manual edits and leaves cancellation results unassigned',async()=>{
 setup();fireEvent.click(await screen.findByRole('button',{name:/全局插件/}));fireEvent.click(screen.getByRole('button',{name:'管理分类'}))
 expect((screen.getByRole('button',{name:'AI 自动分类'}) as HTMLButtonElement).disabled).toBe(true)
 fireEvent.click(screen.getByRole('button',{name:'取消修改'}));fireEvent.click(screen.getByRole('button',{name:'AI 自动分类'}));await screen.findByText(/使用：第一个模型/)
 fireEvent.click(screen.getByRole('button',{name:'取消分类'}));await screen.findByText(/已取消/);expect(screen.queryByText('已分类 1 项')).toBeNull()
})
it('does not expose the global AI action in the shared compact component inventory',async()=>{
 const t=setup(true);await screen.findByRole('button',{name:/当前组件相关插件/});expect(screen.queryByRole('button',{name:'AI 自动分类'})).toBeNull();expect(t.calls.some(p=>p.includes('/ai/'))).toBe(false)
})
it('search does not hide the unclassified action or narrow its scope',async()=>{
 setup();await screen.findByRole('button',{name:/全局插件/});fireEvent.change(screen.getByRole('searchbox'),{target:{value:'does-not-match'}})
 expect(screen.getByRole('button',{name:'AI 自动分类'}).getAttribute('title')).toContain('全部 1 项')
})
