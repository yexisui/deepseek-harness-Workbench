import React,{useEffect,useRef,useState,useSyncExternalStore} from 'react'
import {documentsClient,documentDesktop} from '../../../../shared/client/documents-client.ts'
import s from './DocumentAssistant.module.css'
export function DocumentAssistant({roleId}:{roleId:string}){
 const client=documentsClient(),state=useSyncExternalStore(client.subscribe,client.getSnapshot),mount=useRef<HTMLDivElement>(null),input=useRef<HTMLInputElement>(null),[side,setSide]=useState(true)
 useEffect(()=>{void client.refresh();return client.mount(mount.current!)},[])
 const run=(fn:()=>Promise<unknown>)=>{void fn().catch(client.fail)}
 async function file(value?:File){if(value){const path=documentDesktop()?.getPathForFile?.(value);if(path&&documentDesktop()?.openDocument)await client.openNative(roleId,path);else await client.importBytes(value.name,await value.arrayBuffer(),roleId)}}
 return <section className={s.root} aria-label="智能文档工作区" onDragOver={e=>{if(e.dataTransfer.types.includes('Files'))e.preventDefault()}} onDrop={e=>{e.preventDefault();run(()=>file(e.dataTransfer.files[0]))}}>
  <header className={s.toolbar}><div className={s.identity}><strong>{state.active?.title||'智能文档助手'}</strong><small>{state.busy?'正在打开…':state.saving?'正在暂存…':state.active?state.dirty?'有未保存修改 · '+(state.draftSaved?'工作副本已暂存':'正在暂存'):'工作副本已就绪':'打开 Word，编辑并理解文档'}</small></div>
   <input ref={input} type="file" accept=".docx" hidden onChange={e=>{run(()=>file(e.target.files?.[0]));e.target.value=''}}/>
   <button disabled={state.busy} onClick={()=>documentDesktop()?.openDocument?run(()=>client.openNative(roleId)):input.current?.click()}>打开 Word</button>
   <button disabled={!state.active||state.busy} onClick={()=>run(()=>client.save(false))}>{state.active&&!client.hasNative(state.active.id)?'保存副本':'保存'}</button>
   <button disabled={!state.active||state.busy} onClick={()=>run(()=>client.save(true))}>另存为</button>
   <button aria-expanded={side} onClick={()=>setSide(!side)}>{side?'收起助手':'展开助手'}</button>
  </header>
  {state.error&&<div className={s.error} role="alert">{state.error}<button onClick={client.clearError} aria-label="关闭提示">×</button></div>}
  <div className={s.layout} data-sidebar={side}><div className={s.editor}><div className={s.frame} ref={mount}/>{!state.active&&<div className={s.empty}><strong>从一份 Word 开始</strong><p>点击“打开 Word”或将 DOCX 拖到这里。工作副本在本机暂存。</p>{state.rows.slice(0,6).map(row=><button key={row.id} onClick={()=>run(()=>client.open(row.id))}>{row.title}<small>{new Date(row.updatedAt).toLocaleString()}</small></button>)}</div>}</div>
   {side&&<aside className={s.side}><h3>文档助手</h3><div className={s.context}><strong>{state.context?.selection?'当前选区':'文档大纲'}</strong>{state.context?.selection?<p>{state.context.selection}</p>:state.context?.outline.map((item,i)=><button key={i} onClick={()=>run(()=>client.rpc('find',{text:item.text}))}>{item.text}</button>)}{!state.context?.selection&&!state.context?.outline.length&&<p>在左侧选择文字，可围绕该内容提问。</p>}</div><p className={s.hint}>文档编辑在本机运行。AI 使用工作台已配置的模型；外部资料库暂未接入。</p></aside>}
  </div>
 </section>
}
