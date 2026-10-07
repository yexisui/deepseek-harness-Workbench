import { ManagementRow } from '../../../../shared/client/ManagementRow.tsx'
import { PillCheckbox } from '../../../../shared/client/PillCheckbox.tsx'
import React, { useState } from 'react'
import { latest, type Snapshot } from '../../../dsh-capabilities/src/core/model.ts'
import { capabilityImpact } from './ManagedCapabilityCards.tsx'
import { CapabilityGlyph } from './ManagedWorkbench.tsx'
import { capabilityDisplayDefinition, capabilityHasUnpublishedChanges, capabilityPresentation, type Availability, type CapabilityStatusGroup } from './capability-presentation.ts'
import type { MeetingAvailability } from './meeting-capability-status.ts'
import type { RequirementAvailability } from '../../../dsh-capabilities/src/core/requirements-model.ts'
import s from './ManagedCapabilities.module.css'

export type ListFilters = { states: CapabilityStatusGroup[]; unused: boolean }
export const emptyListFilters = (): ListFilters => ({states:[],unused:false})
export const stateFilters: [CapabilityStatusGroup,string][] = [['pending','需要配置或连接'],['draft','草稿'],['disabled','已停用'],['unknown','检测中或状态未知'],['context','项目内检测'],['ready','已配置或可使用']]
export function restoreListFilters(saved: {filters?: ListFilters; filter?: string}): ListFilters {
  return saved.filters ?? {states:saved.filter==='pending'?['pending','draft','disabled']:[],unused:saved.filter==='unused'}
}
export function CapabilityList({data,query,onQuery,filter,onFilter,filters,onFilters,busy,meetingStatus,requirementsStatus,onOpen,onPin}: {
 data:Snapshot;query:string;onQuery:(value:string)=>void;filter:string;onFilter:(value:string)=>void;filters:ListFilters;onFilters:(value:ListFilters)=>void;busy:boolean;meetingStatus:MeetingAvailability|null;requirementsStatus:Availability;onOpen:(id:string)=>void;onPin:(id:string,pinned:boolean)=>void
}) {
 const [filtering,setFiltering]=useState(false)
 const visible=data.state.capabilities.filter(c=>{
  const definition=capabilityDisplayDefinition(c), status=capabilityPresentation(data,c,latest(c.versions),meetingStatus,requirementsStatus)
  return !c.removedAt&&(filter!=='pinned'||c.pinned)&&(!filters.states.length||filters.states.includes(status.group))&&(!filters.unused||!capabilityImpact(data,c.id).roles.length)&&`${definition.name} ${definition.description} ${c.draft.name} ${c.draft.description}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
 }).sort((a,b)=>Number(b.pinned)-Number(a.pinned))
 const active=filters.states.length>0||filters.unused
 return <>
  <input className={s.search} aria-label="搜索能力" placeholder="搜索能力名称或用途" value={query} onChange={e=>onQuery(e.target.value)}/>
  <div className={s.listToolbar}><div className={s.tabs} aria-label="能力列表">{[['all','全部'],['pinned','收藏']].map(([value,label])=><button key={value} aria-pressed={filter===value} onClick={()=>onFilter(value!)}>{label}</button>)}</div><button className={s.button} aria-expanded={filtering} onClick={()=>setFiltering(!filtering)}>筛选{active?' · 已启用':''}</button></div>
  {filtering&&<div className={s.filterPanel} aria-label="筛选能力"><fieldset><legend>状态</legend>{stateFilters.map(([value,label])=><label key={value} className={s.check}><PillCheckbox type="checkbox" checked={filters.states.includes(value)} onChange={e=>onFilters({...filters,states:e.target.checked?[...filters.states,value]:filters.states.filter(s=>s!==value)})}/>{label}</label>)}</fieldset><fieldset><legend>岗位关联</legend><label className={s.check}><PillCheckbox type="checkbox" checked={filters.unused} onChange={e=>onFilters({...filters,unused:e.target.checked})}/>未关联岗位</label><small className={s.muted}>按岗位草稿或最新版本统计，历史引用仍受保护。</small></fieldset><button className={s.button} onClick={()=>setFiltering(false)}>收起筛选</button></div>}
  {active&&<div className={s.filterSummary}><span>{[...stateFilters.filter(([key])=>filters.states.includes(key)).map(([,label])=>label),...(filters.unused?['未关联岗位']:[])].join(' · ')}</span><button className={s.button} onClick={()=>onFilters(emptyListFilters())}>清除筛选</button></div>}
  <div className={s.capabilityList}>{visible.map(c=>{const definition=capabilityDisplayDefinition(c),status=capabilityPresentation(data,c,latest(c.versions),meetingStatus,requirementsStatus),changed=capabilityHasUnpublishedChanges(c);return <ManagementRow key={c.id} name={definition.name} description={definition.description||'尚未填写能力简介'} status={status.label} statusHint={status.message} icon={<CapabilityGlyph kind={status.icon}/>} hint={changed?'有未发布修改':undefined} openLabel={`管理能力：${definition.name}`} onOpen={()=>onOpen(c.id)} pinned={c.pinned} busy={busy} pinLabel={`${c.pinned?'取消收藏':'收藏能力'}：${definition.name}`} onPin={()=>onPin(c.id,!c.pinned)} attributes={{'data-managed-capability':c.id}}/>})}</div>
  {!visible.length&&<div className={s.empty}><p>{filter==='pinned'&&!query&&!active?'暂无收藏能力，点击能力右侧的图钉即可收藏。':'没有符合条件的能力。'}</p>{(query||active)&&<button className={s.button} onClick={()=>{onQuery('');onFilters(emptyListFilters())}}>清空搜索和筛选</button>}</div>}
 </>
}
