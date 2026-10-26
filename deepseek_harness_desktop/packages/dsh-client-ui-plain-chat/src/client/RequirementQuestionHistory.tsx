import React,{useState} from 'react'
import type {RequirementTask} from '../../../dsh-capabilities/src/core/requirements-model.ts'
import {requirementQuestionHistory} from '../../../dsh-capabilities/src/core/requirement-question-history.ts'
import {Modal} from './PreviewModal.tsx'
import {MessageTime} from './MessageTime.tsx'
import m from './ManagedCapabilities.module.css'
import s from './RequirementQuestionHistory.module.css'

const statusNames={running:'回答中',ready:'已回答',error:'未完成',stopped:'已停止',interrupted:'已中断'}
export function RequirementQuestionHistory({task,disabled,onRetry}:{task?:RequirementTask;disabled:boolean;onRetry:(question:string)=>void}){
  const [open,setOpen]=useState(false),[selected,setSelected]=useState<string>()
  const rows=requirementQuestionHistory(task),row=rows.find(r=>r.id===selected)
  return <>
    <button className={s.trigger} title="历史记录" aria-label="历史记录" onClick={()=>{setSelected(undefined);setOpen(true)}}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 2.8-6.5L3 8M3 3v5h5M12 7v5l3 2"/></svg></button>
    {open&&<Modal title={row?'问答详情':'历史记录'} className={s.dialog} closeLabel="关闭历史记录" onClose={()=>setOpen(false)}><div className={`${m.page} ${m.dialogBody} ${s.body}`}>
      {row?<>
        <div className={s.detailTop}><button className={m.button} onClick={()=>setSelected(undefined)}>← 返回列表</button><span className={m.muted}>{statusNames[row.status]}</span><MessageTime value={row.at}/></div>
        <h3 className={s.question}>{row.question}</h3>
        {row.sources?<p className={m.muted}>当时引用：{[...row.sources.libraries.map(l=>l.name),...row.sources.files].join('、')||'未添加资料'}</p>:<p className={m.muted}>早期记录未保存完整的引用范围。</p>}
        {row.answer?<><p className={s.answer}>{row.answer.answer}</p>{row.answer.sources.length>0&&<details className={s.evidence}><summary>查看 {row.answer.sources.length} 处出处</summary>{row.answer.sources.map((ref,index)=><blockquote key={index}><strong>{ref.name}</strong><p>{ref.quote}</p></blockquote>)}</details>}<MessageTime value={row.answer.at}/></>:<p className={s.answer} role="status">{row.status==='running'?'正在生成回答…':row.error||'这次提问没有生成回答，可以再次提问。'}</p>}
        <div className={s.footer}><small className={m.muted}>再次提问使用当前添加的资料</small><button className={`${m.button} ${m.primary}`} disabled={disabled||row.status==='running'} onClick={()=>{setOpen(false);onRetry(row.question)}}>再次提问</button></div>
      </>:<>
        <p className={m.muted}>本次对话 · {rows.length} 条问答</p>
        {!rows.length?<p className={m.muted}>暂无问答记录，发送问题后会保存在这里。</p>:<ul className={s.list}>{rows.map(item=><li key={item.id}><button className={s.item} onClick={()=>setSelected(item.id)}><span><span className={s.label}>{item.question}</span><small><MessageTime value={item.at}/><span>{statusNames[item.status]}</span>{item.sources&&<span>{item.sources.libraries.length} 个知识库{item.sources.files.length?' · '+item.sources.files.length+' 份文件':''}</span>}</small></span><span className={s.chevron} aria-hidden="true">›</span></button></li>)}</ul>}
      </>}
    </div></Modal>}
  </>
}
