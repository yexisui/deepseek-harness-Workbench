import React, { useState } from 'react'
import type { KnowledgeScope } from '../../../dsh-capabilities/src/core/knowledge.ts'
import { PillCheckbox } from '../../../../shared/client/PillCheckbox.tsx'
import { Modal } from './PreviewModal.tsx'
import { useKnowledgeStatus } from './KnowledgeSettings.tsx'
import { openCapabilityLink } from './capability-client.ts'
import s from './ManagedCapabilities.module.css'

export function KnowledgeSources({ scope, product, disabled, allowed, onChange }: { scope?:KnowledgeScope; product:string; disabled:boolean; allowed:boolean; onChange:(scope?:KnowledgeScope)=>Promise<void> }) {
  const { status, error, refresh } = useKnowledgeStatus()
  const [editing,setEditing]=useState(false),[selected,setSelected]=useState<string[]>([]),[query,setQuery]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('')
  const apply=async(value?:KnowledgeScope)=>{setBusy(true);setNotice('');try{await onChange(value);setEditing(false)}catch(e){setNotice(e instanceof Error?e.message:String(e))}finally{setBusy(false)}}
  return <section aria-label="本次外部知识库"><h3>外部知识库</h3><p role="status">{error||status?.message||'正在读取状态…'}</p>
    {scope&&<><p>本次引用：{scope.collectionIds.map(id=>status?.collections.find(c=>c.id===id)?.name||id).join('、')}</p><button disabled={disabled||busy} onClick={()=>void apply()}>仅用本次文件</button></>}
    {status?.available&&status.configured&&<button disabled={disabled||!allowed||busy||!status.collections.length} title={!allowed?'请在岗位中关联外部知识库模块':undefined} onClick={()=>{setSelected(scope?.collectionIds??[]);setQuery('');setNotice('');setEditing(true);void refresh()}}>添加知识库</button>}
    <button onClick={()=>openCapabilityLink({section:'capability-center',capabilityId:'external-knowledge',tab:'config:knowledge'})}>查看知识库设置</button>
    {notice&&<p role="alert">{notice}</p>}
    {editing&&<Modal title="选择本次知识库" closeLabel="取消知识库选择" onClose={()=>{if(!busy)setEditing(false)}}><div className={`${s.page} ${s.dialogBody}`}>
      <label className={s.field}>搜索资料集<input aria-label="搜索资料集" value={query} onChange={e=>setQuery(e.target.value)} disabled={busy}/></label>
      <div>{status?.collections.filter(c=>c.name.toLowerCase().includes(query.toLowerCase())).map(c=><label className={s.check} key={c.id}><PillCheckbox checked={selected.includes(c.id)} disabled={busy} onChange={e=>setSelected(e.target.checked?[...new Set([...selected,c.id])]:selected.filter(id=>id!==c.id))}/>{c.name}</label>)}</div>
      <p className={s.muted}>确认只保存本次引用范围；生成或提问时才检索，不上传本次文件。</p>
      <div className={s.confirmActions}><button className={s.button} disabled={busy} onClick={()=>setEditing(false)}>取消</button><button className={`${s.button} ${s.primary}`} disabled={busy||!allowed||!selected.length} onClick={()=>void apply({providerId:status?.providerId,collectionIds:selected,...(product?{product}:{}),...(scope?.project?{project:scope.project}:{})})}>{busy?'保存中…':'确认加入'}</button></div>
      {notice&&<p className={s.error} role="alert">{notice}</p>}
    </div></Modal>}
  </section>
}
