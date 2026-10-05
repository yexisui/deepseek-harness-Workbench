// @vitest-environment jsdom
import React,{act,useState} from 'react'
import {createRoot,type Root} from 'react-dom/client'
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {WholeRowSort} from '../../dsh-plugin-manager/src/client/WholeRowSort.tsx'
let container:HTMLDivElement,root:Root,toggles:number,order:string[]
beforeEach(async()=>{
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;toggles=0;order=['a','b','c'];container=document.createElement('div');document.body.append(container);root=createRoot(container)
  vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(function(this:HTMLElement){const index=Array.from(container.querySelectorAll('[data-sort-id]')).indexOf(this);return {left:0,right:500,width:500,top:index<0?100:100+index*100,bottom:index<0?400:200+index*100,height:index<0?300:100,x:0,y:100,toJSON:()=>{}}})
  function Demo(){const [items,setItems]=useState(order.map(id=>({id})));return <WholeRowSort items={items} onChange={next=>{setItems(next);order=next.map(n=>n.id)}} label={i=>i.id} render={i=><><span>{i.id}</span><button role="switch" aria-label={i.id} aria-checked={false} onClick={()=>toggles++}>开关</button><input aria-label={'编辑'+i.id}/></>}/>}
  await act(async()=>root.render(<Demo/>))
})
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.restoreAllMocks()})
const row=(id:string)=>container.querySelector<HTMLElement>('[data-sort-id="'+id+'"]')!
const event=(target:EventTarget,type:string,x:number,y:number)=>{const e=new MouseEvent(type,{bubbles:true,cancelable:true,button:0,clientX:x,clientY:y});Object.defineProperty(e,'pointerId',{value:1});target.dispatchEvent(e)}
async function drag(target:HTMLElement,x=200,y=360){await act(async()=>{event(target,'pointerdown',50,150);event(window,'pointermove',x,y);event(window,'pointerup',x,y)})}
it('drags from text and persists the reordered whole rows without visible move arrows or handles',async()=>{await drag(row('a').querySelector('span')!);expect(order).toEqual(['b','c','a']);expect(container.querySelector('[data-handle-id]')).toBeNull()})
it('drags from a switch without toggling it, but a click still toggles',async()=>{const toggle=row('a').querySelector<HTMLButtonElement>('button')!;await drag(toggle);await act(async()=>toggle.click());expect(order).toEqual(['b','c','a']);expect(toggles).toBe(0);await act(async()=>{event(toggle,'pointerdown',50,350);event(window,'pointerup',50,350);toggle.click()});expect(toggles).toBe(1)})
it('ignores small pointer movement and leaves editing controls usable',async()=>{const toggle=row('a').querySelector<HTMLButtonElement>('button')!;await act(async()=>{event(toggle,'pointerdown',50,150);event(window,'pointermove',53,153);event(window,'pointerup',53,153);toggle.click()});expect(order).toEqual(['a','b','c']);expect(toggles).toBe(1);await drag(row('a').querySelector('input')!);expect(order).toEqual(['a','b','c'])})
it('cancels on Escape and release outside the list without saving a partial reorder',async()=>{await act(async()=>{event(row('a'),'pointerdown',50,150);event(window,'pointermove',200,360);window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))});expect(order).toEqual(['a','b','c']);await drag(row('a'),700,360);expect(order).toEqual(['a','b','c'])})
it('supports keyboard pickup, position changes, cancellation and drop on the card itself',async()=>{const press=async(key:string)=>act(async()=>row('a').dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true})));await press(' ');await press('End');await press('Escape');expect(order).toEqual(['a','b','c']);await press(' ');await press('ArrowDown');await press('Enter');expect(order).toEqual(['b','a','c'])})
