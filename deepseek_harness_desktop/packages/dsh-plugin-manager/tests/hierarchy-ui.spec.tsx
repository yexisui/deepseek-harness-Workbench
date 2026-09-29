// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { InventoryTree } from '../src/client/InventoryTree.tsx'
import { LocalPluginImport } from '../src/client/LocalPluginImport.tsx'
import { initialClassification } from '../src/core/classification.ts'
import seed from '../src/core/classification-seed.json'
const entries=seed.rows.map(e=>({...e,enabled:true,fiberPhase:'active'}))
beforeEach(()=>localStorage.clear())
afterEach(()=>{cleanup();vi.unstubAllGlobals()})
function tree(){
 let classification=initialClassification(entries)
 const fetch=vi.fn(async(url:string,init?:RequestInit)=>{if(url.endsWith('/pending'))return new Response(JSON.stringify({entries:[]}));if(init?.method==='POST')classification={...JSON.parse(init.body as string),revision:1};return new Response(JSON.stringify({classification}))})
 vi.stubGlobal('fetch',fetch)
 const list=vi.fn(async()=>({entries,agentPresets:[{id:'chat',name:'普通聊天',isDefault:true,rows:[{entryId:'persona',moduleName:'persona',enabled:true,fiberPhase:'active'}]}]}))
 render(<InventoryTree list={list}/>);return {fetch,list}
}
it('starts with folded global layers and the session section folds on its first click',async()=>{tree();const global=await screen.findByRole('button',{name:/全局插件/});expect(global.getAttribute('aria-expanded')).toBe('false');const sessions=screen.getByRole('button',{name:/会话插件/});fireEvent.click(sessions);expect(sessions.getAttribute('aria-expanded')).toBe('false');fireEvent.click(global);expect(screen.getByRole('button',{name:/底层插件/}).getAttribute('aria-expanded')).toBe('false');expect(screen.getByRole('button',{name:/工作台扩展/})).toBeTruthy()})
it('search opens relevant groups and restores the previous fold state after clearing',async()=>{tree();await screen.findByRole('button',{name:/全局插件/});const search=screen.getByRole('searchbox');fireEvent.change(search,{target:{value:'框架'}});expect(screen.getByRole('button',{name:/全局插件/}).getAttribute('aria-expanded')).toBe('true');expect(screen.queryByRole('button',{name:/工作台扩展/})).toBeNull();fireEvent.change(search,{target:{value:''}});expect(screen.getByRole('button',{name:/全局插件/}).getAttribute('aria-expanded')).toBe('false')})
it('cancels category edits without writing and persists an explicitly saved rename',async()=>{const {fetch}=tree();await screen.findByRole('button',{name:/全局插件/});fireEvent.click(screen.getByRole('button',{name:'管理分类'}));fireEvent.change(screen.getAllByLabelText('分组名称')[0]!,{target:{value:'我的底座'}});fireEvent.click(screen.getByRole('button',{name:'取消修改'}));expect(fetch.mock.calls.filter(([,init])=>init?.method==='POST')).toHaveLength(0);fireEvent.click(screen.getByRole('button',{name:'管理分类'}));fireEvent.change(screen.getAllByLabelText('分组名称')[0]!,{target:{value:'我的底座'}});fireEvent.click(screen.getByRole('button',{name:'保存分类'}));await waitFor(()=>expect(fetch.mock.calls.filter(([,init])=>init?.method==='POST')).toHaveLength(1));await waitFor(()=>expect(screen.queryByLabelText('分类编辑器')).toBeNull())})
it('uploads a ZIP, shows a preflight, and only installs after explicit confirmation',async()=>{
 const onChange=vi.fn(async()=>{}),calls:string[]=[]
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>{calls.push(url);const data=url.endsWith('/start')?{uploadId:'upload'}:url.endsWith('/inspect')?{preview:{id:'local-demo',name:'本地示例',version:'1.0.0',hash:'hash',entries:[{id:'demo',name:'local-demo'}],fileCount:3,totalBytes:100,shared:[],bundled:[],scriptsSkipped:[],platform:'win32/x64',disposition:'new'}}:url.endsWith('/commit')?{jobId:'job'}:url.includes('/status')?{job:{phase:'done'}}:{};return new Response(JSON.stringify(data))}))
 const view=render(<LocalPluginImport onChange={onChange}/>),input=view.container.querySelector('input[type=file]')!
 fireEvent.change(input,{target:{files:[new File(['zip'],'demo.zip',{type:'application/zip'})]}})
 await screen.findByRole('dialog',{name:'确认本地插件导入'});expect(calls.some(url=>url.endsWith('/commit'))).toBe(false)
 fireEvent.click(screen.getByRole('button',{name:'确认安装'}));await waitFor(()=>expect(onChange).toHaveBeenCalledTimes(1));expect(await screen.findByText(/本地安装完成/)).toBeTruthy()
})
it('shows preflight failures without submitting an install',async()=>{
 const calls:string[]=[];vi.stubGlobal('fetch',vi.fn(async(url:string)=>{calls.push(url);return new Response(JSON.stringify(url.endsWith('/start')?{uploadId:'upload'}:url.endsWith('/inspect')?{error:'离线包缺少依赖 helper'}:{}),{status:url.endsWith('/inspect')?400:200})}))
 const view=render(<LocalPluginImport onChange={async()=>{}}/>);fireEvent.change(view.container.querySelector('input[type=file]')!,{target:{files:[new File(['zip'],'demo.zip')]}})
 expect(await screen.findByRole('alert')).toBeTruthy();expect(calls.some(url=>url.endsWith('/commit'))).toBe(false)
})
