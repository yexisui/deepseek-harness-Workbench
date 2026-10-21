import {SkillsCenter} from '../src/client/SkillsCenter.tsx'
import React,{act} from 'react'
import {createRoot,type Root} from 'react-dom/client'
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {ManagedPanel} from '../src/client/ManagedPanel.tsx'
let host:HTMLDivElement,root:Root,row:any,revision:number,calls:any[],fail:boolean
beforeEach(()=>{sessionStorage.clear();row={id:'skill-one',name:'review',description:'检查产品需求',root:'/skills',scope:'global',hash:'a'.repeat(64),enabled:true,auto:true,manual:true,category:'未分类',warnings:[],updatedAt:'2026-10-07T00:00:00Z'};revision=1;calls=[];fail=false
 HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','')};HTMLDialogElement.prototype.close=function(){this.removeAttribute('open')}
 vi.stubGlobal('fetch',vi.fn(async(url:string,options?:RequestInit)=>{const body=options?.body?JSON.parse(String(options.body)):undefined;calls.push({url,body});let data:any
 if(url.endsWith('/manage/list')){if(fail)return {ok:false,json:async()=>({error:'读取失败'})};data={revision,skills:[{...row}],projects:[]}}
 else if(url.endsWith('/manage/change')){if(body.revision!==revision)throw Error('stale');revision++;if(body.action==='remove'){row.removed=true;row.enabled=false}else if(body.action==='restore'){row.removed=false;row.enabled=false}else row[body.action]=body.value;data={ok:true}}
 else if(url.includes('/manage/detail'))data={content:'说明',files:['SKILL.md','references/template.md']}
 else if(url.includes('/manage/resource'))data={content:url.includes('references')?'<script>template</script>':'技能说明'}
 else if(url==='/api/capabilities/state')data={state:{roles:[{id:'role-one',draft:{name:'需求岗位',skills:[{id:row.id,hash:row.hash,enabled:true}]},versions:[{version:1,skills:[{id:row.id,hash:row.hash,enabled:true}]}]}]}}
 else if(url==='/api/dsh-skill-explorer/list')data={groups:[{title:'插件技能',skills:[{name:'remote',description:'来源说明',provider:'plugin-provider'}]}]}
 else throw Error('Unexpected '+url)
 return {ok:true,json:async()=>data}
 }));host=document.createElement('div');document.body.append(host);root=createRoot(host)
})
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();vi.restoreAllMocks();sessionStorage.clear()})
const buttons=()=>Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
async function click(label:string){await act(async()=>{const b=buttons().find(b=>b.getAttribute('aria-label')===label||b.textContent?.trim()===label);expect(b,label).toBeTruthy();b!.click()})}
async function mount(){await act(async()=>root.render(<ManagedPanel/>))}
it('uses compact shared rows and persists favorites without toggling invocation',async()=>{await mount();expect(host.querySelector('[data-managed-skill]')).toBeTruthy();expect(host.querySelector('[role=switch]')).toBeNull();await click('收藏技能：review');expect(row.pinned).toBe(true);expect(row.enabled).toBe(true);await click('收藏');expect(host.textContent).toContain('检查产品需求');await click('取消收藏：review');expect(host.querySelector('[data-managed-skill]')).toBeNull()})
it('preserves search on detail return, previews text safely and changes only the requested switch',async()=>{await mount();await act(async()=>{const input=host.querySelector<HTMLInputElement>('[aria-label="搜索技能"]')!;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'review');input.dispatchEvent(new Event('input',{bubbles:true}))});await click('管理技能：review');await click('启用技能 review');expect(row.enabled).toBe(false);expect(row.auto).toBe(true);await click('内容与资源');await click('references/template.md');expect(host.querySelector('pre')?.textContent).toBe('<script>template</script>');expect(host.querySelector('script')).toBeNull();await click('← 全部技能');expect(host.querySelector<HTMLInputElement>('[aria-label="搜索技能"]')!.value).toBe('review')})
it('shows current role references without version labels and opens the matching editor',async()=>{await mount();await click('管理技能：review');await click('岗位引用');expect(host.textContent).toContain('岗位中启用');expect(host.textContent).not.toContain('已发布 v1');expect(host.textContent).not.toContain('技术信息与版本');await click('编辑岗位：需求岗位 ↗');const link=JSON.parse(sessionStorage.getItem('workbench-capability-link')!);expect(link.restore.frames[0].view.id).toBe('role-one')})
it('confirms removal, retains the skill in the recycle bin, and restores disabled',async()=>{await mount();await click('管理技能：review');await click('移除技能：review');await click('取消');expect(row.removed).toBeUndefined();await click('移除技能：review');await click('确认移除');await click('← 全部技能');expect(host.querySelector('[data-managed-skill]')).toBeNull();await click('回收站');await click('管理技能：review');await click('恢复技能');expect(row.removed).toBe(false);expect(row.enabled).toBe(false)})
it('retains last good rows on refresh failure and gives other sources their own view',async()=>{await mount();fail=true;await click('刷新技能');expect(host.textContent).toContain('读取失败');expect(host.querySelector('[data-managed-skill]')).toBeTruthy();await click('其他来源技能');await click('查看其他来源技能：remote');expect(host.textContent).toContain('插件技能');expect(host.querySelector('[role=switch]')).toBeNull()})
it('uses the shared import dialog without adding a run preflight',async()=>{await mount();await click('导入技能');expect(document.querySelector('dialog')).toBeTruthy();expect(document.querySelector('dialog')?.textContent).toContain('选择压缩包 / SKILL.md');await click('取消');expect(document.querySelector('dialog')).toBeNull();expect(calls.every(c=>!c.url.includes('health'))).toBe(true)})

it('removes import scope and tag editing while keeping explicit usage choices',async()=>{await mount();await click('导入技能');expect(document.querySelector('dialog')?.textContent).not.toContain('工作台全局');expect(document.querySelector('dialog')?.querySelector('select')).toBeNull();await click('取消');await click('管理技能：review');expect(host.querySelector('[aria-label="技能使用范围"]')).toBeTruthy();expect(host.querySelector('[aria-label="添加技能标签"]')).toBeNull();const automatic=host.querySelector('[aria-label="允许 AI 自动选用 review"]');expect(automatic?.closest('details')?.open).toBe(false)})
it('removes from the list with confirmation and does not open details',async()=>{await mount();await click('移除技能：review');expect(row.removed).toBeUndefined();await click('取消');expect(host.querySelector('[data-managed-skill]')).toBeTruthy();await click('移除技能：review');await click('确认移除');expect(row.removed).toBe(true);expect(host.querySelector('[data-managed-skill]')).toBeNull()})

const skillRows=()=>[
 {...row,id:'review',name:'requirement-review',enabled:false,tags:[]},
 {...row,id:'estimate',name:'workload-estimator',tags:[]},
 {...row,id:'excel',name:'excel-generation-guidelines',tags:[]},
 {...row,id:'archive',name:'webpage-archive',tags:['网页采集','资料归档'],usage:'roles',pinned:true},
 {...row,id:'removed',name:'old-skill',removed:true,tags:[]},
]
async function mountRows(rows:any[]=skillRows()){
 const change=vi.fn();await act(async()=>root.render(<SkillsCenter snapshot={{revision:1,skills:rows,projects:[]}} busy={false} error="" onImport={vi.fn()} reload={vi.fn()} change={change}/>));return change
}
it('discards a persisted tag filter without hiding or changing skills',async()=>{
 sessionStorage.setItem('skills-center-view',JSON.stringify({category:'网页采集'}));const change=await mountRows();
 expect(host.querySelectorAll('[data-managed-skill]')).toHaveLength(4);
 expect(host.querySelector('[aria-label="技能筛选结果"]')?.textContent).toBe('显示 4 / 4 个技能');
 await click('筛选');expect(host.querySelector('[aria-label="技能标签筛选"]')).toBeNull();
 expect(host.querySelector('[aria-label="技能状态筛选"]')).toBeTruthy();expect(host.querySelector('[aria-label="技能范围筛选"]')).toBeTruthy();
 expect(host.querySelector('[data-managed-skill="review"]')?.textContent).toContain('已停用');
 expect(change).not.toHaveBeenCalled();expect(JSON.parse(sessionStorage.getItem('skills-center-view')!).category).toBeUndefined();
})
it('keeps compact rows and existing metadata without exposing tag management',async()=>{
 const rows=skillRows(),before=JSON.stringify(rows),change=await mountRows(rows);const entries=Array.from(host.querySelectorAll('[data-managed-skill]'));
 expect(entries).toHaveLength(4);expect(entries[0].parentElement?.children).toHaveLength(4);
 expect(buttons().some(b=>['管理标签','网页采集','资料归档'].includes(b.textContent??''))).toBe(false);
 await click('管理技能：webpage-archive');expect(host.querySelector('[aria-label="添加技能标签"]')).toBeNull();expect(host.textContent).not.toContain('网页采集');
 await click('← 全部技能');expect(host.querySelectorAll('[data-managed-skill]')).toHaveLength(4);
 expect(JSON.stringify(rows)).toBe(before);expect(change).not.toHaveBeenCalled();
})
it('discards legacy tags when restoring initial and live navigation while preserving valid filters',async()=>{
 const restore={section:'skills',label:'Skills 技能',frames:[{kind:'skills',section:'skills',label:'Skills 技能',view:{category:'网页采集',status:'disabled'}}]};
 sessionStorage.setItem('workbench-capability-link',JSON.stringify({section:'skills',restore}));const change=await mountRows();
 expect(host.querySelectorAll('[data-managed-skill]')).toHaveLength(1);expect(host.querySelector('[data-managed-skill="review"]')).toBeTruthy();
 restore.frames[0].view.status='all';
 await act(async()=>{window.dispatchEvent(new CustomEvent('workbench-capability-link',{detail:{section:'skills',restore}}))});
 expect(host.querySelectorAll('[data-managed-skill]')).toHaveLength(4);expect(JSON.parse(sessionStorage.getItem('skills-center-view')!).category).toBeUndefined();expect(change).not.toHaveBeenCalled();
})
it('searches names and descriptions without matching hidden tag metadata',async()=>{
 await mountRows();const input=host.querySelector<HTMLInputElement>('[aria-label="搜索技能"]')!;
 expect(input.placeholder).toBe('搜索技能名称或用途');
 async function search(value:string){await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}))})}
 await search('资料归档');expect(host.querySelectorAll('[data-managed-skill]')).toHaveLength(0);
 await search('webpage');expect(host.querySelectorAll('[data-managed-skill]')).toHaveLength(1);
 await search('检查产品需求');expect(host.querySelectorAll('[data-managed-skill]')).toHaveLength(4);
})
it('offers recovery for an empty status-only filter without suggesting reimport',async()=>{
 sessionStorage.setItem('skills-center-view',JSON.stringify({status:'disabled'}));const change=await mountRows(skillRows().map(r=>({...r,enabled:true})));
 expect(host.querySelectorAll('[data-managed-skill]')).toHaveLength(0);expect(host.textContent).toContain('状态：已停用');
 expect(buttons().filter(b=>b.textContent==='导入技能')).toHaveLength(1);
 await click('显示全部');expect(host.querySelectorAll('[data-managed-skill]')).toHaveLength(4);expect(change).not.toHaveBeenCalled();
})
it('clears search, favorites, status and scope together while keeping the recycle bin separate',async()=>{
 sessionStorage.setItem('skills-center-view',JSON.stringify({query:'webpage',filter:'pinned',status:'enabled',category:'网页采集',scope:'roles'}));await mountRows();
 expect(host.querySelectorAll('[data-managed-skill]')).toHaveLength(1);await click('显示全部');
 expect(host.querySelectorAll('[data-managed-skill]')).toHaveLength(4);expect(host.querySelector<HTMLInputElement>('[aria-label="搜索技能"]')?.value).toBe('');
 await click('回收站');expect(host.querySelectorAll('[data-managed-skill]')).toHaveLength(1);expect(host.textContent).toContain('old-skill');
 await click('← 全部技能');expect(host.querySelectorAll('[data-managed-skill]')).toHaveLength(4);
})
