import { consumeNavigation, legacyOrigin, pendingNavigation, restoredFrame, returnNavigation, useLeaveGuard, useNavigationFrame, type NavigationLocation } from '../../../dsh-plugin-manager/src/client/workbench-navigation.ts'
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { actionNames, components, references, type Component } from '../../../dsh-capabilities/src/core/model.ts'
import { adaptedCapabilities, pluginRelations, type Candidate, type ComponentMetadata } from '../../../dsh-capabilities/src/core/component-registry.ts'
import { InventoryTree, readPluginInventory } from '../../../dsh-plugin-manager/src/client/InventoryTree.tsx'
import { capabilityClient, lastCapabilityLink, openCapabilityLink, useCapabilities } from './capability-client.ts'
import { CapabilityGlyph } from './ManagedWorkbench.tsx'
import { CapabilityActionIcon } from './ManagedCapabilityCards.tsx'
import { ComponentEnvironment, componentService } from './ComponentService.tsx'
import { useMeetingAvailability } from './meeting-capability-status.ts'
import { useRequirementAvailability } from './RequirementsSettings.tsx'
import { Modal } from './PreviewModal.tsx'
import s from './ManagedCapabilities.module.css'
import css from './ComponentCenter.module.css'

import { readCenterView, rememberCenterView, useCenterLayout } from './component-center-layout.ts'
const tabs = [['overview','概览'],['actions','动作'],['configuration','配置与状态'],['plugins','插件与依赖'],['usage','使用关系'],['versions','版本与变更']]
type Editor = { operationId: string; id: string; revision: number; base: ComponentMetadata; value: { name: string; description: string; category: string } }
type Preview = { id: string; action: string; token: string; revision: number; stateRevision: number; capabilities: { id: string; name: string; draft: boolean; versions: number[]; removed: boolean }[]; roles: { id: string; name: string }[]; activities: { id: string; name: string; kind: string; status: string }[] }
const operationNames: Record<string,string> = { retire: '移入回收站', restore: '恢复组件', disable: '全局停用', enable: '启用组件', purge: '永久删除' }
/** A catalog over the same execution descriptors, service adapters and plugin classification. */
export function ComponentCenter({ embedded = false, initialId, onClose, restore }: { embedded?: boolean; initialId?: string; onClose?: () => void; restore?: NavigationLocation }) {
  const { data, error } = useCapabilities(), { status: meetingStatus } = useMeetingAvailability(data?.state.revision)
  const { status: requirementsStatus } = useRequirementAvailability(data?.state.revision)
  const viewKey=embedded?'embedded':'root'
  const [link] = useState(()=>embedded?undefined:pendingNavigation('component-center'))
  const [savedView] = useState(()=>({...readCenterView(viewKey),...restoredFrame(restore ?? link?.restore,'components')?.view}))
  const [origin,setOrigin]=useState(restoredFrame(restore??link?.restore,'components')?.origin ?? legacyOrigin(link))
  const linked=link?.section==='component-center'&&!!link.componentId
  useEffect(()=>consumeNavigation(link),[link])
  const [pane,setPane] = useState<'list'|'detail'>(savedView.pane && (restore || link?.restore) ? savedView.pane : initialId||linked?'detail':savedView.pane??'list')
  const rootRef=useRef<HTMLElement>(null), listRef=useRef<HTMLDivElement>(null), detailRef=useRef<HTMLDivElement>(null), bodyRef=useRef<HTMLDivElement>(null)
  const tabMemory=useRef(savedView.tabs??{}), scrollMemory=useRef(savedView.scroll??{}), focusOnReturn=useRef(false), visibleIds=useRef(new Set<string>())
  const [folds,setFolds]=useState<Record<string,boolean>>(savedView.folds??{})
  const layout=useCenterLayout(rootRef,!!data)
  const [selected,setSelected] = useState((restore || link?.restore ? savedView.selected : undefined) ?? initialId ?? link?.componentId ?? savedView?.selected ?? 'developer-files')
  const [tab,setTab] = useState(link?.tab ?? savedView.tabs?.[link?.componentId ?? initialId ?? savedView.selected] ?? savedView.tab ?? 'overview')
  const changedLink=linked&&link.componentId!==savedView.selected
  const [query,setQuery] = useState(changedLink?'':savedView.query??''), [filter,setFilter] = useState(changedLink?'all':savedView.filter??'all'), [category,setCategory] = useState(changedLink?'':savedView.category??'')
  const [editor,setEditor] = useState<Editor | undefined>(savedView.editor), [adding,setAdding] = useState(!!savedView.adding), [targeting,setTargeting] = useState(false)
  const [candidateOperationId,setCandidateOperationId] = useState(savedView.candidateOperationId ?? '')
  const [candidate,setCandidate] = useState(savedView.candidate ?? (()=>{try{return JSON.parse(sessionStorage.getItem('workbench-component-candidate:'+viewKey)??'null')?.value ?? {name:'',description:'',category:'未分类',provider:''}}catch{return {name:'',description:'',category:'未分类',provider:''}}}))
  const [preview,setPreview] = useState<Preview>(), [busy,setBusy] = useState(false), [message,setMessage] = useState('')
  const [pendingOperation,setPendingOperation] = useState<{ key:string; id:string }>()
  useLeaveGuard(!!editor,()=>setEditor(undefined))
  useNavigationFrame('components',embedded?40:0,()=>{captureScroll();return {section:'component-center',label:'组件中心',origin,view:{selected,tab,query,filter,category,pane,tabs:tabMemory.current,scroll:scrollMemory.current,folds,adding,candidate,candidateOperationId}}})
  useEffect(()=>{try{sessionStorage.setItem('workbench-component-candidate:'+viewKey,JSON.stringify({value:candidate}))}catch{}},[candidate,viewKey])
  const remember=()=>rememberCenterView(viewKey,{selected,tab,query,filter,category,pane,tabs:tabMemory.current,scroll:scrollMemory.current,folds})
  const captureScroll=()=>{
    if(listRef.current&&!listRef.current.hidden)scrollMemory.current.list=listRef.current.scrollTop
    if(detailRef.current&&!detailRef.current.hidden&&bodyRef.current)scrollMemory.current[selected+':'+tab]=bodyRef.current.scrollTop
  }
  const selectComponent=(id:string,nextTab?:string)=>{captureScroll();tabMemory.current[selected]=tab;setSelected(id);setTab(nextTab??tabMemory.current[id]??'overview');setPane('detail')}
  const selectTab=(next:string)=>{captureScroll();tabMemory.current[selected]=next;setTab(next)}
  const returnToList=()=>{captureScroll();focusOnReturn.current=true;setPane('list')}
  useEffect(()=>remember(),[viewKey,selected,tab,query,filter,category,pane,folds])
  useEffect(() => {
    const open=(event:Event)=>{const next=(event as CustomEvent).detail;if(embedded||next?.section!=='component-center')return
      setOrigin(restoredFrame(next.restore,'components')?.origin??legacyOrigin(next));const saved=restoredFrame(next.restore,'components')?.view
      if(saved){captureScroll();tabMemory.current=saved.tabs??{};scrollMemory.current=saved.scroll??{};setSelected(saved.selected);setTab(saved.tab??'overview');setPane(saved.pane??'list');setQuery(saved.query??'');setFilter(saved.filter??'all');setCategory(saved.category??'');setFolds(saved.folds??{});setAdding(!!saved.adding);if(saved.candidate)setCandidate(saved.candidate);setCandidateOperationId(saved.candidateOperationId??'');setEditor(saved.editor)}
      else if(next.componentId){if(!visibleIds.current.has(next.componentId)){setQuery('');setFilter('all');setCategory('')}selectComponent(next.componentId,next.tab)}
      else if(next.tab)selectTab(next.tab)
      consumeNavigation(next)
    }
    window.addEventListener('workbench-capability-link',open);return()=>window.removeEventListener('workbench-capability-link',open)
  },[selected,tab])
  useLayoutEffect(()=>{
    if(listRef.current&&!listRef.current.hidden)listRef.current.scrollTop=scrollMemory.current.list??0
    let observer:MutationObserver|undefined
    if(bodyRef.current&&detailRef.current&&!detailRef.current.hidden){
      const body=bodyRef.current,top=scrollMemory.current[selected+':'+tab]??0
      const restore=()=>{if(body.querySelector('[data-inventory-ready="false"]'))return;body.scrollTop=top;observer?.disconnect()}
      observer=new MutationObserver(restore);observer.observe(body,{childList:true,subtree:true,attributes:true,attributeFilter:['data-inventory-ready']});restore()
    }
    if(focusOnReturn.current&&listRef.current&&!listRef.current.hidden){focusOnReturn.current=false;Array.from(listRef.current.querySelectorAll<HTMLButtonElement>('[data-component-open]')).find(button=>button.dataset.componentOpen===selected)?.focus({preventScroll:true})}
    return()=>observer?.disconnect()
  },[selected,tab,pane,layout.wide,!!data])
  if (!data) return <div className={s.page}><p role="status">{error || '正在读取组件…'}</p><button className={s.button} onClick={()=>void capabilityClient.refresh()}>重新加载</button></div>
  const registry=data.registry, supported=!!registry
  const catalog=data.components.length ? data.components : components
  const metadata=(id:string):ComponentMetadata=>registry?.metadata[id] ?? {}
  const descriptor=catalog.find(c=>c.id===selected), localCandidate=registry?.candidates.find(c=>c.id===selected)
  const current=descriptor ?? localCandidate, meta=descriptor?metadata(selected):localCandidate ?? {}, name=current?.name ?? selected
  const service=descriptor?componentService(descriptor,{data,meetingStatus,requirementsStatus}):undefined
  const description=meta.description ?? service?.description ?? ''
  const refs=references(data.state,selected,data.tasks), activities=data.componentActivities?.filter(t=>t.componentIds.includes(selected))
  const adapted=descriptor?adaptedCapabilities(data.state,descriptor):[]
  const run=async(fn:()=>Promise<void>)=>{setBusy(true);setMessage('');try{await fn()}catch(e){setMessage(e instanceof Error?e.message:String(e))}finally{setBusy(false)}}
  const save=()=>void run(async()=>{
    if(!editor)return
    const patch=Object.fromEntries(Object.entries(editor.value).filter(([key,value])=>value!==(editor.base[key as keyof ComponentMetadata] ?? (key==='name'?catalog.find(c=>c.id===editor.id)?.name ?? '':key==='description'?description:'未分类'))))
    await capabilityClient.componentCommand({type:'metadata.save',id:editor.id,revision:editor.revision,base:editor.base,patch,operationId:editor.operationId});setEditor(undefined);setMessage('组件信息已保存，动作与服务配置继续使用原有契约。')
  })
  const edit=()=>setEditor({operationId:crypto.randomUUID(),id:selected,revision:registry!.revision,base:structuredClone(meta),value:{name,description,category:meta.category ?? '未分类'}})
  const togglePin=(id:string)=>void run(async()=>{const before=catalog.some(c=>c.id===id)?metadata(id):registry!.candidates.find(c=>c.id===id)!;await capabilityClient.componentCommand({type:'metadata.save',id,revision:registry!.revision,base:{pinned:before.pinned},patch:{pinned:!before.pinned},operationId:crypto.randomUUID()})})
  const inspect=(id:string,action:string)=>void run(async()=>{setPreview(await capabilityClient.componentPreview(id,action));setPendingOperation(undefined)})
  const confirm=()=>void run(async()=>{if(!preview)return;const key=preview.id+':'+preview.action,operationId=pendingOperation?.key===key?pendingOperation.id:crypto.randomUUID();setPendingOperation({key,id:operationId});await capabilityClient.componentCommand({type:'component.'+preview.action,id:preview.id,token:preview.token,confirm:true,operationId});setPreview(undefined);setPendingOperation(undefined);setMessage(operationNames[preview.action]+'已完成');if(preview.action==='retire')setFilter('removed');if(preview.action==='restore')setFilter('all')})
  const configure=()=>{const cap=adapted[0] ?? refs.capabilities.find(c=>!c.removedAt);if(cap)openCapabilityLink({section:'capability-center',capabilityId:cap.id,tab:descriptor?.management==='browser'?'overview':'defaults',componentId:selected,returnTo:'component-center'})}
  const entries: (Component|Candidate)[]=[...catalog,...registry?.candidates ?? []]
  const visible=entries.filter(c=>{
    const m=catalog.some(d=>d.id===c.id)?metadata(c.id):c as Candidate
    const isCandidate=!catalog.some(d=>d.id===c.id), r=references(data.state,c.id,data.tasks)
    const text=[c.name,m.description,catalog.some(d=>d.id===c.id)?componentService(c as Component,{data,meetingStatus,requirementsStatus}).description:'',catalog.some(d=>d.id===c.id)?componentService(c as Component,{data,meetingStatus,requirementsStatus}).summary:'',c.provider,...catalog.some(d=>d.id===c.id)?pluginRelations(c as Component).map(p=>p.moduleName):[],...catalog.some(d=>d.id===c.id)?adaptedCapabilities(data.state,c as Component).map(cap=>cap.draft.name):[]].join(' ').toLocaleLowerCase()
    return (filter==='removed'?!!m.retiredAt:!m.retiredAt)&&(filter!=='pinned'||m.pinned)&&(filter!=='unused'||!r.capabilities.length)&&(filter!=='candidate'||isCandidate)&&(filter!=='pending'||isCandidate||m.enabled===false||(c as Component).management==='browser'&&data.health.state!=='ready'||(c as Component).management==='meeting-asr'&&!meetingStatus?.ready||(c as Component).management==='requirements'&&!requirementsStatus?.ready)&&(!category||(m.category??'未分类')===category)&&text.includes(query.trim().toLocaleLowerCase())
  }).sort((a,b)=>Number(Boolean(metadata(b.id).pinned??(b as Candidate).pinned))-Number(Boolean(metadata(a.id).pinned??(a as Candidate).pinned)))
  visibleIds.current=new Set(visible.map(c=>c.id))
  const visibleCurrent=!!current&&visibleIds.current.has(selected), selectedIndex=visible.findIndex(c=>c.id===selected)
  return <section ref={rootRef} className={[s.page,css.root].join(' ')} data-component-center data-layout={layout.wide?'wide':'single'} data-pane={pane} style={{height:layout.height}}>
    <div className={`${s.heading} ${css.heading}`}><div><h2>组件中心</h2><span className={s.muted}>整理组件，查看适配能力、插件来源与使用关系。</span></div><div className={s.actions}>{!embedded&&origin&&<button className={s.button} onClick={()=>returnNavigation(origin)}>← 返回{origin.label}</button>}{onClose&&<button className={s.button} onClick={onClose}>返回组件组合</button>}<button className={s.button} onClick={()=>openCapabilityLink({section:'capability-center'})}>能力中心 ↗</button><button className={`${s.button} ${s.primary}`} disabled={!supported} onClick={()=>{setCandidateOperationId(crypto.randomUUID());setAdding(true)}}>＋ 添加组件</button></div></div>
    {!supported&&<p className={s.notice}>组件登记服务待更新。可以浏览现有组件；正常重启工作台后再编辑登记信息。</p>}
    {(message||error)&&<p role={message.includes('已')?'status':'alert'} className={s.notice}>{message||error}</p>}
    <div className={css.toolbar} hidden={!layout.wide&&pane==='detail'}><input className={s.search} type="search" aria-label="搜索组件" placeholder="搜索名称、用途、适配能力或提供插件" value={query} onChange={e=>setQuery(e.target.value)}/><select aria-label="组件分类" value={category} onChange={e=>setCategory(e.target.value)}><option value="">全部分类</option>{[...new Set(entries.map(c=>(metadata(c.id).category??(c as Candidate).category??'未分类')))].map(c=><option key={c}>{c}</option>)}</select><button className={s.button} onClick={()=>void capabilityClient.refresh()}>刷新</button></div>
    <div className={`${s.tabs} ${css.filters}`} hidden={!layout.wide&&pane==='detail'}>{[['all','全部'],['pinned','收藏'],['pending','待就绪'],['unused','未使用'],['candidate','待开发'],['removed','回收站']].map(([key,label])=><button key={key} aria-pressed={filter===key} onClick={()=>setFilter(key!)}>{label}</button>)}</div>
    <div className={css.layout}><div ref={listRef} className={css.list} role="list" aria-label="组件清单" hidden={!layout.wide&&pane==='detail'} onScroll={()=>{scrollMemory.current.list=listRef.current!.scrollTop;remember()}}><p className={s.muted}>{visible.length} 项组件 · {catalog.length} 项已有业务组件</p>{visible.map(c=>{
      const d=catalog.find(x=>x.id===c.id), m=d?metadata(c.id):c as Candidate, caps=d?adaptedCapabilities(data.state,d):[]
      return <article key={c.id} className={css.item} data-selected={selected===c.id} role="listitem" onClick={event=>{if(!(event.target as Element).closest('button,a,input,select,summary'))selectComponent(c.id)}}><div className={css.itemHeading}><button className={css.name} data-component-open={c.id} onClick={()=>selectComponent(c.id)}><CapabilityGlyph kind={d?.icon??'document'}/><strong>{c.name}</strong></button><button className={`${s.iconButton} ${m.pinned?s.pinned:''}`} aria-pressed={!!m.pinned} title={(m.pinned?'取消收藏 ':'收藏 ')+c.name} disabled={!supported||busy} aria-label={(m.pinned?'取消收藏 ':'收藏 ')+c.name} onClick={()=>togglePin(c.id)}><CapabilityActionIcon kind="pin"/></button></div><p className={`${s.muted} ${css.metadata}`}>{d?.sourceLabel??'候选登记'} · {m.category??'未分类'}{m.enabled===false?' · 全局停用':''}{m.retiredAt?' · 已移除':''}</p><p className={css.summary} title={m.description??(d?componentService(d,{data,meetingStatus,requirementsStatus}).description:(c as Candidate).description)}>{m.description??(d?componentService(d,{data,meetingStatus,requirementsStatus}).summary:(c as Candidate).description)}</p><div className={css.chipRow}><small>适配能力</small>{caps.length?caps.map(cap=><button className={css.chip} key={cap.id} onClick={()=>openCapabilityLink({section:'capability-center',capabilityId:cap.id,componentId:c.id,returnTo:'component-center'})}>{cap.draft.name}</button>):<span className={s.muted}>尚未接入</span>}</div><div className={css.chipRow}><small>对应插件</small>{(d?pluginRelations(d).filter(r=>r.role!=='support').map(r=>r.moduleName):[(c as Candidate).provider]).map(p=><button className={css.chip} key={p} title={p} onClick={()=>selectComponent(c.id,'plugins')}>{p.replace(/^@[^/]+\/dsh-/,'').replace(/^@[^/]+\//,'')}</button>)}</div></article>
    })}{!visible.length&&<p className={s.empty}>没有符合条件的组件。</p>}</div>
    <div ref={detailRef} className={css.detail} hidden={!layout.wide&&pane==='list'} data-center-detail>{!visibleCurrent?<p className={s.empty}>选择列表中的组件查看详情。</p>:<><div className={css.detailHeader}>
      <div className={css.detailNavigation}><button className={s.button} onClick={returnToList} hidden={layout.wide}>← 返回组件列表</button><div className={css.previousNext}><button className={s.button} aria-label="上一个组件" disabled={selectedIndex<=0} onClick={()=>selectComponent(visible[selectedIndex-1]!.id)}>上一项</button><button className={s.button} aria-label="下一个组件" disabled={selectedIndex<0||selectedIndex===visible.length-1} onClick={()=>selectComponent(visible[selectedIndex+1]!.id)}>下一项</button></div></div>
      <div className={[s.heading,css.detailTitle].join(' ')}><div><h3>{name}</h3><p className={s.muted}>{descriptor?.sourceLabel??'候选组件'} · {meta.retiredAt?'已移入回收站':meta.enabled===false?'全局停用':descriptor?'已登记':'待接入执行适配器'}</p></div></div><div className={`${s.actions} ${css.detailActions}`}><button className={`${s.button} ${s.primary}`} disabled={!descriptor||!!meta.retiredAt||meta.enabled===false||!supported} onClick={()=>setTargeting(true)}>添加到能力</button><button className={s.button} disabled={!supported||busy} onClick={edit}>整理信息</button><details className={css.menu}><summary className={s.button}>更多操作</summary><div>{meta.retiredAt?<button disabled={!supported||busy} onClick={()=>inspect(selected,'restore')}>恢复组件</button>:<button disabled={!supported||busy} onClick={()=>inspect(selected,'retire')}>移入回收站</button>}{descriptor&&<button disabled={!supported||busy} onClick={()=>inspect(selected,meta.enabled===false?'enable':'disable')}>{meta.enabled===false?'启用组件':'全局停用'}</button>}{!descriptor&&meta.retiredAt&&<button disabled={!supported||busy} onClick={()=>inspect(selected,'purge')}>永久删除候选登记</button>}</div></details></div>
      <div className={[s.tabs,css.detailTabs].join(' ')} hidden={layout.narrow} aria-label="组件详情栏目">{tabs.map(([key,label])=><button key={key} aria-pressed={tab===key} onClick={()=>selectTab(key!)}>{label}</button>)}</div>
      <label className={css.tabPicker} hidden={!layout.narrow}>详情栏目<select aria-label="组件详情栏目" value={tab} onChange={event=>selectTab(event.target.value)}>{tabs.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
      </div><div ref={bodyRef} className={css.detailBody} onScroll={()=>{scrollMemory.current[selected+':'+tab]=bodyRef.current!.scrollTop;remember()}}>
      {tab==='overview'&&<><p>{description||'尚未填写用途说明。'}</p><div className={css.overviewReferences}><span>适配 {adapted.length} 项能力 · 被 {refs.capabilities.length} 项能力引用（含历史版本）</span><button className={s.button} onClick={()=>selectTab('usage')}>查看使用关系</button></div>{!descriptor&&<p className={s.notice}>此项是候选登记。安装插件后仍需接入真实动作契约及服务适配器，才能装配和执行。</p>}</>}
      {tab==='actions'&&<>{descriptor?.actions.map(action=><div className={s.row} key={action}><div><strong>{actionNames[action]}</strong><small>{action}</small><p>已适配动作；任务执行仍按岗位、已发布能力版本和任务授权检查。</p></div></div>)}{!descriptor&&<p>尚未接入可执行动作。</p>}</>}
      {tab==='configuration'&&<>{descriptor&&service?<ComponentEnvironment component={descriptor} data={data} meetingStatus={meetingStatus} requirementsStatus={requirementsStatus} onConfigure={configure}/>:<p>候选组件没有可用的服务配置入口。</p>}{descriptor&&<><button className={s.button} onClick={configure}>前往所属能力配置 ↗</button><p className={s.muted}>提供插件的加载状态见“插件与依赖”；本页使用对应能力的同一份配置。</p></>}</>}
      {tab==='plugins'&&<>{descriptor?<InventoryTree key={selected} list={readPluginInventory} componentId={selected} componentData={data} compact/>:<p>候选来源：{localCandidate?.provider}。尚未登记执行关系。</p>}{descriptor&&<details className={css.environment} open={!!folds[selected]} onToggle={event=>{const open=event.currentTarget.open;setFolds(previous=>previous[selected]===open?previous:{...previous,[selected]:open})}}><summary>服务与环境</summary><p>由 {descriptor.sourceLabel} 处理业务动作。服务配置由所属能力统一管理。</p>{descriptor.dependencies.filter(id=>!id.startsWith('@')).map(id=><p key={id}>{id} · 环境要求{descriptor.management==='browser'?` · ${data.health.message}`:''}</p>)}<button className={s.button} onClick={configure}>前往服务配置 ↗</button></details>}</>}
      {tab==='usage'&&<><h4>能力引用（含草稿与历史版本）</h4>{refs.capabilities.map(c=><div className={s.row} key={c.id}><div><strong>{c.draft.name}{c.removedAt?' · 已移除':''}</strong><small>{c.draft.components.some(p=>p.componentId===selected)?'草稿引用 · ':''}{c.versions.filter(v=>v.components.some(p=>p.componentId===selected)).map(v=>'v'+v.version).join('、')||'无已发布引用'}</small></div><button className={s.button} onClick={()=>openCapabilityLink({section:'capability-center',capabilityId:c.id,componentId:selected,returnTo:'component-center'})}>查看能力 ↗</button></div>)}{!refs.capabilities.length&&<p>暂无引用。</p>}<h4>岗位引用</h4><p>{refs.roles.map(r=>r.draft.name).join('、')||'暂无岗位引用。'}</p><h4>活动任务</h4>{activities?activities.length?activities.map(t=><p key={t.kind+':'+t.id}>{t.name} · {t.status}</p>):<p>当前没有正在运行的相关任务。</p>:<p>活动任务检测服务待更新，数量未知。</p>}</>}
      {tab==='versions'&&<><p>动作契约版本：{descriptor?.version??'未接入'} · 组合协议：{descriptor?.compositionVersion??'未接入'}</p><p className={s.muted}>插件实现版本及升级、回退由插件管理维护。整理名称和说明不会发布能力，也不会扩大已有会话权限。</p>{registry?.events.filter(e=>e.componentId===selected).slice().reverse().map(e=><p key={e.id}>{new Date(e.at).toLocaleString()} · {e.action}</p>)}{!registry?.events.some(e=>e.componentId===selected)&&<p>暂无组件登记变更记录。</p>}</>}
    </div></>}</div></div>
    {editor&&<Modal title="整理组件信息" closeLabel="取消整理" onClose={()=>setEditor(undefined)}><div className={`${s.page} ${s.dialogBody}`}><p className={s.muted}>运行标识、提供插件和动作契约由实际适配器维护。</p>{(['name','description','category'] as const).map(key=><label className={s.field} key={key}>{({name:'组件名称',description:'用途说明',category:'整理分类'})[key]}{key==='description'?<textarea value={editor.value[key]} maxLength={1000} onChange={e=>setEditor({...editor,value:{...editor.value,[key]:e.target.value}})}/>:<input value={editor.value[key]} maxLength={80} onChange={e=>setEditor({...editor,value:{...editor.value,[key]:e.target.value}})}/>}</label>)}{message&&<p role="alert">{message}</p>}<button className={`${s.button} ${s.primary}`} disabled={busy||!editor.value.name.trim()} onClick={save}>保存信息</button>{editor.revision!==registry?.revision&&<><p>最新登记名称：{metadata(editor.id).name??catalog.find(c=>c.id===editor.id)?.name}。输入内容仍保留，请核对后再保存。</p><button className={s.button} onClick={()=>setEditor({...editor,revision:registry!.revision,base:structuredClone(catalog.some(c=>c.id===editor.id)?metadata(editor.id):registry!.candidates.find(c=>c.id===editor.id)!)})}>保留输入并加载最新基准</button></>}</div></Modal>}
    {adding&&<Modal title="添加组件" closeLabel="取消添加" onClose={()=>setAdding(false)}><div className={`${s.page} ${s.dialogBody}`}><p>登记候选组件及其来源，后续接入动作和工作区适配器。已有插件的安装与分类继续在插件管理中完成。</p>{(['name','provider','description','category'] as const).map(key=><label className={s.field} key={key}>{({name:'组件名称',provider:'提供插件完整包名 / 导出模块',description:'用途说明',category:'整理分类'})[key]}<input value={candidate[key]} maxLength={key==='description'?1000:key==='provider'?250:80} onChange={e=>setCandidate({...candidate,[key]:e.target.value})}/></label>)}{message&&<p role="alert">{message}</p>}<button className={`${s.button} ${s.primary}`} disabled={busy||!candidate.name.trim()||!candidate.provider.trim()} onClick={()=>void run(async()=>{await capabilityClient.componentCommand({type:'candidate.add',revision:registry!.revision,...candidate,operationId:candidateOperationId});setAdding(false);setCandidate({name:'',provider:'',description:'',category:'未分类'});setFilter('candidate')})}>登记候选组件</button><button className={s.button} onClick={()=>openCapabilityLink({section:'plugins',moduleName:candidate.provider||undefined})}>前往插件管理 ↗</button></div></Modal>}
    {targeting&&<Modal title="选择目标能力" closeLabel="返回组件" onClose={()=>setTargeting(false)}><div className={`${s.page} ${s.dialogBody}`}><p>仅显示已适配的执行流程。添加操作进入能力草稿，发布前仍需检查依赖和权限。</p>{adapted.map(c=><div className={s.row} key={c.id}><strong>{c.draft.name}</strong><button className={s.button} onClick={()=>openCapabilityLink({section:'capability-center',capabilityId:c.id,componentId:selected,edit:true,addComponent:true,returnTo:'component-center'})}>打开组件组合 ↗</button></div>)}{!adapted.length&&<p>暂无已适配能力。</p>}</div></Modal>}
    {preview&&<Modal title={operationNames[preview.action]+'？'} closeLabel="取消操作" onClose={()=>setPreview(undefined)}><div className={`${s.page} ${s.dialogBody}`}><p>{preview.action==='disable'?'停用后立即阻止相关动作并取消对应活动任务；已经完成的结果及引用保留。重新启用不会恢复旧任务的授权。':preview.action==='retire'?'移入回收站后不能新增装配或发布；已有已发布能力与任务继续按原授权运行。':preview.action==='restore'?'恢复组件登记；已停用的组件仍需另行启用。':preview.action==='enable'?'允许新任务使用组件；原来被撤销的任务需要重新创建。':'永久删除候选登记，无法恢复。提供插件由插件管理单独维护。'}</p><h4>影响范围</h4><p>{preview.capabilities.length} 项能力（含历史版本） · {preview.roles.length} 个岗位 · {preview.activities.length} 个活动任务</p>{preview.capabilities.map(c=><p key={c.id}>{c.name} · {c.draft?'草稿 · ':''}{c.versions.map(v=>'v'+v).join('、')}{c.removed?' · 已移除':''}</p>)}{preview.activities.map(t=><p key={t.id}>{t.name} · {t.kind} · {t.status}</p>)}{message&&<p role="alert">{message}</p>}<button className={`${s.button} ${s.primary}`} disabled={busy} onClick={confirm}>确认{operationNames[preview.action]}</button>{message&&<button className={s.button} onClick={()=>inspect(preview.id,preview.action)}>重新检查影响范围</button>}</div></Modal>}
  </section>
}
