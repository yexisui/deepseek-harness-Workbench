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
  const [busy,setBusy]=useState(false),[progress,setProgress]=useState(''),[error,setError]=useState(''),[trusted,setTrusted]=useState(false)
  const [draft,setDraft]=useState<'keep'|'replace'>('keep'),[roles,setRoles]=useState<string[]>([])
  const [exported,setExported]=useState<{id:string;url:string;name:string}|null>(null)
  const downloadUrl=useRef<string|null>(null)
  const token=useRef<string|null>(null)
  useEffect(()=>()=>{if(token.current)void discard(token.current);if(downloadUrl.current)void discardDownload(downloadUrl.current)},[])
  const select=async(files:FileList|null,kind:'folder'|'zip')=>{
    if(!files?.length||busy)return
    setBusy(true);setError('');setPreview(null);setTrusted(false);setRoles([]);setDraft('keep')
    try{
      if(token.current){await discard(token.current);token.current=null}
      let entries:Array<[string,File]>
      if(kind==='zip')entries=[['ability.zip',files[0]!]]
      else{
        const all=new Map(Array.from(files).map(f=>[f.webkitRelativePath.split('/').slice(1).join('/'),f]))
        const entry=all.get('capability.json')
        if(!entry||entry.size>256*1024)throw new Error('请选择根目录含 capability.json 的开发交付目录')
        const manifest=JSON.parse(await entry.text())
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
      setProgress('正在检查能力包…')
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
        const result=await packageRequest<{id:string;duplicate:boolean;needsModel:boolean}>('install',{token:preview!.token,hash:preview!.hash,revision:preview!.revision,trusted,draft,applyToRoles:roles})
        await capabilityClient.refresh(true)
        onImported(result.id,result.duplicate?'此版本已安装，已打开现有能力。':result.needsModel?'能力已导入，请在设置中选择模型后启用。':'能力已导入，组件状态已重新核对。岗位授权保持原有范围。')
      }
    }catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setBusy(false)}
  }
  const cap=installed.find(c=>c.id===selected),published=cap?.versions.find(v=>v.version===version),release=published?.packageHash?data.state.packageReleases?.[published.packageHash]:undefined
  const m=mode==='export'&&source==='installed'?release?.manifest:preview?.manifest
  const linked=preview?.existing?data.state.roles.filter(r=>r.versions.at(-1)?.capabilities.some(b=>b.capabilityId===preview.existing!.id)):[]
  const ready=mode==='export'&&source==='installed'?!!release:!!preview
  return <Modal title={mode==='import'?'导入能力':'导出能力'} closeLabel="关闭能力分发" onClose={()=>{if(!busy)onClose()}}><div className={`${s.page} ${s.dialogBody}`}>
    <p className={s.muted}>{mode==='import'?'选择制作者提供的完整能力包，检查后即可导入。':'从开发交付目录或已安装的完整版本生成一个 ZIP，交给其他工作台导入。'}</p>
    {mode==='export'&&<label className={s.field}>导出来源<select disabled={busy} value={source} onChange={e=>setSource(e.target.value as typeof source)}><option value="folder">本地开发目录</option><option value="installed">已安装能力</option></select></label>}
    {mode==='export'&&source==='installed'?<>
      <label className={s.field}>能力<select disabled={busy||!installed.length} value={selected} onChange={e=>{setSelected(e.target.value);setVersion(installed.find(c=>c.id===e.target.value)?.versions.at(-1)?.version??0)}}>{installed.map(c=><option value={c.id} key={c.id}>{c.versions.at(-1)?.name??c.draft.name}{c.removedAt?'（已移除）':''}</option>)}</select></label>
      <label className={s.field}>完整发布版本<select disabled={busy||!cap} value={version} onChange={e=>setVersion(Number(e.target.value))}>{cap?.versions.filter(v=>v.packageHash).map(v=><option value={v.version} key={v.version}>本地 v{v.version} · 包 {data.state.packageReleases?.[v.packageHash!]?.manifest.version}</option>)}</select></label>
      {!installed.length&&<p className={s.notice}>还没有可分发的已安装能力。你可以直接选择外部开发目录导出。</p>}
      <p className={s.muted}>此处列出带完整执行包的版本。工作台内置服务随应用交付，其专用工作区不能独立导出。</p>
      {published&&release&&definitionChanged(published,packageDefinition(release.manifest))&&<p className={s.notice}>此版本含本地修改，将使用新的派生作品标识并保留原作来源，不覆盖制作者原版。</p>}
    </>:<label className={s.field}>{mode==='import'?'选择能力包（ZIP）':'选择开发交付目录'}<input type="file" disabled={busy} accept={mode==='import'?'.zip':undefined} {...(mode==='export'?{webkitdirectory:'',directory:''}:{})} onChange={e=>{void select(e.target.files,mode==='import'?'zip':'folder');e.target.value=''}}/></label>}
    {mode==='export'&&source==='folder'&&<p className={s.muted}>读取 capability.json 和清单中的已构建文件；不会运行工程安装或构建脚本。</p>}
    {m&&<section aria-label="能力包预览"><h3>{m.name} <small>v{m.version}</small></h3><p>{m.description}</p><p className={s.muted}>{m.author} · {m.license}</p>
      <p>{m.components.length} 个执行组件 · {m.components.reduce((n,c)=>n+c.actions.length,0)} 个动作{preview&&!(mode==='export'&&source==='installed')?` · ${preview.fileCount} 个文件 · ${(preview.bytes/1024).toFixed(1)} KiB`:''}</p>
      <ul className={s.list}>{m.components.map(c=><li key={c.id}>{c.name}：{c.actions.map(a=>a.name).join('、')}</li>)}</ul>
      {m.permissions.includes('model')&&<p>使用工作台模型；账号与密钥由接收方本机提供。</p>}
      {mode==='import'&&preview&&<>
        <p className={s.notice}>{preview.trust}</p>
        <label className={s.check}><input type="checkbox" disabled={busy} checked={trusted} onChange={e=>setTrusted(e.target.checked)}/>我信任此制作者及包内执行代码</label>
        {preview.needsModel&&<p>导入后选择工作台模型即可启用，当前不会运行任何任务。</p>}
        {preview.existing&&<><p>{preview.existing.duplicate?'此包已安装，将直接打开现有能力。':`更新现有能力：包 v${preview.existing.version} → v${m.version}`}</p>{!preview.existing.duplicate&&<><ul className={s.list}>{preview.existing.changes.map(v=><li key={v}>{v}</li>)}</ul>
          {preview.existing.draftChanged&&<label className={s.field}>发现本地未发布修改<select disabled={busy} value={draft} onChange={e=>setDraft(e.target.value as typeof draft)}><option value="keep">保留当前草稿</option><option value="replace">保存备份后替换为导入内容</option></select></label>}
          <details className={s.detailDisclosure}><summary>更新岗位引用（默认保持原版本）</summary><p>仅下方勾选的岗位会生成采用新版的岗位版本；已有岗位草稿与会话保留。</p>{linked.map(role=><label className={s.check} key={role.id}><input type="checkbox" disabled={busy} checked={roles.includes(role.id)} onChange={e=>setRoles(e.target.checked?[...roles,role.id]:roles.filter(id=>id!==role.id))}/>{role.draft.name}</label>)}{!linked.length&&<p>暂无岗位引用。</p>}</details></>}
        </>}
      </>}
      <details className={s.detailDisclosure}><summary>来源与交付清单</summary><p className={s.muted}>{m.id} · {m.protocol}</p><p>本机配置、岗位授权与任务记录不参与导出。</p><ul className={s.list}>{Object.keys(m.files).map(path=><li key={path}>{path}</li>)}</ul></details>
    </section>}
    {progress&&<p role="status">{progress}</p>}{exported&&<a className={s.button} href={exported.url} download={exported.name}>保存 {exported.name}</a>}{error&&<p role="alert" className={s.error}>{error}</p>}
    {preview&&preview.revision!==data.state.revision&&mode==='import'&&!preview.existing?.duplicate&&<p className={s.notice}>能力清单有更新，请重新检查后导入。<button className={s.button} disabled={busy} onClick={()=>{setBusy(true);void packageRequest<PackagePreview>('inspect',{token:preview.token}).then(setPreview).catch(e=>setError(String(e.message))).finally(()=>setBusy(false))}}>重新检查</button></p>}
    <div className={s.confirmActions}><button className={s.button} disabled={busy} onClick={onClose}>关闭</button><button className={`${s.button} ${s.primary}`} disabled={busy||!ready||(mode==='import'&&(!trusted||preview?.revision!==data.state.revision&&!preview?.existing?.duplicate))} onClick={()=>void submit()}>{busy?'处理中…':mode==='export'?'导出能力包':preview?.existing?.duplicate?'打开已有能力':preview?.existing?'更新能力':preview?.needsModel?'导入并配置':'导入并启用'}</button></div>
  </div></Modal>
}
