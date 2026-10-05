import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { ClassificationJob, ClassificationReport } from '../core/ai-classification.ts'
import { useLeaveGuard, openWorkbenchLink } from './workbench-navigation.ts'
import css from './inventory-tree.module.css'
import { pluginResponse } from './plugin-request.ts'

async function request(action:string,body?:object){
  const response=await fetch('/api/plugin-manager/ai/'+action,body?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),keepalive:true}:undefined)
  return pluginResponse(response)
}
export function useAiClassification(enabled:boolean,onChanged:()=>void){
  const [job,setJob]=useState<ClassificationJob>(),[report,setReport]=useState<ClassificationReport>(),[error,setError]=useState(''),[working,setWorking]=useState(false)
  const latest=useRef(onChanged);latest.current=onChanged
  const owned=useRef<string>(),mounted=useRef(false),seen=useRef(''),generation=useRef(0)
  const apply=useCallback((data:{job?:ClassificationJob;report?:ClassificationReport})=>{
    if(!mounted.current)return
    setJob(data.job);setReport(data.job?.report??data.report)
    const result=data.job?.report??data.report,stamp=result?JSON.stringify(result):''
    if(stamp&&seen.current&&seen.current!==stamp)latest.current()
    if(data.job?.phase==='done'&&owned.current===data.job.id){owned.current=undefined;latest.current()}
    if(data.job?.phase==='cancelled'||data.job?.phase==='failed')owned.current=undefined
    seen.current=stamp||'loaded'
  },[])
  const cancel=useCallback(async()=>{const id=owned.current??job?.id;if(!id)return;try{generation.current++;const data=await request('cancel',{id});apply(data);owned.current=undefined}catch(e){if(mounted.current)setError(String(e))}},[job?.id,apply])
  const running=working||job?.phase==='running'
  useLeaveGuard(enabled&&running&&!!owned.current,()=>{void cancel()},'AI 正在分类，确定取消本次分类并离开？尚未保存的结果将丢弃。')
  useEffect(()=>{
    mounted.current=true
    if(!enabled)return()=>{mounted.current=false}
    let inFlight=false
    const poll=async()=>{if(inFlight)return;inFlight=true;const version=generation.current;try{const data=await request('status');if(version===generation.current)apply(data)}catch(e){if(mounted.current)setError(String(e))}finally{inFlight=false}}
    void poll();const timer=setInterval(()=>void poll(),1200)
    const beforeUnload=(event:BeforeUnloadEvent)=>{if(owned.current){event.preventDefault();event.returnValue=''}}
    const pageHide=()=>{if(owned.current)void request('cancel',{id:owned.current}).catch(()=>{})}
    window.addEventListener('beforeunload',beforeUnload);window.addEventListener('pagehide',pageHide)
    return()=>{mounted.current=false;clearInterval(timer);window.removeEventListener('beforeunload',beforeUnload);window.removeEventListener('pagehide',pageHide);pageHide()}
  },[enabled,apply])
  const start=async()=>{
    if(running)return;generation.current++;const id=crypto.randomUUID();owned.current=id;setWorking(true);setError('');setJob({id,phase:'running',total:0,processed:0,model:''})
    try{const result=await request('start',{id}) as ClassificationJob;if(!mounted.current){void request('cancel',{id}).catch(()=>{});return}if(result.id!==id)owned.current=undefined;apply({job:result})}
    catch(e){if(mounted.current){setError(String(e));try{apply(await request('status'))}catch{}}}
    finally{if(mounted.current)setWorking(false)}
  }
  const undo=async()=>{if(!report||running)return;generation.current++;setWorking(true);setError('');try{apply(await request('undo',{id:report.id}));latest.current()}catch(e){setError(String(e))}finally{setWorking(false)}}
  const retry=async()=>{setError('');try{apply(await request('status'))}catch(e){setError(e instanceof Error?e.message:String(e))}}
  return {job,report,error,running,start,cancel,undo,retry}
}
export type AiClassificationState=ReturnType<typeof useAiClassification>
export function AiClassificationFeedback({ai,disabled}:{ai:AiClassificationState;disabled:boolean}){
 const {job,report,error,running}=ai
 if(!job&&!report&&!error)return null
 const count=(status:string)=>report?.results.filter(r=>r.status===status).length??0
 return <div className={css.aiFeedback}>
  <div role="status" aria-live="polite">
   {running?<span>正在分类 {job?.total||'全部未定义'} 项{job?.total?` · 已分析 ${job.processed} / ${job.total}`:''}{job?.model&&<small>使用：{job.model}</small>}</span>:job?.phase==='cancelled'?<span>已取消，尚未保存的结果已丢弃。</span>:job?.phase==='failed'?<span className={css.error}>{job.error}</span>:report?<span>{report.undone?`已撤销 ${count('undone')} 项`:`已分类 ${count('applied')} 项`}{count('unclassified')+count('failed')>0?`，${count('unclassified')+count('failed')} 项仍待整理`:''}{count('skipped')>0?`，${count('skipped')} 项已有变化，已跳过`:''}<small>使用：{report.model}</small></span>:null}
  </div>
  {error&&<p className={css.error} role="alert">{error}</p>}
  {error&&<button onClick={()=>void ai.retry()}>重新检查连接</button>}
  {!error&&job?.phase==='failed'&&<button onClick={()=>openWorkbenchLink({section:'models'})}>前往模型设置</button>}
  {!running&&report&&<details><summary>查看分类结果</summary><ul>{report.results.map(r=><li key={r.key}><strong>{r.name}</strong><span>{r.status==='applied'?r.target:r.status==='undone'?'已退回未定义区':r.status==='skipped'?'保留当前归属':'留在未定义区'}</span><small>{r.reason}</small></li>)}</ul></details>}
  {!running&&report&&!report.undone&&count('applied')>0&&<button disabled={disabled} onClick={()=>void ai.undo()}>撤销本次分类</button>}
 </div>
}
