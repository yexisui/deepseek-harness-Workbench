import React from 'react'
import type { KnowledgeScope, KnowledgeStatus } from '../../../dsh-capabilities/src/core/knowledge.ts'
import { PillCheckbox } from '../../../../shared/client/PillCheckbox.tsx'
import { useKnowledgeStatus } from './KnowledgeSettings.tsx'
import s from './ManagedCapabilities.module.css'

export function KnowledgeScopeFields({value,onChange,status,disabled=false}:{value?:KnowledgeScope;onChange:(value?:KnowledgeScope)=>void;status?:KnowledgeStatus;disabled?:boolean}){
  const change=(ids:string[])=>onChange(ids.length?{...value,collectionIds:ids,providerId:status?.providerId}:undefined)
  return <fieldset className={s.compositionFieldset} disabled={disabled}><legend>允许引用的资料范围</legend>
    {status?.collections.length?status.collections.map(c=><label key={c.id} className={s.check}><PillCheckbox checked={!!value?.collectionIds.includes(c.id)} onChange={e=>change(e.target.checked?[...value?.collectionIds??[],c.id]:(value?.collectionIds??[]).filter(id=>id!==c.id))}/>{c.name}</label>):<p className={s.muted}>{status?.message||'正在读取资料集…'}</p>}
    {value&&<><p className={s.muted}>已选：{value.collectionIds.map(id=>status?.collections.find(c=>c.id===id)?.name||id).join('、')}</p><label className={s.field}>产品范围（选填）<input value={value.product??''} onChange={e=>onChange({...value,product:e.target.value})}/></label><label className={s.field}>项目范围（选填）<input value={value.project??''} onChange={e=>onChange({...value,project:e.target.value})}/></label><button type="button" className={s.button} onClick={()=>onChange(undefined)}>清除范围</button></>}
  </fieldset>
}
export function RoleKnowledgeScope({value,onChange}:{value?:KnowledgeScope;onChange:(value?:KnowledgeScope)=>void}){
  const {status,error}=useKnowledgeStatus()
  return <><KnowledgeScopeFields value={value} onChange={onChange} status={status}/>{error&&<p role="alert">{error}</p>}<p className={s.muted}>随岗位一起保存，新对话直接采用。未选择时不自动检索全部资料；支持任务资料选择的助手可另选本次范围。已有对话保留原范围。</p></>
}
