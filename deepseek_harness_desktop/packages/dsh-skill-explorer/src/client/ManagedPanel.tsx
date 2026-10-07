import React,{useEffect,useRef,useState} from 'react'
import {PillCheckbox} from '../../../../shared/client/PillCheckbox.tsx'
import {Modal} from '../../../dsh-client-ui-plain-chat/src/client/PreviewModal.tsx'
import {SkillsCenter} from './SkillsCenter.tsx'
import {managedRequest as request} from './managed-api.ts'
import type {ManagedSkill} from '../managed.ts'
import s from '../../../dsh-client-ui-plain-chat/src/client/ManagedCapabilities.module.css'
import css from './managed-panel.module.css'
interface Preview {id:string;candidates:{key:string;name:string;description:string;warnings:string[];error?:string;fileCount:number;existing:{id:string;hash:string}[]}[]}
interface Choice {key:string;mode:'copy'|'update';name?:string}
export function ManagedPanel(){
 const [snapshot,setSnapshot]=useState<{revision:number;skills:ManagedSkill[];projects:string[]}>({revision:0,skills:[],projects:[]}),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[preview,setPreview]=useState<Preview>(),[choices,setChoices]=useState<Choice[]>([]),[importing,setImporting]=useState(false)
 const lock=useRef(false),file=useRef<HTMLInputElement>(null),folder=useRef<HTMLInputElement>(null)
 const reload=async()=>setSnapshot(await request('list'))
 useEffect(()=>{void reload().catch(e=>setError(String(e)))},[])
 const run=async(action:()=>Promise<void>)=>{if(lock.current)return;lock.current=true;setBusy(true);setError('');try{await action()}catch(e){setError(e instanceof Error?e.message:String(e))}finally{lock.current=false;setBusy(false)}}
 const change=(row:ManagedSkill,action:string,value?:unknown)=>void run(async()=>{await request('change',{id:row.id,revision:snapshot.revision,action,value});await reload();setNotice('')})
 const upload=(files:FileList|null)=>{if(!files?.length)return;const entries=Array.from(files);void run(async()=>{
  if(entries.length>500||entries.reduce((n,f)=>n+f.size,0)>32*1024*1024)throw Error('最多 500 个文件、32 MiB')
  const payload=[];for(const item of entries){const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(item)});payload.push({path:item.webkitRelativePath||item.name,data})}
  const p:Preview=await request('inspect',{scope:'global',files:payload,zip:entries.length===1&&entries[0].name.toLowerCase().endsWith('.zip')});setPreview(p);setChoices(p.candidates.filter(c=>!c.error).map(c=>({key:c.key,mode:'update'})))
 })}
 const close=()=>{if(busy)return;void run(async()=>{if(preview)await request('discard',{id:preview.id});setPreview(undefined);setChoices([]);setImporting(false)})}
 return <><SkillsCenter snapshot={snapshot} busy={busy} error={error} onImport={()=>{setNotice('');setImporting(true)}} reload={()=>void run(reload)} change={change}/>{notice&&<p role="status">{notice}</p>}{importing&&<Modal title="导入技能" closeLabel="关闭导入" onClose={close}><div className={`${s.page} ${s.dialogBody} ${css.importBody}`}><p>选择包含 SKILL.md 的文件夹或 ZIP，也可导入单个 SKILL.md。</p>   {!preview?<><div className={s.actions}><button className={s.button} disabled={busy} onClick={()=>file.current?.click()}>选择 ZIP / SKILL.md</button><button className={s.button} disabled={busy} onClick={()=>folder.current?.click()}>选择文件夹</button></div><input ref={file} type="file" accept=".zip,.md" hidden onChange={e=>upload(e.target.files)}/><input ref={folder} type="file" multiple hidden {...{webkitdirectory:''} as any} onChange={e=>upload(e.target.files)}/></>:<><p>选择要导入的技能；更新会保留旧版本，已有技能开关保持。</p>{preview.candidates.map(c=>{const selected=choices.find(x=>x.key===c.key);return <div className={s.row} key={c.key}><label><PillCheckbox type="checkbox" disabled={!!c.error||busy} checked={!!selected} onChange={e=>setChoices(old=>e.target.checked?[...old,{key:c.key,mode:'update'}]:old.filter(x=>x.key!==c.key))}/>{c.name||c.key} · {c.fileCount} 个文件</label><p>{c.description}</p>{c.error&&<p role="alert">{c.error}</p>}{c.warnings.map(w=><p key={w}>{w}</p>)}{selected&&<><select aria-label={'导入方式 '+c.name} value={selected.mode} onChange={e=>setChoices(old=>old.map(x=>x.key===c.key?{...x,mode:e.target.value as Choice['mode']}:x))}><option value="update">{c.existing.length?'更新已有技能':'导入新技能'}</option><option value="copy">另存副本</option></select>{selected.mode==='copy'&&<input aria-label={'副本名称 '+c.name} placeholder="新的英文名称" value={selected.name??''} onChange={e=>setChoices(old=>old.map(x=>x.key===c.key?{...x,name:e.target.value}:x))}/>}</>}</div>})}<p>新技能导入后未启用。请在详情页设置使用范围并启用。</p></>}
   {error&&<p role="alert" className={s.error}>{error}</p>}<footer className={s.actions}><button className={s.button} disabled={busy} onClick={close}>取消</button>{preview&&<button className={s.button} disabled={busy||!choices.length} onClick={()=>void run(async()=>{const r=await request('commit',{id:preview.id,choices,enabled:false});setPreview(undefined);setImporting(false);await reload();setNotice('已导入 '+r.count+' 个技能'+(r.unchanged?'，'+r.unchanged+' 个相同版本已跳过':''))})}>{busy?'处理中…':'确认导入'}</button>}</footer>
</div></Modal>}</>
}
