import React, { useRef, useState } from 'react'
import type { OfflinePreview } from '../host/offline-package.ts'
import css from './inventory-tree.module.css'

export async function localPluginRequest(path:string,body?:unknown):Promise<any>{
 const response=await fetch('/api/plugin-manager/'+path,body===undefined?undefined:{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)})
 const data=await response.json();if(!response.ok)throw Error(data.error??data.message??'插件操作失败');return data
}
async function finishJob(jobId:string):Promise<void>{
 const {job}=await localPluginRequest('status?job='+encodeURIComponent(jobId))
 if(job?.phase!=='done')throw Error(job?.error??'插件尚未安装完成，请刷新查看。')
 window.dispatchEvent(new Event('dsh-local-plugins-changed'))
}
export function OfflineRollback({id,version,onChange}:{id:string;version:string;onChange:()=>Promise<void>}){
 const [confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('')
 return <div>{!confirm?<button onClick={()=>setConfirm(true)}>回退到 {version}</button>:<div role="dialog" aria-label="确认回退插件"><p>将 {id} 回退到 {version}，重启后生效。插件自己的数据保留。</p><button disabled={busy} onClick={async()=>{setBusy(true);setError('');try{const r=await localPluginRequest('rollback',{id,confirm:true});await finishJob(r.jobId);await onChange();setConfirm(false)}catch(e){setError(String(e))}finally{setBusy(false)}}}>确认回退</button><button disabled={busy} onClick={()=>setConfirm(false)}>取消</button>{error&&<p role="alert">{error}</p>}</div>}</div>
}
export function LocalPluginImport({onChange,disabled=false}:{onChange:()=>Promise<void>;disabled?:boolean}){
 const zip=useRef<HTMLInputElement>(null),folder=useRef<HTMLInputElement>(null),active=useRef(false)
 const [uploadId,setUploadId]=useState(''),[preview,setPreview]=useState<OfflinePreview>(),[busy,setBusy]=useState(false),[progress,setProgress]=useState(''),[error,setError]=useState(''),[done,setDone]=useState('')
 const discard=async()=>{if(uploadId)try{await localPluginRequest('import/discard',{uploadId})}catch{/* Expired staging is cleaned on next request. */}setUploadId('');setPreview(undefined)}
 const select=async(files:FileList|null,format:'zip'|'folder')=>{
  if(!files?.length||active.current)return;active.current=true;setBusy(true);setError('');setDone('');let id=''
  try{
   await discard();const started=await localPluginRequest('import/start',{format});id=started.uploadId;setUploadId(id)
   if(files.length>2000)throw Error('一个插件包最多支持 2,000 个文件，请使用包含构建产物的发布包。')
   for(let i=0;i<files.length;i++){
    const file=files[i]!,name=format==='zip'?'archive.zip':file.webkitRelativePath||file.name
    setProgress(`正在复制文件 ${i+1} / ${files.length}`)
    const res=await fetch('/api/plugin-manager/import/file?uploadId='+encodeURIComponent(id)+'&path='+encodeURIComponent(name),{method:'PUT',body:file})
    if(!res.ok){const err=await res.json();throw Error(err.error??'文件复制失败')}
   }
   setProgress('正在检查插件和离线依赖…');const result=await localPluginRequest('import/inspect',{uploadId:id});setPreview(result.preview)
  }catch(e){setError(String(e));if(id)try{await localPluginRequest('import/discard',{uploadId:id})}catch{}setUploadId('')}
  finally{setBusy(false);active.current=false;setProgress('');if(zip.current)zip.current.value='';if(folder.current)folder.current.value=''}
 }
 const install=async()=>{
  if(!preview||active.current)return;active.current=true;setBusy(true);setError('')
  try{
   const result=await localPluginRequest('import/commit',{uploadId,hash:preview.hash,currentHash:preview.currentHash??'',replace:preview.disposition!=='new',confirm:true})
   await finishJob(result.jobId);await onChange();setDone(preview.disposition==='identical'?'这个版本已经安装，无需重复导入。':'本地安装完成。新增条目进入未定义区，重启工作台后加载。');setPreview(undefined);setUploadId('')
  }catch(e){setError(String(e))}finally{setBusy(false);active.current=false}
 }
 return <div className={`${css.root} ${css.importBox}`}>
  <strong>导入本地插件</strong><p>选择已经构建好的插件发布包。依赖需要随包提供；安装过程不会联网，也不会执行安装脚本。</p>
  <div className={css.toolbar}><button className={css.primary} disabled={busy||disabled} onClick={()=>zip.current?.click()}>导入 ZIP 压缩包</button><button disabled={busy||disabled} onClick={()=>folder.current?.click()}>选择插件文件夹</button></div>
  <input ref={zip} hidden type="file" accept=".zip,application/zip" onChange={e=>void select(e.target.files,'zip')}/><input ref={folder} hidden type="file" multiple {...{webkitdirectory:''}} onChange={e=>void select(e.target.files,'folder')}/>
  {progress&&<p role="status">{progress}</p>}{error&&<p role="alert" className={css.error}>{error}</p>}{done&&<p role="status">{done}</p>}
  {preview&&<div className={css.preview} role="dialog" aria-label="确认本地插件导入"><strong>{preview.name}</strong><p>{preview.id}</p><dl><dt>版本</dt><dd>{preview.currentVersion?`${preview.currentVersion} → `:''}{preview.version}</dd><dt>安装内容</dt><dd>{preview.entries.length} 个插件条目 · {preview.fileCount} 个文件 · {(preview.totalBytes/1024/1024).toFixed(2)} MiB</dd><dt>分类</dt><dd>{preview.disposition==='new'?'未定义区，导入后可自行归类':'保留已有条目的分类；新增条目进入未定义区'}</dd><dt>依赖检查</dt><dd>包内 {preview.bundled.length} 项 · 底座共享 {preview.shared.length} 项 · {preview.platform}</dd></dl>
   <details><summary>查看条目和依赖</summary><p>{preview.entries.map(e=>e.id).join('、')}</p><p>{[...preview.bundled,...preview.shared.map(s=>s.name+'@'+s.version)].join('、')||'无额外依赖'}</p></details>
   {preview.scriptsSkipped.length>0&&<p>已跳过安装脚本：{preview.scriptsSkipped.join('、')}。发布包必须已包含所需构建产物。</p>}
   {preview.disposition==='replace'&&<p>版本号相同，但文件内容不同。确认后将替换当前受管副本，并保留上一版供回退。</p>}
   <p>插件代码将在重启后运行。确认安装表示允许加载这个本地插件。</p>
   <div className={css.toolbar}><button disabled={busy||disabled} onClick={()=>void install()}>{busy?'正在安装…':preview.disposition==='identical'?'确认，无需重复安装':preview.disposition==='new'?'确认安装':'确认替换版本'}</button><button disabled={busy} onClick={()=>void discard()}>取消</button></div>
  </div>}
 </div>
}
