// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import { FileSearchForm } from '../../../shared/client/FileSearchForm.tsx'
import { createFileSearchClient } from '../../../shared/client/file-search-client.ts'
import { FileSearchSettings } from '../src/client/FileSearchSettings.tsx'
import { roleCapabilityModes } from '../src/client/role-capability-modes.ts'
import { initialState, fileSearchCapability } from '../../dsh-capabilities/src/core/model.ts'
let root: Root, host: HTMLDivElement
beforeEach(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;host=document.createElement('div');document.body.append(host);root=createRoot(host);window.workbenchFileSearch=createFileSearchClient() })
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();delete (window as any).desktop;delete window.workbenchFileSearch})
it('commits only confirmed native folder selections and preserves cancellation, query and global search',async()=>{
 const client=window.workbenchFileSearch!,pick=vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce('C:\\资料')
 ;(window as any).desktop={selectSearchDirectory:pick};client.draft({path:'C:\\old',query:'会议'})
 await act(async()=>root.render(<FileSearchForm compact/>))
 const button=()=>host.querySelector<HTMLButtonElement>('[aria-label="选择搜索文件夹"]')!
 await act(async()=>button().click());expect(client.getSnapshot().path).toBe('C:\\old');expect(client.getSnapshot().query).toBe('会议')
 await act(async()=>button().click());expect(client.getSnapshot().path).toBe('C:\\资料');expect(pick.mock.calls[0]?.[0]).toBe('C:\\old')
 const calls:any[]=[];vi.stubGlobal('fetch',vi.fn(async(_url,init)=>{const body=JSON.parse(init.body);calls.push(body);return {ok:true,json:async()=>({...body,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),items:[]})}}))
 await act(async()=>{client.draft({path:''});host.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await new Promise(ok=>setTimeout(ok,0))})
 expect(calls[0].path).toBe('');expect(calls[0].query).toBe('会议');vi.unstubAllGlobals()
})
it('settings cancellation never posts an unsaved role and search mode is exposed through the shared role catalog',async()=>{
 const config={roleId:'r1',roles:[{id:'r1',name:'文件搜索助手'},{id:'r2',name:'另一个岗位'}],ready:true,engine:{state:'ready',message:'已连接'}}
 const fetcher=vi.fn(async(_url:unknown,_init?:any)=>({ok:true,json:async()=>config}));vi.stubGlobal('fetch',fetcher)
 await act(async()=>root.render(<FileSearchSettings/>))
 const select=host.querySelector('select')!;await act(async()=>{select.value='r2';select.dispatchEvent(new Event('change',{bubbles:true}))})
 await act(async()=>Array.from(host.querySelectorAll('button')).find(b=>b.textContent==='取消')!.click())
 expect(select.value).toBe('r1');expect(fetcher.mock.calls.every(call=>call.length===1||!(call as any)[1]?.method)).toBe(true)
 const state=initialState();state.capabilities.push(fileSearchCapability('now'));const version={...state.roles[0]!.versions[0]!,capabilities:[{capabilityId:'local-file-search',version:1,enabled:true}]}
 expect(roleCapabilityModes(state,version).map(m=>m.mode)).toEqual(['chat','file-search']);vi.unstubAllGlobals()
})
