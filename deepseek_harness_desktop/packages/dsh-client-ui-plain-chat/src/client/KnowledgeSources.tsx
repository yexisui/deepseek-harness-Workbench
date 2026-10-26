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

export function KnowledgeSources({ scope, product, disabled, allowed, onChange }: { scope?:KnowledgeScope; product:string; disabled:boolean; allowed:boolean; onChange:(scope?:KnowledgeScope)=>Promise<void> }) {
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
  const matches=status?.collections.filter(c=>c.name.toLowerCase().includes(query.trim().toLowerCase()))??[]
  return <section className={k.root} aria-label="本次外部知识库" aria-busy={busy}>
    <header className={k.header}><h3>外部知识库</h3>
      {status?.available&&status.configured&&<button className={k.add} aria-label="添加知识库" disabled={disabled||!allowed||busy||!status.collections.length} title={!allowed?'请在岗位中关联外部知识库模块':undefined} onClick={()=>{setSelected([]);setQuery('');setNotice('');setEditing(true);void refresh()}}>添加知识库</button>}
    </header>
    <p className={k.meta}>本次引用 · {ids.length} 个知识库</p>
    {ids.length?<ul className={k.list}>{ids.map(id=><li key={id} className={k.row}><CapabilityGlyph kind="document"/><span className={k.name}>{name(id)}</span><button className={k.remove} disabled={disabled||busy} aria-label={'移除引用：'+name(id)} title={'移除引用：'+name(id)} onClick={()=>remove(id)}><CapabilityActionIcon kind="remove"/></button></li>)}</ul>:<p className={k.empty}>暂未引用知识库，可点击上方添加。</p>}
    <button className={k.settings} onClick={()=>openCapabilityLink({section:'capability-center',capabilityId:'external-knowledge',tab:'config:knowledge'})}>查看知识库设置</button>
    {ids.length>0&&<p className={k.hint}>移除只影响本次引用，不会删除知识库。</p>}
    {undo&&JSON.stringify(scope)===JSON.stringify(undo.after)&&<p className={k.feedback} role="status">已移除本次引用。<button disabled={disabled||busy} onClick={()=>void apply(undo.before)}>撤销</button></p>}
    {(error||status&&!status.available)&&<p className={k.hint} role="status">{error||status?.message}</p>}
    {notice&&!editing&&<p className={k.feedback} role="alert">{notice}</p>}
    {editing&&<Modal title="添加知识库" closeLabel="取消知识库选择" closeDisabled={busy} onClose={()=>{if(!busy)setEditing(false)}}><div className={s.page+' '+s.dialogBody}>
      <label className={s.field}>搜索资料集<input aria-label="搜索资料集" value={query} onChange={e=>setQuery(e.target.value)} disabled={busy}/></label>
      <div>{matches.map(c=><label className={s.check} key={c.id}><PillCheckbox checked={ids.includes(c.id)||selected.includes(c.id)} disabled={busy||ids.includes(c.id)} onChange={e=>setSelected(e.target.checked?[...new Set([...selected,c.id])]:selected.filter(id=>id!==c.id))}/>{c.name}{ids.includes(c.id)&&<small className={s.muted}>已添加</small>}</label>)}{!matches.length&&<p className={s.muted}>没有找到匹配的知识库。</p>}</div>
      <p className={s.muted}>仅加入本次引用，生成或提问时使用。</p>
      <div className={s.confirmActions}><button className={s.button} disabled={busy} onClick={()=>setEditing(false)}>取消</button><button className={s.button+' '+s.primary} disabled={busy||!allowed||!additions.length} onClick={()=>{const collectionIds=[...new Set([...ids,...additions])];void apply({...scope,providerId:scope?.providerId??status?.providerId,collectionIds,...(!scope&&!collectionIds.some(id=>id.startsWith('lib-'))&&product?{product}:{})})}}>{busy?'保存中…':'确认加入'}</button></div>
      {notice&&<p className={s.error} role="alert">{notice}</p>}
    </div></Modal>}
  </section>
}
