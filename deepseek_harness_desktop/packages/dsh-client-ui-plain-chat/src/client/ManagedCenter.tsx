import { PillCheckbox } from '../../../../shared/client/PillCheckbox.tsx'
import { CapabilityDistribution } from './CapabilityDistribution.tsx'
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
  return <div>{available.map(action => <label key={action} className={s.check}><PillCheckbox type="checkbox" checked={value.includes(action)} onChange={e => onChange(e.target.checked ? [...value, action] : value.filter(a => a !== action))}/>{actionNames[action]}</label>)}</div>
}
export function CapabilityEditor({ id, data, onClose, onSaved, compositionFocus = false, meetingStatus, requirementsStatus, onConfigure, requestedComponentId, restore }: { restore?: NavigationLocation; requestedComponentId?: string; meetingStatus?: MeetingAvailability | null; requirementsStatus?: RequirementAvailability | null; onConfigure?: () => void; compositionFocus?: boolean; id?: string; data: Snapshot; onClose: () => void; onSaved: (id: string) => void }) {
  const cap = data.state.capabilities.find(c => c.id === id)
  const { draft, revision, change, rebase, discard } = useCapabilityDefinition(id, data)
  const associationEdit = useAssociationEditing(draft, change, id,data)
  const [managingComponents,setManagingComponents] = useState(!!restoredFrame(restore,'components'))
  useNavigationFrame('capability-editor',30,()=>({section:'capability-center',label:'能力编辑',view:{id,managingComponents,selected}}))
  useEffect(() => { if (requestedComponentId && availableComponents(id,data.components).some(c => c.id === requestedComponentId) && !data.registry?.metadata[requestedComponentId]?.retiredAt && data.registry?.metadata[requestedComponentId]?.enabled !== false) change(addAssociation(draft, requestedComponentId,data.components)) }, [requestedComponentId])
  const [selected, setSelected] = useState<string | null>(restoredFrame(restore,'capability-editor')?.view?.selected ?? draft.components[0]?.componentId ?? null)
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('')
  const part = draft.components.find(p => p.componentId === selected), descriptor = data.components.find(c => c.id === selected)
  const publishProblems = [...issues(draft, id,data.components), ...(data.registry ? componentPublishIssues(data.state, data.registry, draft.components.map(p => p.componentId)) : [])]
  const linked = data.state.roles.filter(r => latest(r.versions)?.capabilities.some(b => b.capabilityId === id))
  const save = async () => {
    setBusy(true); setMessage('')
    try { const result = await capabilityClient.command({ type: 'capability.save', id, definition: draft, publish: true, directSave: true }, revision); clearCapabilityDraft(id); onSaved(result); onClose() }
    catch (error) { setMessage(String(error instanceof Error ? error.message : error)) }
    finally { setBusy(false) }
  }
  if (!compositionSupported(data, id)) return <Modal title="组件组合服务待更新" closeLabel="关闭编辑器" onClose={onClose}><div className={`${s.page} ${s.dialogBody}`}><p>请保存当前工作并正常重启工作台后编辑，避免旧服务忽略新的关联配置。已有草稿会保留。</p><button className={s.button} onClick={() => void capabilityClient.refresh()}>重新检测</button></div></Modal>
  return <Modal title={id ? '编辑能力' : '创建能力'} closeLabel="关闭编辑器" onClose={onClose} wide><div className={s.page} style={{ display: 'contents' }}>
    <ManagedWorkbench libraryTitle="组件库" title={compositionFocus ? "组件组合" : "能力信息"} library={compositionLibrary(draft, id, data)} onManage={() => setManagingComponents(true)} manageLabel="管理组件库" selected={selected} onSelect={setSelected}
      attached={compositionItems(draft, id, data)} attachedTitle="当前组件组合" removeIcon={<CapabilityActionIcon kind="remove"/>}
      onAdd={componentId => { change(addAssociation(draft, componentId,data.components)); setSelected(componentId) }}
      onRemove={associationEdit.request} onReorder={(from, to) => change(moveAssociation(draft, from, to))}
      compositionNotice={<>{associationEdit.feedback}<MissingAssociations draft={draft} change={change} capabilityId={id} data={data}/></>}
      form={<details open={!compositionFocus} className={s.compositionInfo}><summary>能力名称与使用说明</summary><div className={s.fields}><label className={s.field}>能力名称<input value={draft.name} maxLength={80} placeholder="例如：网页资料采集" onChange={e => change({ ...draft, name: e.target.value })}/></label><label className={s.field}>简介<textarea rows={2} maxLength={1000} value={draft.description} onChange={e => change({ ...draft, description: e.target.value })}/></label><label className={s.field}>使用说明<textarea rows={6} maxLength={8000} value={draft.instructions} onChange={e => change({ ...draft, instructions: e.target.value })}/></label></div></details>}
      inspector={selected?.startsWith('@') ? <SupportInspector id={selected} draft={draft} data={data} change={change}/> : descriptor ? <BusinessInspector component={descriptor} draft={draft} capabilityId={id} data={data} meetingStatus={meetingStatus} requirementsStatus={requirementsStatus} onConfigure={onConfigure}>{part ? <ActionFields value={part.actions} available={descriptor.actions} onChange={actions => change({ ...draft, components: draft.components.map(p => p.componentId === selected ? { ...p, actions } : p) })}/> : <p>请先将组件添加到中间区域。</p>}</BusinessInspector> : <p className={s.empty}>选择一个组件以调整动作。</p>}/>

    <div className={s.footer}><div>{message ? <p role="alert" className={s.error}>{message}</p> : <p>{publishProblems.join('；') || '保存后用于关联岗位的新对话。'}</p>}{revision !== data.state.revision && <button className={s.button} onClick={() => { rebase(); setMessage('已更新基准，请核对保留的草稿后保存。') }}>保留草稿并更新保存基准</button>}</div><div className={s.actions}><button className={s.button} disabled={busy} onClick={() => { discard(); onClose() }}>取消</button><button className={`${s.button} ${s.primary}`} disabled={busy || !draft.name.trim()} onClick={() => void save()}>{busy ? '保存中…' : '保存'}</button></div></div>
    {managingComponents && <Modal title="管理组件库" closeLabel="返回能力编辑" onClose={() => setManagingComponents(false)} wide><ComponentCenter embedded restore={restore} initialId={selected??undefined} onClose={() => setManagingComponents(false)}/></Modal>}
    {associationEdit.dialog}
  </div></Modal>
}

export function ManagedCenter({ initialId, embedded = false, restore, managementEntries = false }: { initialId?: string; embedded?: boolean; restore?: NavigationLocation; managementEntries?: boolean }) {
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
  const [distribution,setDistribution] = useState<'import'|'export'|null>(null)
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
    setRole(next.role??null);setCompositionReturn(next.compositionReturn??null);    setEditor(next.editor??(link.edit?{id:link.capabilityId,compositionFocus:true,requestedComponentId:link.addComponent?link.componentId:undefined}:null));consumeNavigation(link)
  };window.addEventListener('workbench-capability-link',open);return()=>window.removeEventListener('workbench-capability-link',open)},[embedded])
  const run=async(fn:()=>Promise<unknown>)=>{setBusy(true);setMessage('');try{await fn()}catch(error){setMessage(error instanceof Error?error.message:String(error))}finally{setBusy(false)}}
  if(!data)return <div className={s.page}><p role={error?'alert':'status'}>{error||'正在读取能力数据…'}</p><button className={s.button} onClick={()=>void capabilityClient.refresh()}>重新加载</button></div>
  const item=data.state.capabilities.find(c=>c.id===selected), removedCount=data.state.capabilities.filter(c=>c.removedAt).length
  const open=(id:string)=>{setSelected(id);setTab('settings');setNotice('')}
  const restoreCapability=(id:string)=>void run(async()=>{await capabilityClient.command({type:'capability.restore',id});setNotice('能力已恢复，当前保持停用。请检查配置后按需启用。');setFilter(listFilter);setSelected(id);setTab('settings')})
  return <section ref={page} className={s.page} data-capability-center>
    {origin&&<button className={s.button} onClick={()=>returnNavigation(origin)}>← 返回{origin.label}</button>}
    {item?<button className={`${s.button} ${s.detailBack}`} onClick={()=>navigate(()=>setSelected(null))}>{filter==='removed'?'← 返回回收站':'← 全部能力'}</button>:<div className={s.heading}><h2>{filter==='removed'?'能力回收站':'能力中心'}</h2>{filter==='removed'?<button className={s.button} onClick={()=>setFilter(listFilter)}>← 返回能力列表</button>:<div className={s.actions}><button className={`${s.button} ${s.primary}`} onClick={()=>setDistribution('import')}>导入能力</button><button className={s.button} onClick={()=>setDistribution('export')}>导出能力</button></div>}</div>}
    {(error||message)&&<p role="alert" className={s.error}>{message||error}</p>}{notice&&<p role="status" className={s.notice}>{notice}</p>}
    {item?<ManagedCapabilityDetail key={`detail:${item.id}`} item={item} data={data} tab={tab} onTab={value=>navigate(()=>setTab(value))} busy={busy} meetingStatus={meetingStatus} requirementsStatus={requirementsStatus} requirementsError={requirementsError} refreshMeeting={refreshMeeting} refreshRequirements={refreshRequirements} acceptRequirements={acceptRequirementsConfig} onEditing={setMeetingEditing}
      onEdit={composition=>navigate(()=>setEditor({id:item.id,compositionFocus:composition}))} onRemove={()=>navigate(()=>setRemoving(item.id))} onRestore={()=>restoreCapability(item.id)} onCopy={()=>navigate(()=>void run(async()=>{const id=await capabilityClient.command({type:'capability.copy',id:item.id});setSelected(id);setEditor({id})}))}
      onToggle={enabled=>void run(()=>capabilityClient.command({type:'capability.toggle',id:item.id,enabled}))} onCheck={start=>void run(()=>capabilityClient.check(start))} onConfigure={()=>configureComponents('relations')} onRole={id=>navigate(()=>setRole(id))} compositionReturn={!!compositionReturn} onReturnComposition={returnToComposition}/>
      :filter==='removed'?<><input className={s.search} aria-label="搜索能力" placeholder="搜索回收站能力" value={recycleQuery} onChange={e=>setRecycleQuery(e.target.value)}/><ManagedRecycleBin data={data} query={recycleQuery} onInspect={open} onNotice={setNotice}/></>
      :<CapabilityList data={data} query={query} onQuery={setQuery} filter={filter} onFilter={setFilter} filters={filters} onFilters={setFilters} busy={busy} meetingStatus={meetingStatus} requirementsStatus={requirementsAvailability} onOpen={open} onPin={(id,pinned)=>void run(()=>capabilityClient.command({type:'capability.pin',id,pinned}))}/>}
    {!item&&filter!=='removed'&&<nav className={s.actions} aria-label="能力管理">{managementEntries&&<><button className={s.button} onClick={()=>openCapabilityLink({section:'component-center'})}>组件库</button><button className={s.button} onClick={()=>openCapabilityLink({section:'plugins'})}>插件管理</button></>}<button className={s.button} onClick={()=>{setListFilter(filter);setFilter('removed');setNotice('')}}>回收站{removedCount?` ${removedCount}`:''}</button></nav>}
    {distribution&&<CapabilityDistribution mode={distribution} data={data} onClose={()=>setDistribution(null)} onImported={(id,message)=>{setDistribution(null);setFilter('all');setSelected(id);setTab('settings');setNotice(message)}}/>}
    {removing&&<RemoveCapabilityDialog id={removing} data={data} onClose={()=>setRemoving(null)} onRemoved={()=>{setRemoving(null);setSelected(null);setNotice('能力已移除，可在“回收站”中恢复。')}}/>}
    {editor&&<CapabilityEditor key={editor.id??'new'} id={editor.id} compositionFocus={editor.compositionFocus} requestedComponentId={editor.requestedComponentId} data={data} restore={restoration} meetingStatus={meetingStatus} requirementsStatus={requirementsStatus} onConfigure={()=>configureComponents('editor')} onClose={()=>{setEditor(null);setRestoration(undefined)}} onSaved={setSelected}/>}
    {role&&<ManagedRoleEditor restore={restoration} id={role} onClose={()=>setRole(null)}/>}
  </section>
}
