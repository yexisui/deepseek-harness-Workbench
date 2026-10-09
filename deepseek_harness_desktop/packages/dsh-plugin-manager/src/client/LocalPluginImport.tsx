import React, { useEffect, useRef, useState } from 'react'
import { InventoryIcon } from './InventoryIcon.tsx'
import { pluginResponse } from './plugin-request.ts'
import type { OfflinePreview } from '../core/offline-preview.ts'
import css from './inventory-tree.module.css'

export async function localPluginRequest(path:string,body?:unknown):Promise<any>{
 const response=await fetch('/api/plugin-manager/'+path,body===undefined?undefined:{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)})
 return pluginResponse(response)
}
async function finishJob(jobId:string):Promise<void>{
 const {job}=await localPluginRequest('status?job='+encodeURIComponent(jobId))
 if(job?.phase!=='done')throw Error(job?.error??'插件尚未安装完成，请刷新查看。')
 window.dispatchEvent(new Event('dsh-local-plugins-changed'))
}
export function LocalPluginImport({onChange,disabled=false,compact=false,onImported}:{onChange:()=>Promise<void>;disabled?:boolean;compact?:boolean;onImported?:(preview:OfflinePreview)=>void}){
 const zip=useRef<HTMLInputElement>(null),folder=useRef<HTMLInputElement>(null),active=useRef(false)
 const [uploadId,setUploadId]=useState(''),[preview,setPreview]=useState<OfflinePreview>(),[busy,setBusy]=useState(false),[progress,setProgress]=useState(''),[error,setError]=useState(''),[done,setDone]=useState('')
 const [menu,setMenu]=useState(false),[open,setOpen]=useState(false)
 const dialog=useRef<HTMLDialogElement>(null),anchor=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null)
 useEffect(()=>{if(!compact)return;const d=dialog.current;if(open&&!d?.open)d?.showModal();else if(!open&&d?.open){d.close();trigger.current?.focus()}},[open,compact])
 useEffect(()=>{if(!menu)return;const outside=(e:PointerEvent)=>{if(!anchor.current?.contains(e.target as Node))setMenu(false)};document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside)},[menu])
 useEffect(()=>{if(!busy)return;const guard=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue=''};window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard)},[busy])
 const discard=async()=>{if(uploadId)try{await localPluginRequest('import/discard',{uploadId})}catch{/* Expired staging is cleaned on next request. */}setUploadId('');setPreview(undefined)}
 const close=async()=>{if(active.current)return;await discard();setOpen(false)}
 const select=async(files:FileList|null,format:'zip'|'folder')=>{
  if(!files?.length||active.current)return;active.current=true;setBusy(true);setError('');setDone('');setMenu(false);setOpen(true);let id=''
  try{
   await discard();const started=await localPluginRequest('import/start',{format});id=started.uploadId;setUploadId(id)
   if(files.length>2000)throw Error('一个插件包最多支持 2,000 个文件，请使用包含构建产物的发布包。')
   for(let i=0;i<files.length;i++){
    const file=files[i]!,name=format==='zip'?'archive.zip':file.webkitRelativePath||file.name
    setProgress(`正在复制文件 ${i+1} / ${files.length}`)
    const res=await fetch('/api/plugin-manager/import/file?uploadId='+encodeURIComponent(id)+'&path='+encodeURIComponent(name),{method:'PUT',body:file})
    if(!res.ok)await pluginResponse(res)
   }
   setProgress('正在检查插件和离线依赖…');const result=await localPluginRequest('import/inspect',{uploadId:id});setPreview(result.preview)
  }catch(e){setError(String(e));if(id)try{await localPluginRequest('import/discard',{uploadId:id})}catch{}setUploadId('')}
  finally{setBusy(false);active.current=false;setProgress('');if(zip.current)zip.current.value='';if(folder.current)folder.current.value=''}
 }
 const install=async()=>{
  if(!preview||active.current)return;active.current=true;setBusy(true);setError('')
  try{
   const result=await localPluginRequest('import/commit',{uploadId,hash:preview.hash,currentHash:preview.currentHash??'',replace:preview.disposition!=='new',confirm:true})
   await finishJob(result.jobId);await onChange();onImported?.(preview);if(compact)setOpen(false);setDone(preview.disposition==='identical'?'内容相同，无需重复导入。':'本地安装完成。新增条目进入未定义区，重启工作台后加载。');setPreview(undefined);setUploadId('')
  }catch(e){setError(String(e))}finally{setBusy(false);active.current=false}
 }
 const content=<div className={`${css.root} ${css.importBox}`}>
  <div className={css.importTitle}><strong id="local-plugin-import-title">导入本地插件</strong>{compact&&<button aria-label="关闭导入" disabled={busy} onClick={()=>void close()}>×</button>}</div><p>选择已经构建好的插件发布包。依赖需要随包提供；安装过程不会联网，也不会执行安装脚本。</p>
  {!compact&&<div className={css.toolbar}><button className={css.primary} disabled={busy||disabled} onClick={()=>zip.current?.click()}>导入 ZIP 压缩包</button><button disabled={busy||disabled} onClick={()=>folder.current?.click()}>选择插件文件夹</button></div>}
  {progress&&<p role="status">{progress}</p>}{error&&<p role="alert" className={css.error}>{error}</p>}{done&&<p role="status">{done}</p>}
  {preview&&<div className={css.preview} role={compact?undefined:'dialog'} aria-label="确认本地插件导入"><strong>{preview.name}</strong><p>{preview.id}</p><dl><dt>版本</dt><dd>{preview.currentVersion?`${preview.currentVersion} → `:''}{preview.version}</dd><dt>安装内容</dt><dd>{preview.entries.length} 个插件条目 · {preview.fileCount} 个文件 · {(preview.totalBytes/1024/1024).toFixed(2)} MiB</dd><dt>分类</dt><dd>{preview.disposition==='new'?'未定义区，导入后可自行归类':'保留已有条目的分类；新增条目进入未定义区'}</dd><dt>依赖检查</dt><dd>包内 {preview.bundled.length} 项 · 底座共享 {preview.shared.length} 项 · {preview.platform}</dd></dl>
   <details><summary>查看条目和依赖</summary><p>{preview.entries.map(e=>e.id).join('、')}</p><p>{[...preview.bundled,...preview.shared.map(s=>s.name+'@'+s.version)].join('、')||'无额外依赖'}</p></details>
   {preview.scriptsSkipped.length>0&&<p>已跳过安装脚本：{preview.scriptsSkipped.join('、')}。发布包必须已包含所需构建产物。</p>}
   {preview.disposition==='replace'&&<p>内容已有变化，确认后更新当前插件。</p>}
   <p>插件代码将在重启后运行。确认安装表示允许加载这个本地插件。</p>
   <div className={css.toolbar}><button disabled={busy||disabled} onClick={()=>void install()}>{busy?'正在安装…':preview.disposition==='identical'?'确认，无需重复安装':preview.disposition==='new'?'确认安装':'更新插件'}</button><button disabled={busy} onClick={()=>void (compact?close():discard())}>取消</button></div>
  </div>}
 </div>
 return <><input ref={zip} hidden type="file" accept=".zip,application/zip" onChange={e=>void select(e.target.files,'zip')}/><input ref={folder} hidden type="file" multiple {...{webkitdirectory:''}} onChange={e=>void select(e.target.files,'folder')}/>{compact?<div className={css.importControl} ref={anchor} onKeyDown={e=>{if(e.key==='Escape'&&!open){e.stopPropagation();setMenu(false);trigger.current?.focus()}}}>
  <button ref={trigger} className={css.toolButton} aria-label="导入插件" aria-expanded={menu} disabled={disabled||busy} onClick={()=>setMenu(!menu)}><InventoryIcon name="plus"/>导入<span aria-hidden="true">⌄</span></button>
  {menu&&<div className={css.importMenu} role="group" aria-label="选择导入方式"><button onClick={()=>{setMenu(false);zip.current?.click()}}>导入 ZIP 压缩包</button><button onClick={()=>{setMenu(false);folder.current?.click()}}>选择插件文件夹</button></div>}
  <dialog ref={dialog} className={css.importDialog} aria-labelledby="local-plugin-import-title" onCancel={e=>{e.preventDefault();void close()}}>{content}</dialog>
 </div>:content}</>
}
