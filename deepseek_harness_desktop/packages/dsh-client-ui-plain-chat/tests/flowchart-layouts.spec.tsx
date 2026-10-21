// @vitest-environment jsdom
import React,{act} from 'react'
import {createRoot, type Root} from 'react-dom/client'
import {afterEach,expect,it,vi} from 'vitest'
import {FlowchartLayoutPicker,flowchartId} from '../src/client/FlowchartLayouts.tsx'
const id='11111111-1111-1111-1111-111111111111'
let container:HTMLDivElement,root:Root
const data={selected:'standard',layouts:[{id:'standard',name:'标准纵向',description:'标准',available:true,previewUrl:'/standard.svg'},{id:'horizontal',name:'横向展开',description:'横向',available:true,previewUrl:'/horizontal.svg'},{id:'snake',name:'蛇形折返',description:'蛇形',available:false,reason:'当前流程包含分支',previewUrl:'/snake.svg'}]}
afterEach(async()=>{if(root)await act(async()=>root.unmount());container?.remove();vi.unstubAllGlobals()})
async function mount(){vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);container=document.createElement('div');document.body.append(container);root=createRoot(container);const changed=vi.fn();await act(async()=>root.render(<FlowchartLayoutPicker id={id} onChange={changed}/>));return changed}
async function click(selector:string){await act(async()=>{document.querySelector<HTMLButtonElement>(selector)!.click();await new Promise(r=>setTimeout(r,0))})}
it('loads actual thumbnails, explains unavailable choices, applies layout and supports Escape',async()=>{
 const fetch=vi.fn(async(_url:string,options:any)=>new Response(JSON.stringify(options?.method==='POST'?{...data,selected:'horizontal'}:data)));vi.stubGlobal('fetch',fetch);const changed=await mount();await click('[aria-label="切换流程图布局"]');expect(document.querySelectorAll('img')).toHaveLength(2);expect(document.body.textContent).toContain('当前流程包含分支');expect(document.querySelector<HTMLButtonElement>('[title="当前流程包含分支"]')!.disabled).toBe(true);
 await click('[title="横向"]');expect(changed).toHaveBeenCalledOnce();expect(fetch.mock.calls[1][0].endsWith('/layout')).toBe(true);expect(JSON.parse(fetch.mock.calls[1][1].body).style).toBe('horizontal');expect(document.querySelector('[title="横向"]')?.getAttribute('aria-pressed')).toBe('true');
 await act(async()=>document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));expect(document.querySelector('[role="dialog"]')).toBeNull();expect(document.activeElement?.getAttribute('aria-label')).toBe('切换流程图布局');
});
it('failed selection keeps the previous selected layout and shows a retryable error',async()=>{
 vi.stubGlobal('fetch',vi.fn(async(_url:string,options:any)=>new Response(JSON.stringify(options?.method==='POST'?{error:'保存失败，原图保留'}:data),{status:options?.method==='POST'?400:200})));const changed=await mount();await click('[aria-label="切换流程图布局"]');await click('[title="横向"]');expect(changed).not.toHaveBeenCalled();expect(document.querySelector('[title="标准"]')?.getAttribute('aria-pressed')).toBe('true');expect(document.querySelector('[role="alert"]')?.textContent).toContain('原图保留');
});
it('only recognizes same-origin flowchart artifacts',()=>{expect(flowchartId('http://localhost/api/capabilities/packages/artifact/'+id+'/image.svg','http://localhost')).toBe(id);expect(flowchartId('https://other.example/api/capabilities/packages/artifact/'+id+'/image.svg','http://localhost')).toBeNull();expect(flowchartId('/ordinary.png','http://localhost')).toBeNull()});
