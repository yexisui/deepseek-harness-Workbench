import React, { useEffect, useState } from 'react'
import type { KnowledgeAnswer, KnowledgeEvidence as Evidence, KnowledgeScope } from '../../../dsh-capabilities/src/core/knowledge.ts'
import { MessageTime } from './MessageTime.tsx'
import s from './ManagedCapabilities.module.css'
type Record={id:string;taskId:string;roleId?:string;query:string;scope?:KnowledgeScope;sources:Evidence[];createdAt:string}
/** Compact trial-only view; assistant history keeps its original evidence presentation. */
export function KnowledgeTrialEvidence({sources,citations,rawOnly=false}:{sources:Evidence[];citations?:KnowledgeAnswer['citations'];rawOnly?:boolean}){
 if(!sources.length)return null
 const cited=citations?.length?sources.filter(source=>citations.some(c=>c.sourceId===source.id)):sources
 const groups=new Map<string,{title:string;quotes:string[]}>()
 for(const source of cited){const key=JSON.stringify([source.providerId,source.collectionId,source.documentId]),group=groups.get(key)??{title:source.title,quotes:[]};const quotes=citations?.filter(c=>c.sourceId===source.id).map(c=>c.quote)??[];for(const quote of quotes.length?quotes:[source.text.slice(0,300)+(source.text.length>300?'…':'')])if(!group.quotes.includes(quote))group.quotes.push(quote);groups.set(key,group)}
 return <><details className={s.trialSources} open={rawOnly}><summary>{citations?.length?'查看回答依据':'查看相关资料'}（{groups.size} 份文档）</summary>{[...groups].map(([id,group])=><article key={id}><strong>{group.title}</strong>{group.quotes.map((quote,i)=><blockquote key={i}>{quote}</blockquote>)}</article>)}</details>
 <details className={s.trialOptions}><summary>原始检索片段（{sources.length} 条）</summary><KnowledgeEvidenceList sources={sources}/></details></>
}
export function KnowledgeEvidenceList({sources}:{sources:Evidence[]}){return <>{sources.map((source,i)=><details key={source.id}><summary>[K{i+1}] {source.title}</summary><p>{source.text}</p><small>{[source.locator,source.version].filter(Boolean).join(' · ')}</small>{source.url&&<p><a href={source.url} target="_blank" rel="noreferrer">查看原文</a></p>}<MessageTime value={source.retrievedAt}/></details>)}{!sources.length&&<p>没有检索到相关资料。</p>}</>}
export function KnowledgeHistory({taskId,active=false,all=false}:{taskId?:string|null;active?:boolean;all?:boolean}){
  const [rows,setRows]=useState<Record[]>([]),[error,setError]=useState('')
  useEffect(()=>{if(!taskId&&!all){setRows([]);return}let live=true;setRows([]);const read=async()=>{try{const r=await fetch('/api/capabilities/knowledge/history'+(taskId?'?'+new URLSearchParams({taskId}):''),{credentials:'same-origin'});const v=await r.json();if(!r.ok)throw Error(v.error||'知识库依据读取失败');if(live){setRows(v);setError('')}}catch(e){if(live)setError(e instanceof Error?e.message:String(e))}};void read();const timer=active?setInterval(read,2000):undefined;return()=>{live=false;clearInterval(timer)}},[taskId,active,all])
  if(!all&&!rows.length)return null
  return <section className={s.page} aria-label="知识库检索记录"><h4>知识库依据</h4>{error&&<p role="alert">{error}</p>}{!rows.length&&!error&&<p>尚无检索记录。</p>}{rows.slice().reverse().map(row=><details key={row.id}><summary>{row.query.slice(0,100)}</summary><p>任务：{row.taskId}{row.roleId?' · 岗位：'+row.roleId:''}</p><MessageTime value={row.createdAt}/><KnowledgeEvidenceList sources={row.sources}/></details>)}</section>
}
