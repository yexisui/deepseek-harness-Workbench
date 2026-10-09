import { EnableSwitch } from '../../../../shared/client/EnableSwitch.tsx'
import React, { useEffect, useRef, useState } from 'react'
import type { Snapshot } from '../../../dsh-capabilities/src/core/model.ts'
import { definitionChanged, packageDefinition, type PackagePreview } from '../../../dsh-capabilities/src/core/distribution.ts'
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

export function CapabilityDistribution({mode,data,onClose,onImported}:{mode:'import'|'export';data:Snapshot;onClose:()=>void;onImported:(id:string,message:string)=>void}){
  const [source,setSource]=useState<'folder'|'installed'>('installed'),[preview,setPreview]=useState<PackagePreview|null>(null)
  const installed=data.state.capabilities.filter(c=>!c.removedAt&&c.versions.at(-1)?.packageHash)
  const [selected,setSelected]=useState(installed[0]?.id??''),[version,setVersion]=useState(installed[0]?.versions.at(-1)?.version??0)
  const [busy,setBusy]=useState(false),[progress,setProgress]=useState(''),[error,setError]=useState('')
  const [ai,setAI]=useState(true),[uploaded,setUploaded]=useState(false)
  const alive=useRef(true)
  const draft='replace',roles:string[]=[]
  const [exported,setExported]=useState<{id:string;url:string;name:string}|null>(null)
  const downloadUrl=useRef<string|null>(null)
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
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;if(token.current){const id=token.current;void packageRequest('cancel-process',{token:id}).catch(()=>{}).finally(()=>discard(id))}if(downloadUrl.current)void discardDownload(downloadUrl.current)}},[])
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
      if(mode==='export')setPreview(await packageRequest<PackagePreview>('inspect',{token:session.token}))
    }catch(e){setError(e instanceof Error?e.message:String(e));if(token.current){await discard(token.current);token.current=null}}
    finally{setBusy(false);setProgress('')}
  }
  const submit=async()=>{
    setBusy(true);setError('')
    try{
      if(mode==='export'){
        const file=await download(source==='installed'?{id:selected,version}:{token:preview!.token,hash:preview!.hash})
        if(downloadUrl.current)URL.revokeObjectURL(downloadUrl.current);downloadUrl.current=file.id;setExported(file)
        setProgress('能力包已生成。如果浏览器未自动保存，可点击下方文件名。')
      }else{
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
      }
    }catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setBusy(false);setProgress('')}
  }
  const cap=installed.find(c=>c.id===selected),published=cap?.versions.find(v=>v.version===version),release=published?.packageHash?data.state.packageReleases?.[published.packageHash]:undefined
  const m=mode==='export'&&source==='installed'?release?.manifest:preview?.manifest
  const ready=mode==='import'?uploaded:source==='installed'?!!release:!!preview
  return <Modal title={mode==='import'?'导入能力':'导出能力'} closeLabel="关闭能力分发" onClose={()=>{if(!busy)onClose()}}><div className={`${s.page} ${s.dialogBody}`} onDragOver={mode==='import'?e=>{e.preventDefault();e.stopPropagation();if(!busy)setDragging(true)}:undefined} onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setDragging(false)}} onDrop={mode==='import'?e=>void onDrop(e):undefined}>
    <p className={s.muted}>{mode==='import'?'将能力包拖入此窗口，或选择文件后导入。':'将当前能力导出为 ZIP，可在其他工作台导入。'}</p>
    {mode==='export'&&<label className={s.field}>导出来源<select disabled={busy} value={source} onChange={e=>setSource(e.target.value as typeof source)}><option value="folder">本地开发目录</option><option value="installed">已安装能力</option></select></label>}
    {mode==='export'&&source==='installed'?<>
      <label className={s.field}>能力<select disabled={busy||!installed.length} value={selected} onChange={e=>{setSelected(e.target.value);setVersion(installed.find(c=>c.id===e.target.value)?.versions.at(-1)?.version??0)}}>{installed.map(c=><option value={c.id} key={c.id}>{c.versions.at(-1)?.name??c.draft.name}{c.removedAt?'（已移除）':''}</option>)}</select></label>
      {!installed.length&&<p className={s.notice}>还没有可分发的已安装能力。你可以直接选择外部开发目录导出。</p>}
      <p className={s.muted}>导出当前使用的能力。工作台内置服务随应用交付，其专用工作区不能独立导出。</p>
      {published&&release&&definitionChanged(published,packageDefinition(release.manifest))&&<p className={s.notice}>将一并导出你保存的修改。</p>}
    </>:mode==='import'?<section className={s.importDrop} data-dragging={dragging||undefined} aria-label="选择或拖入能力包">
      <p className={s.importFile} title={fileName}>{fileName||'拖入 ZIP 能力包或交付文件夹'}</p>
      <div className={s.importButtons}><button className={s.button} disabled={busy} onClick={()=>picker.current?.click()}>选择文件</button><button className={s.button} disabled={busy} onClick={()=>folderPicker.current?.click()}>选择文件夹</button></div>
      <input ref={picker} aria-label="选择能力包文件" type="file" hidden accept=".zip" disabled={busy} onChange={e=>{void select(e.target.files,'zip');e.target.value=''}}/>
      <input ref={folderPicker} aria-label="选择能力包文件夹" type="file" hidden disabled={busy} {...{webkitdirectory:'',directory:''}} onChange={e=>{void select(e.target.files,'folder');e.target.value=''}}/>
    </section>:<label className={s.field}>选择开发交付目录<input type="file" disabled={busy} {...{webkitdirectory:'',directory:''}} onChange={e=>{void select(e.target.files,'folder');e.target.value=''}}/></label>}
    {mode==='import'&&<div className={s.importButtons}><span>使用 AI 处理</span><EnableSwitch checked={ai} disabled={busy} label="使用 AI 处理" onChange={setAI}/><span className={s.muted}>使用工作台默认模型整理并适配</span></div>}
    {mode==='export'&&source==='folder'&&<p className={s.muted}>读取 capability.json 和清单中的已构建文件；不会运行工程安装或构建脚本。</p>}
    {m&&mode==='export'&&<section aria-label="能力包预览"><h3>{m.name}</h3><p>{m.description}</p><p className={s.muted}>{m.author} · {m.license}</p>
      <p>{m.components.length} 个执行组件 · {m.components.reduce((n,c)=>n+c.actions.length,0)} 个动作{preview&&!(mode==='export'&&source==='installed')?` · ${preview.fileCount} 个文件 · ${(preview.bytes/1024).toFixed(1)} KiB`:''}</p>
      <ul className={s.list}>{m.components.map(c=><li key={c.id}>{c.name}：{c.actions.map(a=>a.name).join('、')}</li>)}</ul>
      {m.permissions.includes('model')&&<p>使用工作台模型；账号与密钥由接收方本机提供。</p>}
      <details className={s.detailDisclosure}><summary>来源与交付清单</summary><p className={s.muted}>{m.id} · {m.protocol}</p><p>本机配置、岗位授权与任务记录不参与导出。</p><ul className={s.list}>{Object.keys(m.files).map(path=><li key={path}>{path}</li>)}</ul></details>
    </section>}
    {progress&&<p role="status">{progress}</p>}{exported&&<a className={s.button} href={exported.url} download={exported.name}>保存 {exported.name}</a>}{error&&<p role="alert" className={s.error}>{error}</p>}
    {mode==='import'&&uploaded&&<p className={s.muted}>仅导入可信来源的能力包；点击下方按钮即允许加载包内代码。</p>}
    {mode==='import'&&busy&&uploaded&&<button className={s.button} onClick={()=>void packageRequest('cancel-process',{token:token.current})}>停止处理</button>}
    <div className={s.confirmActions}><button className={s.button} disabled={busy} onClick={onClose}>关闭</button><button className={`${s.button} ${s.primary}`} disabled={busy||!ready} onClick={()=>void submit()}>{busy?'处理中…':mode==='export'?'导出能力包':'导入'}</button></div>
  </div></Modal>
}
