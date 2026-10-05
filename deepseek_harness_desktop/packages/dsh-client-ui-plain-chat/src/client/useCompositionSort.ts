import { useEffect, useRef, useState, type PointerEvent, type MouseEvent, type KeyboardEvent, type CSSProperties } from 'react'

type Sort = {id:string;target:string|null;x?:number;y?:number;keyboard?:boolean}
/** Whole-item sorting keeps edits local until drop; pointer and keyboard share the same commit. */
export function useCompositionSort(move: ((id:string,target:string)=>void)|undefined, order: string[] = []) {
 const root=useRef<HTMLDivElement>(null), callback=useRef(move), ids=useRef(order)
 callback.current=move;ids.current=order
 const gesture=useRef<{id:string;pointer:number;x:number;y:number;moved:boolean;source:HTMLElement;rects:{id:string;top:number;bottom:number;left:number;right:number}[];scroll:HTMLElement|null;scrollTop:number}|null>(null)
 const suppress=useRef(0), [sorting,setSorting]=useState<Sort|null>(null), currentSort=useRef(sorting)
 currentSort.current=sorting
 const clear=()=>{const g=gesture.current;gesture.current=null;setSorting(null);if(g?.source.hasPointerCapture?.(g.pointer))g.source.releasePointerCapture(g.pointer)}
 useEffect(()=>{
  const hit=(event:globalThis.PointerEvent)=>{
   const g=gesture.current, delta=g?.scroll?(g.scroll.scrollTop-g.scrollTop):0
   if(g?.rects.some(r=>r.bottom>r.top))return g.rects.find(r=>event.clientX>=r.left&&event.clientX<=r.right&&event.clientY>=r.top-delta&&event.clientY<=r.bottom-delta)?.id??null
   const row=document.elementFromPoint?.(event.clientX,event.clientY)?.closest<HTMLElement>('[data-composition-row]')
   return row&&root.current?.contains(row)?row.dataset.compositionRow!:null
  }
  const onMove=(event:globalThis.PointerEvent)=>{
   const g=gesture.current;if(!g||g.pointer!==event.pointerId)return
   if(!g.moved&&Math.hypot(event.clientX-g.x,event.clientY-g.y)<7)return
   g.moved=true;event.preventDefault();g.source.setPointerCapture?.(g.pointer)
   setSorting({id:g.id,target:hit(event),x:event.clientX,y:event.clientY})
   const box=g.scroll?.getBoundingClientRect();if(g.scroll&&box){if(event.clientY<box.top+45)g.scroll.scrollTop-=12;else if(event.clientY>box.bottom-45)g.scroll.scrollTop+=12}
  }
  const onEnd=(event:globalThis.PointerEvent)=>{const g=gesture.current;if(!g||g.pointer!==event.pointerId)return;const target=hit(event);if(g.moved){suppress.current=Date.now()+300;if(target&&target!==g.id)callback.current?.(g.id,target)}clear()}
  const cancel=()=>{if(gesture.current?.moved)suppress.current=Date.now()+300;clear()}
  const key=(event:globalThis.KeyboardEvent)=>{if(event.key==='Escape'&&(gesture.current||currentSort.current)){event.preventDefault();event.stopPropagation();cancel()}}
  window.addEventListener('pointermove',onMove,{passive:false});window.addEventListener('pointerup',onEnd);window.addEventListener('pointercancel',cancel);window.addEventListener('blur',cancel);window.addEventListener('keydown',key,true)
  return()=>{window.removeEventListener('pointermove',onMove);window.removeEventListener('pointerup',onEnd);window.removeEventListener('pointercancel',cancel);window.removeEventListener('blur',cancel);window.removeEventListener('keydown',key,true)}
 },[])
 return {root,sorting,start:(id:string,event:PointerEvent<HTMLElement>)=>{
  if(!callback.current||event.button!==0||(event.target as HTMLElement).closest('input:not([type="checkbox"]):not([type="radio"]),textarea,select,[contenteditable="true"]'))return
  suppress.current=0;event.stopPropagation()
  const scroll=root.current?.closest<HTMLElement>('section')??null
  const rects=Array.from(root.current?.querySelectorAll<HTMLElement>('[data-composition-row]')??[]).map(row=>{const {top,bottom,left,right}=row.getBoundingClientRect();return {id:row.dataset.compositionRow!,top,bottom,left,right}})
  gesture.current={id,pointer:event.pointerId,x:event.clientX,y:event.clientY,moved:false,source:event.currentTarget,scroll,scrollTop:scroll?.scrollTop??0,rects}
 },click:(event:MouseEvent)=>{if(Date.now()<suppress.current){event.preventDefault();event.stopPropagation();suppress.current=0}},key:(id:string,event:KeyboardEvent<HTMLElement>)=>{
  if(!callback.current||event.target!==event.currentTarget)return
  if(event.key===' '||event.key==='Enter'){event.preventDefault();event.stopPropagation();if(sorting?.keyboard&&sorting.id===id){if(sorting.target&&sorting.target!==id)callback.current(id,sorting.target);setSorting(null)}else setSorting({id,target:id,keyboard:true})}
  else if(sorting?.keyboard&&sorting.id===id&&['ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();event.stopPropagation();const target=ids.current[ids.current.indexOf(sorting.target??id)+(event.key==='ArrowUp'?-1:1)];if(target)setSorting({...sorting,target})}
 },style:(id:string):CSSProperties|undefined=>{
  if(!sorting?.target)return
  const from=ids.current.indexOf(sorting.id),to=ids.current.indexOf(sorting.target),index=ids.current.indexOf(id)
  const row=Array.from(root.current?.querySelectorAll<HTMLElement>('[data-composition-row]')??[]).find(row=>row.dataset.compositionRow===sorting.id),height=(row?.getBoundingClientRect().height??0)+10
  if(from<to&&index>from&&index<=to)return {transform:`translateY(-${height}px)`}
  if(from>to&&index>=to&&index<from)return {transform:`translateY(${height}px)`}
 }}
}
