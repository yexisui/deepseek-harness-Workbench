import React,{act} from 'react'
import {createRoot,type Root} from 'react-dom/client'
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {SkillRoleAssignments} from '../src/client/SkillRoleAssignments.tsx'
import {SkillDetail} from '../src/client/SkillDetail.tsx'
import {requestLeave} from '../../dsh-plugin-manager/src/client/workbench-navigation.ts'

let host:HTMLDivElement,root:Root,state:any,posts:any[],failSave:boolean,failLoad:boolean
const skill={id:'s1',name:'archive',description:'归档',root:'/skills',scope:'global',hash:'a'.repeat(64),enabled:true,auto:true,manual:true,category:'未分类',tags:[],warnings:[],updatedAt:'2026-10-21',usage:'roles' as const}
function role(id:string,name:string,bound=false,extra:any={}){return {id,enabled:true,draft:{name,color:'#5465b6',icon:{kind:'builtin',id:'analyst'},skills:bound?[{id:'s1',enabled:true}]:[]},versions:[],...extra}}
beforeEach(()=>{
 state={revision:6,roles:[role('r1','需求分析助手',true),role('r2','市场部助手'),role('r3','项目经理助手'),role('archived','归档岗位',true,{archivedAt:'2026-10-01'}),role('removed','删除岗位',true,{removedAt:'2026-10-01'})]};posts=[];failSave=false;failLoad=false
 HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','')};HTMLDialogElement.prototype.close=function(){this.removeAttribute('open')}
 vi.stubGlobal('fetch',vi.fn(async(url:string,init?:RequestInit)=>{
  if(url==='/api/capabilities/state')return {ok:!failLoad,json:async()=>failLoad?{error:'读取失败'}:{state:structuredClone(state)}}
  if(url==='/api/capabilities/command'){const body=JSON.parse(String(init?.body));posts.push(body);if(failSave)return {ok:false,json:async()=>({error:'岗位已改变，请重新打开后重试'})};state.revision++;state.roles.forEach((r:any)=>{if(!r.archivedAt&&!r.removedAt)r.draft.skills=body.command.roleIds.includes(r.id)?[{id:'s1',enabled:true}]:[]});return {ok:true,json:async()=>({ok:true})}}
  if(url.includes('/manage/detail'))return {ok:true,json:async()=>({content:'内容',files:['SKILL.md']})}
  if(url.includes('/manage/resource'))return {ok:true,json:async()=>({content:'内容'})}
  throw Error('Unexpected '+url)
 }));host=document.createElement('div');document.body.append(host);root=createRoot(host)
})
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();vi.restoreAllMocks()})
const buttons=()=>Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
async function click(label:string){await act(async()=>{const b=buttons().find(b=>b.getAttribute('aria-label')===label||b.textContent?.trim()===label);expect(b,label).toBeTruthy();b!.click()})}
async function mount(){await act(async()=>root.render(<SkillRoleAssignments skillId="s1" busy={false}/>))}
async function search(value:string){await act(async()=>{const input=document.querySelector<HTMLInputElement>('[aria-label="搜索岗位名称"]')!;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}))})}

it('shows only associated active roles with icons and icon-only removal',async()=>{await mount();expect(host.querySelectorAll('[data-assigned-role]')).toHaveLength(1);expect(host.querySelector('[data-role-appearance-icon]')).toBeTruthy();expect(host.querySelector('[role=switch]')).toBeNull();expect(host.textContent).not.toContain('市场部助手');expect(host.textContent).not.toContain('归档岗位');expect(host.querySelector('[aria-label="解除岗位关联：需求分析助手"]')?.textContent).toBe('');expect(buttons().some(b=>b.textContent==='保存')).toBe(false)})
it('adds multiple roles without duplicate or immediate writes and closes the picker without saving',async()=>{
 await mount();await click('＋ 添加岗位');expect(document.querySelector('dialog[open]')).toBeTruthy();expect(document.querySelectorAll('[data-picker-role]')).toHaveLength(3)
 await click('添加岗位：市场部助手');await click('添加岗位：项目经理助手');expect(document.querySelector('[aria-label="添加岗位：市场部助手"]')).toBeNull();expect(document.querySelectorAll('dialog [data-picker-role]')).toHaveLength(3)
 await click('完成');expect(document.querySelector('dialog')).toBeNull();expect(host.querySelectorAll('[data-assigned-role]')).toHaveLength(3);expect(posts).toHaveLength(0)
 await click('保存');expect(posts).toEqual([{revision:6,command:{type:'role.skills',skillId:'s1',roleIds:['r1','r2','r3']}}]);expect(host.textContent).not.toContain('有未保存的更改')
})
it('cancels additions and removals back to the persisted selection',async()=>{await mount();await click('解除岗位关联：需求分析助手');expect(host.textContent).toContain('尚未添加岗位');await click('＋ 添加岗位');await click('添加岗位：市场部助手');await click('关闭添加岗位');await click('取消');expect(host.querySelectorAll('[data-assigned-role]')).toHaveLength(1);expect(host.querySelector('[data-assigned-role="r1"]')).toBeTruthy();expect(posts).toHaveLength(0)})
it('searches the picker, handles no matches, and closes only the top layer with Escape',async()=>{await mount();await click('＋ 添加岗位');await search('市场');expect(document.querySelectorAll('[data-picker-role]')).toHaveLength(1);await search('不存在');expect(document.querySelector('dialog')?.textContent).toContain('没有找到匹配的岗位');const outside=vi.fn();document.addEventListener('keydown',outside);await act(async()=>document.querySelector('dialog')!.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})));expect(document.querySelector('dialog')).toBeNull();expect(outside).not.toHaveBeenCalled();document.removeEventListener('keydown',outside);expect(posts).toHaveLength(0)})
it('keeps edits on save failure and permits cancel without changing other role settings',async()=>{await mount();await click('解除岗位关联：需求分析助手');failSave=true;const before=structuredClone(state);await click('保存');expect(host.querySelector('[role=alert]')?.textContent).toContain('岗位已改变');expect(host.textContent).toContain('有未保存的更改');expect(state).toEqual(before);await click('取消');expect(host.querySelector('[data-assigned-role="r1"]')).toBeTruthy()})
it('offers retry on loading errors instead of pretending there are no assignments',async()=>{failLoad=true;await mount();expect(host.querySelector('[role=alert]')?.textContent).toContain('读取失败');expect(host.textContent).not.toContain('尚未添加岗位');failLoad=false;await click('重试');expect(host.querySelectorAll('[data-assigned-role]')).toHaveLength(1)})
it('guards unsaved departure and allows explicit discard',async()=>{await mount();await click('解除岗位关联：需求分析助手');const confirm=vi.spyOn(window,'confirm').mockReturnValue(false);let left=true;await act(async()=>{left=requestLeave()});expect(left).toBe(false);expect(host.textContent).toContain('有未保存的更改');confirm.mockReturnValue(true);await act(async()=>{left=requestLeave()});expect(left).toBe(true);expect(host.querySelector('[data-assigned-role="r1"]')).toBeTruthy();expect(posts).toHaveLength(0)})
it('preserves pending selections while visiting content and references',async()=>{
 function Detail(){const [tab,onTab]=React.useState('settings');return <SkillDetail row={skill} tab={tab} onTab={onTab} busy={false} change={vi.fn()} onConfirm={vi.fn()}/>}
 await act(async()=>root.render(<Detail/>));await click('＋ 添加岗位');await click('添加岗位：市场部助手');await click('完成');await click('内容与资源');await click('岗位引用');await click('设置');expect(host.querySelectorAll('[data-assigned-role]')).toHaveLength(2);expect(host.textContent).toContain('有未保存的更改');expect(posts).toHaveLength(0)
})
