import React,{useEffect,useLayoutEffect,useRef,useState} from 'react'
type Item={id:string}
type Gesture={id:string;pointer?:number;x:number;y:number;active:boolean;order:string[];centers:{id:string;y:number}[];inside:boolean;node:HTMLElement}
/** Whole-row sorting, including button/switch surfaces. Only editable fields opt out. */
export function WholeRowSort<T extends Item>({items,onChange,render,label,disabled,className,rowClassName,ghostClassName}:{items:T[];onChange:(items:T[])=>void;render:(item:T,index:number)=>React.ReactNode;label:(item:T)=>string;disabled?:boolean;className?:string;rowClassName?:string;ghostClassName?:string}){
  const root=useRef<HTMLOListElement>(null),latest=useRef({items,onChange,disabled});latest.current={items,onChange,disabled}
  const gesture=useRef<Gesture>(),suppress=useRef(0),[drag,setDrag]=useState<Gesture>(),[message,setMessage]=useState(''),positions=useRef(new Map<string,number>())
  const publish=(g:Gesture)=>{setDrag({...g});setMessage('第 '+(g.order.indexOf(g.id)+1)+' 项，松开放置；Esc 取消')}
  const finish=(commit:boolean)=>{
    const g=gesture.current;gesture.current=undefined;setDrag(undefined);if(!g)return
    if(g.active){suppress.current=Date.now()+400;if(commit&&g.inside&&!latest.current.disabled){const byId=new Map(latest.current.items.map(i=>[i.id,i]));if(g.order.length===byId.size&&g.order.every(id=>byId.has(id)))latest.current.onChange(g.order.map(id=>byId.get(id)!));setMessage('排序已调整，保存后从下一轮生效')}else setMessage('已取消移动，原顺序保留')}
    if(g.pointer!==undefined&&g.node.hasPointerCapture?.(g.pointer))g.node.releasePointerCapture(g.pointer)
    if(g.active)requestAnimationFrame(()=>root.current?.querySelector<HTMLElement>('[data-sort-id="'+g.id+'"]')?.focus())
  }
  const finishRef=useRef(finish);finishRef.current=finish
  useEffect(()=>{
    let frame=0,last:{x:number;y:number}|undefined
    const update=()=>{
      const g=gesture.current,list=root.current;if(!g?.active||!last||!list)return
      const r=list.getBoundingClientRect();g.x=last.x;g.y=last.y;g.inside=last.x>=r.left&&last.x<=r.right&&last.y>=Math.max(0,r.top)&&last.y<=Math.min(innerHeight,r.bottom)
      if(g.inside){const others=g.centers.filter(c=>c.id!==g.id);const index=others.filter(c=>last!.y-r.top+list.scrollTop>c.y).length;g.order=others.map(c=>c.id);g.order.splice(index,0,g.id)}
      publish(g)
      let scroll:HTMLElement|null=list;while(scroll&&!(scroll.scrollHeight>scroll.clientHeight&&/auto|scroll/.test(getComputedStyle(scroll).overflowY)))scroll=scroll.parentElement
      if(scroll){const box=scroll.getBoundingClientRect();if(last.x>=box.left&&last.x<=box.right){if(last.y<Math.max(0,box.top)+32)scroll.scrollTop-=8;else if(last.y>Math.min(innerHeight,box.bottom)-32)scroll.scrollTop+=8}}
      frame=requestAnimationFrame(update)
    }
    const move=(e:PointerEvent)=>{
      const g=gesture.current;if(!g||g.pointer!==e.pointerId)return
      if(!g.active&&Math.hypot(e.clientX-g.x,e.clientY-g.y)<7)return
      e.preventDefault();last={x:e.clientX,y:e.clientY}
      if(!g.active){g.active=true;suppress.current=Date.now()+400;g.node.setPointerCapture?.(e.pointerId);update()}
    }
    const up=(e:PointerEvent)=>{const g=gesture.current;if(!g||g.pointer!==e.pointerId)return;if(g.active){last={x:e.clientX,y:e.clientY};cancelAnimationFrame(frame);update()}cancelAnimationFrame(frame);finishRef.current(true)}
    const cancel=()=>{cancelAnimationFrame(frame);finishRef.current(false)}
    const key=(e:KeyboardEvent)=>{if(e.key==='Escape'&&gesture.current){e.preventDefault();e.stopImmediatePropagation();cancel()}}
    window.addEventListener('pointermove',move,{passive:false});window.addEventListener('pointerup',up);window.addEventListener('pointercancel',cancel);window.addEventListener('blur',cancel);window.addEventListener('keydown',key,true)
    return()=>{cancelAnimationFrame(frame);window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancel);window.removeEventListener('blur',cancel);window.removeEventListener('keydown',key,true);gesture.current=undefined}
  },[])
  useEffect(()=>{if(disabled&&gesture.current)finishRef.current(false)},[disabled])
  const order=drag?.active?drag.order:items.map(i=>i.id),byId=new Map(items.map(i=>[i.id,i]))
  useLayoutEffect(()=>{const next=new Map<string,number>();for(const row of Array.from(root.current?.querySelectorAll<HTMLElement>('[data-sort-id]')??[])){const id=row.dataset.sortId!,top=row.getBoundingClientRect().top,old=positions.current.get(id);next.set(id,top);if(old!==undefined&&old!==top&&!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)row.animate?.([{transform:'translateY('+(old-top)+'px)'},{transform:'translateY(0)'}],{duration:140,easing:'ease-out'})}positions.current=next},[order.join('|')])
  return <><ol ref={root} className={className} aria-label="模型优先级" onClickCapture={e=>{if(Date.now()<suppress.current){e.preventDefault();e.stopPropagation();suppress.current=0}}}>{order.map((id,index)=>{const item=byId.get(id);if(!item)return null;return <li key={id} className={rowClassName} data-sort-id={id} data-dragging={drag?.active&&drag.id===id} data-drop-target={drag?.active&&drag.inside&&drag.id===id} tabIndex={disabled?-1:0} aria-label={'第 '+(index+1)+' 项：'+label(item)} aria-roledescription="可拖动的模型选项" aria-keyshortcuts="Space Enter Escape" onPointerDown={e=>{
    if(disabled||e.button!==0||(e.target as HTMLElement).closest('input,textarea,select,[contenteditable="true"]'))return
    const list=root.current!,rect=list.getBoundingClientRect();suppress.current=0
    gesture.current={id,pointer:e.pointerId,x:e.clientX,y:e.clientY,active:false,order:items.map(i=>i.id),inside:true,node:e.currentTarget,centers:Array.from(list.children).map(n=>{const r=n.getBoundingClientRect();return {id:(n as HTMLElement).dataset.sortId!,y:r.top-rect.top+list.scrollTop+r.height/2}})}
  }} onKeyDown={e=>{
    if(e.target!==e.currentTarget||disabled)return
    if((e.key===' '||e.key==='Enter')&&!gesture.current){e.preventDefault();const g={id,x:0,y:0,active:true,order:items.map(i=>i.id),centers:[],inside:true,node:e.currentTarget};gesture.current=g;publish(g);return}
    const g=gesture.current;if(!g||g.pointer!==undefined)return
    if(e.key===' '||e.key==='Enter'){e.preventDefault();finish(true);return}
    if(!['ArrowUp','ArrowDown','Home','End'].includes(e.key))return;e.preventDefault();const current=g.order.indexOf(g.id),next=e.key==='Home'?0:e.key==='End'?g.order.length-1:Math.min(g.order.length-1,Math.max(0,current+(e.key==='ArrowUp'?-1:1)));g.order.splice(current,1);g.order.splice(next,0,g.id);publish(g)
  }}>{render(item,index)}</li>})}</ol><span style={{position:'absolute',width:1,height:1,overflow:'hidden',clipPath:'inset(50%)'}} role="status">{message}</span>{drag?.active&&drag.pointer!==undefined&&byId.has(drag.id)&&<div aria-hidden="true" className={ghostClassName} style={{position:'fixed',pointerEvents:'none',zIndex:10000,left:Math.min(drag.x+12,innerWidth-240),top:drag.y+12,maxWidth:220}}>{label(byId.get(drag.id)!)}<small style={{display:'block'}}>{drag.inside?'松开后放到第 '+(drag.order.indexOf(drag.id)+1)+' 项':'移出列表，松开将取消'}</small></div>}</>
}
