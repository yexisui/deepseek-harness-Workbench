// @vitest-environment jsdom
import React,{act} from 'react'
import {createRoot,type Root} from 'react-dom/client'
import {afterEach,expect,it,vi} from 'vitest'
import {TeamContributions} from '../src/client/TeamContributions.tsx'
import type {ContributionSnapshot} from '../../dsh-capabilities/src/core/team-contributions.ts'

const roots:Root[]=[]
afterEach(async()=>{for(const root of roots.splice(0))await act(async()=>root.unmount());vi.restoreAllMocks();vi.unstubAllGlobals();document.body.innerHTML=''})
async function setup(multipleOwners=true){
 (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true
 Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value(){this.setAttribute('open','')}})
 Object.defineProperty(HTMLDialogElement.prototype,'close',{configurable:true,value(){this.removeAttribute('open')}})
 const data:ContributionSnapshot={revision:1,multipleOwners,members:Array.from({length:8},(_,i)=>({id:'m'+i,name:'成员'+i,employeeId:'00'+i,department:i<4?'研发部':'应用部'})),owners:{'skill:excel':['m0']},entries:[{id:'excel',key:'skill:excel',kind:'skill',name:'表格生成',description:'生成表格',enabled:true,archived:false,source:'全局技能',related:[]}],counts:{'skill:excel':{count:5,lastAt:'2026-10-30T06:00:00Z'}},startedAt:'2026-10-27T00:00:00Z',syncedAt:'2026-10-30T06:00:00Z',warning:''}
 const posts:any[]=[];let failure=''
 vi.stubGlobal('fetch',vi.fn(async(_url,init)=>{if(init?.method==='POST'){const body=JSON.parse(init.body);posts.push(body);if(failure)return {ok:false,json:async()=>({error:failure})};if(body.type==='owner.set')data.owners[body.key]=body.memberIds;data.revision++}return {ok:true,json:async()=>structuredClone(data)}}))
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);roots.push(root);await act(async()=>root.render(<TeamContributions/>))
 return {data,posts,fail:(value:string)=>failure=value}
}
const dialog=()=>document.querySelector('dialog')!
const byLabel=(label:string)=>document.querySelector<HTMLElement>('[aria-label="'+label+'"]')!
const click=async(element:HTMLElement)=>act(async()=>element.click())
const button=(label:string,scope:ParentNode=document)=>Array.from(scope.querySelectorAll<HTMLButtonElement>('button')).find(b=>b.textContent?.trim()===label)!
const checkbox=(i:number)=>byLabel(`选择贡献人 成员${i}（00${i}）`) as HTMLInputElement
const open=()=>click(byLabel('设置 表格生成 的贡献归属'))
async function fill(element:HTMLInputElement,value:string){await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(element,value);element.dispatchEvent(new Event('input',{bubbles:true}))})}

it('selects across pages and searches, saves all members and restores selections on reopen',async()=>{
 const h=await setup();await open();expect(checkbox(0).checked).toBe(true);await click(checkbox(1));await click(button('下一页',dialog()));await click(checkbox(7))
 await fill(byLabel('搜索贡献人') as HTMLInputElement,'002');await click(checkbox(2));expect(dialog().textContent).toContain('已选 4 位成员')
 await click(button('保存',dialog()));expect(h.posts[0]).toMatchObject({type:'owner.set',memberIds:['m0','m1','m7','m2'],revision:1});expect(document.querySelector('dialog')).toBeNull()
 await open();expect(checkbox(0).checked).toBe(true);expect(checkbox(1).checked).toBe(true);expect(checkbox(2).checked).toBe(true);expect(dialog().textContent).toContain('成员7（007）')
})
it('removes hidden selections and keeps unsaved cancellation from changing ownership',async()=>{
 const h=await setup();await open();await click(checkbox(1));await fill(byLabel('搜索贡献人') as HTMLInputElement,'007');await click(byLabel('取消选择 成员0（000）'))
 expect(dialog().textContent).toContain('已选 1 位成员');expect(dialog().textContent).not.toContain('成员0（000）')
 const confirm=vi.spyOn(window,'confirm').mockReturnValue(true);await click(button('取消',dialog()));expect(confirm).toHaveBeenCalled();expect(h.posts).toHaveLength(0);expect(h.data.owners['skill:excel']).toEqual(['m0'])
})
it('platform default clears every selected contributor only on save',async()=>{
 const h=await setup();await open();await click(checkbox(1));await click(button('平台默认',dialog()));expect(checkbox(0).checked).toBe(false);expect(checkbox(1).checked).toBe(false)
 await click(button('保存',dialog()));expect(h.posts[0].memberIds).toEqual([]);expect(byLabel('设置 表格生成 的贡献归属').textContent).toContain('平台默认')
})
it('shows both contributors in search, detail and member statistics without inflating content usage',async()=>{
 const h=await setup();await open();await click(checkbox(1));await click(button('保存',dialog()))
 await fill(byLabel('搜索贡献内容') as HTMLInputElement,'成员1');expect(byLabel('设置 表格生成 的贡献归属').textContent).toContain('成员0、成员1')
 await click(byLabel('查看 表格生成'));expect(dialog().textContent).toContain('成员0、成员1');await click(byLabel('关闭详情'))
 await click(button('使用统计'));const rows=Array.from(byLabel('成员贡献使用统计').querySelectorAll('[role=row]'))
 for(const name of ['成员0','成员1']){const row=rows.find(r=>r.firstElementChild?.textContent===name)!;expect(row.children[2]!.textContent).toBe('5')}
 expect(document.querySelector('section header strong')?.textContent).toBe('0');expect(document.body.textContent).toContain('成员数据不相加');expect(h.data.counts['skill:excel'].count).toBe(5)
})
it('keeps choices on a conflicting save and retries only after adopting the current revision',async()=>{
 const h=await setup();await open();await click(checkbox(1));h.data.revision=2;h.fail('团队配置已在其他页面更新，请刷新后重新保存');await click(button('保存',dialog()))
 expect(checkbox(1).checked).toBe(true);expect(dialog().textContent).toContain('团队配置已在其他页面更新');h.fail('');await click(button('保留输入，使用最新配置',dialog()));await click(button('保存',dialog()))
 expect(h.posts[1]).toMatchObject({revision:2,memberIds:['m0','m1']})
})
it('requires restart before sending multiple selections to a legacy host',async()=>{
 const h=await setup(false);await open();await click(checkbox(1));expect(button('保存',dialog()).disabled).toBe(true);expect(dialog().textContent).toContain('重新打开工作台');expect(h.posts).toHaveLength(0)
})
