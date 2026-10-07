import React,{useEffect,useState} from 'react'
import type {ManagedSkill} from '../managed.ts'
import {EnableSwitch} from '../../../../shared/client/EnableSwitch.tsx'
import {ManagementIcon} from '../../../../shared/client/ManagementRow.tsx'
import {openWorkbenchLink,captureNavigation} from '../../../dsh-plugin-manager/src/client/workbench-navigation.ts'
import type {Role} from '../../../dsh-capabilities/src/core/model.ts'
import {managedRequest as request,prefix} from './managed-api.ts'
import s from '../../../dsh-client-ui-plain-chat/src/client/ManagedCapabilities.module.css'
import css from './managed-panel.module.css'

function Contents({row}:{row:ManagedSkill}){
 const [files,setFiles]=useState<string[]>([]),[selected,setSelected]=useState('SKILL.md'),[content,setContent]=useState(''),[error,setError]=useState('')
 useEffect(()=>{let active=true;void request('detail?id='+encodeURIComponent(row.id)).then(d=>{if(active)setFiles(d.files)}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[row.id,row.hash])
 useEffect(()=>{let active=true;setContent('');setError('');void request('resource?id='+encodeURIComponent(row.id)+'&path='+encodeURIComponent(selected)).then(d=>{if(active)setContent(d.content)}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[row.id,row.hash,selected])
 return <div className={css.resources}><nav aria-label="技能资源文件">{files.map(file=><button className={s.button} key={file} aria-pressed={selected===file} onClick={()=>setSelected(file)}>{file}</button>)}</nav><div><h3>{selected}</h3>{error?<p role="alert" className={s.error}>{error}</p>:<pre className={css.preview}>{content}</pre>}</div></div>
}
function References({id}:{id:string}){
 const [roles,setRoles]=useState<Role[]>(),[error,setError]=useState('')
 useEffect(()=>{let active=true;void fetch('/api/capabilities/state').then(async r=>{const v=await r.json();if(!r.ok)throw Error(v.error??'无法读取岗位引用');if(active)setRoles(v.state.roles)}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[id])
 if(error)return <p role="alert" className={s.error}>岗位引用读取失败：{error}</p>
 if(!roles)return <p>正在读取岗位引用…</p>
 const rows=roles.filter(r=>r.draft.skills?.some(b=>b.id===id)||r.versions.some(v=>v.skills?.some(b=>b.id===id)))
 return <>{!rows.length&&<p className={s.empty}>暂无岗位引用。可在岗位编辑器中添加此技能。</p>}{rows.map(role=><article className={s.row} key={role.id}><strong>{role.draft.name}{role.archivedAt?' · 已归档':''}</strong>{role.draft.skills?.filter(b=>b.id===id).map(b=><p key="draft">编辑草稿 · {b.hash.slice(0,12)} · {b.enabled?'岗位中启用':'岗位中停用'}</p>)}{role.versions.filter(v=>v.skills?.some(b=>b.id===id)).map(v=><p key={v.version}>已发布 v{v.version}{v.version===role.versions.at(-1)?.version?'（当前）':'（历史）'} · {v.skills!.find(b=>b.id===id)!.hash.slice(0,12)}</p>)}{!role.archivedAt&&<button className={s.button} onClick={()=>openWorkbenchLink({section:'agent-presets',origin:captureNavigation(),restore:{section:'agent-presets',label:'岗位编辑',frames:[{kind:'role-editor',section:'agent-presets',label:'岗位编辑',view:{id:role.id}}]}})}>编辑岗位：{role.draft.name} ↗</button>}</article>)}</>
}
export function SkillDetail({row,tab,onTab,busy,change,onConfirm}:{row:ManagedSkill;tab:string;onTab:(value:string)=>void;busy:boolean;change:(row:ManagedSkill,action:string,value?:unknown)=>void;onConfirm:(action:'remove'|'rollback')=>void}){
 return <><div className={s.heading}><div className={s.actions}><ManagementIcon kind="file"/><h2>{row.name}</h2></div><div className={s.actions}><a className={s.button} href={prefix+'export?id='+encodeURIComponent(row.id)} download={row.name+'.zip'}>导出技能</a>{!row.removed&&<button className={s.iconButton} disabled={busy} title="移入回收站" aria-label={'移除技能：'+row.name} onClick={()=>onConfirm('remove')}><ManagementIcon kind="remove"/></button>}</div></div><p>{row.description}</p>
 <div className={s.tabs}>{[['settings','设置'],['contents','内容与资源'],['references','岗位引用']].map(([key,label])=><button key={key} aria-pressed={tab===key} onClick={()=>onTab(key)}>{label}</button>)}</div>
 {tab==='contents'?<Contents row={row}/>:tab==='references'?<References id={row.id}/>:<>
 {row.removed?<><p>此技能已移入回收站。恢复后保持停用。</p><button className={s.button} disabled={busy} onClick={()=>change(row,'restore')}>恢复技能</button></>:<>
 <label className={s.check}>启用此技能 <EnableSwitch label={'启用技能 '+row.name} checked={row.enabled} busy={busy} onChange={v=>change(row,'enabled',v)}/></label>
 <label className={s.check}>允许 AI 自动选用 <EnableSwitch label={'允许 AI 自动选用 '+row.name} checked={row.auto} busy={busy} onChange={v=>change(row,'auto',v)}/></label>
 <label className={s.field}>分类<input aria-label={'分类 '+row.name} key={row.category} defaultValue={row.category} disabled={busy} maxLength={40} onBlur={e=>{const value=e.target.value.trim();if(value&&value!==row.category)change(row,'category',value)}}/></label></>}
 <p className={s.muted}>适用范围：{row.scope==='global'?'工作台全局':row.scope}</p><p className={s.muted}>来源：本地导入 · {row.removed?'已移除':row.enabled?'已启用':'已停用'}</p>
 <details className={s.detailDisclosure}><summary>技术信息与版本</summary><p>版本摘要：{row.hash.slice(0,12)}</p><p>更新时间：{new Date(row.updatedAt).toLocaleString()}</p><p className={css.path}>目录：{row.root}</p>{row.warnings.map(w=><p key={w}>{w}</p>)}<p className={s.muted}>更新技能不会自动更换岗位已发布的绑定版本。</p>{!row.removed&&<button className={s.button} disabled={busy||!row.previous} onClick={()=>onConfirm('rollback')}>回退上一版本</button>}</details>
 </>}</>
}
