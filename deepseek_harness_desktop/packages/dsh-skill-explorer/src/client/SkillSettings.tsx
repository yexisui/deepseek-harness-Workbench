import React,{useEffect,useState,useRef} from 'react'
import type {ManagedSkill} from '../managed.ts'
import type {State} from '../../../dsh-capabilities/src/core/model.ts'
import {EnableSwitch} from '../../../../shared/client/EnableSwitch.tsx'
import {openWorkbenchLink,captureNavigation} from '../../../dsh-plugin-manager/src/client/workbench-navigation.ts'
import s from '../../../dsh-client-ui-plain-chat/src/client/ManagedCapabilities.module.css'
import css from './managed-panel.module.css'
type Props={row:ManagedSkill;busy:boolean;tags:string[];change:(row:ManagedSkill,action:string,value?:unknown)=>void}
export function SkillSettings({row,busy,tags,change}:Props){
 const [text,setText]=useState(''),[state,setState]=useState<State>(),[chosen,setChosen]=useState<string[]>([]),[query,setQuery]=useState(''),[error,setError]=useState(''),[saving,setSaving]=useState(false),lock=useRef(false)
 const load=async()=>{const r=await fetch('/api/capabilities/state');const v=await r.json();if(!r.ok)throw Error(v.error??'岗位读取失败');setState(v.state);setChosen(v.state.roles.filter((role:any)=>role.draft.skills?.some((b:any)=>b.id===row.id&&b.enabled)).map((r:any)=>r.id))}
 useEffect(()=>{void load().catch(e=>setError(e.message))},[row.id])
 const add=(value:string)=>{const t=value.trim();if(!t)return;change(row,'tags',[...new Set([...(row.tags??[]),t])]);setText('')}
 const saveRoles=async()=>{if(lock.current||!state)return;lock.current=true;setSaving(true);setError('');try{const r=await fetch('/api/capabilities/command',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({revision:state.revision,command:{type:'role.skills',skillId:row.id,roleIds:chosen}})});const v=await r.json();if(!r.ok)throw Error(v.error??'岗位设置保存失败');await load()}catch(e){setError(e instanceof Error?e.message:String(e))}finally{lock.current=false;setSaving(false)}}
 return <>
 <label className={s.check}>启用此技能 <EnableSwitch label={'启用技能 '+row.name} checked={row.enabled} busy={busy} onChange={v=>change(row,'enabled',v)}/></label>
 <p className={s.muted}>启用后，助手可在所选范围内，根据当前任务需要使用此技能。</p>
 <label className={s.field}>使用范围<select aria-label="技能使用范围" value={row.usage??'legacy'} disabled={busy} onChange={e=>change(row,'usage',e.target.value)}>{!row.usage&&<option value="legacy">保留原有范围</option>}<option value="all" disabled={row.scope!=='global'}>全部对话</option><option value="roles">指定岗位</option></select></label>
 {!row.usage&&<p className={s.muted}>旧技能保留原有对话可见性及岗位绑定；选择新范围后才调整。</p>}
 {row.usage==='all'&&<p className={s.muted}>用于新建的普通对话和岗位对话；在岗位中单独停用的技能不会使用。</p>}
 {row.scope!=='global'&&<p className={s.muted}>此旧技能还限定于原项目：{row.scope}。如需跨项目使用，请另存导入。</p>}
 {row.usage==='roles'&&<div><input className={s.search} aria-label="搜索指定岗位" placeholder="搜索岗位" value={query} onChange={e=>setQuery(e.target.value)}/>{state?.roles.filter(r=>!r.archivedAt&&r.draft.name.toLowerCase().includes(query.toLowerCase())).map(role=><div className={s.row} key={role.id}><label className={s.check}>{role.draft.name}<EnableSwitch label={'指定岗位 '+role.draft.name} checked={chosen.includes(role.id)} busy={saving} onChange={v=>setChosen(old=>v?[...old,role.id]:old.filter(id=>id!==role.id))}/></label><button className={s.button} onClick={()=>openWorkbenchLink({section:'agent-presets',origin:captureNavigation(),restore:{section:'agent-presets',label:'岗位编辑',frames:[{kind:'role-editor',section:'agent-presets',label:'岗位编辑',view:{id:role.id}}]}})}>编辑岗位 ↗</button></div>)}<p className={s.muted}>保存后用于所选岗位的新对话，无需再到岗位页面操作。</p><button className={s.button} disabled={saving||!state} onClick={()=>void saveRoles()}>保存岗位选择</button><button className={s.button} disabled={saving} onClick={()=>void load().catch(e=>setError(e.message))}>重新读取岗位</button></div>}
 {error&&<p className={s.error} role="alert">{error}</p>}
 <label className={s.field}>标签</label><div className={css.tags}>{(row.tags??[]).map(t=><span className={css.tag} key={t}>{t}<button disabled={busy} aria-label={'移除标签 '+t} onClick={()=>change(row,'tags',row.tags!.filter(x=>x!==t))}>×</button></span>)}</div>
 <div className={s.actions}><input aria-label="添加技能标签" list="skill-tag-suggestions" value={text} maxLength={40} placeholder="输入或选择标签" disabled={busy} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.nativeEvent.isComposing){e.preventDefault();add(text)}}}/><datalist id="skill-tag-suggestions">{tags.filter(t=>!row.tags?.includes(t)).map(t=><option key={t} value={t}/>)}</datalist><button className={s.button} disabled={busy||!text.trim()} onClick={()=>add(text)}>添加标签</button></div>
 <details className={s.detailDisclosure}><summary>高级设置 · 调用方式</summary><p>按任务需要选用不代表后台自动运行，也不代表每次强制调用。关闭自动选用后保留原有手动调用限制；专用岗位流程按保存的岗位设置执行。</p><label className={s.check}>允许按任务需要自动选用<EnableSwitch label={'允许 AI 自动选用 '+row.name} checked={row.auto} busy={busy} onChange={v=>change(row,'auto',v)}/></label>{!row.manual&&<p>技能包不允许普通对话手动调用。</p>}</details>
 </>
}
