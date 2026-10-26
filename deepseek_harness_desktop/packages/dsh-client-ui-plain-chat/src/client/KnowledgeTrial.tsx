import React,{useCallback,useEffect,useRef,useState} from 'react'
import type {KnowledgeScope,KnowledgeStatus,KnowledgeTrialResult} from '../../../dsh-capabilities/src/core/knowledge.ts'
import {KnowledgeScopeFields} from './KnowledgeScopeFields.tsx'
import {KnowledgeTrialEvidence} from './KnowledgeEvidence.tsx'
import {PillCheckbox} from '../../../../shared/client/PillCheckbox.tsx'
import s from './ManagedCapabilities.module.css'

export function KnowledgeTrial({status,disabled=false,scope,onScopeChange,revision=0,focusRequest=0}:{status?:KnowledgeStatus;disabled?:boolean;scope?:KnowledgeScope;onScopeChange:(scope?:KnowledgeScope)=>void;revision?:number;focusRequest?:number}){
 const [question,setQuestion]=useState(''),[rawOnly,setRawOnly]=useState(false),[busy,setBusy]=useState(false),[result,setResult]=useState<KnowledgeTrialResult>(),[notice,setNotice]=useState('')
 const pending=useRef<AbortController>(),sequence=useRef(0),section=useRef<HTMLElement>(null),input=useRef<HTMLTextAreaElement>(null),lastFocus=useRef(focusRequest)
 const invalidate=useCallback(()=>{sequence.current++;pending.current?.abort();pending.current=undefined;setBusy(false);setResult(undefined);setNotice('')},[])
 const scopeKey=JSON.stringify(scope),availabilityKey=JSON.stringify([status?.providerId,status?.moduleEnabled,status?.available,status?.collections.map(c=>c.id),disabled])
 useEffect(()=>{invalidate()},[scopeKey,availabilityKey,revision,invalidate])
 useEffect(()=>{if(lastFocus.current!==focusRequest){section.current?.scrollIntoView?.({block:'nearest'});input.current?.focus({preventScroll:true})}lastFocus.current=focusRequest},[focusRequest])
 useEffect(()=>()=>{sequence.current++;pending.current?.abort()},[])
 const ready=!!status?.available&&status.moduleEnabled!==false&&!disabled
 const validScope=!!scope?.collectionIds.length&&(!scope.providerId||scope.providerId===status?.providerId)&&scope.collectionIds.every(id=>status?.collections.some(c=>c.id===id))
 const choose=(next?:KnowledgeScope)=>{invalidate();onScopeChange(next)}
 const ask=async()=>{
  if(!ready||!validScope||!question.trim()||busy)return
  invalidate();const round=sequence.current,controller=new AbortController();pending.current=controller;setBusy(true)
  try{const response=await fetch('/api/capabilities/knowledge/'+(rawOnly?'search':'ask'),{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:question.trim(),scope}),signal:controller.signal});const value=await response.json();if(round!==sequence.current||controller.signal.aborted)return;if(!response.ok)throw Error(value.error||'试用失败，请重试');setResult(value)}
  catch(error){if(round===sequence.current&&!controller.signal.aborted)setNotice(error instanceof Error?error.message:'试用失败，请重试')}
  finally{if(round===sequence.current){pending.current=undefined;setBusy(false)}}
 }
 return <section className={s.knowledgeTrial} ref={section} aria-label="知识库问答试用">
  <div><h4>问答试用</h4><p className={s.muted}>选好知识库，问一个问题，查看回答和出处。</p></div>
  <label className={s.field}>知识库<select disabled={!ready} value={scope?.collectionIds.length===1?scope.collectionIds[0]:scope?.collectionIds.length?'__multiple':''} onChange={e=>choose(e.target.value?{providerId:status?.providerId,collectionIds:[e.target.value]}:undefined)}>
   <option value="">请选择知识库</option>{scope&&scope.collectionIds.length>1&&<option value="__multiple" disabled>已选择 {scope.collectionIds.length} 个知识库</option>}{status?.collections.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
  </select></label>
  <label className={s.field}>问题<textarea ref={input} rows={2} disabled={!ready} value={question} placeholder="例如：当前版本每份需要多少克酱料？" onChange={e=>{invalidate();setQuestion(e.target.value)}}/></label>
  <div className={s.trialToolbar}><button type="button" className={`${s.button} ${s.primary}`} disabled={!ready||!validScope||!question.trim()||busy} onClick={()=>void ask()}>{busy?'处理中…':rawOnly?'检索原文':'提问'}</button>{busy?<button type="button" className={s.button} onClick={()=>{invalidate();setNotice('已取消，可修改问题后重新提问。')}}>取消</button>:<small className={s.muted}>{rawOnly?'只查找原文，不生成回答':'使用工作台默认对话模型'}</small>}</div>
  {!ready&&<p className={s.muted}>{disabled?'此能力已停用。':status?.message||'正在读取知识库…'}</p>}
  {ready&&!validScope&&scope&&<p className={s.muted}>资料范围已变化，请重新选择知识库。</p>}
  <details className={s.trialOptions}><summary>更多选项</summary><KnowledgeScopeFields value={scope} onChange={choose} status={status} disabled={!ready}/><label className={s.check}><PillCheckbox disabled={!ready} checked={rawOnly} onChange={e=>{invalidate();setRawOnly(e.target.checked)}}/>仅检索原文</label></details>
  {busy&&<p role="status" className={s.muted}>{rawOnly?'正在查找资料…':'正在查找资料并生成回答…'}</p>}
  {notice&&<p role="status">{notice}</p>}
  {result&&<div className={s.trialResult} aria-live="polite">
   {result.answer&&<div className={s.trialAnswer}><strong>回答</strong><p>{result.answer.text}</p></div>}
   {result.answerError&&<p role="alert">{result.answerError}</p>}
   {!result.sources.length&&!result.answer&&<p>没有找到相关资料，请调整问题或补充资料。</p>}
   <KnowledgeTrialEvidence sources={result.sources} citations={result.answer?.citations} rawOnly={rawOnly}/>
   {result.answer&&<small className={s.muted}>AI 根据资料生成，关键内容可展开出处核对。</small>}
  </div>}
 </section>
}
