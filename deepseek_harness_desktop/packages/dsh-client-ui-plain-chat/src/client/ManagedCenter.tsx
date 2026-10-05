import { consumeNavigation, legacyOrigin, pendingNavigation, requestLeave, restoredFrame, returnNavigation, useNavigationFrame, type NavigationLocation } from '../../../dsh-plugin-manager/src/client/workbench-navigation.ts'
import { componentPublishIssues } from '../../../dsh-capabilities/src/core/component-registry.ts'
import { ComponentCenter } from './ComponentCenter.tsx'
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { actionNames, actionsOf, components, latest, type Action, type Snapshot } from '../../../dsh-capabilities/src/core/model.ts'
import { useMeetingAvailability, type MeetingAvailability } from './meeting-capability-status.ts'
import { type RequirementAvailability } from '../../../dsh-capabilities/src/core/requirements-model.ts'
import { useRequirementAvailability } from './RequirementsSettings.tsx'
import { issues } from '../../../dsh-capabilities/src/core/validation.ts'
import { capabilityClient, lastCapabilityLink, openCapabilityLink, useCapabilities, type CapabilityLink } from './capability-client.ts'
import { addAssociation, availableComponents, compositionSupported, moveAssociation } from '../../../dsh-capabilities/src/core/composition.ts'
import { clearCapabilityDraft, useCapabilityDefinition } from './useCapabilityDefinition.ts'
import { BusinessInspector, compositionItems, compositionLibrary, MissingAssociations, SupportInspector, useAssociationEditing } from './ComponentComposition.tsx'
import { componentService } from './ComponentService.tsx'
import { ManagedWorkbench } from './ManagedWorkbench.tsx'
import { Modal } from './PreviewModal.tsx'
import { ManagedRoleEditor } from './ManagedRoles.tsx'
import { CapabilityActionIcon, RemoveCapabilityDialog } from './ManagedCapabilityCards.tsx'
import { ManagedRecycleBin } from './ManagedRecycleBin.tsx'
import { CapabilityList, restoreListFilters } from './CapabilityList.tsx'
import { ManagedCapabilityDetail } from './ManagedCapabilityDetail.tsx'
import s from './ManagedCapabilities.module.css'

export function ActionFields({ value, available = ['navigate', 'read', 'screenshot'], onChange }: { value: Action[]; available?: readonly Action[]; onChange: (value: Action[]) => void }) {
  return <div>{available.map(action => <label key={action} className={s.check}><input type="checkbox" checked={value.includes(action)} onChange={e => onChange(e.target.checked ? [...value, action] : value.filter(a => a !== action))}/>{actionNames[action]}</label>)}</div>
}
export function CapabilityEditor({ id, data, onClose, onSaved, compositionFocus = false, meetingStatus, requirementsStatus, onConfigure, requestedComponentId, restore }: { restore?: NavigationLocation; requestedComponentId?: string; meetingStatus?: MeetingAvailability | null; requirementsStatus?: RequirementAvailability | null; onConfigure?: () => void; compositionFocus?: boolean; id?: string; data: Snapshot; onClose: () => void; onSaved: (id: string) => void }) {
  const cap = data.state.capabilities.find(c => c.id === id)
  const { draft, revision, change, rebase } = useCapabilityDefinition(id, data)
  const associationEdit = useAssociationEditing(draft, change, id)
  const [managingComponents,setManagingComponents] = useState(!!restoredFrame(restore,'components'))
  useNavigationFrame('capability-editor',30,()=>({section:'capability-center',label:'能力编辑',view:{id,managingComponents,selected}}))
  useEffect(() => { if (requestedComponentId && availableComponents(id).some(c => c.id === requestedComponentId) && !data.registry?.metadata[requestedComponentId]?.retiredAt && data.registry?.metadata[requestedComponentId]?.enabled !== false) change(addAssociation(draft, requestedComponentId)) }, [requestedComponentId])
  const [selected, setSelected] = useState<string | null>(restoredFrame(restore,'capability-editor')?.view?.selected ?? draft.components[0]?.componentId ?? null)
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [review, setReview] = useState(false), [applyRoles, setApplyRoles] = useState<string[]>([])
  const part = draft.components.find(p => p.componentId === selected), descriptor = data.components.find(c => c.id === selected)
  const publishProblems = [...issues(draft, id), ...(data.registry ? componentPublishIssues(data.state, data.registry, draft.components.map(p => p.componentId)) : [])]
  const linked = data.state.roles.filter(r => latest(r.versions)?.capabilities.some(b => b.capabilityId === id))
  const save = async (publish: boolean) => {
    setBusy(true); setMessage('')
    try { const result = await capabilityClient.command({ type: 'capability.save', id, definition: draft, publish, applyToRoles: publish ? applyRoles : [] }, revision); clearCapabilityDraft(id); onSaved(result); onClose() }
    catch (error) { setMessage(String(error instanceof Error ? error.message : error)) }
    finally { setBusy(false) }
  }
  if (!compositionSupported(data, id)) return <Modal title="组件组合服务待更新" closeLabel="关闭编辑器" onClose={onClose}><div className={`${s.page} ${s.dialogBody}`}><p>请保存当前工作并正常重启工作台后编辑，避免旧服务忽略新的关联配置。已有草稿会保留。</p><button className={s.button} onClick={() => void capabilityClient.refresh()}>重新检测</button></div></Modal>
  return <Modal title={id ? '编辑能力' : '创建能力'} closeLabel="关闭编辑器" onClose={onClose} wide><div className={s.page} style={{ display: 'contents' }}>
    <ManagedWorkbench libraryTitle="组件库" title={compositionFocus ? "组件组合" : "能力信息"} library={compositionLibrary(draft, id, data)} onManage={() => setManagingComponents(true)} manageLabel="管理组件库" selected={selected} onSelect={setSelected}
      attached={compositionItems(draft, id, data)} attachedTitle="当前组件组合" removeIcon={<CapabilityActionIcon kind="remove"/>}
      onAdd={componentId => { change(addAssociation(draft, componentId)); setSelected(componentId) }}
      onRemove={associationEdit.request} onReorder={(from, to) => change(moveAssociation(draft, from, to))}
      compositionNotice={<>{associationEdit.feedback}<MissingAssociations draft={draft} change={change} capabilityId={id}/></>}
      form={<details open={!compositionFocus} className={s.compositionInfo}><summary>能力名称与使用说明</summary><div className={s.fields}><label className={s.field}>能力名称<input value={draft.name} maxLength={80} placeholder="例如：网页资料采集" onChange={e => change({ ...draft, name: e.target.value })}/></label><label className={s.field}>简介<textarea rows={2} maxLength={1000} value={draft.description} onChange={e => change({ ...draft, description: e.target.value })}/></label><label className={s.field}>使用说明<textarea rows={6} maxLength={8000} value={draft.instructions} onChange={e => change({ ...draft, instructions: e.target.value })}/></label>{cap && <label className={s.field}>从历史版本恢复到当前草稿<select value="" onChange={e => { const value = cap.versions.find(v => v.version === Number(e.target.value)); if (value) change(structuredClone(value)) }}><option value="">选择版本…</option>{cap.versions.map(v => <option key={v.version} value={v.version}>v{v.version} · {v.createdAt.slice(0, 16).replace('T', ' ')}</option>)}</select></label>}</div></details>}
      inspector={selected?.startsWith('@') ? <SupportInspector id={selected} draft={draft} data={data} change={change}/> : descriptor ? <BusinessInspector component={descriptor} draft={draft} capabilityId={id} data={data} meetingStatus={meetingStatus} requirementsStatus={requirementsStatus} onConfigure={onConfigure}>{part ? <ActionFields value={part.actions} available={descriptor.actions} onChange={actions => change({ ...draft, components: draft.components.map(p => p.componentId === selected ? { ...p, actions } : p) })}/> : <p>请先将组件添加到中间区域。</p>}</BusinessInspector> : <p className={s.empty}>选择一个组件以调整动作。</p>}/>

    <div className={s.footer}><div>{message ? <p role="alert" className={s.error}>{message}</p> : <p>{publishProblems.join('；') || '已选择受支持的动作。发布前可检查影响范围。'}</p>}{revision !== data.state.revision && <button className={s.button} onClick={() => { rebase(); setMessage('已更新基准，请核对保留的草稿后保存。') }}>保留草稿并更新保存基准</button>}</div><div className={s.actions}><button className={s.button} disabled={busy} onClick={() => void save(false)}>保存草稿</button><button className={`${s.button} ${s.primary}`} disabled={busy || !draft.name.trim() || publishProblems.length > 0} onClick={() => setReview(true)}>检查并发布</button></div></div>
    {managingComponents && <Modal title="管理组件库" closeLabel="返回能力编辑" onClose={() => setManagingComponents(false)} wide><ComponentCenter embedded restore={restore} initialId={selected??undefined} onClose={() => setManagingComponents(false)}/></Modal>}
    {associationEdit.dialog}
    {review && <Modal title="发布新版本" closeLabel="返回编辑" onClose={() => setReview(false)}><div className={`${s.page} ${s.dialogBody}`}><p>当前发布：v{latest(cap?.versions ?? [])?.version ?? 0} → v{(latest(cap?.versions ?? [])?.version ?? 0) + 1}</p><p>原动作：{actionsOf(latest(cap?.versions ?? [])).map(a => actionNames[a]).join('、') || '无'}</p><p>新动作：{actionsOf(draft).map(a => actionNames[a]).join('、') || '无'}</p><p className={s.notice}>{[...new Set(availableComponents(id).map(component => componentService(component, { data, meetingStatus, requirementsStatus }).publishNotice))].join(' ')}</p><h4>让以下岗位的新会话采用此版本</h4>{linked.map(role => <label className={s.check} key={role.id}><input type="checkbox" checked={applyRoles.includes(role.id)} onChange={e => setApplyRoles(e.target.checked ? [...applyRoles, role.id] : applyRoles.filter(id => id !== role.id))}/>{role.draft.name}</label>)}{!linked.length && <p className={s.muted}>尚无引用此能力的已发布岗位。</p>}<button className={`${s.button} ${s.primary}`} disabled={busy} onClick={() => void save(true)}>{busy ? '发布中…' : '发布本地版本'}</button>{message && <p role="alert" className={s.error}>{message}</p>}</div></Modal>}
  </div></Modal>
}

export function ManagedCenter({ initialId, embedded = false, restore }: { initialId?: string; embedded?: boolean; restore?: NavigationLocation }) {
  const [entry] = useState(() => embedded ? undefined : pendingNavigation('capability-center'))
  const [restoration,setRestoration] = useState(restore ?? entry?.restore)
  const saved = restoredFrame(restoration,'capabilities')?.view ?? {}
  const [origin,setOrigin] = useState(restoredFrame(restoration,'capabilities')?.origin ?? legacyOrigin(entry))
  useEffect(() => { consumeNavigation(entry) },[entry])
  const { data, error } = useCapabilities()
  const { status: meetingStatus, refresh: refreshMeeting } = useMeetingAvailability(data?.state.revision)
  const { status: requirementsStatus, availability: requirementsAvailability, refresh: refreshRequirements, error: requirementsError, accept: acceptRequirementsConfig } = useRequirementAvailability(data?.state.revision)
  const [selected, setSelected] = useState<string | null>(saved.selected ?? initialId ?? entry?.capabilityId ?? null)
  const [tab,setTab] = useState<string>(saved.tab ?? entry?.tab ?? 'settings'), [query,setQuery] = useState<string>(saved.query ?? '')
  const [filter,setFilter] = useState<string>(saved.filter==='pinned'||saved.filter==='removed'?saved.filter:'all')
  const [filters,setFilters] = useState(()=>restoreListFilters(saved)), [recycleQuery,setRecycleQuery] = useState<string>(saved.recycleQuery ?? '')
  const [listFilter,setListFilter] = useState<string>(saved.listFilter ?? (saved.filter==='pinned'?'pinned':'all'))
  const [more,setMore] = useState(false)
  const [editor,setEditor] = useState<{id?:string;compositionFocus?:boolean;requestedComponentId?:string}|null>(saved.editor ?? (entry?.edit?{id:entry.capabilityId,compositionFocus:true,requestedComponentId:entry.addComponent?entry.componentId:undefined}:null))
  const [role,setRole] = useState<string|null>(saved.role ?? null), [message,setMessage] = useState(''), [busy,setBusy] = useState(false)
  const [removing,setRemoving] = useState<string|null>(null), [notice,setNotice] = useState('')
  const [,setMeetingEditing] = useState(false)
  const [compositionReturn,setCompositionReturn] = useState<'relations'|'editor'|null>(saved.compositionReturn ?? null)
  const navigate = (action:()=>void) => {if(requestLeave()){setMeetingEditing(false);action()}}
  const page = useRef<HTMLElement>(null), scrollMemory = useRef<Record<string,number>>(saved.scroll ?? {})
  const scrollKey=selected?selected+':'+tab:filter==='removed'?'recycle':'list'
  useLayoutEffect(()=>{
    let scroller=page.current?.parentElement
    while(scroller&&!/(auto|scroll)/.test(getComputedStyle(scroller).overflowY))scroller=scroller.parentElement
    if(!scroller)return
    const target=scroller;target.scrollTop=scrollMemory.current[scrollKey]??0
    const remember=()=>{scrollMemory.current[scrollKey]=target.scrollTop}
    target.addEventListener('scroll',remember);return()=>target.removeEventListener('scroll',remember)
  },[scrollKey,!!data])
  useNavigationFrame('capabilities',embedded?20:0,()=>({section:'capability-center',label:'能力中心',origin,view:{selected,tab,query,filter,filters,recycleQuery,listFilter,editor,role,compositionReturn,scroll:{...scrollMemory.current}}}))
  const configureComponents=(from:'relations'|'editor')=>navigate(()=>{setCompositionReturn(from);setEditor(null);setTab('defaults')})
  const returnToComposition=()=>navigate(()=>{setTab('components');if(compositionReturn==='editor'&&selected)setEditor({id:selected,compositionFocus:true});setCompositionReturn(null)})
  useEffect(()=>{if(embedded)return;const open=(event:Event)=>{
    const link=(event as CustomEvent<CapabilityLink>).detail;if(link.section!=='capability-center')return
    const frame=restoredFrame(link.restore,'capabilities'),next=frame?.view??{}
    setOrigin(frame?.origin??legacyOrigin(link));setRestoration(link.restore);setSelected(next.selected??link.capabilityId??null);setTab(next.tab??link.tab??'settings')
    setQuery(next.query??'');setFilter(next.filter==='pinned'||next.filter==='removed'?next.filter:'all');setFilters(restoreListFilters(next));setRecycleQuery(next.recycleQuery??'');setListFilter(next.listFilter??'all');scrollMemory.current=next.scroll??{}
    setRole(next.role??null);setCompositionReturn(next.compositionReturn??null);setMore(false)
    setEditor(next.editor??(link.edit?{id:link.capabilityId,compositionFocus:true,requestedComponentId:link.addComponent?link.componentId:undefined}:null));consumeNavigation(link)
  };window.addEventListener('workbench-capability-link',open);return()=>window.removeEventListener('workbench-capability-link',open)},[embedded])
  const run=async(fn:()=>Promise<unknown>)=>{setBusy(true);setMessage('');try{await fn()}catch(error){setMessage(error instanceof Error?error.message:String(error))}finally{setBusy(false)}}
  if(!data)return <div className={s.page}><p role={error?'alert':'status'}>{error||'正在读取能力数据…'}</p><button className={s.button} onClick={()=>void capabilityClient.refresh()}>重新加载</button></div>
  const item=data.state.capabilities.find(c=>c.id===selected), removedCount=data.state.capabilities.filter(c=>c.removedAt).length
  const open=(id:string)=>{setSelected(id);setTab('settings');setNotice('')}
  const restoreCapability=(id:string)=>void run(async()=>{await capabilityClient.command({type:'capability.restore',id});setNotice('能力已恢复，当前保持停用。请检查配置后按需启用。');setFilter(listFilter);setSelected(id);setTab('settings')})
  return <section ref={page} className={s.page} data-capability-center>
    {origin&&<button className={s.button} onClick={()=>returnNavigation(origin)}>← 返回{origin.label}</button>}
    {item?<button className={`${s.button} ${s.detailBack}`} onClick={()=>navigate(()=>setSelected(null))}>{filter==='removed'?'← 返回回收站':'← 全部能力'}</button>:<div className={s.heading}><h2>{filter==='removed'?'能力回收站':'能力中心'}</h2>{filter==='removed'?<button className={s.button} onClick={()=>setFilter(listFilter)}>← 返回能力列表</button>:<div className={s.actions}><button className={s.button} onClick={()=>setEditor({})}>＋ 创建能力</button><div className={s.moreMenu} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setMore(false)}} onKeyDown={e=>{if(e.key==="Escape"){e.preventDefault();e.stopPropagation();setMore(false)}}}><button className={s.button} aria-expanded={more} onClick={()=>setMore(!more)}>更多</button>{more&&<div className={s.morePanel}><button className={s.button} onClick={()=>{setListFilter(filter);setFilter('removed');setMore(false);setNotice('')}}>回收站{removedCount?` ${removedCount}`:''}</button></div>}</div></div>}</div>}
    {(error||message)&&<p role="alert" className={s.error}>{message||error}</p>}{notice&&<p role="status" className={s.notice}>{notice}</p>}
    {item?<ManagedCapabilityDetail key={`detail:${item.id}`} item={item} data={data} tab={tab} onTab={value=>navigate(()=>setTab(value))} busy={busy} meetingStatus={meetingStatus} requirementsStatus={requirementsStatus} requirementsError={requirementsError} refreshMeeting={refreshMeeting} refreshRequirements={refreshRequirements} acceptRequirements={acceptRequirementsConfig} onEditing={setMeetingEditing}
      onEdit={composition=>navigate(()=>setEditor({id:item.id,compositionFocus:composition}))} onRemove={()=>navigate(()=>setRemoving(item.id))} onRestore={()=>restoreCapability(item.id)} onCopy={()=>navigate(()=>void run(async()=>{const id=await capabilityClient.command({type:'capability.copy',id:item.id});setSelected(id);setEditor({id})}))}
      onToggle={enabled=>void run(()=>capabilityClient.command({type:'capability.toggle',id:item.id,enabled}))} onCheck={start=>void run(()=>capabilityClient.check(start))} onConfigure={()=>configureComponents('relations')} onRole={id=>navigate(()=>setRole(id))} compositionReturn={!!compositionReturn} onReturnComposition={returnToComposition}/>
      :filter==='removed'?<><input className={s.search} aria-label="搜索能力" placeholder="搜索回收站能力" value={recycleQuery} onChange={e=>setRecycleQuery(e.target.value)}/><ManagedRecycleBin data={data} query={recycleQuery} onInspect={open} onNotice={setNotice}/></>
      :<CapabilityList data={data} query={query} onQuery={setQuery} filter={filter} onFilter={setFilter} filters={filters} onFilters={setFilters} busy={busy} meetingStatus={meetingStatus} requirementsStatus={requirementsAvailability} onOpen={open} onPin={(id,pinned)=>void run(()=>capabilityClient.command({type:'capability.pin',id,pinned}))}/>}
    {removing&&<RemoveCapabilityDialog id={removing} data={data} onClose={()=>setRemoving(null)} onRemoved={()=>{setRemoving(null);setSelected(null);setNotice('能力已移除，可在“更多 → 回收站”中恢复。')}}/>}
    {editor&&<CapabilityEditor key={editor.id??'new'} id={editor.id} compositionFocus={editor.compositionFocus} requestedComponentId={editor.requestedComponentId} data={data} restore={restoration} meetingStatus={meetingStatus} requirementsStatus={requirementsStatus} onConfigure={()=>configureComponents('editor')} onClose={()=>{setEditor(null);setRestoration(undefined)}} onSaved={setSelected}/>}
    {role&&<ManagedRoleEditor restore={restoration} id={role} onClose={()=>setRole(null)}/>}
  </section>
}
