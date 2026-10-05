import { consumeNavigation, legacyOrigin, pendingNavigation, restoredFrame, returnNavigation, useLeaveGuard, useNavigationFrame } from './workbench-navigation.ts'
import React, { useEffect, useMemo, useState } from 'react'
import { entryKey, entryFacts, removeCategory, type Classification, type InventoryEntry } from '../core/classification.ts'
import css from './inventory-tree.module.css'
import { useAiClassification, AiClassificationFeedback } from './AiClassification.tsx'
import { InventoryIcon } from './InventoryIcon.tsx'
import { CategoryEditor } from './CategoryEditor.tsx'
import { LocalPluginImport } from './LocalPluginImport.tsx'
import { CapabilityReferences, capabilityLink, useCapabilityReferences } from './CapabilityReferences.tsx'

import { pluginRelations, relationNames } from '../../../dsh-capabilities/src/core/component-registry.ts'
import type { Snapshot } from '../../../dsh-capabilities/src/core/model.ts'
interface Preset { id:string;name:string;isDefault?:boolean;rows:InventoryEntry[] }
export interface InventorySnapshot { entries:InventoryEntry[];agentPresets?:Preset[] }
interface Props { list:()=>Promise<InventorySnapshot>;presetName?:(preset:Preset)=>string; componentId?:string; componentData?:Snapshot; compact?:boolean }
async function inventoryRequest(list:Props['list']):Promise<InventorySnapshot>{
 const [s,r]=await Promise.all([list(),fetch('/api/plugin-manager/pending')]);if(!r.ok)throw Error('无法读取待加载插件');const pending=await r.json();const existing=new Set(s.entries.map(entryKey)),origins=new Map<string,string>((pending.origins??[]).map((e:InventoryEntry)=>[entryKey(e),e.origin]));return {...s,entries:[...s.entries,...pending.entries.filter((e:InventoryEntry)=>!existing.has(entryKey(e)))].map(e=>({...e,origin:origins.get(entryKey(e))}))}
}
async function classificationRequest(body?:Classification):Promise<Classification>{
 const r=await fetch('/api/plugin-manager/classification',body?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}:undefined)
 const data=await r.json();if(!r.ok)throw Error(data.error??'无法读取分类');return data.classification
}
export async function readPluginInventory():Promise<InventorySnapshot>{ const r=await fetch('/api/plugin-manager/inventory');const data=await r.json();if(!r.ok)throw Error(data.error??'插件清单读取失败');return data }
export function InventoryTree({list,presetName,componentId,componentData,compact=false}:Props){
 const [imported,setImported]=useState<string[]>([]),[importNotice,setImportNotice]=useState('')
 useEffect(()=>{if(!imported.length)return;const timer=setTimeout(()=>setImported([]),8000);return()=>clearTimeout(timer)},[imported])
 const [entry]=useState(()=>compact?undefined:pendingNavigation('plugins'))
 const [saved]=useState(()=>{try{return restoredFrame(entry?.restore,'plugins')?.view ?? JSON.parse(sessionStorage.getItem('workbench-plugin-view')??'{}')}catch{return {}}})
 const [origin,setOrigin]=useState(restoredFrame(entry?.restore,'plugins')?.origin ?? legacyOrigin(entry))
 const polledData=useCapabilityReferences(); const capabilityData=componentData??polledData
 const [relatedId,setRelatedId]=useState(componentId ?? saved.relatedId)
 const descriptor=capabilityData?.components?.find(c=>c.id===(componentId??relatedId))
 const relations=descriptor?pluginRelations(descriptor):[]
 const related=(e:InventoryEntry)=>!descriptor||relations.some(r=>r.moduleName===e.moduleName)
 const [snapshot,setSnapshot]=useState<InventorySnapshot>(),[config,setConfig]=useState<Classification>(),[draft,setDraft]=useState<Classification>()
 const [focusEntry,setFocusEntry]=useState<{id:string;scope:string} | undefined>(saved.focusEntry)
 const [query,setQuery]=useState(()=>{try{return compact?String(JSON.parse(sessionStorage.getItem('component-plugin-view:'+componentId)??'{}').query??''):saved.query??''}catch{return ''}}),[chosen,setChosen]=useState(()=>{try{return compact?String(JSON.parse(sessionStorage.getItem('component-plugin-view:'+componentId)??'{}').chosen??''):saved.chosen??''}catch{return ''}}),[selected,setSelected]=useState<string[]>([]),[target,setTarget]=useState('')
 useEffect(()=>{if(compact)return;const select=(link:any)=>{if(link?.section!=='plugins')return;const frame=restoredFrame(link.restore,'plugins'),view=frame?.view;setOrigin(frame?.origin??legacyOrigin(link));if(view){setQuery(view.query??'');setRelatedId(view.relatedId);setFocusEntry(view.focusEntry);setChosen(view.chosen??'');setOpened(view.opened??{})}else{setQuery(link.moduleName??'');setRelatedId(link.componentId);setFocusEntry(link.entryId?{id:link.entryId,scope:link.scope??'global'}:undefined);if(link.scope&&link.scope!=='global')setChosen(link.scope);setOpened(old=>({...old,global:true}))}consumeNavigation(link)};select(entry);const listener=(event:Event)=>select((event as CustomEvent).detail);window.addEventListener('workbench-capability-link',listener);return()=>window.removeEventListener('workbench-capability-link',listener)},[compact,entry])
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[remove,setRemove]=useState<{id:string;group:boolean}>(),[removeTarget,setRemoveTarget]=useState('')
 const [opened,setOpened]=useState<Record<string,boolean>>(()=>{try{return compact?{global:true,...JSON.parse(sessionStorage.getItem('component-plugin-view:'+componentId)??'{}').opened}:restoredFrame(entry?.restore,'plugins')?.view?.opened??JSON.parse(localStorage.getItem('dsh-plugin-tree-open')??'{}')}catch{return {}}})
 useEffect(()=>{if(compact){try{sessionStorage.setItem('component-plugin-view:'+componentId,JSON.stringify({query,opened,chosen}))}catch{}}},[compact,componentId,query,opened,chosen])
 useLeaveGuard(!!draft,()=>setDraft(undefined))
 useNavigationFrame('plugins',0,()=>({section:'plugins',label:'插件管理',origin,view:{query,opened,chosen,relatedId,focusEntry}}),!compact)
 useEffect(()=>{if(!compact){try{sessionStorage.setItem('workbench-plugin-view',JSON.stringify({query,opened,chosen,relatedId,focusEntry}))}catch{}}},[compact,query,opened,chosen,relatedId,focusEntry])
 const refresh=async()=>{setError('');try{const [s,c]=await Promise.all([inventoryRequest(list),classificationRequest()]);setSnapshot(s);setConfig(c)}catch(e){setError(String(e))}}
 useEffect(()=>{let current=true;Promise.all([inventoryRequest(list),classificationRequest()]).then(([s,c])=>{if(current){setSnapshot(s);setConfig(c)}}).catch(e=>{if(current)setError(String(e))});return()=>{current=false}},[list])
 const ai=useAiClassification(!compact&&!relatedId,()=>{void refresh();window.dispatchEvent(new Event('plugin-classification-changed'))})
 useEffect(()=>{const changed=()=>void refresh();window.addEventListener('plugin-classification-changed',changed);return()=>window.removeEventListener('plugin-classification-changed',changed)},[list])
 const current=draft??config
 const presets=snapshot?.agentPresets??[]
 const preset=presets.find(p=>p.id===chosen)??presets.find(p=>p.isDefault)??presets[0]
 const q=query.trim().toLocaleLowerCase()
 const memberships=useMemo(()=>{const m=new Map<string,string[]>();for(const p of presets)for(const r of p.rows)if(r.enabled)m.set(r.moduleName,[...new Set([...(m.get(r.moduleName)??[]),presetName?.(p)??p.name])]);return m},[presets,presetName])
 const toggle=(key:string)=>{const next={...opened,[key]:!(opened[key]??(key==='sessions'))};setOpened(next);try{if(!compact)localStorage.setItem('dsh-plugin-tree-open',JSON.stringify(next))}catch{/* Optional browser preference. */}}
 const rememberOpen=(key:string,open:boolean)=>setOpened(previous=>previous[key]===open?previous:{...previous,[key]:open})
 const rows=(snapshot?.entries??[]).filter(related)
 const relevantPresets=presets.filter(p=>p.rows.some(related))
 const selectedPreset=descriptor?(relevantPresets.find(p=>p.id===chosen)??relevantPresets.find(p=>p.isDefault)??relevantPresets[0]):preset
 const absent=relations.filter(r=>snapshot&&!snapshot.entries.some(e=>e.moduleName===r.moduleName)&&!presets.some(p=>p.rows.some(e=>e.moduleName===r.moduleName)))
 const categoryLabel=(e:InventoryEntry)=>{const m=current?.modules.find(m=>m.id===current.assignments[entryKey(e)]);return m?[current?.groups.find(g=>g.id===m.groupId)?.name,m.name].join(' '):'未定义区'}
 const matches=(e:InventoryEntry,extra='')=>[e.moduleName,e.entryId,entryFacts(e).purpose,entryFacts(e).source,extra,categoryLabel(e)].join(' ').toLocaleLowerCase().includes(q)
 const card=(e:InventoryEntry,session=false)=>{
  const key=entryKey(e),fact=entryFacts(e),provided=!e.enabled?memberships.get(e.moduleName):undefined,scope=session?selectedPreset?.id:'global',identityKey='identity:'+scope+':'+e.entryId,referencesKey='references:'+scope+':'+e.entryId
  return <div key={(session?'session:':'')+e.entryId} className={css.card} data-imported={!session&&imported.includes(e.entryId)} data-entry-id={e.entryId} data-focused={focusEntry?.id===e.entryId && focusEntry.scope===(session?selectedPreset?.id:'global')}>
   {draft&&!session&&<label className={css.select}><input type="checkbox" aria-label={'选择 '+e.moduleName} checked={selected.includes(key)} onChange={ev=>setSelected(ev.target.checked?[...selected,key]:selected.filter(x=>x!==key))}/>选择</label>}
   <details open={focusEntry?.id===e.entryId && focusEntry.scope===(session?selectedPreset?.id:'global')?true:compact?!!opened[identityKey]:undefined} onToggle={compact?event=>rememberOpen(identityKey,event.currentTarget.open):undefined}><summary><strong>{e.moduleName.replace(/^@deepseek-ai\/(?:dsh-)?/,'').replace(/^@linxin666\/dsh-/,'')}</strong><span className={css.badge} data-state={e.fiberPhase==='failed'?'failed':e.enabled?'active':'disabled'}>{e.fiberPhase==='conditional'?'条件待确定':e.fiberPhase==='pending-restart'?'待重启加载':e.fiberPhase==='failed'?'加载失败':e.enabled?(e.fiberPhase==='active'?'已启用':'待激活'):provided?'由会话预设提供':'已停用'}</span></summary>
    <dl><dt>完整包名</dt><dd>{e.moduleName}</dd><dt>条目 ID</dt><dd>{e.entryId}</dd><dt>来源</dt><dd>{session?(e.moduleName.startsWith('@deepseek-ai/')?'官方 Harness':'会话预设插件'):fact.source}</dd><dt>运行状态</dt><dd>{e.fiberPhase??'未在全局加载'}</dd>{provided&&<><dt>提供此能力的预设</dt><dd>{provided.join('、')}</dd></>}</dl>
   </details><p>{session?(e.moduleName==='./no-tools.mjs'?'普通聊天的工具禁用边界。':e.moduleName.endsWith('/dsh-persona')?'会话角色提示词。':e.entryId):fact.purpose}</p>{descriptor&&<div className={css.relationBadges}>{relations.filter(r=>r.moduleName===e.moduleName).map(r=><span key={r.role} title={r.reason}>{relationNames[r.role]} · 必需</span>)}{compact&&<button className={css.toolButton} onClick={()=>capabilityLink('plugins',undefined,e.moduleName,{componentId:descriptor.id,entryId:e.entryId,scope:session?selectedPreset?.id:'global'})}>查看插件 ↗</button>}</div>}<CapabilityReferences moduleName={e.moduleName} componentId={descriptor?.id} data={capabilityData} open={compact?!!opened[referencesKey]:undefined} onOpenChange={compact?open=>rememberOpen(referencesKey,open):undefined}/>
  </div>
 }
 const grid=(entries:InventoryEntry[],session=false)=><div className={css.grid}>{[...entries].sort((a,b)=>Number(b.fiberPhase==='failed')-Number(a.fiberPhase==='failed')).map(e=>card(e,session))}</div>
 const section=(id:string,title:string,all:InventoryEntry[],content:React.ReactNode,extra='',empty=false)=>{
   const found=all.filter(e=>matches(e,extra||title));if((q||descriptor)&&!found.length&&!(id==='undefined'&&!compact&&!relatedId))return null
   const isOpen=q?true:(opened[id]??(compact&&!id.startsWith('module-'))),failed=all.filter(e=>e.fiberPhase==='failed').length
   const isModule=id.startsWith('module-'), isUndefined=id==='undefined'
   const moduleId=id.replace(/^module-/,''), groupId=id.replace(/^group-/,'')
   const group=isModule?current?.modules.find(m=>m.id===moduleId)?.groupId:groupId
   const tone=isUndefined?'amber':group==='extensions'?'violet':'blue'
   const moduleCount=current?.modules.filter(m=>m.groupId===groupId&&(!descriptor||rows.some(e=>current.assignments[entryKey(e)]===m.id))).length??0
   const showAI=isUndefined&&!compact&&!relatedId
   const heading=<button className={css.branchButton} onClick={()=>toggle(id)} aria-expanded={isOpen} aria-controls={'tree-'+id}>
     <span className={css.branchIcon}><InventoryIcon name={isModule?moduleId:isUndefined?'inbox':groupId==='core'?'layers':'grid'}/></span>
     <span className={css.branchLabel}><span className={css.branchTitle}>{title}</span>{!isModule&&<span className={css.branchHint}>{isUndefined?(all.length?'新加入的插件，从这里开始整理':'新加入的插件会收纳在这里'):`${moduleCount} 个功能模块`}</span>}</span>
     {!showAI&&<><span className={css.branchMeta}>{failed>0&&<span className={css.failureCount}>{failed} 项失败</span>}<span className={css.count}>{q?`${found.length} / ${all.length}`:all.length}<span className={css.countUnit}>个</span></span></span><InventoryIcon name="chevron" className={css.chevron}/></>}
    </button>
   return <section className={css.branch} key={id} data-level={isModule?'module':'group'} data-open={isOpen} data-tone={tone}>
    {showAI?<div className={css.aiHeader}>{heading}<div className={css.aiActions}><button className={css.aiButton} disabled={!!draft||busy||(!all.length&&!ai.running)} title={draft?'请先保存或取消手动分类':!all.length?'暂无需要分类的插件':`使用已有模型，处理全部 ${all.length} 项未定义插件`} onClick={()=>void (ai.running?ai.cancel():ai.start())}><InventoryIcon name={ai.running?'refresh':'spark'}/>{ai.running?'取消分类':'AI 自动分类'}</button><button className={css.aiToggle} aria-label={isOpen?'收起未定义区':'展开未定义区'} aria-expanded={isOpen} aria-controls={'tree-'+id} onClick={()=>toggle(id)}><span className={css.count}>{all.length}<span className={css.countUnit}>个</span></span><InventoryIcon name="chevron" className={css.chevron}/></button></div></div>:heading}
    {showAI&&<AiClassificationFeedback ai={ai} disabled={!!draft||busy}/>}
    {isOpen&&<div id={'tree-'+id} className={css.children}>{empty?<div className={css.emptyState}><InventoryIcon name="inbox"/><span>暂无待分类插件<small>导入新插件后，可以在这里为它选择模块。</small></span></div>:content}</div>}
   </section>
 }
 const setAssignment=(keys:string[],moduleId:string)=>setDraft(old=>old?{...old,assignments:{...old.assignments,...Object.fromEntries(keys.map(k=>[k,moduleId]))}}:old)
 const save=async()=>{if(!draft)return;setBusy(true);setError('');try{const c=await classificationRequest(draft);setConfig(c);setDraft(undefined);setSelected([])}catch(e){setError(String(e))}finally{setBusy(false)}}
 const differences=draft&&config?Object.keys({...config.assignments,...draft.assignments}).filter(k=>config.assignments[k]!==draft.assignments[k]).length:0
 const removeCount=remove&&current?rows.filter(r=>{const m=current.modules.find(m=>m.id===current.assignments[entryKey(r)]);return remove.group?m?.groupId===remove.id:m?.id===remove.id}).length:0
 return <div className={css.root} data-component-id={compact?relatedId:undefined} data-inventory-ready={!!snapshot&&!!current}>
  {!compact&&origin&&<button className={css.toolButton} onClick={()=>returnNavigation(origin)}>← 返回{origin.label}</button>}
  <div className={css.toolbar}><label className={css.search}><InventoryIcon name="search"/><input type="search" aria-label="搜索插件" placeholder="搜索插件、用途或模块" value={query} onChange={e=>setQuery(e.target.value)}/></label><button className={css.toolButton} title="刷新插件列表" aria-label="刷新" disabled={busy||!!draft} onClick={()=>void refresh()}><InventoryIcon name="refresh"/></button><button hidden={compact} className={css.toolButton} disabled={!config||busy||!!draft||ai.running} onClick={()=>{setDraft(structuredClone(config!));setSelected([])}}><InventoryIcon name="grid"/>管理分类</button>{!compact&&!relatedId&&<LocalPluginImport compact disabled={!config||busy||!!draft||ai.running} onChange={refresh} onImported={p=>{setImported(p.entries.map(e=>'include:'+e.id));setOpened(old=>({...old,global:true,undefined:true}));setImportNotice(p.disposition==='identical'?'该版本已安装，无需重复导入。':'已导入，重启后加载。新增条目已进入未定义区。')}}/>}</div>
  {importNotice&&<div className={css.importNotice} role="status"><span>{importNotice}</span><button onClick={()=>{setQuery('');setOpened(old=>({...old,global:true,undefined:true}));document.getElementById('tree-undefined')?.scrollIntoView({block:'nearest'})}}>查看新插件</button><button aria-label="关闭导入提示" onClick={()=>setImportNotice('')}>×</button></div>}
  {descriptor&&<p className={css.scopeDescription}>当前组件：{descriptor.name} · 仅显示精确关联的插件和预设条目{!compact&&<button className={css.toolButton} onClick={()=>{setRelatedId(undefined);setFocusEntry(undefined);setQuery('')}}>查看全部插件</button>}</p>}
  {error&&<p role="alert" className={css.error}>{error}</p>}
  {!snapshot||!current?<p>正在读取插件清单…</p>:<>
   {(descriptor?relevantPresets:presets).length>0&&<section className={css.session} data-plugin-scope="session"><div className={css.scopeToolbar}><button className={css.scopeButton} onClick={()=>toggle('sessions')} aria-expanded={opened.sessions!==false}><InventoryIcon name="chat" className={css.scopeIcon}/><span>会话插件</span><span className={css.count}>{selectedPreset?.rows.filter(related).length??0}<span className={css.countUnit}>个</span></span><InventoryIcon name="chevron" className={css.chevron}/></button><select aria-label="会话插件预设" value={selectedPreset?.id??''} onChange={e=>setChosen(e.target.value)}>{(descriptor?relevantPresets:presets).map(p=><option key={p.id} value={p.id}>{presetName?.(p)??p.name}{p.isDefault?'（默认）':''}</option>)}</select></div>{opened.sessions!==false&&<div className={css.reveal}><p className={css.muted}>由 Agent 预设按会话组成</p>{grid((selectedPreset?.rows??[]).filter(e=>related(e)&&matches(e)),true)}</div>}</section>}
   {draft&&<div className={css.editor} aria-label="分类编辑器">
    <strong>编辑分类</strong><p>新加入的插件进入未定义区。分类调整不改变插件启停。</p>
    <CategoryEditor value={draft} onChange={setDraft} disabled={busy} onRemove={(id,group)=>{setRemove({id,group});setRemoveTarget('')}}/>
    {remove&&<div className={css.confirm} role="dialog" aria-label="删除分类"><p>此分类涉及当前 {removeCount} 个插件。删除分类后将插件移到：</p><select aria-label="删除分类后的去向" value={removeTarget} onChange={e=>setRemoveTarget(e.target.value)}><option value="">未定义区</option>{draft.modules.filter(m=>remove.group?m.groupId!==remove.id:m.id!==remove.id).map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select><button onClick={()=>{setDraft(removeCategory(draft,remove.id,remove.group,removeTarget));setRemove(undefined)}}>确认移除分类</button><button onClick={()=>setRemove(undefined)}>取消</button></div>}
    <div className={css.toolbar}><span>已选择 {selected.length} 项</span><select aria-label="移动到模块" value={target} onChange={e=>setTarget(e.target.value)}><option value="">未定义区</option>{draft.groups.map(g=><optgroup key={g.id} label={g.name}>{draft.modules.filter(m=>m.groupId===g.id).map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</optgroup>)}</select><button disabled={!selected.length} onClick={()=>{setAssignment(selected,target);setSelected([])}}>移动到</button><button onClick={()=>setSelected(rows.filter(e=>matches(e)).map(entryKey))}>选择搜索结果</button><button onClick={()=>setSelected([])}>清除选择</button></div>
    <p>待保存：{differences} 项插件归属变更；分组 {config!.groups.length} → {draft.groups.length}，模块 {config!.modules.length} → {draft.modules.length}。名称和顺序按当前编辑结果保存。</p><div className={css.editorFooter}><button disabled={busy} onClick={()=>void save()}>{busy?'保存中…':'保存分类'}</button><button disabled={busy} onClick={()=>{setDraft(undefined);setRemove(undefined);setSelected([])}}>取消修改</button></div>
   </div>}
   {absent.length>0&&<details className={css.branch} open={compact?!!opened.sources:undefined} onToggle={compact?event=>rememberOpen('sources',event.currentTarget.open):undefined}><summary>来源包与待检测声明 · {absent.length} 项</summary><p className={css.muted}>以下来源未发现独立加载条目。包已安装、由服务直接加载和独立插件启用分别核对。</p>{absent.map(r=><div key={r.moduleName} className={css.card}><strong>{r.moduleName}</strong><p>{relationNames[r.role]} · {r.reason}</p><p>{capabilityData?.dependencies?.find(d=>d.id===r.moduleName)?.installed?'提供包已安装':'安装状态未检测'} · 未注册独立插件条目</p><button className={css.toolButton} onClick={()=>capabilityLink('plugins',undefined,r.moduleName,{componentId:descriptor?.id})}>查看插件管理 ↗</button></div>)}</details>}
   <section className={css.global} data-plugin-scope="global"><button className={css.scopeButton} aria-expanded={q?true:!!opened.global} onClick={()=>toggle('global')}><InventoryIcon name="layers" className={css.scopeIcon}/><span>{compact?'当前组件相关插件':'全局插件'}</span><span className={css.count}>{rows.length}<span className={css.countUnit}>个</span></span><InventoryIcon name="chevron" className={css.chevron}/></button><p className={css.scopeDescription}>系统与所有会话共用<span className={css.statusDot}/>{rows.filter(r=>r.enabled).length} 项启用<span className={css.inactiveCount}>{rows.filter(r=>!r.enabled).length} 项未启用</span></p>
    {(q||opened.global)&&<div className={css.groupList}>
     {(()=>{const all=rows.filter(e=>!current.modules.some(m=>m.id===current.assignments[entryKey(e)]));return section('undefined','未定义区',all,grid(all.filter(e=>matches(e,'未定义区'))),'未定义区',all.length===0)})()}
     {current.groups.map(g=>{const ms=current.modules.filter(m=>m.groupId===g.id),ids=new Set(ms.map(m=>m.id)),all=rows.filter(e=>ids.has(current.assignments[entryKey(e)]!));const content=<div className={css.moduleList}>{ms.map(m=>{const members=all.filter(e=>current.assignments[entryKey(e)]===m.id);return section('module-'+m.id,m.name,members,grid(members.filter(e=>matches(e,g.name+' '+m.name))),g.name+' '+m.name)})}</div>;return section('group-'+g.id,g.name,all,content,g.name)})}
    </div>}
   </section>
  </>}
 </div>
}
