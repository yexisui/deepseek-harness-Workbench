// @vitest-environment jsdom
import React,{act} from 'react'
import {createRoot,type Root} from 'react-dom/client'
import {beforeEach,afterEach,it,expect,vi} from 'vitest'
import {KnowledgeLibraries} from '../src/client/KnowledgeLibraries.tsx'
import {KnowledgeSources} from '../src/client/KnowledgeSources.tsx'
vi.mock('../src/client/capability-client.ts',()=>({capabilityClient:{refresh:async()=>{},getSnapshot:()=>({data:{state:{roles:[]}}})},openCapabilityLink:vi.fn(),useCapabilities:()=>({data:{state:{roles:[]}}})}))
let host:HTMLDivElement,root:Root,writes:any[]=[],libraries:any[]=[]
beforeEach(()=>{(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;writes=[];libraries=[];host=document.createElement('div');document.body.append(host);root=createRoot(host);HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','')};HTMLDialogElement.prototype.close=function(){this.removeAttribute('open')};vi.stubGlobal('fetch',vi.fn(async(url:string,options?:RequestInit)=>{if(options?.method==='POST')writes.push(JSON.parse(String(options.body)));return {ok:true,json:async()=>url.includes('/libraries/document?')?{name:'报告.docx',status:'ready',storedVectors:4,dimension:4096,pendingUpdate:false,total:1,offset:0,parts:[{text:'账单合计18,828.57元',locator:'正文表1第2行',truncated:false}]}:url.endsWith('/knowledge/status')?{available:true,configured:true,providerId:'workbench-knowledge',collections:[{id:'lib-test',name:'产品资料'}]}:{revision:1,libraries,models:[{id:'configured/embed',name:'已配置向量模型',recommended:true}]}}}))})
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();vi.restoreAllMocks()})
const button=(name:string)=>Array.from(document.querySelectorAll('button')).find(b=>b.textContent===name)!
async function render(){await act(async()=>{root.render(<KnowledgeLibraries disabled={false} onChanged={async()=>{}} onSelect={()=>{}}/>);await new Promise(r=>setTimeout(r,10))})}
it('keeps database addresses and indexing settings out of the normal creation flow',async()=>{await render();expect(button('新建知识库')).toBeTruthy();await act(async()=>button('新建知识库').click());expect(document.body.querySelector('select')?.value).toBe('configured/embed');expect(document.body.querySelector('input[type=password]')).toBeNull();expect(document.body.textContent).not.toContain('Milvus服务地址');const advanced=Array.from(document.body.querySelectorAll('details')).find(d=>d.textContent?.includes('每段字符数'));expect(advanced?.open).toBe(false);expect(button('添加文件')).toBeTruthy();expect(button('选择目录')).toBeTruthy();await act(async()=>button('取消').click());expect(writes).toEqual([])})
it('makes remote service fields available only after explicit import/connect selection',async()=>{await render();await act(async()=>button('导入向量库').click());await act(async()=>Array.from(document.querySelectorAll('button')).find(b=>b.textContent?.includes('接入已有 Milvus 服务'))!.click());expect(document.body.querySelector('input[type=password]')).toBeTruthy();expect(document.body.textContent).toContain('Milvus服务地址');expect(document.body.querySelector('details')?.open).toBe(false);expect(writes).toEqual([])})
it('does not apply the template product name as an unsupported filter to a local library',async()=>{const changed=vi.fn(async()=>{});await act(async()=>{root.render(<KnowledgeSources product="新产品" disabled={false} allowed onChange={changed}/>);await new Promise(r=>setTimeout(r,10))});await act(async()=>button('添加知识库').click());await act(async()=>document.querySelector<HTMLInputElement>('input[type=checkbox]')!.click());await act(async()=>{button('确认加入').click();await Promise.resolve()});expect(changed).toHaveBeenCalledWith({providerId:'workbench-knowledge',collectionIds:['lib-test']})})

it('keeps the vector library list visible and exposes parsed Word content without a write',async()=>{
 libraries=[{id:'local',name:'Word报告',kind:'local',modelRef:'configured/embed',dimension:4096,collection:'kb_one',documents:[{id:'doc',name:'报告.docx',status:'ready',chunks:4,revision:'one'}],directories:[]},{id:'remote',name:'远端资料',kind:'milvus',modelRef:'configured/embed',documents:[],directories:[]}];
 await render();const list=document.body.querySelector('[aria-label="知识库列表"]')!;expect(list.textContent).toContain('知识库（2）');expect(list.textContent).toContain('4 个向量片段');expect(list.textContent).toContain('只读连接');
 await act(async()=>Array.from(list.querySelectorAll('button')).find(b=>b.textContent?.includes('Word报告'))!.click());expect(document.body.querySelector('[aria-label="知识库列表"]')).toBeTruthy();
 await act(async()=>{button('查看解析内容').click();await new Promise(r=>setTimeout(r,10))});expect(document.querySelector('dialog')?.textContent).toContain('账单合计18,828.57元');expect(writes).toEqual([]);
});
it('recognizes the original model and name from an imported vector package',async()=>{
 await render();await act(async()=>button('导入向量库').click());await act(async()=>Array.from(document.querySelectorAll('button')).find(b=>b.textContent?.includes('导入向量资料包（JSON'))!.click());
 const file=new File(['{}'],'蟹黄堡.json',{type:'application/json'});Object.defineProperty(file,'text',{value:async()=>JSON.stringify({modelRef:'configured/embed'})});const input=Array.from(document.body.querySelectorAll<HTMLInputElement>('input[type=file]')).find(i=>!i.hidden)!;Object.defineProperty(input,'files',{value:[file]});await act(async()=>{input.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,10))});
 expect(document.body.textContent).toContain('已选用资料包记录的原向量模型');expect(document.body.querySelector<HTMLInputElement>('input[placeholder="例如：产品说明、项目资料"]')?.value).toBe('蟹黄堡');expect(button('导入并使用').disabled).toBe(false);expect(writes).toEqual([]);await act(async()=>button('取消').click());
});

async function changeInput(input:HTMLInputElement|HTMLSelectElement,value:string){await act(async()=>{Object.getOwnPropertyDescriptor(input instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event(input instanceof HTMLSelectElement?'change':'input',{bubbles:true}))})}
async function clickText(name:string){await act(async()=>button(name).click())}
async function remote(){await clickText('导入向量库');await act(async()=>Array.from(document.querySelectorAll('button')).find(b=>b.textContent?.includes('接入已有 Milvus 服务'))!.click())}
const field=(text:string)=>Array.from(document.querySelectorAll('label')).find(l=>l.textContent?.startsWith(text))!.querySelector('input,select') as HTMLInputElement
it('cancels all new-library input without writing and reopens a clean draft',async()=>{
 await render();await clickText('新建知识库');expect(document.querySelector('dialog')).toBeTruthy();expect(button('管理模型 ↗')).toBeUndefined();
 await changeInput(field('知识库名称'),'取消的资料');await changeInput(field('每段字符数'),'1200');
 const picker=document.querySelector<HTMLInputElement>('input[type=file][multiple]')!;Object.defineProperty(picker,'files',{value:[new File(['one'],'未上传.docx')],configurable:true});await act(async()=>picker.dispatchEvent(new Event('change',{bubbles:true})));
 expect(document.querySelector('dialog')?.textContent).toContain('未上传.docx');await clickText('取消');expect(document.querySelector('dialog')).toBeNull();expect(writes).toEqual([]);
 await clickText('新建知识库');expect(field('知识库名称').value).toBe('');expect(field('每段字符数').value).toBe('900');expect(document.querySelector('dialog')?.textContent).not.toContain('未上传.docx');
});
it('resets remote database and field mapping after cancellation',async()=>{
 await render();await remote();await changeInput(field('数据库名称'),'private-db');await changeInput(field('向量字段'),'custom-vector');await changeInput(field('正文字段'),'custom-body');await changeInput(field('来源字段'),'custom-source');await changeInput(field('原库距离算法'),'L2');await changeInput(field('访问凭据'),'test-secret');await clickText('取消');
 await remote();expect(field('数据库名称').value).toBe('default');expect(field('向量字段').value).toBe('vector');expect(field('正文字段').value).toBe('text');expect(field('来源字段').value).toBe('');expect(field('原库距离算法').value).toBe('COSINE');expect(field('访问凭据').value).toBe('');expect(writes).toEqual([]);
});
it('discards a late bundle inspection after the form is cancelled',async()=>{
 await render();await clickText('导入向量库');await act(async()=>Array.from(document.querySelectorAll('button')).find(b=>b.textContent?.includes('导入向量资料包（JSON'))!.click());
 let finish!:(v:string)=>void;const file=new File(['{}'],'late.json');Object.defineProperty(file,'text',{value:()=>new Promise<string>(r=>{finish=r})});const input=document.querySelector<HTMLInputElement>('dialog input[type=file]')!;Object.defineProperty(input,'files',{value:[file]});await act(async()=>input.dispatchEvent(new Event('change',{bubbles:true})));
 await clickText('取消');await clickText('新建知识库');await act(async()=>{finish(JSON.stringify({modelRef:'unrelated/model'}));await Promise.resolve()});expect(field('知识库名称').value).toBe('');expect(document.body.textContent).not.toContain('unrelated/model');expect(writes).toEqual([]);
});
it('allows cancelling a model check and ignores its late response',async()=>{
 await render();await clickText('新建知识库');const original=globalThis.fetch;let finish!:(v:any)=>void;vi.stubGlobal('fetch',vi.fn((url:string,options?:RequestInit)=>url.endsWith('/embedding-check')?new Promise(r=>{finish=r}):original(url,options)));
 await clickText('测试模型');expect(button('取消').disabled).toBe(false);await clickText('取消');await clickText('新建知识库');await act(async()=>{finish({ok:true,json:async()=>({dimension:4096})});await Promise.resolve()});expect(document.body.textContent).not.toContain('模型调用成功');expect(button('测试模型').disabled).toBe(false);
});
it('keeps a submitted save open until the result and preserves input on failure',async()=>{
 await render();await clickText('新建知识库');await changeInput(field('知识库名称'),'保留草稿');const original=globalThis.fetch;let finish!:(v:any)=>void;vi.stubGlobal('fetch',vi.fn((url:string,options?:RequestInit)=>url.endsWith('/create')?new Promise(r=>{finish=r}):original(url,options)));
 await clickText('保存并建立索引');expect(button('取消').disabled).toBe(true);await act(async()=>document.querySelector('dialog')!.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));expect(document.querySelector('dialog')).toBeTruthy();
 await act(async()=>{finish({ok:false,json:async()=>({error:'模拟保存失败'})});await new Promise(r=>setTimeout(r,10))});expect(document.querySelector('dialog [role=alert]')?.textContent).toContain('模拟保存失败');expect(field('知识库名称').value).toBe('保留草稿');expect(button('取消').disabled).toBe(false);
});

const labelled=(name:string)=>document.querySelector<HTMLButtonElement>('button[aria-label="'+name+'"]')!;
it('expands details inside the library card and exposes a separate accessible recycle action',async()=>{
 libraries=[{id:'one',name:'资料甲',kind:'local',modelRef:'configured/embed',documents:[],directories:[]}];await render();expect(labelled('移入回收站：资料甲')).toBeTruthy();expect(document.querySelector('button button')).toBeNull();await act(async()=>labelled('展开知识库：资料甲').click());const card=document.querySelector('article')!;expect(card.querySelector('[id=library-detail-one]')?.textContent).toContain('添加资料');expect(document.body.textContent).not.toContain('← 收起资料详情');await act(async()=>labelled('收起知识库：资料甲').click());expect(card.querySelector('[id=library-detail-one]')).toBeNull();expect(writes).toEqual([]);
});
it('separates recycle, restore and permanent delete with cancellation and visible failure',async()=>{
 libraries=[{id:'one',name:'资料甲',kind:'local',modelRef:'configured/embed',documents:[],directories:[]}];const original=globalThis.fetch,paths:string[]=[];let fail=false;
 vi.stubGlobal('fetch',vi.fn(async(url:string,options?:RequestInit)=>{if(options?.method==='POST'){paths.push(url.split('/').at(-1)!);if(url.endsWith('/remove'))libraries[0].removedAt='2026-10-28T00:00:00Z';if(url.endsWith('/restore'))delete libraries[0].removedAt;if(url.endsWith('/purge')){if(fail)return {ok:false,json:async()=>({error:'删除失败，请重试'})};libraries=[]}}return original(url,options)}));
 await render();await act(async()=>labelled('移入回收站：资料甲').click());await clickText('取消');expect(paths).toEqual([]);await act(async()=>labelled('移入回收站：资料甲').click());await clickText('移入回收站');expect(paths).toEqual(['remove']);expect(labelled('移入回收站：资料甲')).toBeNull();await clickText('回收站（1）');expect(labelled('彻底删除知识库：资料甲')).toBeTruthy();await act(async()=>labelled('恢复知识库：资料甲').click());expect(paths).toEqual(['remove','restore']);await clickText('知识库（1）');await act(async()=>labelled('移入回收站：资料甲').click());await clickText('移入回收站');await clickText('回收站（1）');await act(async()=>labelled('彻底删除知识库：资料甲').click());expect(document.querySelector('dialog')?.textContent).toContain('无法恢复');fail=true;await clickText('彻底删除');expect(document.querySelector('dialog [role=alert]')?.textContent).toContain('删除失败');fail=false;await clickText('彻底删除');expect(libraries).toEqual([]);expect(document.body.textContent).toContain('回收站是空的');
});
it('disables removal while indexing and restoration after an interrupted purge',async()=>{
 libraries=[{id:'one',name:'处理中',kind:'local',modelRef:'configured/embed',documents:[],directories:[],job:{state:'running'}},{id:'two',name:'待清理',kind:'local',modelRef:'configured/embed',documents:[],directories:[],removedAt:'2026-10-28',purgeStartedAt:'2026-10-28'}];await render();expect(labelled('移入回收站：处理中').disabled).toBe(true);await clickText('回收站（1）');expect(labelled('恢复知识库：待清理').disabled).toBe(true);expect(labelled('彻底删除知识库：待清理').disabled).toBe(false);expect(writes).toEqual([]);
});
