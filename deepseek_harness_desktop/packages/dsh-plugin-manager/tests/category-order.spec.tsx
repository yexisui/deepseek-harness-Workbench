// @vitest-environment jsdom
import React, { useState } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { CategoryEditor } from '../src/client/CategoryEditor.tsx'
import { moveCategory } from '../src/client/category-order.ts'
import type { Classification } from '../src/core/classification.ts'
const initial: Classification = { version:1,revision:4,groups:[{id:'a',name:'基础'},{id:'b',name:'扩展'},{id:'c',name:'空组'}],modules:[{id:'one',name:'模块一',groupId:'a'},{id:'two',name:'模块二',groupId:'a'},{id:'three',name:'模块三',groupId:'b'}],assignments:{plugin:'one'} }
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals()})
function setup() { const change=vi.fn(); function App(){const [value,set]=useState(initial);return <CategoryEditor value={value} onChange={v=>{change(v);set(v)}} onRemove={()=>{}}/>};const view=render(<App/>);return {...view,change} }
it('reorders groups while preserving modules and assignments',()=>{
 const next=moveCategory(initial,{kind:'group',id:'a'},{groupId:''});expect(next.groups.map(g=>g.id)).toEqual(['b','c','a']);expect(next.modules).toBe(initial.modules);expect(next.assignments).toBe(initial.assignments);expect(initial.groups[0].id).toBe('a')
})
it('moves a module to an empty group and keeps its stable assignment',()=>{
 const next=moveCategory(initial,{kind:'module',id:'one'},{groupId:'c'});expect(next.modules.find(m=>m.id==='one')?.groupId).toBe('c');expect(next.assignments.plugin).toBe('one');expect(next.revision).toBe(4)
})
it('rejects stale and mismatched targets',()=>{
 expect(moveCategory(initial,{kind:'module',id:'one'},{groupId:'missing'})).toBe(initial)
 expect(moveCategory(initial,{kind:'module',id:'one'},{groupId:'a',before:'three'})).toBe(initial)
 expect(moveCategory(initial,{kind:'group',id:'missing'},{groupId:''})).toBe(initial)
})
it('uses keyboard preview, confirms order, and cancels without writing',()=>{
 const t=setup(),h=screen.getByRole('button',{name:'拖动排序：模块一'});fireEvent.keyDown(h,{key:' '});fireEvent.keyDown(h,{key:'ArrowDown'});expect(t.change).not.toHaveBeenCalled();fireEvent.keyDown(h,{key:'Enter'});expect(t.change.mock.lastCall![0].modules.map((m:any)=>m.id)).toEqual(['two','one','three'])
 fireEvent.keyDown(h,{key:' '});fireEvent.keyDown(h,{key:'ArrowRight'});fireEvent.keyDown(h,{key:'Escape'});expect(t.change).toHaveBeenCalledTimes(1)
})
it('keyboard cross-group movement and menu movement share the same result',()=>{
 const t=setup(),h=screen.getByRole('button',{name:'拖动排序：模块一'});fireEvent.keyDown(h,{key:' '});fireEvent.keyDown(h,{key:'ArrowRight'});fireEvent.keyDown(h,{key:'Enter'});expect(t.change.mock.lastCall![0]).toEqual(moveCategory(initial,{kind:'module',id:'one'},{groupId:'b'}))
 fireEvent.click(screen.getByRole('button',{name:'移动到分组：模块一'}));fireEvent.change(screen.getByRole('combobox',{name:'模块所属分组'}),{target:{value:'c'}});expect(t.change.mock.lastCall![0].modules.find((m:any)=>m.id==='one').groupId).toBe('c')
})
it('pointer movement has a threshold, drops across groups, and ignores outside drops',()=>{
 vi.stubGlobal('PointerEvent',class extends MouseEvent { pointerId=1 });const t=setup(),h=screen.getByRole('button',{name:'拖动排序：模块一'}),target=t.container.querySelector('[data-category-group=c]')!
 Object.defineProperty(document,'elementFromPoint',{configurable:true,value:vi.fn(()=>target)})
 fireEvent.pointerDown(h,{button:0,clientX:10,clientY:10});fireEvent.pointerMove(window,{clientX:12,clientY:12});fireEvent.pointerUp(window,{clientX:12,clientY:12});expect(t.change).not.toHaveBeenCalled()
 fireEvent.pointerDown(h,{button:0,clientX:10,clientY:10});fireEvent.pointerMove(window,{clientX:30,clientY:30});fireEvent.pointerUp(window,{clientX:30,clientY:30});expect(t.change.mock.lastCall![0].modules.find((m:any)=>m.id==='one').groupId).toBe('c')
 vi.mocked(document.elementFromPoint).mockReturnValue(document.body);fireEvent.pointerDown(h,{button:0,clientX:10,clientY:10});fireEvent.pointerMove(window,{clientX:40,clientY:40});fireEvent.pointerUp(window,{clientX:40,clientY:40});expect(t.change).toHaveBeenCalledTimes(1)
})
it('keeps name editing independent and removes visible arrow controls',()=>{
 const t=setup();fireEvent.change(screen.getAllByRole('textbox',{name:'模块名称'})[0],{target:{value:'新名称'}});expect(t.change.mock.lastCall![0].modules[0].name).toBe('新名称');expect(screen.queryByRole('button',{name:/上移|下移/})).toBeNull();expect(screen.queryByRole('combobox')).toBeNull()
})
it('drags from module name and group blank space while buttons and active text editing stay independent',()=>{
 vi.stubGlobal('PointerEvent',class extends MouseEvent {pointerId=1});const t=setup(),input=screen.getAllByLabelText('模块名称')[0],target=t.container.querySelector('[data-category-group=c]')!;Object.defineProperty(document,'elementFromPoint',{configurable:true,value:()=>target});
 fireEvent.pointerDown(input,{button:0,clientX:10,clientY:10});fireEvent.pointerMove(window,{clientX:30,clientY:30});fireEvent.pointerUp(window,{clientX:30,clientY:30});expect(t.change.mock.lastCall![0].modules.find((m:any)=>m.id==='one').groupId).toBe('c');
 fireEvent.click(screen.getByDisplayValue('模块一')); // Generated click after drag must not enter edit mode.
 const moved=screen.getByDisplayValue('模块一');fireEvent.click(moved);expect((moved as HTMLInputElement).readOnly).toBe(false);fireEvent.pointerDown(moved,{button:0,clientX:10,clientY:10});fireEvent.pointerMove(window,{clientX:30,clientY:30});fireEvent.pointerUp(window,{clientX:30,clientY:30});expect(t.change).toHaveBeenCalledTimes(1);
 fireEvent.blur(moved);const group=t.container.querySelector('[data-category-group=a]')!;fireEvent.pointerDown(group,{button:0,clientX:10,clientY:10});fireEvent.pointerMove(window,{clientX:30,clientY:30});fireEvent.pointerUp(window,{clientX:30,clientY:30});expect(t.change.mock.lastCall![0].groups.map((g:any)=>g.id)).toEqual(['b','c','a'])
})
