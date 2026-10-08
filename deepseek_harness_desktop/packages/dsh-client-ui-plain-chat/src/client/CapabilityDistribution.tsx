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
  const [source,setSource]=useState<'folder'|'installed'>('folder'),[preview,setPreview]=useState<PackagePreview|null>(null)
  const installed=data.state.capabilities.filter(c=>c.versions.some(v=>v.packageHash))
  const [selected,setSelected]=useState(installed[0]?.id??''),[version,setVersion]=useState(installed[0]?.versions.at(-1)?.version??0)
  const [busy,setBusy]=useState(false),[progress,setProgress]=useState(''),[error,setError]=useState('')
  const draft='keep',roles:string[]=[]
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
  useEffect(()=>()=>{if(token.current)void discard(token.current);if(downloadUrl.current)void discardDownload(downloadUrl.current)},[])
  const select=async(files:FileList|File[]|null,kind:'folder'|'zip')=>{
    if(!files?.length||busy)return
    if(kind==='zip'&&(files.length!==1||!files[0]!.name.toLowerCase().endsWith('.zip'))){setPreview(null);setFileName('');setError('请选择一个 ZIP 能力包');return}
    setFileName(kind==='zip'?files[0]!.name:files[0]!.webkitRelativePath.split('/')[0]??files[0]!.name)
    setBusy(true);setError('');setPreview(null);
    try{
      if(token.current){await discard(token.current);token.current=null}
      let entries:Array<[string,File]>
      if(kind==='zip')entries=[['ability.zip',files[0]!]]
      else{
        const all=new Map(Array.from(files).map(f=>[f.webkitRelativePath.split('/').slice(1).join('/'),f]))
        if(!all.has('capability.json')){
          const roots=[...all.keys()].filter(p=>p.endsWith('/capability.json'))
          if(roots.length===1){const prefix=roots[0]!.slice(0,-'capability.json'.length);const nested=[...all].filter(([p])=>p.startsWith(prefix)).map(([p,f])=>[p.slice(prefix.length),f] as const);all.clear();for(const [p,f] of nested)all.set(p,f)}
        }
        const entry=all.get('capability.json')
        if(!entry||entry.size>256*1024)throw new Error('请选择根目录含 capability.json 的开发交付目录')
        const manifest=JSON.parse((await entry.text()).replace(/^\uFEFF/,''))
        if(!manifest.files||typeof manifest.files!=='object'||Array.isArray(manifest.files))throw new Error('交付清单需要 files 字段')
        entries=[['capability.json',entry],...Object.keys(manifest.files).map(path=>{const file=all.get(path);if(!file)throw new Error(`交付清单中的文件不存在：${path}`);return [path,file] as [string,File]})]
      }
      if(entries.length>501||entries.reduce((n,[,f])=>n+f.size,0)>64*1024*1024)throw new Error('能力包最多 500 个交付文件、64 MiB')
      const session=await packageRequest<{token:string}>('start',{kind});token.current=session.token
      for(let i=0;i<entries.length;i++){
        const [path,file]=entries[i]!;setProgress(`正在准备 ${i+1}/${entries.length} 个文件`)
        const response=await fetch(`/api/capabilities/packages/upload/${session.token}?path=${encodeURIComponent(path)}`,{method:'PUT',credentials:'same-origin',headers:{'content-type':'application/octet-stream'},body:file})
        if(!response.ok){const value=await response.json();throw new Error(value.error??'文件上传失败')}
      }
      setProgress('正在读取文件…')
      setPreview(await packageRequest<PackagePreview>('inspect',{token:session.token}))
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
        const current=await packageRequest<PackagePreview>('inspect',{token:preview!.token})
        const result=await packageRequest<{id:string;duplicate:boolean;needsModel:boolean}>('install',{token:preview!.token,hash:preview!.hash,revision:current.revision,trusted:true,draft,applyToRoles:roles})
        await capabilityClient.refresh(true)
        onImported(result.id,result.duplicate?'此版本已安装，已打开现有能力。':result.needsModel?'能力已导入，请在设置中选择模型后启用。':'能力已导入，组件状态已重新核对。岗位授权保持原有范围。')
      }
    }catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setBusy(false)}
  }
  const cap=installed.find(c=>c.id===selected),published=cap?.versions.find(v=>v.version===version),release=published?.packageHash?data.state.packageReleases?.[published.packageHash]:undefined
  const m=mode==='export'&&source==='installed'?release?.manifest:preview?.manifest
  const ready=mode==='export'&&source==='installed'?!!release:!!preview
  return <Modal title={mode==='import'?'导入能力':'导出能力'} closeLabel="关闭能力分发" onClose={()=>{if(!busy)onClose()}}><div className={`${s.page} ${s.dialogBody}`} onDragOver={mode==='import'?e=>{e.preventDefault();e.stopPropagation();if(!busy)setDragging(true)}:undefined} onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setDragging(false)}} onDrop={mode==='import'?e=>void onDrop(e):undefined}>
    <p className={s.muted}>{mode==='import'?'将能力包拖入此窗口，或选择文件后导入。':'从开发交付目录或已安装的完整版本生成一个 ZIP，交给其他工作台导入。'}</p>
    {mode==='export'&&<label className={s.field}>导出来源<select disabled={busy} value={source} onChange={e=>setSource(e.target.value as typeof source)}><option value="folder">本地开发目录</option><option value="installed">已安装能力</option></select></label>}
    {mode==='export'&&source==='installed'?<>
      <label className={s.field}>能力<select disabled={busy||!installed.length} value={selected} onChange={e=>{setSelected(e.target.value);setVersion(installed.find(c=>c.id===e.target.value)?.versions.at(-1)?.version??0)}}>{installed.map(c=><option value={c.id} key={c.id}>{c.versions.at(-1)?.name??c.draft.name}{c.removedAt?'（已移除）':''}</option>)}</select></label>
      <label className={s.field}>完整发布版本<select disabled={busy||!cap} value={version} onChange={e=>setVersion(Number(e.target.value))}>{cap?.versions.filter(v=>v.packageHash).map(v=><option value={v.version} key={v.version}>本地 v{v.version} · 包 {data.state.packageReleases?.[v.packageHash!]?.manifest.version}</option>)}</select></label>
      {!installed.length&&<p className={s.notice}>还没有可分发的已安装能力。你可以直接选择外部开发目录导出。</p>}
      <p className={s.muted}>此处列出带完整执行包的版本。工作台内置服务随应用交付，其专用工作区不能独立导出。</p>
      {published&&release&&definitionChanged(published,packageDefinition(release.manifest))&&<p className={s.notice}>此版本含本地修改，将使用新的派生作品标识并保留原作来源，不覆盖制作者原版。</p>}
    </>:mode==='import'?<section className={s.importDrop} data-dragging={dragging||undefined} aria-label="选择或拖入能力包">
      <p className={s.importFile} title={fileName}>{fileName||'拖入 ZIP 能力包或交付文件夹'}</p>
      <div className={s.importButtons}><button className={s.button} disabled={busy} onClick={()=>picker.current?.click()}>选择文件</button><button className={s.button} disabled={busy} onClick={()=>folderPicker.current?.click()}>选择文件夹</button></div>
      <input ref={picker} aria-label="选择能力包文件" type="file" hidden accept=".zip" disabled={busy} onChange={e=>{void select(e.target.files,'zip');e.target.value=''}}/>
      <input ref={folderPicker} aria-label="选择能力包文件夹" type="file" hidden disabled={busy} {...{webkitdirectory:'',directory:''}} onChange={e=>{void select(e.target.files,'folder');e.target.value=''}}/>
    </section>:<label className={s.field}>选择开发交付目录<input type="file" disabled={busy} {...{webkitdirectory:'',directory:''}} onChange={e=>{void select(e.target.files,'folder');e.target.value=''}}/></label>}
    {mode==='export'&&source==='folder'&&<p className={s.muted}>读取 capability.json 和清单中的已构建文件；不会运行工程安装或构建脚本。</p>}
    {m&&mode==='export'&&<section aria-label="能力包预览"><h3>{m.name} <small>v{m.version}</small></h3><p>{m.description}</p><p className={s.muted}>{m.author} · {m.license}</p>
      <p>{m.components.length} 个执行组件 · {m.components.reduce((n,c)=>n+c.actions.length,0)} 个动作{preview&&!(mode==='export'&&source==='installed')?` · ${preview.fileCount} 个文件 · ${(preview.bytes/1024).toFixed(1)} KiB`:''}</p>
      <ul className={s.list}>{m.components.map(c=><li key={c.id}>{c.name}：{c.actions.map(a=>a.name).join('、')}</li>)}</ul>
      {m.permissions.includes('model')&&<p>使用工作台模型；账号与密钥由接收方本机提供。</p>}
      <details className={s.detailDisclosure}><summary>来源与交付清单</summary><p className={s.muted}>{m.id} · {m.protocol}</p><p>本机配置、岗位授权与任务记录不参与导出。</p><ul className={s.list}>{Object.keys(m.files).map(path=><li key={path}>{path}</li>)}</ul></details>
    </section>}
    {progress&&<p role="status">{progress}</p>}{exported&&<a className={s.button} href={exported.url} download={exported.name}>保存 {exported.name}</a>}{error&&<p role="alert" className={s.error}>{error}</p>}
    {mode==='import'&&preview&&<p className={s.muted}>仅导入可信来源的能力包；点击下方按钮即允许加载包内代码。</p>}
    <div className={s.confirmActions}><button className={s.button} disabled={busy} onClick={onClose}>关闭</button><button className={`${s.button} ${s.primary}`} disabled={busy||!ready} onClick={()=>void submit()}>{busy?'处理中…':mode==='export'?'导出能力包':preview?.existing?.duplicate?'打开已有能力':preview?.existing?'更新能力':preview?.needsModel?'导入并配置':'导入并启用'}</button></div>
  </div></Modal>
}
