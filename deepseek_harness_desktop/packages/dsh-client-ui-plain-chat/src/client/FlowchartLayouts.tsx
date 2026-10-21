import { createPortal } from 'react-dom'
import React, { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import s from './FlowchartLayouts.module.css'

type Layout={id:string;name:string;description:string;available:boolean;reason?:string;previewUrl:string}
type Choices={selected:string;layouts:Layout[]}
export function flowchartId(src:string,origin=window.location.origin):string|null {
  try{const url=new URL(src,origin);return url.origin===origin?(/^\/api\/capabilities\/packages\/artifact\/([a-f0-9-]{36})\/image\.svg$/.exec(url.pathname)?.[1]??null):null}catch{return null}
}
async function request(id:string,style?:string):Promise<Choices>{
  const response=await fetch(`/api/capabilities/packages/artifact/${id}/${style?'layout':'layouts'}`,{credentials:'same-origin',...(style?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({style})}:{})})
  const data=await response.json();if(!response.ok)throw Error(data.error||'布局操作失败，请重试');return data
}
export function FlowchartLayoutPicker({id,onChange}:{id:string;onChange:()=>void}){
  const [open,setOpen]=useState(false),[data,setData]=useState<Choices>(),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const panel=useRef<HTMLElement>(null),[position,setPosition]=useState({left:12,top:12,width:450}),element=useRef<HTMLDivElement>(null),toggle=useRef<HTMLButtonElement>(null),closeButton=useRef<HTMLButtonElement>(null),generation=useRef(0)
  const close=useCallback(()=>{setOpen(false);toggle.current?.focus()},[])
  useEffect(()=>()=>{generation.current++},[])
  useEffect(()=>{if(!open)return;const onPointer=(event:PointerEvent)=>{if(!element.current?.contains(event.target as Node)&&!panel.current?.contains(event.target as Node))setOpen(false)};const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close()}};document.addEventListener('pointerdown',onPointer);document.addEventListener('keydown',onKey,true);closeButton.current?.focus();return()=>{document.removeEventListener('pointerdown',onPointer);document.removeEventListener('keydown',onKey,true)}},[open,close])
  useEffect(()=>{if(!open)return;const place=()=>{const r=toggle.current!.getBoundingClientRect(),width=Math.min(450,window.innerWidth-24),height=Math.min(560,window.innerHeight-24);setPosition({width,left:Math.max(12,Math.min(r.right-width,window.innerWidth-width-12)),top:Math.max(12,Math.min(r.top-height-10,window.innerHeight-height-12))})};place();window.addEventListener('resize',place);window.addEventListener('scroll',place,true);document.addEventListener('load',place,true);return()=>{window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true);document.removeEventListener('load',place,true)}},[open])
  const load=async()=>{setOpen(true);setError('');const current=++generation.current;try{const value=await request(id);if(current===generation.current)setData(value)}catch(e){if(current===generation.current)setError((e as Error).message)}}
  const select=async(style:string)=>{if(busy||style===data?.selected)return;setBusy(true);setError('');const current=generation.current;try{const value=await request(id,style);if(current!==generation.current)return;setData(value);onChange();window.dispatchEvent(new CustomEvent('workbench-flowchart-layout',{detail:id}))}catch(e){if(current===generation.current)setError((e as Error).message)}finally{if(current===generation.current)setBusy(false)}}
  return <div ref={element} className={s.control} onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();close()}}}>
    {open&&createPortal(<section ref={panel} style={position} className={s.panel} role="dialog" aria-label="流程图布局" aria-busy={busy}>
      <div className={s.heading}><div><strong>选择布局</strong><small>预览当前流程，保留全部步骤与连线</small></div><button ref={closeButton} onClick={close} aria-label="关闭布局选择">×</button></div>
      {!data&&!error&&<p role="status">正在加载预览…</p>}
      {data&&<div className={s.grid}>{data.layouts.map(layout=><button type="button" key={layout.id} className={s.option} disabled={!layout.available||busy} aria-pressed={data.selected===layout.id} title={layout.reason||layout.description} onClick={()=>void select(layout.id)}>
        {layout.available?<img src={layout.previewUrl} alt={`${layout.name}缩略图`}/>:<span className={s.unavailable}>当前流程不适用</span>}
        <strong>{layout.name}<span aria-hidden="true">{data.selected===layout.id?'✓':''}</span></strong><small>{layout.reason||layout.description}</small>
      </button>)}</div>}
      {busy&&<p role="status">正在应用布局…</p>}{error&&<p role="alert" className={s.error}>{error}<button onClick={()=>void load()}>重新加载</button></p>}
      <div className={s.footer}><a href={`/api/capabilities/packages/artifact/${id}/view`} target="_blank" rel="noreferrer">查看大图 / 下载 PNG</a><a href={`/api/capabilities/packages/artifact/${id}/download.svg`} download>下载 SVG</a></div>
    </section>,document.body)}
    <button type="button" ref={toggle} className={s.toggle} aria-label="切换流程图布局" aria-expanded={open} onClick={()=>open?close():void load()}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg>布局 / 风格<span aria-hidden="true">⌃</span></button>
  </div>
}

type Anchor={image:HTMLImageElement;id:string;left:number;top:number;width:number;height:number;key:number}
/** Compatibility decorator: preserve upstream Markdown rendering and attach controls only to our same-origin artifacts. */
export function FlowchartLayouts({children}:{children:ReactNode}){
  const root=useRef<HTMLDivElement>(null),[anchors,setAnchors]=useState<Anchor[]>([])
  useEffect(()=>{
    const container=root.current!;let frame=0,sequence=0;const keys=new WeakMap<HTMLImageElement,number>(),observed=new Set<HTMLImageElement>()
    const refreshImage=(image:HTMLImageElement)=>{const url=new URL(image.src);url.searchParams.delete('style');url.searchParams.set('view',String(Date.now()));image.src=url.href}
    const update=()=>{frame=0;const bounds=container.getBoundingClientRect();const next:Anchor[]=[]
      for(const image of Array.from(container.querySelectorAll<HTMLImageElement>('img'))){
        if(image.closest('[data-flowchart-controls]'))continue
        const id=flowchartId(image.src);if(!id)continue
        if(!keys.has(image))keys.set(image,++sequence)
        if(!observed.has(image)){resize.observe(image);observed.add(image)}
        const r=image.getBoundingClientRect();if(r.width&&r.height)next.push({image,id,left:r.left-bounds.left,top:r.top-bounds.top,width:r.width,height:r.height,key:keys.get(image)!})
      }
      for(const image of observed)if(!container.contains(image)){resize.unobserve(image);observed.delete(image)}
      setAnchors(previous=>previous.length===next.length&&previous.every((a,i)=>a.image===next[i]?.image&&a.id===next[i]?.id&&a.left===next[i]?.left&&a.top===next[i]?.top&&a.width===next[i]?.width&&a.height===next[i]?.height)?previous:next)
    }
    const schedule=()=>{if(!frame)frame=requestAnimationFrame(update)},resize=new ResizeObserver(schedule),mutation=new MutationObserver(schedule)
    resize.observe(container);mutation.observe(container,{subtree:true,childList:true,attributes:true,attributeFilter:['src']});container.addEventListener('load',schedule,true);window.addEventListener('resize',schedule)
    const changed=(event:Event)=>{for(const image of observed)if(flowchartId(image.src)===(event as CustomEvent<string>).detail)refreshImage(image)}
    window.addEventListener('workbench-flowchart-layout',changed);schedule()
    return()=>{cancelAnimationFrame(frame);resize.disconnect();mutation.disconnect();container.removeEventListener('load',schedule,true);window.removeEventListener('resize',schedule);window.removeEventListener('workbench-flowchart-layout',changed)}
  },[])
  return <div className={s.message} ref={root}>{children}{anchors.map(a=><div key={`${a.key}:${a.id}`} data-flowchart-controls className={s.anchor} style={{left:a.left,top:a.top,width:a.width,height:a.height}}><FlowchartLayoutPicker id={a.id} onChange={()=>{}}/></div>)}</div>
}
