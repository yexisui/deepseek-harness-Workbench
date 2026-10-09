import { EnableSwitch } from '../../../../shared/client/EnableSwitch.tsx'
import React, { useEffect, useRef, useState } from 'react'
import type { Snapshot } from '../../../dsh-capabilities/src/core/model.ts'
import { type PackagePreview } from '../../../dsh-capabilities/src/core/distribution.ts'
import { Modal } from './PreviewModal.tsx'
import { capabilityClient } from './capability-client.ts'
import s from './ManagedCapabilities.module.css'

export async function packageRequest<T>(path:string,body?:unknown):Promise<T> {
  const response=await fetch(`/api/capabilities/packages/${path}`,{credentials:'same-origin',...(body===undefined?{}:{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)})})
  const value=await response.json()
  if(!response.ok)throw new Error(value.error??'能力包操作失败')
  return value
}
async function discard(token:string){await fetch(`/api/capabilities/packages/upload/${encodeURIComponent(token)}`,{method:'DELETE',credentials:'same-origin'}).catch(()=>{})}
async function discardDownload(id:string){await fetch('/api/capabilities/packages/download/'+encodeURIComponent(id),{method:'DELETE',credentials:'same-origin'}).catch(()=>{})}
async function download(body:unknown){
  const file=await packageRequest<{id:string;url:string;name:string}>('export-link',body)
  const a=document.createElement('a');a.href=file.url;a.download=file.name;document.body.append(a);a.click();a.remove();return file
}

export function CapabilityDistribution(props:{mode:'import'|'export';data:Snapshot;onClose:()=>void;onImported:(id:string,message:string)=>void}){
 return props.mode==='export'?<CapabilityExport data={props.data} onClose={props.onClose}/>:<CapabilityImport {...props}/>
}
function CapabilityExport({data,onClose}:{data:Snapshot;onClose:()=>void}){
 const abilities=data.state.capabilities.filter(c=>!c.removedAt&&!c.purgedAt)
 const [selected,setSelected]=useState(abilities[0]?.id??''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[file,setFile]=useState<{id:string;url:string;name:string}|null>(null)
 const fileRef=useRef<string|null>(null);useEffect(()=>()=>{if(fileRef.current)void discardDownload(fileRef.current)},[])
 const save=async()=>{setBusy(true);setError('');try{const next=await download({id:selected});if(fileRef.current)await discardDownload(fileRef.current);fileRef.current=next.id;setFile(next)}catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}}
 return <Modal title="导出能力" closeLabel="关闭能力导出" onClose={()=>{if(!busy)onClose()}}><div className={s.page+' '+s.dialogBody}>
  <label className={s.field}>选择能力<select aria-label="选择能力" value={selected} disabled={busy} onChange={e=>{setSelected(e.target.value);setFile(null)}}>{abilities.map(c=><option key={c.id} value={c.id}>{c.versions.at(-1)?.name??c.draft.name}</option>)}</select></label>
  {!abilities.length&&<p>暂无可导出的能力。</p>}
  {error&&<p role="alert" className={s.error}>{error}</p>}
  {file&&<p role="status">已生成 <a href={file.url} download={file.name}>{file.name}</a></p>}
  <div className={s.confirmActions}><button className={s.button} disabled={busy} onClick={onClose}>关闭</button><button className={s.button+' '+s.primary} disabled={busy||!selected} onClick={()=>void save()}>{busy?'导出中…':'导出'}</button></div>
 </div></Modal>
}
function CapabilityImport({mode,data,onClose,onImported}:{mode:'import'|'export';data:Snapshot;onClose:()=>void;onImported:(id:string,message:string)=>void}){
  const [,setPreview]=useState<PackagePreview|null>(null)
  const [busy,setBusy]=useState(false),[progress,setProgress]=useState(''),[error,setError]=useState('')
  const [ai,setAI]=useState(true),[uploaded,setUploaded]=useState(false)
  const alive=useRef(true)
  const draft='replace',roles:string[]=[]
  const token=useRef<string|null>(null)
  const picker=useRef<HTMLInputElement>(null), folderPicker=useRef<HTMLInputElement>(null)
  const [fileName,setFileName]=useState(''),[dragging,setDragging]=useState(false)
  const onDrop=async(event:React.DragEvent)=>{
    event.preventDefault();event.stopPropagation();setDragging(false)
    if(busy)return
    const items=Array.from(event.dataTransfer.items??[]).filter(item=>item.kind==='file')
    const entry=items[0]?.webkitGetAsEntry?.()
    if(entry?.isDirectory){
      if(items.length!==1){setError('请一次选择一个能力包');return}
      const files:File[]=[]
      const walk=async(node:any,prefix:string):Promise<void>=>{
        if(node.isFile){const file:File=await new Promise((resolve,reject)=>node.file(resolve,reject));Object.defineProperty(file,'webkitRelativePath',{value:prefix+node.name});files.push(file)}
        else {const reader=node.createReader();for(;;){const entries:any[]=await new Promise((resolve,reject)=>reader.readEntries(resolve,reject));if(!entries.length)break;for(const child of entries)await walk(child,prefix+node.name+'/')}}
      }
      try{await walk(entry,'');await select(files,'folder')}catch(e){setError(e instanceof Error?e.message:String(e))}
    }else await select(Array.from(event.dataTransfer.files),'zip')
  }
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;if(token.current){const id=token.current;void packageRequest('cancel-process',{token:id}).catch(()=>{}).finally(()=>discard(id))}}},[])
  const select=async(files:FileList|File[]|null,kind:'folder'|'zip')=>{
    if(!files?.length||busy)return
    if(kind==='zip'&&(files.length!==1||!files[0]!.name.toLowerCase().endsWith('.zip'))){setPreview(null);setFileName('');setError('请选择一个 ZIP 能力包');return}
    setFileName(kind==='zip'?files[0]!.name:files[0]!.webkitRelativePath.split('/')[0]??files[0]!.name)
    setBusy(true);setError('');setPreview(null);setUploaded(false);
    try{
      if(token.current){await discard(token.current);token.current=null}
      let entries:Array<[string,File]>
      if(kind==='zip')entries=[['ability.zip',files[0]!]]
      else{
        const all=new Map(Array.from(files).map(f=>[f.webkitRelativePath.split('/').slice(1).join('/'),f]))
        entries=[...all].filter(([p])=>!/(^|\/)(\.git|\.svn|\.pnpm)(\/|$)/.test(p))
      }
      if(entries.length>501||entries.reduce((n,[,f])=>n+f.size,0)>64*1024*1024)throw new Error('能力包最多 500 个交付文件、64 MiB')
      const session=await packageRequest<{token:string}>('start',{kind});token.current=session.token
      for(let i=0;i<entries.length;i++){
        const [path,file]=entries[i]!;setProgress(`正在准备 ${i+1}/${entries.length} 个文件`)
        const response=await fetch(`/api/capabilities/packages/upload/${session.token}?path=${encodeURIComponent(path)}`,{method:'PUT',credentials:'same-origin',headers:{'content-type':'application/octet-stream'},body:file})
        if(!response.ok){const value=await response.json();throw new Error(value.error??'文件上传失败')}
      }
      setUploaded(true)

    }catch(e){setError(e instanceof Error?e.message:String(e));if(token.current){await discard(token.current);token.current=null}}
    finally{setBusy(false);setProgress('')}
  }
  const submit=async()=>{
    setBusy(true);setError('')
    try{
        type Processing={status:'running'|'done'|'error';message:string;preview?:PackagePreview}
        let state=await packageRequest<Processing>('process',{token:token.current,ai,name:fileName})
        while(state.status==='running'){
          if(!alive.current)return
          setProgress(state.message);await new Promise(resolve=>setTimeout(resolve,500))
          state=await packageRequest<Processing>('processing/'+token.current)
        }
        if(state.status==='error'||!state.preview)throw new Error(state.message)
        const current=state.preview;setPreview(current);setProgress('正在添加到能力中心…')
        const result=await packageRequest<{id:string;duplicate:boolean;needsModel:boolean}>('install',{token:current.token,hash:current.hash,revision:current.revision,trusted:true,draft,applyToRoles:roles})
        await capabilityClient.refresh(true)
        onImported(result.id,result.duplicate?'内容相同，已打开现有能力。':result.needsModel?'能力已导入，请在设置中选择模型后启用。':'能力已导入，可在岗位助手中添加使用。')
    }catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setBusy(false);setProgress('')}
  }
  return <Modal title="导入能力" closeLabel="关闭能力分发" onClose={()=>{if(!busy)onClose()}}><div className={s.page+' '+s.dialogBody} onDragOver={e=>{e.preventDefault();e.stopPropagation();if(!busy)setDragging(true)}} onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setDragging(false)}} onDrop={e=>void onDrop(e)}>
    <p className={s.muted}>将能力包拖入此窗口，或选择文件后导入。</p>
    <section className={s.importDrop} data-dragging={dragging||undefined} aria-label="选择或拖入能力包">
      <p className={s.importFile} title={fileName}>{fileName||'拖入 ZIP 能力包或文件夹'}</p>
      <div className={s.importButtons}><button className={s.button} disabled={busy} onClick={()=>picker.current?.click()}>选择文件</button><button className={s.button} disabled={busy} onClick={()=>folderPicker.current?.click()}>选择文件夹</button></div>
      <input ref={picker} aria-label="选择能力包文件" type="file" hidden accept=".zip" disabled={busy} onChange={e=>{void select(e.target.files,'zip');e.target.value=''}}/>
      <input ref={folderPicker} aria-label="选择能力包文件夹" type="file" hidden disabled={busy} {...{webkitdirectory:'',directory:''}} onChange={e=>{void select(e.target.files,'folder');e.target.value=''}}/>
    </section>
    <div className={s.importButtons}><span>使用 AI 处理</span><EnableSwitch checked={ai} disabled={busy} label="使用 AI 处理" onChange={setAI}/><span className={s.muted}>使用工作台默认模型整理并适配</span></div>
    {progress&&<p role="status">{progress}</p>}{error&&<p role="alert" className={s.error}>{error}</p>}
    {uploaded&&<p className={s.muted}>仅导入可信来源的能力包；点击下方按钮即允许加载包内代码。</p>}
    {busy&&uploaded&&<button className={s.button} onClick={()=>void packageRequest('cancel-process',{token:token.current})}>停止处理</button>}
    <div className={s.confirmActions}><button className={s.button} disabled={busy} onClick={onClose}>关闭</button><button className={s.button+' '+s.primary} disabled={busy||!uploaded} onClick={()=>void submit()}>{busy?'处理中…':'导入'}</button></div>
  </div></Modal>
}
