import React,{useEffect,useLayoutEffect,useRef,useState} from 'react'
import type {ManagedSkill} from '../managed.ts'
import {ManagementRow} from '../../../../shared/client/ManagementRow.tsx'
import {Modal} from '../../../dsh-client-ui-plain-chat/src/client/PreviewModal.tsx'
import {SkillDetail} from './SkillDetail.tsx'
import {OtherSkills} from './OtherSkills.tsx'
import {prefix} from './managed-api.ts'
import {pendingNavigation,consumeNavigation,restoredFrame,useNavigationFrame,requestLeave} from '../../../dsh-plugin-manager/src/client/workbench-navigation.ts'
import s from '../../../dsh-client-ui-plain-chat/src/client/ManagedCapabilities.module.css'
type Snapshot={revision:number;skills:ManagedSkill[];projects:string[]}
type View={query:string;filter:string;status:string;scope:string;page:'list'|'trash'|'other';selected:string|null;tab:string}
const defaults:View={query:'',filter:'all',status:'all',scope:'',page:'list',selected:null,tab:'settings'}
// Retired tag filters must not survive persisted views or cross-module navigation.
function restoreView(value:Partial<View>&{category?:unknown}):View{const {category:_legacyCategory,...rest}=value;return {...defaults,...rest}}
function initial():View{try{return restoreView({...JSON.parse(sessionStorage.getItem('skills-center-view')??'{}'),...restoredFrame(pendingNavigation('skills')?.restore,'skills')?.view})}catch{return defaults}}
export function SkillsCenter({snapshot,busy,error,onImport,reload,change}:{snapshot:Snapshot;busy:boolean;error:string;onImport:()=>void;reload:()=>void;change:(row:ManagedSkill,action:string,value?:unknown)=>void}){
 const [view,setView]=useState(initial),[filtering,setFiltering]=useState(false),[exporting,setExporting]=useState(false),[confirm,setConfirm]=useState<'remove'>(),listPreferences=useRef<View>(),listScroll=useRef(0),root=useRef<HTMLElement>(null)
 const [removeId,setRemoveId]=useState<string>();const removeRow=snapshot.skills.find(r=>r.id===(removeId??view.selected))
 const update=(patch:Partial<View>)=>setView(v=>({...v,...patch})),row=snapshot.skills.find(r=>r.id===view.selected)
 useEffect(()=>{try{sessionStorage.setItem('skills-center-view',JSON.stringify(view))}catch{}},[view])
 useEffect(()=>{const link=pendingNavigation('skills');consumeNavigation(link);const go=(e:Event)=>{const l=(e as CustomEvent).detail;if(l?.section==='skills'){const saved=restoredFrame(l.restore,'skills')?.view;if(saved)setView(restoreView(saved));consumeNavigation(l)}};window.addEventListener('workbench-capability-link',go);return()=>window.removeEventListener('workbench-capability-link',go)},[])
 useNavigationFrame('skills',5,()=>({section:'skills',label:'Skills 技能',view}))
 function scroller(){let el=root.current?.parentElement;while(el&&el.scrollHeight<=el.clientHeight)el=el.parentElement;return el}
 const open=(id:string)=>{listScroll.current=scroller()?.scrollTop??0;update({selected:id,tab:'settings'})}
 useLayoutEffect(()=>{if(!view.selected){const el=scroller();if(el)el.scrollTop=listScroll.current}},[view.selected])
 // Listing preferences never alter skill enablement or role bindings.
 const clearFilters=()=>update({filter:'all',status:'all',scope:'',query:''})
 const filterLabels=[view.status==='enabled'?'状态：已启用':view.status==='disabled'?'状态：已停用':'',view.scope?'范围：'+({all:'全部对话',roles:'指定岗位',legacy:'保留原有范围'}[view.scope]??view.scope):''].filter(Boolean)
 const summaryLabels=[view.filter==='pinned'?'仅收藏':'',...filterLabels,view.query?'搜索：'+view.query:''].filter(Boolean)
 const available=snapshot.skills.filter(r=>!!r.removed===(view.page==='trash'))
 const visible=snapshot.skills.filter(r=>!!r.removed===(view.page==='trash')&&(view.filter!=='pinned'||r.pinned)&&(view.status!=='enabled'||r.enabled)&&(view.status!=='disabled'||!r.enabled)&&(!view.scope||(r.usage??'legacy')===view.scope)&&[r.name,r.description].join(' ').toLowerCase().includes(view.query.toLowerCase())).sort((a,b)=>Number(!!b.pinned)-Number(!!a.pinned))
 return <section ref={root} className={s.page} aria-label="Skills 技能管理">
 {row?<button className={`${s.button} ${s.detailBack}`} onClick={()=>{if(requestLeave())update({selected:null})}}>← {view.page==='trash'?'返回回收站':'全部技能'}</button>:<div className={s.heading}><h2>{view.page==='list'?'Skills 技能':view.page==='trash'?'技能回收站':'其他来源技能'}</h2>{view.page==='list'?<div className={s.actions}><button className={`${s.button} ${s.primary}`} onClick={onImport} disabled={busy}>导入技能</button><button className={s.button} onClick={()=>setExporting(true)} disabled={busy||!snapshot.skills.length}>导出技能</button><button className={s.iconButton} disabled={busy} aria-label="刷新技能" title="刷新技能" onClick={reload}>↻</button></div>:<button className={s.button} onClick={()=>setView(listPreferences.current??{...defaults})}>← 全部技能</button>}</div>}
 {error&&<p role="alert" className={s.error}>{error}</p>}
 {row?<SkillDetail row={row} tab={view.tab} onTab={tab=>update({tab})} busy={busy} change={change} onConfirm={action=>{setRemoveId(undefined);setConfirm(action)}}/>:view.page==='other'?<OtherSkills/>:<>
 <input className={s.search} aria-label="搜索技能" placeholder="搜索技能名称或用途" value={view.query} onChange={e=>update({query:e.target.value})}/>
 <div className={s.listToolbar}><div className={s.tabs} aria-label="技能列表">{[['all','全部'],['pinned','收藏']].map(([value,label])=><button key={value} aria-pressed={view.filter===value} onClick={()=>value==='all'?clearFilters():update({filter:value})}>{label}</button>)}</div><button className={s.button} aria-expanded={filtering} onClick={()=>setFiltering(!filtering)}>筛选{filterLabels.length?' · '+filterLabels.length:''}</button></div>
 {filtering&&<div className={s.filterPanel}><label className={s.field}>状态<select aria-label="技能状态筛选" value={view.status} onChange={e=>update({status:e.target.value})}><option value="all">全部</option><option value="enabled">已启用</option><option value="disabled">已停用</option></select></label><label className={s.field}>适用范围<select aria-label="技能范围筛选" value={view.scope} onChange={e=>update({scope:e.target.value})}><option value="">全部范围</option><option value="all">全部对话</option><option value="roles">指定岗位</option><option value="legacy">保留原有范围</option></select></label><button className={s.button} onClick={clearFilters}>清除筛选</button></div>}
 <div className={s.actions}><p className={s.muted} role="status" aria-label="技能筛选结果">显示 {visible.length} / {available.length} 个技能{summaryLabels.length?' · '+summaryLabels.join(' · '):''}</p>{summaryLabels.length>0&&<button className={s.button} onClick={clearFilters}>显示全部</button>}</div>
 <div className={s.capabilityList}>{visible.map(r=><ManagementRow key={r.id} name={r.name} description={r.description} status={r.removed?'已移除':r.enabled?'已启用':'已停用'} onOpen={()=>open(r.id)} openLabel={'管理技能：'+r.name} pinned={r.pinned} busy={busy} onPin={r.removed?undefined:()=>change(r,'pinned',!r.pinned)} pinLabel={(r.pinned?'取消收藏':'收藏技能')+'：'+r.name} onRemove={r.removed?undefined:()=>{setRemoveId(r.id);setConfirm('remove')}} removeLabel={'移除技能：'+r.name} attributes={{'data-managed-skill':r.id}}/>)}</div>
 {!visible.length&&<div className={s.empty}><p>{summaryLabels.length?'暂无符合条件的技能。':view.page==='trash'?'回收站为空。':'尚未导入技能。'}</p>{!summaryLabels.length&&view.page==='list'&&<button className={s.button} onClick={onImport}>导入技能</button>}</div>}
 {view.page==='list'&&<div className={s.actions}><button className={s.button} onClick={()=>{listPreferences.current=view;update({page:'other'})}}>其他来源技能</button><button className={s.button} onClick={()=>{listPreferences.current=view;update({page:'trash',filter:'all',status:'all',scope:'',query:''})}}>回收站</button></div>}
 </>}
 {exporting&&<Modal title="导出技能" closeLabel="关闭导出" onClose={()=>setExporting(false)}><div className={`${s.page} ${s.dialogBody}`}><p>选择一个技能，导出包含说明与资源文件的 ZIP。</p>{snapshot.skills.map(r=><p key={r.id}><a className={s.button} href={prefix+'export?id='+encodeURIComponent(r.id)} download={r.name+'.zip'} onClick={()=>setExporting(false)}>{r.name}{r.removed?' · 已移除':''}</a></p>)}</div></Modal>}
 {confirm&&removeRow&&<Modal title={'移除技能'} closeLabel="取消操作" onClose={()=>{if(!busy)setConfirm(undefined)}}><div className={`${s.page} ${s.dialogBody}`}><p>{'新的技能调用将停止，可从回收站恢复。'}</p>{error&&<p role="alert" className={s.error}>{error}</p>}<div className={s.actions}><button className={s.button} disabled={busy} onClick={()=>setConfirm(undefined)}>取消</button><button className={`${s.button} ${s.primary}`} disabled={busy} onClick={()=>{change(removeRow,confirm);setConfirm(undefined)}}>确认{'移除'}</button></div></div></Modal>}
 </section>
}
