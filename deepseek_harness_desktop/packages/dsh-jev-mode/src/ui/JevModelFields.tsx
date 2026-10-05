import React,{useEffect,useId,useRef,useState} from 'react'
import {candidates,candidateConfig,type JevCandidate,type JevAccount,type JevConfig,type JevConnection} from '../core/contract.ts'
import {connectionName,fieldErrors} from './view-model.ts'
import {CapabilityActionIcon} from '../../../dsh-client-ui-plain-chat/src/client/ManagedCapabilityCards.tsx'
import {CapabilitySelection} from '../../../dsh-client-ui-plain-chat/src/client/CapabilitySelection.tsx'
import {WholeRowSort} from '../../../dsh-plugin-manager/src/client/WholeRowSort.tsx'
import {openWorkbenchLink} from '../../../dsh-plugin-manager/src/client/workbench-navigation.ts'
import s from '../../../dsh-client-ui-plain-chat/src/client/ManagedCapabilities.module.css'
import css from './JevControls.module.css'
export function JevModelFields({value,accounts,loading,refresh,change,connection,test,checking,disabled}:{value:JevConfig;accounts:JevAccount[];loading:boolean;refresh:()=>void;change:(patch:Partial<JevConfig>)=>void;connection?:JevConnection;test:(config:JevConfig)=>void;checking:boolean;disabled?:boolean}){
  const [query,setQuery]=useState(''),[provider,setProvider]=useState(''),[selected,setSelected]=useState<string[]>([]),[open,setOpen]=useState(false),rows=candidates(value)
  const pickerId=useId(),trigger=useRef<HTMLButtonElement>(null),picker=useRef<HTMLDivElement>(null)
  const matches=(...values:string[])=>values.some(v=>v.toLowerCase().includes(query.trim().toLowerCase()))
  const visible=accounts.filter(a=>!provider||a.id===provider).map(a=>({...a,models:a.models.filter(m=>matches(a.name,a.id,m.name,m.id))})).filter(a=>a.models.length)
  const update=(next:JevCandidate[])=>change({candidates:next,model:next.find(c=>c.enabled)?.model??'',reasoningEffort:''})
  const name=(row:JevCandidate)=>accounts.flatMap(a=>a.models).find(m=>m.id===row.model)?.name??row.model
  const catalog=accounts.flatMap(a=>a.models),added=new Set(rows.map(c=>c.model)),remaining=Math.max(0,12-rows.length)
  const selectedModels=catalog.filter(m=>selected.includes(m.id)&&!added.has(m.id)).slice(0,remaining)
  const toggleModel=(id:string)=>{if(added.has(id))return;setSelected(current=>current.includes(id)?current.filter(m=>m!==id):current.length<remaining?[...current,id]:current)}
  // A background refresh must not disable the picker or discard its pending selection.
  useEffect(()=>{if(loading)return;if(provider&&!accounts.some(a=>a.id===provider))setProvider('');setSelected(current=>{const next=current.filter(id=>catalog.some(m=>m.id===id)&&!added.has(id)).slice(0,remaining);return next.length===current.length?current:next})},[accounts,loading,provider,value.candidates,value.model])
  const close=()=>{setOpen(false);trigger.current?.focus()}
  const pickerKeys=(event:React.KeyboardEvent<HTMLDivElement>)=>{
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();return}
    if(!(event.target instanceof HTMLInputElement)||event.target.type!=='checkbox')return
    const options=Array.from(picker.current?.querySelectorAll<HTMLInputElement>('[data-model-option] input:not(:disabled)')??[]),index=options.indexOf(event.target)
    const next=event.key==='Home'?0:event.key==='End'?options.length-1:event.key==='ArrowDown'?Math.min(index+1,options.length-1):event.key==='ArrowUp'?Math.max(index-1,0):-1
    if(next>=0){event.preventDefault();options[next]?.focus()}
  }
  return <div className={css.candidateSection}>
    <div className={css.candidateHeading}><strong>候选模型</strong><small className={s.muted}>已添加 {rows.length}/12 · 已开启 {rows.filter(c=>c.enabled).length}</small></div>
    <p className={s.muted}>从上到下依次尝试，关闭项跳过。整张卡片可拖动排序，单击开关启停。</p>
    <button ref={trigger} type="button" className={`${s.button} ${css.pickerTrigger}`} aria-label="选择候选模型" aria-expanded={open} aria-controls={pickerId} onClick={()=>setOpen(!open)}><span>{loading&&!accounts.length?'正在读取模型…':'选择已有模型'}{selectedModels.length>0&&<small>已勾选 {selectedModels.length} 个模型</small>}</span><svg aria-hidden="true" viewBox="0 0 16 16" className={open?css.chevronOpen:undefined}><path d="m4 6 4 4 4-4"/></svg></button>
    {open&&<div id={pickerId} ref={picker} className={css.pickerPanel} onKeyDown={pickerKeys}>
      <label className={s.field}><span className={css.srOnly}>搜索账号或模型</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="搜索账号或模型"/></label>
      {accounts.length>1&&<div className={css.accountTabs} aria-label="筛选模型账号"><button type="button" aria-pressed={!provider} onClick={()=>setProvider('')}>全部账号</button>{accounts.map(a=><button type="button" key={a.id} aria-pressed={provider===a.id} onClick={()=>setProvider(a.id)}>{a.name}</button>)}</div>}
      <div className={css.batchTools}><span className={s.muted}>已选 {selectedModels.length} · 还可选 {Math.max(0,remaining-selectedModels.length)}</span><button type="button" className={s.button} disabled={selectedModels.length>=remaining||!visible.some(a=>a.models.some(m=>!added.has(m.id)&&!selected.includes(m.id)))} onClick={()=>setSelected(current=>Array.from(new Set([...current,...visible.flatMap(a=>a.models).filter(m=>!added.has(m.id)).map(m=>m.id)])).slice(0,remaining))}>全选当前</button><button type="button" className={s.button} disabled={!selected.length} onClick={()=>setSelected([])}>清空勾选</button></div>
      <div className={css.modelOptions} aria-label="已有模型">{visible.map(a=><div key={a.id} role="group" aria-label={a.name}><div className={css.optionGroup}>{a.name}</div>{a.models.map(m=>{
        const checked=selected.includes(m.id),inList=added.has(m.id),locked=inList||!checked&&selectedModels.length>=remaining
        return <div key={m.id} data-model-option={m.id} data-selected={checked} data-disabled={locked} className={`${s.choice} ${css.modelOption}`} onClick={event=>{if(!locked&&!(event.target instanceof Element&&event.target.closest('label')))toggleModel(m.id)}}>
          <CapabilitySelection checked={checked} disabled={locked} label={'选择 '+m.name} onChange={()=>toggleModel(m.id)}/><span className={css.optionIdentity}><strong>{m.name}</strong><small>{m.id.slice(m.id.indexOf('/')+1)}</small></span>{(inList||!a.available)&&<small title={inList?undefined:a.message}>{inList?'已在候选':'JEV 配置受限'}</small>}
        </div>
      })}</div>)}</div>
      {!visible.length&&<p className={s.muted} role="status">{loading?'正在读取本地模型…':query?'没有匹配的模型，请调整搜索内容。':'当前账号未登记模型，请前往模型账号设置添加。'}</p>}
      <div className={css.batchFooter}><small className={s.muted}>按列表顺序追加，默认关闭；最多 12 项。</small><button type="button" className={`${s.button} ${s.primary}`} disabled={!selectedModels.length} onClick={()=>{update([...rows,...selectedModels.map(m=>({id:crypto.randomUUID(),model:m.id,enabled:false,reasoningEffort:'' as const}))]);setSelected([]);close()}}>添加所选（{selectedModels.length}）</button></div>
    </div>}
    {rows.length>=12&&<p className={s.muted}>已达到 12 个候选模型上限，可移除候选后再添加。</p>}
    <span className={css.srOnly}>键盘操作：选中卡片后按空格拾起，上下调整，回车放下，Esc 取消。</span><WholeRowSort items={rows} onChange={update} disabled={disabled} label={name} className={css.candidateList} rowClassName={css.candidateRow} ghostClassName={css.dragGhost} render={(row,index)=>{
      const account=accounts.find(a=>a.models.some(m=>m.id===row.model)),model=account?.models.find(m=>m.id===row.model),state=connection?.candidates?.find(c=>c.id===row.id)??(value.candidates===undefined?connection:undefined)
      return <><span className={css.rank}>{index+1}</span><div className={css.candidateIdentity}><strong>{name(row)}</strong><small title={row.model}>{account?.name??row.model.split('/')[0]} · {row.model.slice(row.model.indexOf('/')+1)}</small><small title={account?.available===false?account.message:state?.message} className={state?.state==='error'||account?.available===false?css.warning:s.muted}>{account?.available===false?'JEV 配置受限：'+account.message:!account&&!loading?'账号或模型已移除，请核对配置':state?connectionName[state.state]+' · '+state.message:row.enabled?'等待检查':'已关闭 · 默认跳过'}</small></div><div className={css.candidateActions}><button type="button" className={`${s.button} ${css.toggle}`} role="switch" aria-label={'启用 '+name(row)} aria-checked={row.enabled} onClick={()=>update(rows.map(c=>c.id===row.id?{...c,enabled:!c.enabled}:c))}><span className={css.track}/><span>{row.enabled?'开':'关'}</span></button><div className={css.rowTools}><button type="button" className={s.button} aria-label={'检查 '+name(row)} disabled={checking||account?.available===false||!!Object.keys(fieldErrors(value)).length} onClick={()=>test(candidateConfig(value,row))}>检查</button><button type="button" className={s.iconButton} aria-label={'移除 '+name(row)} title="从候选列表移除" onClick={()=>update(rows.filter(c=>c.id!==row.id))}><CapabilityActionIcon kind="remove"/></button></div></div>{(!!model?.reasoning?.length||!!row.reasoningEffort)&&<details className={css.rowOptions}><summary>思考强度：{({'':'模型默认',low:'低',medium:'中',high:'高'})[row.reasoningEffort]}</summary><select aria-label={name(row)+'思考强度'} value={row.reasoningEffort} onChange={e=>update(rows.map(c=>c.id===row.id?{...c,reasoningEffort:e.target.value as JevConfig['reasoningEffort']}:c))}><option value="">模型默认</option>{(['low','medium','high'] as const).filter(v=>model?.reasoning?.includes(v)||row.reasoningEffort===v).map(v=><option key={v} value={v}>{({low:'低',medium:'中',high:'高'})[v]}</option>)}</select></details>}</>
    }}/>
    {!rows.length&&<p className={css.candidateEmpty}>展开上方列表，可勾选多个模型后一次添加。新候选项默认关闭。</p>}
    {rows.some(c=>accounts.some(a=>!a.available&&a.models.some(m=>m.id===c.model)))&&<p className={`${s.notice} ${css.catalogNotice}`}>当前为 JEV 内网模式。“配置受限”表示账号尚不满足 JEV 的地址或协议要求，并不表示密钥失效。普通聊天与 JEV 的连接条件不同。</p>}
    <div className={s.actions}><button type="button" className={s.button} disabled={loading} onClick={refresh}>{loading?'读取中…':'刷新本地模型'}</button><button type="button" className={s.button} onClick={()=>openWorkbenchLink({section:'models'})}>模型账号设置 ↗</button><small className={s.muted}>只读取本地配置</small></div>
  </div>
}
export function JevAdvanced({value,open,setOpen,change}:{value:JevConfig;accounts:JevAccount[];open:boolean;setOpen:(value:boolean)=>void;change:(patch:Partial<JevConfig>)=>void}){
  const invalid=fieldErrors(value)
  return <details className={s.compositionInfo} open={open} onToggle={e=>setOpen(e.currentTarget.open)}><summary>高级设置</summary><div className={s.fields}>
    {([['timeoutMs','单个模型超时（秒）',5,120,1000,'超时后尝试下一个启用模型。'],['totalTimeoutMs','候选链总超时（秒）',5,300,1000,'每次审查共用此时间上限，达到上限停止。'],['maxChecks','每轮最多模型调用次数',3,32,1,'包含失败后切换产生的调用，达到上限停止。'],['maxContextChars','检查上下文字符上限',4000,64000,1,'过长动作证据会停止检查，避免遗漏依据。']] as const).map(([key,label,min,max,divisor,hint])=><label className={s.field} key={key}>{label}<input type="number" min={min} max={max} step={1} value={value[key]===undefined?(value.candidates?90:value.timeoutMs/1000):Number.isFinite(value[key])?value[key]!/divisor:''} aria-invalid={!!invalid[key]} aria-describedby={'jev-error-'+key} onChange={e=>change({[key]:e.target.value===''?NaN:Number(e.target.value)*divisor})}/><small id={'jev-error-'+key} role={invalid[key]?'alert':undefined}>{invalid[key]??hint}</small></label>)}
  </div></details>
}
