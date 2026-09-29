import React, { useEffect, useState } from 'react'
import { actionNames, actionsOf, components, latest, type Action, type Snapshot } from '../../../dsh-capabilities/src/core/model.ts'
import { MEETING_ROLE_ID } from '../../../dsh-capabilities/src/core/default-roles.ts'
import { MEETING_CAPABILITY_ID } from '../../../dsh-capabilities/src/core/default-roles.ts'
import { useMeetingAvailability, type MeetingAvailability } from './meeting-capability-status.ts'
import { REQUIREMENTS_CAPABILITY_ID, type RequirementAvailability } from '../../../dsh-capabilities/src/core/requirements-model.ts'
import { RequirementsSettings, useRequirementAvailability } from './RequirementsSettings.tsx'
import { MeetingAsrSettings } from './MeetingAsrSettings.tsx'
import { issues } from '../../../dsh-capabilities/src/core/validation.ts'
import { capabilityClient, lastCapabilityLink, openCapabilityLink, useCapabilities, type CapabilityLink } from './capability-client.ts'
import { addAssociation, availableComponents, compositionSupported, moveAssociation } from '../../../dsh-capabilities/src/core/composition.ts'
import { clearCapabilityDraft, useCapabilityDefinition } from './useCapabilityDefinition.ts'
import { ComponentRelations, BusinessInspector, compositionItems, compositionLibrary, MissingAssociations, SupportInspector, useAssociationEditing } from './ComponentComposition.tsx'
import { componentService } from './ComponentService.tsx'
import { ManagedWorkbench, CapabilityGlyph } from './ManagedWorkbench.tsx'
import { Modal } from './PreviewModal.tsx'
import { ManagedRoleEditor } from './ManagedRoles.tsx'
import { CapabilityActionIcon, ManagedCapabilityCard, RemoveCapabilityDialog, capabilityImpact } from './ManagedCapabilityCards.tsx'
import { ManagedRecycleBin } from './ManagedRecycleBin.tsx'
import s from './ManagedCapabilities.module.css'

export function ActionFields({ value, available = ['navigate', 'read', 'screenshot'], onChange }: { value: Action[]; available?: readonly Action[]; onChange: (value: Action[]) => void }) {
  return <div>{available.map(action => <label key={action} className={s.check}><input type="checkbox" checked={value.includes(action)} onChange={e => onChange(e.target.checked ? [...value, action] : value.filter(a => a !== action))}/>{actionNames[action]}</label>)}</div>
}
export function CapabilityEditor({ id, data, onClose, onSaved, compositionFocus = false, meetingStatus, requirementsStatus, onConfigure }: { meetingStatus?: MeetingAvailability | null; requirementsStatus?: RequirementAvailability | null; onConfigure?: () => void; compositionFocus?: boolean; id?: string; data: Snapshot; onClose: () => void; onSaved: (id: string) => void }) {
  const cap = data.state.capabilities.find(c => c.id === id)
  const { draft, revision, change, rebase } = useCapabilityDefinition(id, data)
  const associationEdit = useAssociationEditing(draft, change, id)
  const [selected, setSelected] = useState<string | null>(draft.components[0]?.componentId ?? null)
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [review, setReview] = useState(false), [applyRoles, setApplyRoles] = useState<string[]>([])
  const part = draft.components.find(p => p.componentId === selected), descriptor = components.find(c => c.id === selected)
  const linked = data.state.roles.filter(r => latest(r.versions)?.capabilities.some(b => b.capabilityId === id))
  const save = async (publish: boolean) => {
    setBusy(true); setMessage('')
    try { const result = await capabilityClient.command({ type: 'capability.save', id, definition: draft, publish, applyToRoles: publish ? applyRoles : [] }, revision); clearCapabilityDraft(id); onSaved(result); onClose() }
    catch (error) { setMessage(String(error instanceof Error ? error.message : error)) }
    finally { setBusy(false) }
  }
  if (!compositionSupported(data, id)) return <Modal title="组件组合服务待更新" closeLabel="关闭编辑器" onClose={onClose}><div className={`${s.page} ${s.dialogBody}`}><p>请保存当前工作并正常重启工作台后编辑，避免旧服务忽略新的关联配置。已有草稿会保留。</p><button className={s.button} onClick={() => void capabilityClient.refresh()}>重新检测</button></div></Modal>
  return <Modal title={id ? '编辑能力' : '创建能力'} closeLabel="关闭编辑器" onClose={onClose} wide><div className={s.page} style={{ display: 'contents' }}>
    <ManagedWorkbench libraryTitle="组件库" title={compositionFocus ? "组件组合" : "能力信息"} library={compositionLibrary(draft, id)} selected={selected} onSelect={setSelected}
      attached={compositionItems(draft, id)} attachedTitle="当前组件组合" removeIcon={<CapabilityActionIcon kind="remove"/>}
      onAdd={componentId => { change(addAssociation(draft, componentId)); setSelected(componentId) }}
      onRemove={associationEdit.request} onReorder={(from, to) => change(moveAssociation(draft, from, to))}
      compositionNotice={<>{associationEdit.feedback}<MissingAssociations draft={draft} change={change} capabilityId={id}/></>}
      form={<details open={!compositionFocus} className={s.compositionInfo}><summary>能力名称与使用说明</summary><div className={s.fields}><label className={s.field}>能力名称<input value={draft.name} maxLength={80} placeholder="例如：网页资料采集" onChange={e => change({ ...draft, name: e.target.value })}/></label><label className={s.field}>简介<textarea rows={2} maxLength={1000} value={draft.description} onChange={e => change({ ...draft, description: e.target.value })}/></label><label className={s.field}>使用说明<textarea rows={6} maxLength={8000} value={draft.instructions} onChange={e => change({ ...draft, instructions: e.target.value })}/></label>{cap && <label className={s.field}>从历史版本恢复到当前草稿<select value="" onChange={e => { const value = cap.versions.find(v => v.version === Number(e.target.value)); if (value) change(structuredClone(value)) }}><option value="">选择版本…</option>{cap.versions.map(v => <option key={v.version} value={v.version}>v{v.version} · {v.createdAt.slice(0, 16).replace('T', ' ')}</option>)}</select></label>}</div></details>}
      inspector={selected?.startsWith('@') ? <SupportInspector id={selected} draft={draft} data={data} change={change}/> : descriptor ? <BusinessInspector component={descriptor} draft={draft} capabilityId={id} data={data} meetingStatus={meetingStatus} requirementsStatus={requirementsStatus} onConfigure={onConfigure}>{part ? <ActionFields value={part.actions} available={descriptor.actions} onChange={actions => change({ ...draft, components: draft.components.map(p => p.componentId === selected ? { ...p, actions } : p) })}/> : <p>请先将组件添加到中间区域。</p>}</BusinessInspector> : <p className={s.empty}>选择一个组件以调整动作。</p>}/>

    <div className={s.footer}><div>{message ? <p role="alert" className={s.error}>{message}</p> : <p>{issues(draft, id).join('；') || '已选择受支持的动作。发布前可检查影响范围。'}</p>}{revision !== data.state.revision && <button className={s.button} onClick={() => { rebase(); setMessage('已更新基准，请核对保留的草稿后保存。') }}>保留草稿并更新保存基准</button>}</div><div className={s.actions}><button className={s.button} disabled={busy} onClick={() => void save(false)}>保存草稿</button><button className={`${s.button} ${s.primary}`} disabled={busy || !draft.name.trim() || issues(draft, id).length > 0} onClick={() => setReview(true)}>检查并发布</button></div></div>
    {associationEdit.dialog}
    {review && <Modal title="发布新版本" closeLabel="返回编辑" onClose={() => setReview(false)}><div className={`${s.page} ${s.dialogBody}`}><p>当前发布：v{latest(cap?.versions ?? [])?.version ?? 0} → v{(latest(cap?.versions ?? [])?.version ?? 0) + 1}</p><p>原动作：{actionsOf(latest(cap?.versions ?? [])).map(a => actionNames[a]).join('、') || '无'}</p><p>新动作：{actionsOf(draft).map(a => actionNames[a]).join('、') || '无'}</p><p className={s.notice}>{[...new Set(availableComponents(id).map(component => componentService(component, { data, meetingStatus, requirementsStatus }).publishNotice))].join(' ')}</p><h4>让以下岗位的新会话采用此版本</h4>{linked.map(role => <label className={s.check} key={role.id}><input type="checkbox" checked={applyRoles.includes(role.id)} onChange={e => setApplyRoles(e.target.checked ? [...applyRoles, role.id] : applyRoles.filter(id => id !== role.id))}/>{role.draft.name}</label>)}{!linked.length && <p className={s.muted}>尚无引用此能力的已发布岗位。</p>}<button className={`${s.button} ${s.primary}`} disabled={busy} onClick={() => void save(true)}>{busy ? '发布中…' : '发布本地版本'}</button>{message && <p role="alert" className={s.error}>{message}</p>}</div></Modal>}
  </div></Modal>
}

export function ManagedCenter({ initialId, embedded = false }: { initialId?: string; embedded?: boolean }) {
  const { data, error } = useCapabilities()
  const { status: meetingStatus, refresh: refreshMeeting } = useMeetingAvailability(data?.state.revision)
  const { status: requirementsStatus, refresh: refreshRequirements, error: requirementsError, accept: acceptRequirementsConfig } = useRequirementAvailability(data?.state.revision)
  const [selected, setSelected] = useState<string | null>(initialId ?? lastCapabilityLink()?.capabilityId ?? null), [tab, setTab] = useState('overview'), [query, setQuery] = useState(''), [filter, setFilter] = useState('all')
  const [editor, setEditor] = useState<{ id?: string; compositionFocus?: boolean } | null>(null), [role, setRole] = useState<string | null>(null), [message, setMessage] = useState(''), [busy, setBusy] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null), [notice, setNotice] = useState('')
  const [meetingEditing, setMeetingEditing] = useState(false)
  const [compositionReturn, setCompositionReturn] = useState<'relations' | 'editor' | null>(null)
  const meetingNavigate = (action: () => void) => { if (!meetingEditing || window.confirm('服务配置尚未保存，确定放弃修改？')) { setMeetingEditing(false); action() } }
  const configureComponents = (from: 'relations' | 'editor') => meetingNavigate(() => { setCompositionReturn(from); setEditor(null); setTab('defaults') })
  const returnToComposition = () => meetingNavigate(() => { setTab('components'); if (compositionReturn === 'editor' && selected) setEditor({ id: selected, compositionFocus: true }); setCompositionReturn(null) })
  useEffect(() => { const open = (event: Event) => { const link = (event as CustomEvent<CapabilityLink>).detail; if (link.section === 'capability-center') setSelected(link.capabilityId ?? null) }; window.addEventListener('workbench-capability-link', open); return () => window.removeEventListener('workbench-capability-link', open) }, [])
  const run = async (fn: () => Promise<unknown>) => { setBusy(true); setMessage(''); try { await fn() } catch (error) { setMessage(error instanceof Error ? error.message : String(error)) } finally { setBusy(false) } }
  if (!data) return <div className={s.page}><p role={error ? 'alert' : 'status'}>{error || '正在读取能力数据…'}</p><button className={s.button} onClick={() => void capabilityClient.refresh()}>重新加载</button></div>
  const item = data.state.capabilities.find(c => c.id === selected)
  const meetingAssistantName = data.state.roles.find(role => role.id === MEETING_ROLE_ID)?.draft.name ?? '会议纪要助手'
  const linked = (id: string) => capabilityImpact(data, id).roles
  const removedCount = data.state.capabilities.filter(c => c.removedAt).length
  const visible = data.state.capabilities.filter(c => (filter === 'removed' ? Boolean(c.removedAt) : !c.removedAt) && (filter !== 'pinned' || c.pinned) && (filter !== 'pending' || !c.enabled || !c.versions.length || (c.id === REQUIREMENTS_CAPABILITY_ID ? !requirementsStatus?.ready : c.id === MEETING_CAPABILITY_ID ? !meetingStatus?.ready : data.health.state !== 'ready')) && (filter !== 'unused' || !linked(c.id).length) && `${c.draft.name} ${c.draft.description}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).sort((a, b) => Number(b.pinned) - Number(a.pinned))
  const restore = (id: string) => void run(async () => { await capabilityClient.command({ type: 'capability.restore', id }); setNotice('能力已恢复，当前保持停用。可在“管理能力”中检查配置并启用。'); setFilter('all'); setSelected(id); setTab('overview') })
  if (item?.id === MEETING_CAPABILITY_ID || item?.id === REQUIREMENTS_CAPABILITY_ID) return <section className={s.page} data-capability-center data-meeting-capability-detail={item.id === MEETING_CAPABILITY_ID || undefined} data-workflow-capability-detail={item.id}>
    <button className={s.button} onClick={() => meetingNavigate(() => setSelected(null))}>{item.removedAt ? '← 返回回收站' : '← 全部能力'}</button>
    <div className={s.heading} style={{ marginTop: 18 }}><div className={s.actions}><CapabilityGlyph kind={item.id === REQUIREMENTS_CAPABILITY_ID ? "document" : "audio"}/><div><h3>{item.draft.name}</h3><span className={s.muted}>内置能力 · v{latest(item.versions)?.version ?? 1}</span></div></div><div className={s.actions}>{item.removedAt ? <button className={s.button} disabled={busy} onClick={() => restore(item.id)}>恢复能力</button> : <><button className={s.button} onClick={() => meetingNavigate(() => setEditor({ id: item.id }))}>编辑能力</button><button className={`${s.iconButton} ${s.removeAction}`} disabled={busy} aria-label={`移除能力：${item.draft.name}`} onClick={() => setRemoving(item.id)}><CapabilityActionIcon kind="remove"/></button></>}</div></div>
    {(error || message) && <p role="alert" className={s.error}>{message || error}</p>}
    {notice && <p role="status" className={s.notice}>{notice}</p>}
    <p>{item.draft.description}</p>
    <div className={s.tabs}>{[['overview', '概览与连接'], ['instructions', '使用说明'], ['defaults', '默认配置'], ['components', '关联组件'], ['roles', '使用岗位']].map(([value, label]) => <button key={value} aria-pressed={tab === value} onClick={() => meetingNavigate(() => setTab(value))}>{label}</button>)}</div>
    {tab === 'overview' && <><div className={s.row}><div><strong>{item.removedAt ? '此能力已移除' : !item.enabled ? '此能力已停用' : item.id === REQUIREMENTS_CAPABILITY_ID ? requirementsStatus?.ready ? '需求分析服务可用' : '需求分析待配置' : meetingStatus?.ready ? '语音识别接口已配置' : '语音识别接口待配置'}</strong><small>{item.id === REQUIREMENTS_CAPABILITY_ID ? requirementsError || requirementsStatus?.message || '正在检查配置…' : meetingStatus?.message ?? '正在检查配置…'}</small></div><button className={s.button} disabled={busy} onClick={() => void (item.id === REQUIREMENTS_CAPABILITY_ID ? refreshRequirements() : refreshMeeting())}>刷新状态</button></div><label className={s.check}><input type="checkbox" checked={item.enabled} disabled={busy || !!item.removedAt} onChange={event => void run(() => capabilityClient.command({ type: 'capability.toggle', id: item.id, enabled: event.target.checked }))}/>启用此能力</label><p className={s.muted}>{item.id === REQUIREMENTS_CAPABILITY_ID ? '可由配置了需求分析能力的岗位使用。停用后阻止分析调用，已有资料、需求和确认版本保留。配置状态与实际调用结果分别记录。' : `由${meetingAssistantName}使用。停用后不能新建或继续处理录音；已有纪要和转写记录保留。`}</p></>}
    {tab === 'instructions' && <><p style={{ whiteSpace: 'pre-wrap' }}>{item.draft.instructions}</p><button className={s.button} disabled={!!item.removedAt} onClick={() => setEditor({ id: item.id })}>编辑说明</button></>}
    {tab === 'defaults' && <>{compositionReturn && <button className={s.button} onClick={returnToComposition}>← 返回组件组合</button>}<>{item.id === REQUIREMENTS_CAPABILITY_ID ? <RequirementsSettings status={requirementsStatus} onSaved={acceptRequirementsConfig} disabled={!!item.removedAt} onEditingChange={setMeetingEditing}/> : <MeetingAsrSettings status={meetingStatus} refresh={refreshMeeting} disabled={!!item.removedAt} onEditingChange={setMeetingEditing}/>}</></>}
    {tab === 'components' && <ComponentRelations key={`relations:${item.id}`} data={data} capabilityId={item.id} meetingStatus={meetingStatus} requirementsStatus={requirementsStatus} onConfigure={() => configureComponents('relations')} onEdit={() => setEditor({ id: item.id, compositionFocus: true })}/>}
    {tab === 'roles' && <>{linked(item.id).map(used => <div className={s.row} key={used.id}><div><strong>{used.draft.name}</strong><small>{used.enabled ? '已启用' : '已停用'} · 已发布 v{latest(used.versions)?.version ?? 1}</small></div><button className={s.button} onClick={() => setRole(used.id)}>编辑岗位 →</button></div>)}</>}
    {removing && <RemoveCapabilityDialog id={removing} data={data} onClose={() => setRemoving(null)} onRemoved={() => { setRemoving(null); setSelected(null); setNotice('能力已移除，可在“回收站”中恢复。') }}/>}
    {editor && <CapabilityEditor key={editor.id ?? 'new'} id={editor.id} compositionFocus={editor.compositionFocus} data={data} meetingStatus={meetingStatus} requirementsStatus={requirementsStatus} onConfigure={() => configureComponents('editor')} onClose={() => setEditor(null)} onSaved={setSelected}/>}
    {role && <ManagedRoleEditor id={role} onClose={() => setRole(null)}/>}
  </section>
  return <section className={s.page} data-capability-center>
    {!embedded && <div className={s.heading}><div><h2>能力中心</h2><span className={s.muted}>编辑能力、组合组件，再装配到岗位助手。</span></div><button className={`${s.button} ${s.primary}`} onClick={() => setEditor({})}>＋ 创建能力</button></div>}
    {(error || message) && <p role="alert" className={s.error}>{message || error}</p>}
    {notice && <p role="status" className={s.notice}>{notice}</p>}
    {item ? <><button className={s.button} onClick={() => setSelected(null)}>{filter === 'removed' ? '← 返回回收站' : '← 全部能力'}</button><div className={s.heading} style={{ marginTop: 18 }}><div className={s.actions}><CapabilityGlyph/><div><h3>{item.draft.name}</h3><span className={s.muted}>{item.source === 'builtin' ? '内置能力' : '我的能力'} · {item.versions.length ? `v${latest(item.versions)!.version}` : '未发布草稿'}</span></div></div><div className={s.actions}>{item.removedAt ? <button className={`${s.button} ${s.inlineAction}`} disabled={busy} onClick={() => restore(item.id)}><CapabilityActionIcon kind="restore"/>恢复能力</button> : <><button className={s.button} onClick={() => setEditor({ id: item.id })}>编辑能力</button><button className={s.button} disabled={busy} onClick={() => void run(async () => { const id = await capabilityClient.command({ type: 'capability.copy', id: item.id }); setSelected(id); setEditor({ id }) })}>复制为我的能力</button><button className={`${s.iconButton} ${s.removeAction}`} disabled={busy} aria-label={`移除能力：${item.draft.name}`} title={`移除能力：${item.draft.name}`} onClick={() => setRemoving(item.id)}><CapabilityActionIcon kind="remove"/></button></>}</div></div><p>{item.draft.description}</p>{item.removedAt && <p className={s.notice}>此能力已移除，配置与岗位引用已保留。恢复后可继续编辑，并按需手动启用。</p>}
      <div className={s.tabs}>{[['overview', '概览与连接'], ['instructions', '使用说明'], ['defaults', '默认配置'], ['components', '关联组件'], ['roles', '使用岗位']].map(([value, label]) => <button key={value} aria-pressed={tab === value} onClick={() => setTab(value!)}>{label}</button>)}</div>
      {tab === 'overview' && <><div className={s.row}><div><strong>{item.removedAt ? '此能力已移除' : item.enabled ? data.health.message : '此能力已停用'}</strong><small>检测时间：{data.health.checkedAt ? new Date(data.health.checkedAt).toLocaleString() : '尚未检测'}</small></div><div className={s.actions}><button className={s.button} disabled={busy || !!item.removedAt} onClick={() => void run(() => capabilityClient.check())}>检测连接</button><button className={s.button} disabled={busy || !!item.removedAt} onClick={() => void run(() => capabilityClient.check(true))}>启动本地连接</button></div></div><label className={s.check}><input type="checkbox" checked={item.enabled} disabled={busy || !!item.removedAt} onChange={e => void run(() => capabilityClient.command({ type: 'capability.toggle', id: item.id, enabled: e.target.checked }))}/>启用此能力</label><p className={s.muted}>影响范围：{linked(item.id).length} 个岗位、{capabilityImpact(data, item.id).tasks.length} 个活动会话。停用将立即阻止后续调用，并停止相关浏览器任务；保留配置与岗位引用。</p><div className={s.row}><span>{linked(item.id).length} 个岗位引用</span><button className={s.button} onClick={() => setTab('roles')}>查看岗位 →</button></div></>}
      {tab === 'instructions' && <><p style={{ whiteSpace: 'pre-wrap' }}>{item.draft.instructions || '尚未填写使用说明。'}</p><button className={s.button} disabled={!!item.removedAt} onClick={() => setEditor({ id: item.id })}>编辑说明</button></>}
      {tab === 'defaults' && <><p>已发布动作：{actionsOf(latest(item.versions)).map(a => actionNames[a]).join('、') || '无'}</p><p className={s.notice}>岗位可覆盖为更少的动作。点击、填写、提交和站点白名单尚未开放。</p><button className={s.button} disabled={!!item.removedAt} onClick={() => setEditor({ id: item.id })}>编辑组件与动作</button></>}
      {tab === 'components' && <ComponentRelations key={`relations:${item.id}`} data={data} capabilityId={item.id} meetingStatus={meetingStatus} requirementsStatus={requirementsStatus} onConfigure={() => configureComponents('relations')} onEdit={() => setEditor({ id: item.id, compositionFocus: true })}/>}
      {tab === 'roles' && <>{linked(item.id).map(r => <div className={s.row} key={r.id}><div><strong>{r.draft.name}</strong><small>{r.versions.length ? `已发布 v${latest(r.versions)!.version}` : '草稿'} · {r.enabled ? '启用' : '停用'}</small></div><button className={s.button} onClick={() => setRole(r.id)}>编辑岗位 →</button></div>)}{!linked(item.id).length && <p className={s.empty}>尚无岗位使用此能力。</p>}</>}
    </> : <><input className={s.search} aria-label="搜索能力" placeholder="搜索能力名称或用途" value={query} onChange={e => setQuery(e.target.value)}/>
      <div className={s.tabs}>{[['all','全部'],['pinned','收藏'],['pending','待就绪'],['unused','未使用'],['removed',`回收站${removedCount ? ` ${removedCount}` : ''}`]].map(([value,label]) => <button key={value} aria-pressed={filter === value} onClick={() => { setFilter(value!); setNotice('') }}>{label}</button>)}</div>
      {filter === 'removed' ? <ManagedRecycleBin data={data} query={query} onInspect={id => { setSelected(id); setTab('overview'); setNotice('') }} onNotice={setNotice}/> : <>
      <div className={s.grid}>{visible.map(c => <ManagedCapabilityCard key={c.id} capability={c} data={data} busy={busy} meetingStatus={c.id === MEETING_CAPABILITY_ID ? meetingStatus : undefined} requirementsStatus={c.id === REQUIREMENTS_CAPABILITY_ID ? requirementsStatus : undefined}
        onManage={() => { setSelected(c.id); setTab('overview'); setNotice('') }}
        onPin={() => void run(() => capabilityClient.command({ type: 'capability.pin', id: c.id, pinned: !c.pinned }))}
        onRemove={() => { setRemoving(c.id); setNotice('') }} onRestore={() => restore(c.id)}/>)}</div>
      {!visible.length && <p className={s.empty}>{query.trim() ? '没有找到匹配的能力，试试其他名称或用途。' : filter === 'removed' ? '暂无已移除的能力。' : filter === 'pinned' ? '暂无收藏能力，点击卡片右上角的图钉即可收藏。' : '没有符合条件的能力。'}</p>}
      <p className={s.muted}>会议录音转写由{meetingAssistantName}调用；录音会发送至你配置的识别服务，纪要由工作台已配置的模型生成。其他可组合能力仍按现有配置管理。</p></>}</>}
    {removing && <RemoveCapabilityDialog id={removing} data={data} onClose={() => setRemoving(null)} onRemoved={() => { setRemoving(null); setSelected(null); setNotice('能力已移除，可在“回收站”中恢复。'); }}/>}
    {editor && <CapabilityEditor key={editor.id ?? 'new'} id={editor.id} compositionFocus={editor.compositionFocus} data={data} meetingStatus={meetingStatus} requirementsStatus={requirementsStatus} onConfigure={() => configureComponents('editor')} onClose={() => setEditor(null)} onSaved={setSelected}/>}
    {role && <ManagedRoleEditor id={role} onClose={() => setRole(null)}/>}
  </section>
}
