import React, { useEffect, useMemo, useState } from 'react'
import { entryKey, entryFacts, removeCategory, type Classification, type InventoryEntry } from '../core/classification.ts'
import css from './inventory-tree.module.css'
import { InventoryIcon } from './InventoryIcon.tsx'
import { CapabilityReferences, capabilityLink, useCapabilityReferences } from './CapabilityReferences.tsx'

interface Preset { id:string;name:string;isDefault?:boolean;rows:InventoryEntry[] }
export interface InventorySnapshot { entries:InventoryEntry[];agentPresets?:Preset[] }
interface Props { list:()=>Promise<InventorySnapshot>;presetName?:(preset:Preset)=>string }
async function inventoryRequest(list:Props['list']):Promise<InventorySnapshot>{
 const [s,r]=await Promise.all([list(),fetch('/api/plugin-manager/pending')]);if(!r.ok)throw Error('无法读取待加载插件');const pending=await r.json();const existing=new Set(s.entries.map(entryKey)),origins=new Map<string,string>((pending.origins??[]).map((e:InventoryEntry)=>[entryKey(e),e.origin]));return {...s,entries:[...s.entries,...pending.entries.filter((e:InventoryEntry)=>!existing.has(entryKey(e)))].map(e=>({...e,origin:origins.get(entryKey(e))}))}
}
async function classificationRequest(body?:Classification):Promise<Classification>{
 const r=await fetch('/api/plugin-manager/classification',body?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}:undefined)
 const data=await r.json();if(!r.ok)throw Error(data.error??'无法读取分类');return data.classification
}
function shift<T>(items:T[],index:number,delta:number):T[]{const result=[...items],other=index+delta;if(other<0||other>=items.length)return result;[result[index],result[other]]=[result[other]!,result[index]!];return result}
export function InventoryTree({list,presetName}:Props){
 const capabilityData=useCapabilityReferences()
 const [snapshot,setSnapshot]=useState<InventorySnapshot>(),[config,setConfig]=useState<Classification>(),[draft,setDraft]=useState<Classification>()
 const [query,setQuery]=useState(''),[chosen,setChosen]=useState(''),[selected,setSelected]=useState<string[]>([]),[target,setTarget]=useState('')
 useEffect(()=>{const select=(event?:Event)=>{try{const link=event?(event as CustomEvent).detail:JSON.parse(sessionStorage.getItem('workbench-capability-link')??'null');if(link?.section==='plugins'&&link.moduleName)setQuery(link.moduleName)}catch{/* Optional navigation memory. */}};select();window.addEventListener('workbench-capability-link',select);return()=>window.removeEventListener('workbench-capability-link',select)},[])
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[remove,setRemove]=useState<{id:string;group:boolean}>(),[removeTarget,setRemoveTarget]=useState('')
 const [opened,setOpened]=useState<Record<string,boolean>>(()=>{try{return JSON.parse(localStorage.getItem('dsh-plugin-tree-open')??'{}')}catch{return {}}})
 const refresh=async()=>{setError('');try{const [s,c]=await Promise.all([inventoryRequest(list),classificationRequest()]);setSnapshot(s);setConfig(c)}catch(e){setError(String(e))}}
 useEffect(()=>{let current=true;Promise.all([inventoryRequest(list),classificationRequest()]).then(([s,c])=>{if(current){setSnapshot(s);setConfig(c)}}).catch(e=>{if(current)setError(String(e))});return()=>{current=false}},[list])
 const current=draft??config
 const presets=snapshot?.agentPresets??[]
 const preset=presets.find(p=>p.id===chosen)??presets.find(p=>p.isDefault)??presets[0]
 const q=query.trim().toLocaleLowerCase()
 const memberships=useMemo(()=>{const m=new Map<string,string[]>();for(const p of presets)for(const r of p.rows)if(r.enabled)m.set(r.moduleName,[...new Set([...(m.get(r.moduleName)??[]),presetName?.(p)??p.name])]);return m},[presets,presetName])
 const toggle=(key:string)=>{const next={...opened,[key]:!(opened[key]??(key==='sessions'))};setOpened(next);try{localStorage.setItem('dsh-plugin-tree-open',JSON.stringify(next))}catch{/* Optional browser preference. */}}
 const rows=snapshot?.entries??[]
 const categoryLabel=(e:InventoryEntry)=>{const m=current?.modules.find(m=>m.id===current.assignments[entryKey(e)]);return m?[current?.groups.find(g=>g.id===m.groupId)?.name,m.name].join(' '):'未定义区'}
 const matches=(e:InventoryEntry,extra='')=>[e.moduleName,e.entryId,entryFacts(e).purpose,entryFacts(e).source,extra,categoryLabel(e)].join(' ').toLocaleLowerCase().includes(q)
 const card=(e:InventoryEntry,session=false)=>{
  const key=entryKey(e),fact=entryFacts(e),provided=!e.enabled?memberships.get(e.moduleName):undefined
  return <div key={(session?'session:':'')+e.entryId} className={css.card} data-entry-id={e.entryId}>
   {draft&&!session&&<label className={css.select}><input type="checkbox" aria-label={'选择 '+e.moduleName} checked={selected.includes(key)} onChange={ev=>setSelected(ev.target.checked?[...selected,key]:selected.filter(x=>x!==key))}/>选择</label>}
   <details><summary><strong>{e.moduleName.replace(/^@deepseek-ai\/(?:dsh-)?/,'').replace(/^@linxin666\/dsh-/,'')}</strong><span className={css.badge} data-state={e.fiberPhase==='failed'?'failed':e.enabled?'active':'disabled'}>{e.fiberPhase==='pending-restart'?'待重启加载':e.fiberPhase==='failed'?'加载失败':e.enabled?(e.fiberPhase==='active'?'已启用':'待激活'):provided?'由会话预设提供':'已停用'}</span></summary>
    <dl><dt>完整包名</dt><dd>{e.moduleName}</dd><dt>条目 ID</dt><dd>{e.entryId}</dd><dt>来源</dt><dd>{session?(e.moduleName.startsWith('@deepseek-ai/')?'官方 Harness':'会话预设插件'):fact.source}</dd><dt>运行状态</dt><dd>{e.fiberPhase??'未在全局加载'}</dd>{provided&&<><dt>提供此能力的预设</dt><dd>{provided.join('、')}</dd></>}</dl>
   </details><p>{session?(e.moduleName==='./no-tools.mjs'?'普通聊天的工具禁用边界。':e.moduleName.endsWith('/dsh-persona')?'会话角色提示词。':e.entryId):fact.purpose}</p><CapabilityReferences moduleName={e.moduleName} data={capabilityData}/>
  </div>
 }
 const grid=(entries:InventoryEntry[],session=false)=><div className={css.grid}>{[...entries].sort((a,b)=>Number(b.fiberPhase==='failed')-Number(a.fiberPhase==='failed')).map(e=>card(e,session))}</div>
 const section=(id:string,title:string,all:InventoryEntry[],content:React.ReactNode,extra='',empty=false)=>{
   const found=all.filter(e=>matches(e,extra||title));if(q&&!found.length)return null
   const isOpen=q?true:!!opened[id],failed=all.filter(e=>e.fiberPhase==='failed').length
   const isModule=id.startsWith('module-'), isUndefined=id==='undefined'
   const moduleId=id.replace(/^module-/,''), groupId=id.replace(/^group-/,'')
   const group=isModule?current?.modules.find(m=>m.id===moduleId)?.groupId:groupId
   const tone=isUndefined?'amber':group==='extensions'?'violet':'blue'
   const moduleCount=current?.modules.filter(m=>m.groupId===groupId).length??0
   return <section className={css.branch} key={id} data-level={isModule?'module':'group'} data-open={isOpen} data-tone={tone}>
    <button className={css.branchButton} onClick={()=>toggle(id)} aria-expanded={isOpen} aria-controls={'tree-'+id}>
     <span className={css.branchIcon}><InventoryIcon name={isModule?moduleId:isUndefined?'inbox':groupId==='core'?'layers':'grid'}/></span>
     <span className={css.branchLabel}><span className={css.branchTitle}>{title}</span>{!isModule&&<span className={css.branchHint}>{isUndefined?(all.length?'新加入的插件，从这里开始整理':'新加入的插件会收纳在这里'):`${moduleCount} 个功能模块`}</span>}</span>
     <span className={css.branchMeta}>{failed>0&&<span className={css.failureCount}>{failed} 项失败</span>}<span className={css.count}>{q?`${found.length} / ${all.length}`:all.length}<span className={css.countUnit}>个</span></span></span>
     <InventoryIcon name="chevron" className={css.chevron}/>
    </button>
    {isOpen&&<div id={'tree-'+id} className={css.children}>{empty?<div className={css.emptyState}><InventoryIcon name="inbox"/><span>暂无待分类插件<small>导入新插件后，可以在这里为它选择模块。</small></span></div>:content}</div>}
   </section>
 }
 const setAssignment=(keys:string[],moduleId:string)=>setDraft(old=>old?{...old,assignments:{...old.assignments,...Object.fromEntries(keys.map(k=>[k,moduleId]))}}:old)
 const save=async()=>{if(!draft)return;setBusy(true);setError('');try{const c=await classificationRequest(draft);setConfig(c);setDraft(undefined);setSelected([])}catch(e){setError(String(e))}finally{setBusy(false)}}
 const differences=draft&&config?Object.keys({...config.assignments,...draft.assignments}).filter(k=>config.assignments[k]!==draft.assignments[k]).length:0
 const removeCount=remove&&current?rows.filter(r=>{const m=current.modules.find(m=>m.id===current.assignments[entryKey(r)]);return remove.group?m?.groupId===remove.id:m?.id===remove.id}).length:0
 return <div className={css.root}>
  {capabilityData&&<button className={css.toolButton} onClick={()=>{let id:string|undefined;try{id=JSON.parse(sessionStorage.getItem('workbench-capability-link')??'null')?.capabilityId}catch{}capabilityLink('capability-center',id)}}>← 返回能力中心</button>}
  <div className={css.toolbar}><label className={css.search}><InventoryIcon name="search"/><input type="search" aria-label="搜索插件" placeholder="搜索插件、用途或模块" value={query} onChange={e=>setQuery(e.target.value)}/></label><button className={css.toolButton} disabled={busy||!!draft} onClick={()=>void refresh()}><InventoryIcon name="refresh"/>刷新</button><button className={css.toolButton} disabled={!config||busy||!!draft} onClick={()=>{setDraft(structuredClone(config!));setSelected([])}}><InventoryIcon name="grid"/>管理分类</button></div>
  {error&&<p role="alert" className={css.error}>{error}</p>}
  {!snapshot||!current?<p>正在读取插件清单…</p>:<>
   {presets.length>0&&<section className={css.session} data-plugin-scope="session"><div className={css.scopeToolbar}><button className={css.scopeButton} onClick={()=>toggle('sessions')} aria-expanded={opened.sessions!==false}><InventoryIcon name="chat" className={css.scopeIcon}/><span>会话插件</span><span className={css.count}>{preset?.rows.length??0}<span className={css.countUnit}>个</span></span><InventoryIcon name="chevron" className={css.chevron}/></button><select aria-label="会话插件预设" value={preset?.id??''} onChange={e=>setChosen(e.target.value)}>{presets.map(p=><option key={p.id} value={p.id}>{presetName?.(p)??p.name}{p.isDefault?'（默认）':''}</option>)}</select></div>{opened.sessions!==false&&<div className={css.reveal}><p className={css.muted}>由 Agent 预设按会话组成</p>{grid((preset?.rows??[]).filter(e=>matches(e)),true)}</div>}</section>}
   {draft&&<div className={css.editor} aria-label="分类编辑器">
    <strong>编辑分类</strong><p>新加入的插件进入未定义区。分类调整不改变插件启停。</p>
    {draft.groups.map((g,gi)=><div className={css.editGroup} key={g.id}><div className={css.toolbar}><input aria-label="分组名称" value={g.name} onChange={e=>setDraft({...draft,groups:draft.groups.map(x=>x.id===g.id?{...x,name:e.target.value}:x)})}/><button disabled={gi===0} onClick={()=>setDraft({...draft,groups:shift(draft.groups,gi,-1)})}>上移</button><button disabled={gi===draft.groups.length-1} onClick={()=>setDraft({...draft,groups:shift(draft.groups,gi,1)})}>下移</button><button onClick={()=>{setRemove({id:g.id,group:true});setRemoveTarget('')}}>删除分组</button></div>
      {draft.modules.filter(m=>m.groupId===g.id).map(m=><div className={css.moduleEdit} key={m.id}><input aria-label="模块名称" value={m.name} onChange={e=>setDraft({...draft,modules:draft.modules.map(x=>x.id===m.id?{...x,name:e.target.value}:x)})}/><select aria-label="模块所属分组" value={m.groupId} onChange={e=>setDraft({...draft,modules:draft.modules.map(x=>x.id===m.id?{...x,groupId:e.target.value}:x)})}>{draft.groups.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select><button aria-label={'上移 '+m.name} onClick={()=>{const index=draft.modules.indexOf(m),previous=draft.modules.map((x,i)=>i<index&&x.groupId===g.id?i:-1).reduce((a,b)=>Math.max(a,b),-1);if(previous>=0){const next=[...draft.modules];[next[index],next[previous]]=[next[previous]!,next[index]!];setDraft({...draft,modules:next})}}}>↑</button><button aria-label={'下移 '+m.name} onClick={()=>{const index=draft.modules.indexOf(m),nextIndex=draft.modules.findIndex((x,i)=>i>index&&x.groupId===g.id);if(nextIndex>=0){const next=[...draft.modules];[next[index],next[nextIndex]]=[next[nextIndex]!,next[index]!];setDraft({...draft,modules:next})}}}>↓</button><button onClick={()=>{setRemove({id:m.id,group:false});setRemoveTarget('')}}>删除</button></div>)}
      <button onClick={()=>setDraft({...draft,modules:[...draft.modules,{id:'m-'+crypto.randomUUID(),name:'新模块',groupId:g.id}]})}>新增模块标签</button>
    </div>)}
    <button onClick={()=>setDraft({...draft,groups:[...draft.groups,{id:'g-'+crypto.randomUUID(),name:'新分组'}]})}>新增分组</button>
    {remove&&<div className={css.confirm} role="dialog" aria-label="删除分类"><p>此分类涉及当前 {removeCount} 个插件。删除分类后将插件移到：</p><select aria-label="删除分类后的去向" value={removeTarget} onChange={e=>setRemoveTarget(e.target.value)}><option value="">未定义区</option>{draft.modules.filter(m=>remove.group?m.groupId!==remove.id:m.id!==remove.id).map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select><button onClick={()=>{setDraft(removeCategory(draft,remove.id,remove.group,removeTarget));setRemove(undefined)}}>确认移除分类</button><button onClick={()=>setRemove(undefined)}>取消</button></div>}
    <div className={css.toolbar}><span>已选择 {selected.length} 项</span><select aria-label="移动到模块" value={target} onChange={e=>setTarget(e.target.value)}><option value="">未定义区</option>{draft.groups.map(g=><optgroup key={g.id} label={g.name}>{draft.modules.filter(m=>m.groupId===g.id).map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</optgroup>)}</select><button disabled={!selected.length} onClick={()=>{setAssignment(selected,target);setSelected([])}}>移动到</button><button onClick={()=>setSelected(rows.filter(e=>matches(e)).map(entryKey))}>选择搜索结果</button><button onClick={()=>setSelected([])}>清除选择</button></div>
    <p>待保存：{differences} 项插件归属变更；分组 {config!.groups.length} → {draft.groups.length}，模块 {config!.modules.length} → {draft.modules.length}。名称和顺序按当前编辑结果保存。</p><div className={css.toolbar}><button disabled={busy} onClick={()=>void save()}>{busy?'保存中…':'保存分类'}</button><button disabled={busy} onClick={()=>{setDraft(undefined);setRemove(undefined);setSelected([])}}>取消修改</button></div>
   </div>}
   <section className={css.global} data-plugin-scope="global"><button className={css.scopeButton} aria-expanded={q?true:!!opened.global} onClick={()=>toggle('global')}><InventoryIcon name="layers" className={css.scopeIcon}/><span>全局插件</span><span className={css.count}>{rows.length}<span className={css.countUnit}>个</span></span><InventoryIcon name="chevron" className={css.chevron}/></button><p className={css.scopeDescription}>系统与所有会话共用<span className={css.statusDot}/>{rows.filter(r=>r.enabled).length} 项启用<span className={css.inactiveCount}>{rows.filter(r=>!r.enabled).length} 项未启用</span></p>
    {(q||opened.global)&&<div className={css.groupList}>
     {(()=>{const all=rows.filter(e=>!current.modules.some(m=>m.id===current.assignments[entryKey(e)]));return section('undefined','未定义区',all,grid(all.filter(e=>matches(e,'未定义区'))),'未定义区',all.length===0)})()}
     {current.groups.map(g=>{const ms=current.modules.filter(m=>m.groupId===g.id),ids=new Set(ms.map(m=>m.id)),all=rows.filter(e=>ids.has(current.assignments[entryKey(e)]!));const content=<div className={css.moduleList}>{ms.map(m=>{const members=all.filter(e=>current.assignments[entryKey(e)]===m.id);return section('module-'+m.id,m.name,members,grid(members.filter(e=>matches(e,g.name+' '+m.name))),g.name+' '+m.name)})}</div>;return section('group-'+g.id,g.name,all,content,g.name)})}
    </div>}
   </section>
  </>}
 </div>
}
