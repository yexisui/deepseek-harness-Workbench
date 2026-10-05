// @vitest-environment jsdom
import React from 'react'
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react'
import {LocalPluginImport} from '../src/client/LocalPluginImport.tsx'
import {pluginResponse} from '../src/client/plugin-request.ts'
beforeEach(()=>{
 Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(this:HTMLDialogElement){this.setAttribute('open','')}})
 Object.defineProperty(HTMLDialogElement.prototype,'close',{configurable:true,value:function(this:HTMLDialogElement){this.removeAttribute('open')}})
})
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals()})
const preview={id:'test-plugin',name:'测试插件',version:'1.0.0',hash:'hash',entries:[{id:'test-entry',name:'test-plugin'}],fileCount:3,totalBytes:120,shared:[],bundled:[],scriptsSkipped:[],platform:'win32',disposition:'new',requiresRestart:true}
function setup(){
 const calls:string[]=[],onChange=vi.fn(async()=>{}),onImported=vi.fn()
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>{calls.push(url);return new Response(JSON.stringify(url.endsWith('/start')?{uploadId:'upload-1'}:url.endsWith('/inspect')?{preview}:url.endsWith('/commit')?{jobId:'job-1'}:url.includes('/status?')?{job:{phase:'done'}}:{}))}))
 const view=render(<LocalPluginImport compact onChange={onChange} onImported={onImported}/>);return {view,calls,onChange,onImported}
}
it('uses a small disclosure, hides the form initially and supports Escape',()=>{
 setup();expect(screen.queryByRole('dialog')).toBeNull();expect(screen.queryByRole('button',{name:'导入 ZIP 压缩包'})).toBeNull()
 const button=screen.getByRole('button',{name:'导入插件'});fireEvent.click(button)
 expect(screen.getByRole('button',{name:'选择插件文件夹'})).toBeTruthy()
 fireEvent.keyDown(button,{key:'Escape'});expect(screen.queryByRole('group')).toBeNull()
})
it('previews ZIP before explicit installation and reports imported entries',async()=>{
 const t=setup();fireEvent.change(t.view.container.querySelector('input[type=file]')!,{target:{files:[new File(['zip'],'test.zip')]}})
 await screen.findByRole('button',{name:'确认安装'});expect(t.calls.some(x=>x.endsWith('/commit'))).toBe(false)
 expect(screen.getByRole('dialog',{name:'导入本地插件'})).toBeTruthy()
 fireEvent.click(screen.getByRole('button',{name:'确认安装'}));await waitFor(()=>expect(t.onImported).toHaveBeenCalledWith(preview))
 expect(t.onChange).toHaveBeenCalledOnce();await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull())
})
it('folder import cancellation discards staging without installing',async()=>{
 const t=setup(),file=new File(['content'],'index.js');Object.defineProperty(file,'webkitRelativePath',{value:'plugin/index.js'})
 fireEvent.change(t.view.container.querySelector('input[webkitdirectory]')!,{target:{files:[file]}})
 await screen.findByRole('button',{name:'确认安装'});fireEvent.click(screen.getByRole('button',{name:'取消'}))
 await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());expect(t.calls.some(x=>x.endsWith('/discard'))).toBe(true);expect(t.calls.some(x=>x.endsWith('/commit'))).toBe(false)
})
it('blocks close while uploading then permits closing a failed import',async()=>{
 let finish!:(r:Response)=>void
 vi.stubGlobal('fetch',vi.fn(()=>new Promise<Response>(resolve=>{finish=resolve})))
 const view=render(<LocalPluginImport compact onChange={async()=>{}}/>);fireEvent.change(view.container.querySelector('input')!,{target:{files:[new File(['zip'],'test.zip')]}})
 expect((screen.getByRole('button',{name:'关闭导入'}) as HTMLButtonElement).disabled).toBe(true)
 await waitFor(()=>expect(finish).toBeTypeOf('function'));finish(new Response('not found',{status:404}));await screen.findByRole('alert');expect(screen.getByRole('alert').textContent).toContain('重新打开工作台')
 fireEvent.click(screen.getByRole('button',{name:'关闭导入'}));await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull())
})
it('maps plain-text missing routes and expired sessions to actionable errors',async()=>{
 await expect(pluginResponse(new Response('not found',{status:404}))).rejects.toThrow('接口尚未加载')
 await expect(pluginResponse(new Response('unauthorized',{status:401}))).rejects.toThrow('连接已失效')
 await expect(pluginResponse(new Response('<html>error</html>',{status:502}))).rejects.toThrow('无法识别的响应')
 await expect(pluginResponse(new Response('{"error":"模型调用失败"}',{status:400}))).rejects.toThrow('模型调用失败')
})
