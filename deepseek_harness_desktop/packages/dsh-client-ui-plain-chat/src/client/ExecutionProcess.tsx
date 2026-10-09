import React, { useEffect, useRef, useState } from 'react'
import type { ExecutionRecord, ExecutionPage, ExecutionStatus } from '../../../../shared/types/execution.ts'
import { MessageTime } from './MessageTime.tsx'
import s from './ExecutionProcess.module.css'
const names:Record<ExecutionStatus,string>={running:'执行中',waiting:'等待核对',done:'已完成',review:'审查未通过',failed:'执行失败',stopped:'已停止',interrupted:'已中断'}
export function useExecutionHistory(kind:string,id?:string|null,active=false) {
  const [page,setPage]=useState<ExecutionPage>({items:[],total:0}),[error,setError]=useState(''),[limit,setLimit]=useState(10)
  const current=useRef({active,items:page.items});current.current={active,items:page.items}
  useEffect(()=>{setLimit(10);setPage({items:[],total:0});setError('')},[kind,id])
  useEffect(()=>{
    if(!id)return
    let live=true,busy=false
    const read=async()=>{
      if(busy)return;busy=true
      const request=async(params:Record<string,string>)=>{const response=await fetch('/api/capabilities/executions?'+new URLSearchParams({kind,id,...params}),{credentials:'same-origin'});const value=await response.json();if(!response.ok)throw new Error(value.error||'执行过程读取失败');return value}
      try{
        const descriptors:ExecutionRecord[]=[];let total=0
        for(let offset=0;offset<limit;offset+=50){const p:ExecutionPage=await request({offset:String(offset),limit:String(Math.min(50,limit-offset)),summary:'1'});descriptors.push(...p.items);total=p.total;if(!p.nextOffset)break}
        const cached=current.current.items,items:ExecutionRecord[]=[]
        for(const descriptor of descriptors){
          const old=cached.find(r=>r.id===descriptor.id)
          if(old&&old.seq===descriptor.seq&&old.status===descriptor.status&&old.finishedAt===descriptor.finishedAt){items.push(old);continue}
          const next:ExecutionRecord=await request({runId:descriptor.id,afterSeq:String(old?.seq??0)})
          const events=new Map(old?.events.map(e=>[e.id,e])??[]);for(const e of next.events)events.set(e.id,e)
          items.push({...next,events:[...events.values()]})
        }
        if(live){setPage({items,total});setError('')}
      }catch(e){if(live)setError(e instanceof Error?e.message:'执行过程暂不可读')}finally{busy=false}
    }
    void read();const timer=setInterval(()=>{if(current.current.active||current.current.items.some(r=>r.status==='running'))void read()},2000)
    return()=>{live=false;clearInterval(timer)}
  },[kind,id,limit,active])
  return {runs:page.items.slice().reverse(),error,hasMore:page.total>page.items.length,more:()=>setLimit(n=>n+10)}
}
function resultText(record:ExecutionRecord){if(record.result?.kind!=='minutes')return record.result?.text;try{const m=JSON.parse(record.result.text);return [m.title,m.overview,'主要结论',...m.decisions.map((x:any)=>'• '+x.text),'行动项',...m.actions.map((x:any)=>'• '+x.text+'｜'+(x.owner||'负责人待确认')+'｜'+(x.deadline||'期限待确认')),'待确认',...m.unknown.map((x:any)=>'• '+x.text)].join('\n\n')}catch{return '此版本暂不可读取'}}
export function ExecutionProcessCard({run,showInput=false}:{run:ExecutionRecord;showInput?:boolean}) {
  const key='execution-open-'+run.taskId+'-'+run.id
  const [open,setOpen]=useState(()=>{try{return sessionStorage.getItem(key)==='true'}catch{return false}}),[clock,setClock]=useState(Date.now())
  useEffect(()=>{if(run.status!=='running')return;const t=setInterval(()=>setClock(Date.now()),1000);return()=>clearInterval(t)},[run.status])
  const active=run.events.filter(e=>e.status==='running').at(-1),seconds=Math.max(0,Math.round(((run.finishedAt?Date.parse(run.finishedAt):clock)-Date.parse(run.startedAt))/1000))
  return <section className={s.round} data-execution-run={run.id}>
    {showInput&&<div className={s.input}><small>{run.inputKind==='user'?'本轮要求':'本轮操作'} · {run.operation}</small><p>{run.input}</p><MessageTime value={run.startedAt}/></div>}
    <details className={s.process} open={open} onToggle={e=>{const value=e.currentTarget.open;setOpen(value);try{sessionStorage.setItem(key,String(value))}catch{}}}>
      <summary><span>执行过程</span><strong>{active?.title||names[run.status]}</strong><small>{seconds}秒</small></summary>
      <p className={s.meta}>{run.operation}{run.model?' · '+run.model:''}{run.jev?' · JEV '+(run.jev.enabled?'开启':'关闭')+' · 配置 v'+run.jev.revision:''}</p>
      <ol>{run.events.map(event=><li key={event.id} data-status={event.status}><div><strong>{event.title}</strong><span>{names[event.status]}</span>{event.total!==undefined&&<small>{event.current??0}/{event.total}</small>}</div>{event.detail&&<p>{event.detail}</p>}{event.model&&<small>{event.model}</small>}<MessageTime value={event.updatedAt}/></li>)}</ol>
      <MessageTime value={run.finishedAt||run.startedAt}/>
    </details>
    {run.summary&&<p className={s.outcome} role={['failed','review','interrupted'].includes(run.status)?'status':undefined}>{run.summary}</p>}
    {run.warning&&<p role="alert">{run.warning}</p>}
    {run.result&&<details className={s.result}><summary>查看本轮保存的{run.result.kind==='minutes'?'纪要版本':run.result.kind==='transcript'?'转写':run.result.kind==='check'?'验证输出':'结果'}</summary><pre>{resultText(run)}</pre><MessageTime value={run.finishedAt}/></details>}
  </section>
}
export function ExecutionHistory({kind,id,active=false}:{kind:string;id?:string|null;active?:boolean}){const history=useExecutionHistory(kind,id,active);if(!id)return null;return <div aria-label="执行过程记录">{history.error&&<p role="status">{history.error}；已显示内容保留。</p>}{history.hasMore&&<button onClick={history.more}>查看更早的执行过程</button>}{!history.runs.length&&!history.error&&!active&&<p className={s.meta}>此历史任务未记录完整执行过程，原结果保留。</p>}{history.runs.map(run=><ExecutionProcessCard key={run.id} run={run} showInput/>)}</div>}
