import React,{useState} from 'react'
import type {JevAccount,JevConfig} from '../core/contract.ts'
import {fieldErrors} from './view-model.ts'
import {openWorkbenchLink} from '../../../dsh-plugin-manager/src/client/workbench-navigation.ts'
import s from '../../../dsh-client-ui-plain-chat/src/client/ManagedCapabilities.module.css'
import css from './JevControls.module.css'
export function JevModelFields({value,accounts,loading,refresh,change}:{value:JevConfig;accounts:JevAccount[];loading:boolean;refresh:()=>void;change:(patch:Partial<JevConfig>)=>void}){
  const [query,setQuery]=useState(''),selected=accounts.flatMap(a=>a.models).find(m=>m.id===value.model)
  const matches=(...values:string[])=>values.some(v=>v.toLowerCase().includes(query.toLowerCase()))
  const visible=accounts.filter(a=>matches(a.name,a.id,...a.models.flatMap(m=>[m.id,m.name]))),available=visible.filter(a=>a.available).sort((a,b)=>Number(b.models.some(m=>m.id===value.model))-Number(a.models.some(m=>m.id===value.model))),unavailable=visible.filter(a=>!a.available)
  return <><label className={s.field}>搜索账号或模型<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="按名称或标识筛选本地模型"/></label>
    <div className={s.field}><span>独立决策模型</span><small>当前选择：{selected?.name||(value.model||'未选择')}{selected?' · '+value.model:''}。仅刷新本地配置，不联网发现模型。</small><div className={css.modelList} role="group" aria-label="本地模型选项">{available.map(a=><div className={css.account} key={a.id}><strong>{a.name||a.id}</strong>{a.models.filter(m=>matches(a.name,a.id,m.name,m.id)).map(m=><button className={s.choice} aria-pressed={value.model===m.id} key={m.id} onClick={()=>change({model:m.id,reasoningEffort:''})}><span>{m.name}<small>{m.id}</small></span>{value.model===m.id&&<span aria-label="已选择">✓</span>}</button>)}{!a.models.length&&<p className={s.muted}>尚未登记本地模型；可配置账号，或在高级设置填写模型标识。</p>}</div>)}{!available.length&&!loading&&<p>{query?'没有匹配的可选模型。':'尚无可选模型，请配置内网模型账号。'}</p>}</div></div>
    {!!unavailable.length&&<details className={s.compositionInfo} open={query?true:undefined}><summary>待配置或不可用账号（{unavailable.length}）</summary><div className={css.modelList}>{unavailable.map(a=><div className={css.account} key={a.id}><strong className={s.muted}>{a.name||a.id}</strong><p className={s.muted}>不可用：{a.message}</p><button className={s.button} onClick={()=>openWorkbenchLink({section:'models'})}>配置此模型账号 ↗</button></div>)}</div></details>}
    <div className={s.actions}><button className={s.button} disabled={loading} onClick={refresh}>{loading?'读取中…':'刷新本地模型'}</button><button className={s.button} onClick={()=>openWorkbenchLink({section:'models'})}>模型账号设置 ↗</button></div>
  </>
}
export function JevAdvanced({value,accounts,open,setOpen,change}:{value:JevConfig;accounts:JevAccount[];open:boolean;setOpen:(value:boolean)=>void;change:(patch:Partial<JevConfig>)=>void}){
  const invalid=fieldErrors(value),known=accounts.flatMap(a=>a.models).find(m=>m.id===value.model)?.reasoning
  return <details className={s.compositionInfo} open={open} onToggle={e=>setOpen(e.currentTarget.open)}><summary>高级设置</summary><div className={s.fields}>
    <label className={s.field}>手动填写模型标识<input maxLength={250} value={value.model} aria-invalid={!!invalid.model} placeholder="提供方/模型标识" onChange={e=>change({model:e.target.value})}/><small role={invalid.model?'alert':undefined}>{invalid.model??'用于已配置内网账号中未登记的模型；仍需连接检查。'}</small></label>
    <label className={s.field}>决策模型思考强度<select value={value.reasoningEffort} onChange={e=>change({reasoningEffort:e.target.value as JevConfig['reasoningEffort']})}><option value="">模型默认</option>{(['low','medium','high'] as const).map((id,i)=><option key={id} value={id} disabled={known?!known.includes(id):value.reasoningEffort!==id}>{['低','中','高'][i]}</option>)}</select><small>{known===undefined?'本地配置未声明可用强度，优先采用模型默认；历史显式设置保留，可恢复默认。':known.length?'仅提供账号明确声明支持的强度。':'此模型声明不支持思考强度，使用模型默认。'}</small></label>
    {([['timeoutMs','单次检查超时（秒）',5,120,1000,'检查超时会停止当前自动步骤。'],['maxChecks','每轮最多检查次数',3,32,1,'限制一轮中的额外模型调用。'],['maxContextChars','检查上下文字符上限',4000,64000,1,'过长动作证据会停止检查，避免遗漏依据。']] as const).map(([key,label,min,max,divisor,hint])=><label className={s.field} key={key}>{label}<input type="number" min={min} max={max} step={1} value={Number.isFinite(value[key])?value[key]/divisor:''} aria-invalid={!!invalid[key]} aria-describedby={'jev-error-'+key} onChange={e=>change({[key]:e.target.value===''?NaN:Number(e.target.value)*divisor})}/><small id={'jev-error-'+key} role={invalid[key]?'alert':undefined}>{invalid[key]??hint}</small></label>)}
  </div></details>
}
