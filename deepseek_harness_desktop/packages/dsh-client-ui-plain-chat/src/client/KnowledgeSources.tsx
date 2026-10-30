import React, { useRef, useState } from 'react'
import type { KnowledgeScope } from '../../../dsh-capabilities/src/core/knowledge.ts'
import { PillCheckbox } from '../../../../shared/client/PillCheckbox.tsx'
import { Modal } from './PreviewModal.tsx'
import { useKnowledgeStatus } from './KnowledgeSettings.tsx'
import { openCapabilityLink } from './capability-client.ts'
import { CapabilityActionIcon } from './ManagedCapabilityCards.tsx'
import { CapabilityGlyph } from './ManagedWorkbench.tsx'
import s from './ManagedCapabilities.module.css'
import k from './KnowledgeSources.module.css'

export function KnowledgeSources({ scope, product, disabled, allowed, onChange, compact=false, enabled=false, onEnabledChange }: { scope?:KnowledgeScope; product:string; disabled:boolean; allowed:boolean; onChange:(scope?:KnowledgeScope)=>Promise<void>; compact?:boolean; enabled?:boolean; onEnabledChange?:(enabled:boolean)=>void }) {
  const { status, error, refresh } = useKnowledgeStatus()
  const [editing,setEditing]=useState(false),[selected,setSelected]=useState<string[]>([]),[query,setQuery]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('')
  const [undo,setUndo]=useState<{before:KnowledgeScope;after?:KnowledgeScope}>(),saving=useRef(false)
  const ids=scope?.collectionIds??[],name=(id:string)=>status?.collections.find(c=>c.id===id)?.name||id
  async function apply(value?:KnowledgeScope,removed=false){
    if(saving.current)return
    saving.current=true;setBusy(true);setNotice('')
    try{await onChange(value);setUndo(removed&&scope?{before:scope,after:value}:undefined);setEditing(false)}
    catch(e){setNotice(e instanceof Error?e.message:String(e))}
    finally{saving.current=false;setBusy(false)}
  }
  function remove(id:string){const next=ids.filter(value=>value!==id);void apply(next.length?{...scope!,collectionIds:next}:undefined,true)}
  const additions=selected.filter(id=>!ids.includes(id))
  const collections=status?.collections??[],choices=compact?[...collections,...ids.filter(id=>!collections.some(c=>c.id===id)).map(id=>({id,name:id+'（当前不可用）'}))]:collections
  const matches=choices.filter(c=>c.name.toLowerCase().includes(query.trim().toLowerCase()))
  const ready=!!status?.available&&status.configured&&status.moduleEnabled!==false
  const open=()=>{setSelected(compact?[...ids]:[]);setQuery('');setNotice('');setEditing(true);void refresh()}
  const manage=()=>openCapabilityLink({section:'capability-center',capabilityId:'external-knowledge',tab:'config:knowledge'})
  const compactMessage=!allowed?'请在岗位中关联外部知识库模块':!ready?(error||status?.message||'正在读取知识库状态…'):!ids.length?'尚未选择资料':`${enabled?'已启用':'未启用'} · 已选 ${ids.length} 个知识库${status.verified?'':' · 连接待验证'}`
  return <section className={k.root+(compact?' '+k.compact:'')} aria-label="本次外部知识库" aria-busy={busy}>
    {compact?<><header className={k.header}><span className={k.compactTitle}><CapabilityGlyph kind="document"/><h3>外部知识库</h3></span><label className={k.toggle} title={!ids.length?'请先选择资料':compactMessage}><PillCheckbox aria-label="结合外部知识库" checked={enabled} disabled={disabled||busy||!enabled&&(!allowed||!ready||!ids.length)} onChange={e=>onEnabledChange?.(e.target.checked)}/></label><button className={k.choose} disabled={disabled||busy||!allowed||!ready} onClick={open}>选择资料 <span aria-hidden="true">›</span></button><button className={k.manageIcon} aria-label="管理外部知识库" title="管理外部知识库" onClick={manage}>↗</button></header>
      <p className={k.compactMeta} role="status" title={compactMessage}>{compactMessage}</p>
      {!!ids.length&&<div className={k.chips} aria-label="已选知识库">{ids.slice(0,2).map(id=><span key={id} title={name(id)}>{name(id)}</span>)}{ids.length>2&&<span title={ids.slice(2).map(name).join('、')}>另 {ids.length-2} 个</span>}</div>}
    </>:<>
    <header className={k.header}><h3>外部知识库</h3>
      {status?.available&&status.configured&&<button className={k.add} aria-label="添加知识库" disabled={disabled||!allowed||busy||!status.collections.length} title={!allowed?'请在岗位中关联外部知识库模块':undefined} onClick={open}>添加知识库</button>}
    </header>
    <p className={k.meta}>本次引用 · {ids.length} 个知识库</p>
    {ids.length?<ul className={k.list}>{ids.map(id=><li key={id} className={k.row}><CapabilityGlyph kind="document"/><span className={k.name}>{name(id)}</span><button className={k.remove} disabled={disabled||busy} aria-label={'移除引用：'+name(id)} title={'移除引用：'+name(id)} onClick={()=>remove(id)}><CapabilityActionIcon kind="remove"/></button></li>)}</ul>:<p className={k.empty}>暂未引用知识库，可点击上方添加。</p>}
    <button className={k.settings} onClick={manage}>查看知识库设置</button>
    {ids.length>0&&<p className={k.hint}>移除只影响本次引用，不会删除知识库。</p>}
    {undo&&JSON.stringify(scope)===JSON.stringify(undo.after)&&<p className={k.feedback} role="status">已移除本次引用。<button disabled={disabled||busy} onClick={()=>void apply(undo.before)}>撤销</button></p>}
    {(error||status&&!status.available)&&<p className={k.hint} role="status">{error||status?.message}</p>}</>}
    {notice&&!editing&&<p className={k.feedback} role="alert">{notice}</p>}
    {editing&&<Modal title={compact?'本次引用的知识库':'添加知识库'} closeLabel="取消知识库选择" closeDisabled={busy} onClose={()=>{if(!busy)setEditing(false)}}><div className={s.page+' '+s.dialogBody+' '+k.picker}>
      <label className={s.field}>搜索资料集<input aria-label="搜索资料集" value={query} onChange={e=>setQuery(e.target.value)} disabled={busy}/></label>
      <div className={compact?k.pickerList:undefined}>{matches.map(c=>compact?<label className={k.pickerRow} key={c.id}><CapabilityGlyph kind="document"/><span>{c.name}</span><PillCheckbox aria-label={c.name} checked={selected.includes(c.id)} disabled={busy} onChange={e=>setSelected(e.target.checked?[...new Set([...selected,c.id])]:selected.filter(id=>id!==c.id))}/></label>:<label className={s.check} key={c.id}><PillCheckbox checked={ids.includes(c.id)||selected.includes(c.id)} disabled={busy||ids.includes(c.id)} onChange={e=>setSelected(e.target.checked?[...new Set([...selected,c.id])]:selected.filter(id=>id!==c.id))}/>{c.name}{ids.includes(c.id)&&<small className={s.muted}>已添加</small>}</label>)}{!matches.length&&<p className={s.muted}>没有找到匹配的知识库。</p>}</div>
      {compact&&<><p className={s.muted}>已选择 {selected.length} 个。移除只影响本次引用，不删除知识库。</p><button className={k.pickerManage} disabled={busy} onClick={manage}>管理外部知识库 ↗</button></>}
      <p className={s.muted}>仅加入本次引用，生成或提问时使用。</p>
      <div className={s.confirmActions}><button className={s.button} disabled={busy} onClick={()=>setEditing(false)}>取消</button><button className={s.button+' '+s.primary} disabled={busy||disabled||!allowed||(compact?JSON.stringify(selected)===JSON.stringify(ids):!additions.length)} onClick={()=>{const collectionIds=compact?selected:[...new Set([...ids,...additions])];void apply(collectionIds.length?{...scope,providerId:scope?.providerId??status?.providerId,collectionIds,...(!scope&&!collectionIds.some(id=>id.startsWith('lib-'))&&product?{product}:{})}:undefined)}}>{busy?'保存中…':compact?'保存':'确认加入'}</button></div>
      {notice&&<p className={s.error} role="alert">{notice}</p>}
    </div></Modal>}
  </section>
}
