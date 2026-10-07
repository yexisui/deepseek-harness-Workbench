import {useRoleSkillCatalog,RoleSkillInspector} from './RoleSkills.tsx'
import { consumeNavigation, pendingNavigation, requestLeave, restoredFrame, useNavigationFrame, type NavigationLocation } from '../../../dsh-plugin-manager/src/client/workbench-navigation.ts'
import { componentPublishIssues } from '../../../dsh-capabilities/src/core/component-registry.ts'
import React, { useEffect, useState } from 'react'
import { actionsOf, actionNames, emptyRole, latest, rolePresentation, roleHasUnpublishedChanges, resolveBinding, type RoleDefinition } from '../../../dsh-capabilities/src/core/model.ts'
import { MEETING_CAPABILITY_ID, MEETING_ROLE_ID } from '../../../dsh-capabilities/src/core/default-roles.ts'
import { capabilityClient, editorDrafts, useCapabilities } from './capability-client.ts'
import { ActionFields, ManagedCenter } from './ManagedCenter.tsx'
import { ManagedWorkbench } from './ManagedWorkbench.tsx'
import { Modal } from './PreviewModal.tsx'
import type { ChatKey } from './locales.ts'
import s from './ManagedCapabilities.module.css'
import r from './Roles.module.css'
import { appearanceStyle, RoleAppearanceIcon, roleAppearanceIconId } from './RoleAppearance.tsx'
import { RoleAppearanceEditor } from './RoleAppearanceEditor.tsx'
import { REQUIREMENTS_CAPABILITY_ID } from '../../../dsh-capabilities/src/core/requirements-model.ts'
import { roleCompositionIssues } from '../../../dsh-capabilities/src/core/validation.ts'
import { useRequirementAvailability } from './RequirementsSettings.tsx'
import { usesRequirements } from './requirements-routing.ts'
import { RoleVersionDialog } from './RoleVersions.tsx'
import { RoleImpactDialog, roleActivities } from './RoleImpactDialog.tsx'
import { capabilityPresentation } from './capability-presentation.ts'
import { useMeetingAvailability } from './meeting-capability-status.ts'

const freeChat = { name: '自由聊天', color: '#78869f', description: '日常问答、写作与想法讨论，无需选择工作区。' }
export const MEETING_DEMO_ROLE_ID = MEETING_ROLE_ID

function useMeetingStatus() {
  return useMeetingAvailability().status
}

export function ManagedRoleEditor({ id, onClose, restore }: { id?: string; onClose: () => void; restore?: NavigationLocation }) {
  const { data } = useCapabilities()
  useEffect(() => {
    const navigate = (event: Event) => { if ((event as CustomEvent).detail?.section === 'plugins') onClose() }
    window.addEventListener('workbench-capability-link', navigate)
    return () => window.removeEventListener('workbench-capability-link', navigate)
  }, [onClose])
  return <Modal title={id ? '编辑岗位助手' : '创建岗位助手'} closeLabel="关闭岗位编辑" onClose={()=>{if(requestLeave())onClose()}} wide>{data ? <RoleForm key={id ?? 'new'} id={id} restore={restore} onClose={onClose}/> : <p>正在读取岗位…</p>}</Modal>
}
function RoleForm({ id, onClose, restore }: { id?: string; onClose: () => void; restore?: NavigationLocation }) {
  const restored=restoredFrame(restore,'role-editor')?.view
  const { data } = useCapabilities(), state = data!.state, role = state.roles.find(r => r.id === id), key = `role:${id ?? 'new'}`, cached = editorDrafts.get(key)
  const {skills:skillCatalog,error:skillCatalogError}=useRoleSkillCatalog()
  const meetingStatus = useMeetingStatus()
  const { availability: requirementsStatus } = useRequirementAvailability(state.revision)
  const [draft, setDraft] = useState<RoleDefinition>(() => structuredClone(cached?.value as RoleDefinition ?? role?.draft ?? emptyRole()))
  const [initialAppearance] = useState(() => structuredClone({ color: draft.color, icon: draft.icon }))
  const [appearanceBusy, setAppearanceBusy] = useState(false)
  const [appearanceRevision, setAppearanceRevision] = useState(0)
  const [revision, setRevision] = useState(cached?.revision ?? state.revision), [selected, setSelected] = useState<string | null>(restored?.selected ?? (id === MEETING_ROLE_ID ? MEETING_CAPABILITY_ID : draft.capabilities[0]?.capabilityId ?? null))
  const [center, setCenter] = useState(!!restored?.center), [busy, setBusy] = useState(false), [error, setError] = useState(''), [review, setReview] = useState(false)
  useNavigationFrame('role-editor',10,()=>({section:'agent-presets',label:'岗位编辑',view:{id,center,selected}}))
  const change = (value: RoleDefinition) => { setDraft(value); editorDrafts.set(key, { value: structuredClone(value), revision }) }
  const skillId=selected?.startsWith('skill:')?selected.slice(6):undefined,skillBinding=draft.skills?.find(b=>b.id===skillId),selectedSkill=skillCatalog.find(s=>s.id===skillId)
  const binding = draft.capabilities.find(b => b.capabilityId === selected), cap = state.capabilities.find(c => c.id === selected), version = binding && resolveBinding(state, binding)
  const describe = (c: typeof cap, v = c && latest(c.versions)) => c ? capabilityPresentation(data!, c, v, meetingStatus, requirementsStatus) : { icon: 'document' as const, label: '能力缺失', message: '能力已不存在' }
  const updateBinding = (patch: Partial<RoleDefinition['capabilities'][number]>) => change({ ...draft, capabilities: draft.capabilities.map(b => b.capabilityId === selected ? { ...b, ...patch } : b) })
  const previousBindings = [...role?.draft.capabilities ?? [], ...latest(role?.versions ?? [])?.capabilities ?? []]
  const newComponentIds = draft.capabilities.filter(b => !previousBindings.some(old => old.capabilityId === b.capabilityId && old.version === b.version)).flatMap(b => resolveBinding(state, b)?.components.map(p => p.componentId) ?? [])
  const registryProblems = data?.registry ? componentPublishIssues(state, data.registry, newComponentIds) : []
  const publishProblems = [...roleCompositionIssues(draft), ...registryProblems]
  const save = async (publish: boolean) => {
    if (appearanceBusy) return
    setBusy(true); setError('')
    try { await capabilityClient.command({ type: 'role.save', id, definition: draft, publish }, revision); editorDrafts.delete(key); onClose() }
    catch (error) { setError(error instanceof Error ? error.message : String(error)) }
    finally { setBusy(false) }
  }
  return <><ManagedWorkbench libraryTitle={id === MEETING_ROLE_ID ? '会议流程能力' : '能力配件库'} title="岗位信息" selected={selected} onSelect={setSelected} onManage={() => setCenter(true)}
    libraryNote="列出已发布的能力及已导入的 Skills 技能" library={[...state.capabilities.filter(c => !c.removedAt && c.versions.length && (id === MEETING_ROLE_ID ? c.id === MEETING_CAPABILITY_ID : c.id !== MEETING_CAPABILITY_ID)).map(c => ({ id: c.id, name: c.draft.name, icon: describe(c).icon, subtitle: `v${latest(c.versions)!.version} · ${c.enabled ? '已发布' : '已停用'}`, disabled: id === MEETING_ROLE_ID })),...skillCatalog.filter(s=>s.name!=='browser-skill').map(s=>({id:'skill:'+s.id,name:s.name,subtitle:'Skill · '+s.description,icon:'document' as const,group:'Skills 技能'}))]}
    attached={[...draft.capabilities.map(b => { const c = state.capabilities.find(c => c.id === b.capabilityId), presentation = describe(c, resolveBinding(state, b)); return { id: b.capabilityId, name: c?.draft.name ?? '能力缺失', icon: presentation.icon, subtitle: `v${b.version} · ${c?.removedAt ? '能力已移除' : !b.enabled ? '岗位中停用' : !c?.enabled ? '能力已停用' : presentation.label}`, removable: b.capabilityId !== MEETING_CAPABILITY_ID } }),...(draft.skills??[]).map(b=>({id:'skill:'+b.id,name:b.name,subtitle:'Skill · '+b.hash.slice(0,12)+(b.enabled?'':' · 岗位中停用'),icon:'document' as const,removable:true}))]}
    onAdd={capabilityId => {if(capabilityId.startsWith('skill:')){const row=skillCatalog.find(s=>s.id===capabilityId.slice(6));if(row&&!draft.skills?.some(b=>b.id===row.id))change({...draft,skills:[...draft.skills??[],{id:row.id,name:row.name,hash:row.hash,enabled:true}]});setSelected(capabilityId);return} if (id === MEETING_ROLE_ID) return; const c = state.capabilities.find(c => c.id === capabilityId), v = c && latest(c.versions); if (v && !c?.removedAt && !draft.capabilities.some(b => b.capabilityId === capabilityId)) change({ ...draft, capabilities: [...draft.capabilities, { capabilityId, version: v.version, enabled: true }] }); setSelected(capabilityId) }}
    onRemove={capabilityId => {if(capabilityId.startsWith('skill:')){change({...draft,skills:(draft.skills??[]).filter(b=>b.id!==capabilityId.slice(6))});return} if (capabilityId !== MEETING_CAPABILITY_ID) change({ ...draft, capabilities: draft.capabilities.filter(b => b.capabilityId !== capabilityId) }) }}
    compositionNotice={skillCatalogError?<p role="alert" className={s.error}>{skillCatalogError}</p>:undefined}
    form={<div className={`${s.page} ${s.fields}`}>{id === MEETING_ROLE_ID && <div className={s.notice}>此岗位已关联“会议录音转写”能力，并提供快速生成和引导整理两种对话流程。下方的职责、要求和输出格式会用于新会议的纪要生成。<button type="button" className={s.button} onClick={() => setCenter(true)}>查看录音转写能力 →</button></div>}{draft.capabilities.some(b => b.capabilityId === REQUIREMENTS_CAPABILITY_ID) && <p className={s.notice}>需求分析岗位提供对话、需求工作区和轨迹。职责与工作要求会用于新分析；该流程暂不支持同时启用其他执行能力。</p>}<label className={s.field}>助手名称<input value={draft.name} maxLength={80} placeholder="例如：网页资料分析助手" onChange={e => change({ ...draft, name: e.target.value })}/></label><RoleAppearanceEditor key={appearanceRevision} roleId={id} value={draft} initialAppearance={initialAppearance} onBusyChange={setAppearanceBusy} onChange={patch => setDraft(current => { const value = { ...current, ...patch }; editorDrafts.set(key, { value: structuredClone(value), revision }); return value })}/><label className={s.field}>岗位职责<textarea rows={4} maxLength={8000} value={draft.duties} onChange={e => change({ ...draft, duties: e.target.value })}/></label><details><summary>工作要求与输出格式</summary><div className={s.fields}><label className={s.field}>工作要求<textarea rows={3} maxLength={8000} value={draft.requirements} onChange={e => change({ ...draft, requirements: e.target.value })}/></label><label className={s.field}>输出格式<textarea rows={3} maxLength={4000} value={draft.format} onChange={e => change({ ...draft, format: e.target.value })}/></label></div></details>{role && <label className={s.field}>从历史版本恢复到草稿<select value="" onChange={e => { const v = role.versions.find(v => v.version === Number(e.target.value)); if (v) { change(structuredClone(v)); setAppearanceRevision(value => value + 1) } }}><option value="">选择版本…</option>{role.versions.map(v => <option key={v.version} value={v.version}>v{v.version} · {v.name}</option>)}</select></label>}</div>}
    inspector={<div className={s.page}>{skillId?<RoleSkillInspector binding={skillBinding} skill={selectedSkill} onChange={value=>change({...draft,skills:(draft.skills??[]).map(b=>b.id===value.id?value:b)})}/>:cap?.id === MEETING_CAPABILITY_ID ? <><h3>{cap.draft.name}</h3><p className={s.muted}>{cap.draft.description}</p>{cap.removedAt && <p className={s.notice}>此能力已移除，请在能力中心恢复后使用。</p>}{binding && <><label className={s.check}><input type="checkbox" checked={binding.enabled} onChange={e => updateBinding({ enabled: e.target.checked })}/>在此岗位中启用录音转写</label><label className={s.field}>采用的能力版本<select value={binding.version} onChange={e => updateBinding({ version: Number(e.target.value), actions: undefined })}>{cap.versions.map(v => <option key={v.version} value={v.version}>v{v.version} · {v.createdAt.slice(0, 10)}</option>)}</select></label></>}<p className={s.notice}>{meetingStatus?.message ?? '正在检查语音识别配置…'}</p><button className={s.button} onClick={() => setCenter(true)}>管理录音转写能力 ↗</button></> : cap ? <><h3>{cap.draft.name}</h3><p className={s.muted}>{cap.draft.description}</p>{cap.removedAt && <p className={s.notice}>此能力已移除，当前不可执行。可从岗位中移除此配件，或在能力中心恢复。</p>}{binding ? <><label className={s.check}><input type="checkbox" checked={binding.enabled} onChange={e => updateBinding({ enabled: e.target.checked })}/>在此岗位中启用</label><label className={s.field}>采用的能力版本<select value={binding.version} onChange={e => updateBinding({ version: Number(e.target.value), actions: undefined })}>{cap.versions.map(v => <option key={v.version} value={v.version}>v{v.version} · {v.createdAt.slice(0, 10)}</option>)}</select></label><label className={s.check}><input type="checkbox" checked={binding.actions !== undefined} onChange={e => updateBinding({ actions: e.target.checked ? actionsOf(version) : undefined })}/>为此岗位缩小动作范围</label>{binding.actions !== undefined ? <ActionFields value={binding.actions} available={actionsOf(version)} onChange={actions => updateBinding({ actions })}/> : <p className={s.muted}>继承该版本默认动作：{actionsOf(version).map(a => actionNames[a]).join('、')}</p>}<p className={s.notice}>{describe(cap, version).message}</p></> : <p>先添加此能力，再设置岗位覆盖。</p>}<button className={s.button} onClick={() => setCenter(true)}>查看能力及关联组件 ↗</button></> : id === MEETING_ROLE_ID ? <div className={s.notice}><h3>会议录音转纪要</h3><p>快速生成、引导整理与录音转写由会议流程提供。语音识别接口在服务端配置，密钥不会保存到岗位草稿。</p><button className={s.button} onClick={() => setCenter(true)}>查看能力中心 →</button></div> : <p className={s.empty}>选择已添加的能力以调整设置。</p>}</div>}/>
    <div className={`${s.page} ${s.footer}`}><div>{error ? <p role="alert" className={s.error}>{error}</p> : <p>{appearanceBusy ? '请先在外观与配色中完成图片应用或修正颜色，再保存岗位。' : publishProblems.join('；') || '保存并发布后，新对话将采用这个岗位版本。'}</p>}{revision !== state.revision && <button className={s.button} onClick={() => setRevision(state.revision)}>保留草稿并更新保存基准</button>}</div><div className={s.actions}><button className={s.button} disabled={busy || appearanceBusy || registryProblems.length > 0} onClick={() => void save(false)}>保存草稿</button><button className={`${s.button} ${s.primary}`} disabled={busy || appearanceBusy || !draft.name.trim() || publishProblems.length > 0} onClick={() => setReview(true)}>保存并发布</button></div></div>
    {center && <Modal title="能力中心" closeLabel="返回岗位" onClose={() => {if(requestLeave())setCenter(false)}}><div className={`${s.page} ${s.dialogBody}`}><button className={s.button} onClick={() => {if(requestLeave())setCenter(false)}}>← 返回岗位，保留草稿</button><ManagedCenter embedded restore={restore} initialId={selected ?? undefined}/></div></Modal>}
    {review && <Modal title="发布岗位版本" closeLabel="返回编辑" onClose={() => setReview(false)}><div className={`${s.page} ${s.dialogBody}`}><p>{draft.name} · v{(latest(role?.versions ?? [])?.version ?? 0) + 1}</p><ul className={s.list}>{draft.skills?.map(b=><li key={'skill:'+b.id}>{b.name} · Skill · {b.hash.slice(0,12)}{b.enabled?'':' · 停用'}</li>)}{draft.capabilities.map(b => <li key={b.capabilityId}>{state.capabilities.find(c => c.id === b.capabilityId)?.draft.name} · v{b.version} · {b.enabled ? (b.actions ?? actionsOf(resolveBinding(state, b))).map(a => actionNames[a]).join('、') : '停用'}</li>)}</ul><p className={s.notice}>{draft.capabilities.some(b => b.enabled && b.capabilityId === REQUIREMENTS_CAPABILITY_ID) ? '新需求分析采用此岗位版本；已有分析保留创建时的要求和确认结果。停用能力或缩小权限会限制后续模型调用。' : id === MEETING_ROLE_ID ? '新会议将采用此岗位版本的名称、外观、纪要要求与录音转写能力关联；已有会议保留创建时的版本。' : '新增能力和放宽动作只由新对话采用。移除能力或缩小权限会立即限制旧会话，并停止受影响的浏览器任务。'}</p>{error && <p role="alert" className={s.error}>{error}</p>}<button className={`${s.button} ${s.primary}`} disabled={busy || appearanceBusy} onClick={() => void save(true)}>{busy ? '保存中…' : '确认发布'}</button></div></Modal>}
  </>
}
export function ManagedRolesSection({ selected, onSelect }: { selected: string; onSelect: (id: string) => void }) {
  const [entry]=useState(()=>pendingNavigation('agent-presets')), [restoration,setRestoration]=useState(entry?.restore)
  const { data, error } = useCapabilities(), [editor, setEditor] = useState<{ id?: string } | null>(()=>{const frame=restoredFrame(entry?.restore,'role-editor');return frame?{id:frame.view?.id}:null}), [message, setMessage] = useState('')
  useEffect(()=>{consumeNavigation(entry);const open=(event:Event)=>{const link=(event as CustomEvent).detail;if(link?.section!=='agent-presets')return;const frame=restoredFrame(link.restore,'role-editor');setRestoration(link.restore);setEditor(frame?{id:frame.view?.id}:null);consumeNavigation(link)};window.addEventListener('workbench-capability-link',open);return()=>window.removeEventListener('workbench-capability-link',open)},[entry])
  const [history, setHistory] = useState<string | null>(null)
  const historyRole = data?.state.roles.find(role => role.id === history)
  const [pendingAction, setPendingAction] = useState<{id:string;action:'disable'|'archive'} | null>(null), [archived, setArchived] = useState(false)
  const meetingStatus = useMeetingStatus()
  const displayedRoles = [...(data?.state.roles ?? [])].filter(role => !!role.archivedAt === archived).sort((left, right) => Number(right.id === MEETING_ROLE_ID) - Number(left.id === MEETING_ROLE_ID))
  const selectedRole = data?.state.roles.find(role => role.id === selected && role.enabled && role.versions.length)
  const restoreRole = async (id: string) => { try { await capabilityClient.command({ type: 'role.restore', id }); setArchived(false) } catch(error) { setMessage(error instanceof Error ? error.message : String(error)) } }
  const copyRole = async (id: string) => { try { const copied = await capabilityClient.command({ type: 'role.copy', id }); setEditor({ id: copied }) } catch (error) { setMessage(error instanceof Error ? error.message : String(error)) } }
  const toggleRole = async (id: string, enabled: boolean) => {
    try {
      await capabilityClient.command({ type: 'role.toggle', id, enabled })
      if (!enabled && selected === id) onSelect('chat')
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)) }
  }
  return <section className={r.section}>
    <div className={r.sectionHeader}><div><h2>岗位助手</h2><p>为每一类工作，准备一位熟悉职责的助手。</p></div><button className={r.primary} onClick={() => setEditor({})}>＋ 创建岗位助手</button></div>
    {(error || message) && <p role="alert" className={s.error}>{message || error}</p>}
    <PresetRepairNotice issues={data?.presetIssues ?? []}/>
    <div className={r.selectionStatus}><span role="status">{selected === 'chat' ? `已选定：${freeChat.name}` : selectedRole ? `已选定：${rolePresentation(selectedRole).name}` : data ? '当前岗位暂不可用' : '正在读取选定岗位…'}</span>{selected !== 'chat' && <button className={r.textButton} onClick={() => onSelect('chat')}>返回自由聊天</button>}</div>
    <button className={r.textButton} aria-pressed={archived} onClick={() => setArchived(value => !value)}>{archived ? '返回可用岗位' : `已归档（${data?.state.roles.filter(role => role.archivedAt).length ?? 0}）`}</button>
    <div className={r.cards}>
      {/* 基础聊天沿用 chat / workbench-chat，不创建可发布、停用的岗位记录。 */}
      {!archived && <article data-role-id="chat" aria-label={freeChat.name} className={`${r.roleCard} ${selected === 'chat' ? r.selectedCard : ''}`} style={appearanceStyle(freeChat.color)}>
        <div className={r.cardBody}>
          <button type="button" className={r.cardSelect} aria-label={`选定助手：${freeChat.name}`} aria-pressed={selected === 'chat'} onClick={() => onSelect('chat')}/>
          <div className={r.cardTop}><RoleAppearanceIcon roleId="chat" color={freeChat.color}/><span className={`${r.exampleBadge} ${selected === 'chat' ? r.selectedBadge : ''}`}>{selected === 'chat' ? '✓ 已选定' : '内置'}</span></div>
          <h3>{freeChat.name}</h3><p className={r.cardSummary}>{freeChat.description}</p>
          <div className={r.tags}><span>内置基础助手</span><span>日常问答</span><span>写作讨论</span></div>
        </div>
        <div className={r.cardControls}><p className={r.chatCardNote}>无需岗位配置，随时开始聊天。</p></div>
      </article>}
      {displayedRoles.map(role => {
      const displayed = rolePresentation(role), published = latest(role.versions), selectable = role.enabled && !!published, chosen = selectable && selected === role.id
      return <article key={role.id} data-role-id={role.id} aria-label={displayed.name} className={`${r.roleCard} ${chosen ? r.selectedCard : ''}`} style={appearanceStyle(displayed.color)}>
        <div className={r.cardBody}>
          {/* 正文选择与管理操作分开，编辑/停用不会触发卡片选择。 */}
          <button type="button" className={r.cardSelect} aria-label={`选定助手：${displayed.name}`} aria-pressed={chosen} disabled={!selectable} onClick={() => onSelect(role.id)}/>
          <div className={r.cardTop}><RoleAppearanceIcon roleId={role.id} icon={displayed.icon} color={displayed.color}/><span className={`${r.exampleBadge} ${chosen ? r.selectedBadge : ''}`}>{chosen ? '✓ 已选定' : role.archivedAt ? '已归档' : !role.enabled ? '已停用' : published ? '岗位助手' : '草稿'}</span></div>
          <h3>{displayed.name}</h3><p className={r.cardSummary} title={displayed.duties}>{displayed.duties || '点击编辑岗位，填写职责与工作要求。'}</p>
          <div className={r.tags}>{roleHasUnpublishedChanges(role) && <span>有未发布修改</span>}<span>{published ? `已发布 v${published.version}` : '未发布'}</span>{role.id === MEETING_ROLE_ID ? <><span>快速生成 · 引导整理</span><span title={meetingStatus?.message}>{meetingStatus?.ready === true ? '录音转写已配置' : meetingStatus?.state === 'disabled' ? '录音转写不可用' : meetingStatus?.ready === false ? '录音转写待配置' : '正在检测录音转写'}</span></> : usesRequirements(data?.state, published) ? <><span>快速整理 · 引导分析</span><span>需求工作区</span></> : role.id === 'builtin-analyst' ? <><span>{displayed.capabilities.length} 个能力</span><span>可编辑岗位，选择需求分析能力</span></> : <><span>{displayed.capabilities.length} 个能力</span></>}<span>{roleActivities(data!, role.id).length} 个活动任务</span></div>
        </div>
        <div className={r.cardControls}><button className={r.cardAction} disabled={!!role.archivedAt} onClick={() => setEditor({ id: role.id })}>编辑岗位<span aria-hidden="true">↗</span></button><button className={r.textButton} onClick={() => setHistory(role.id)}>版本（{role.versions.length}）</button><button className={r.textButton} disabled={!!role.archivedAt || role.id === MEETING_ROLE_ID} title={role.id === MEETING_ROLE_ID ? "会议使用专用流程，请编辑原岗位并发布新版本" : "复制当前已发布配置为独立草稿"} onClick={() => void copyRole(role.id)}>复制岗位</button><button className={r.textButton} onClick={() => role.archivedAt ? void restoreRole(role.id) : role.enabled ? setPendingAction({id:role.id,action:'disable'}) : void toggleRole(role.id, true)}>{role.archivedAt ? '恢复岗位' : role.enabled ? '停用' : '启用'}</button>{!role.archivedAt && <button className={r.textButton} onClick={() => setPendingAction({id:role.id,action:'archive'})}>归档</button>}</div>
      </article>
    })}</div>
    {data && !data.state.roles.length && <p className={s.empty}>还没有保存的岗位助手。创建后即可装配能力。</p>}
    <p className={r.sectionNote}>点击卡片选定助手；选择会用于下一次新对话，当前对话保持不变。</p>
    {data && historyRole && <RoleVersionDialog data={data} role={historyRole} onClose={() => setHistory(null)} onEdit={version => { if ((editorDrafts.has('role:'+historyRole.id) || roleHasUnpublishedChanges(historyRole)) && !window.confirm('恢复历史版本将替换当前编辑草稿，已发布版本不受影响。是否继续？')) return; editorDrafts.set('role:'+historyRole.id,{value:structuredClone(version),revision:data.state.revision});setEditor({id:historyRole.id});setHistory(null) }}/>}
    {data && pendingAction && <RoleImpactDialog data={data} roleId={pendingAction.id} action={pendingAction.action} onClose={() => setPendingAction(null)} onDone={() => { if (selected === pendingAction.id) onSelect('chat'); setPendingAction(null) }}/> }
    {editor && <ManagedRoleEditor restore={restoration} id={editor.id} onClose={() => setEditor(null)}/>}
  </section>
}
export function PresetRepairNotice({ issues }: { issues: string[] }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('')
  const repair = async () => {
    if (busy || !window.confirm('修复会先备份外部修改的预设文件，再按已发布岗位恢复。岗位、能力与会话数据保留。是否继续？')) return
    setBusy(true); setError(''); setMessage('')
    try { await capabilityClient.repairPresets(); setMessage('岗位预设已修复；被替换的原文件已备份。') }
    catch (error) { setError(error instanceof Error ? error.message : String(error)) }
    finally { setBusy(false) }
  }
  if (!issues.length && !error && !message) return null
  return <div className={s.notice}>
    {!!issues.length && <><p>部分历史岗位预设需要修复；其他配置仍可正常保存。</p><details><summary>查看 {issues.length} 项问题</summary><ul className={s.presetIssues}>{issues.map(issue => <li key={issue}>{issue}</li>)}</ul></details><button className={s.button} disabled={busy} onClick={() => void repair()}>{busy ? '正在备份并修复…' : '备份并修复岗位预设'}</button></>}
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
  </div>
}
export function ManagedRolePicker({ selected, onSelect, t }: { selected: string; onSelect: (id: string) => void; t: (key: ChatKey) => string }) {
  const { data } = useCapabilities(), [open, setOpen] = useState(false), [editor, setEditor] = useState(false)
  const role = data?.state.roles.find(role => role.id === selected), displayed = role && rolePresentation(role)
  return <>
    <button className={r.picker} aria-haspopup="dialog" onClick={() => setOpen(true)}>
      <RoleAppearanceIcon roleId={role?.id ?? 'chat'} icon={displayed?.icon} color={displayed?.color ?? freeChat.color}/><span>{displayed?.name ?? t('mode')}</span><span>⌄</span>
    </button>
    {open && <Modal title="选择岗位助手" closeLabel="关闭" onClose={() => setOpen(false)}><div className={`${s.page} ${s.dialogBody}`}>
      <button className={s.choice} aria-pressed={selected === 'chat'} onClick={() => { onSelect('chat'); setOpen(false) }}><div><RoleAppearanceIcon roleId="chat" color={freeChat.color}/></div><span><strong>{freeChat.name}</strong><small>{freeChat.description}</small></span></button>
      {[...(data?.state.roles ?? [])].sort((left, right) => Number(right.id === MEETING_ROLE_ID) - Number(left.id === MEETING_ROLE_ID)).filter(role => role.enabled && role.versions.length).map(role => <button className={s.choice} key={role.id} aria-pressed={selected === role.id} onClick={() => { onSelect(role.id); setOpen(false) }}>
        <div><RoleAppearanceIcon roleId={role.id} icon={rolePresentation(role).icon} color={rolePresentation(role).color}/></div><span><strong>{latest(role.versions)!.name}</strong><small>{role.id === MEETING_ROLE_ID ? `v${latest(role.versions)!.version} · 快速生成 / 引导整理` : usesRequirements(data?.state, latest(role.versions)) ? `v${latest(role.versions)!.version} · 快速整理 / 引导分析` : `v${latest(role.versions)!.version} · ${latest(role.versions)!.capabilities.length} 个能力`}</small></span>
      </button>)}
      <button className={s.button} onClick={() => setEditor(true)}>＋ 创建岗位助手</button><p className={s.muted}>选择仅用于下一次新对话，当前对话的岗位不会改变。</p>
    </div></Modal>}
    {editor && <ManagedRoleEditor onClose={() => setEditor(false)}/>}
  </>
}
export function ManagedCurrentAssistant({ selected, onOpen, preset }: { selected: string; onOpen: () => void; preset?: string }) {
  const { data } = useCapabilities()
  // An existing conversation shows the appearance of its saved preset version.
  // A new draft shows the current choice from the role picker.
  const role = data?.state.roles.find(role => role.id === selected)
  const version = preset ? role?.versions.find(version => version.preset === preset) : undefined
  const appearance = version ?? (role && rolePresentation(role))
  const name = appearance?.name ?? freeChat.name, color = appearance?.color ?? freeChat.color
  const iconSpec = appearance?.icon
  const icon = roleAppearanceIconId(role?.id ?? 'chat', iconSpec)
  return <button type="button" data-current-assistant="true" data-role-icon={icon} className={r.currentAssistant} style={appearanceStyle(color)} aria-label={`打开岗位助手：${name}`} title={`当前选定：${name} · 点击管理岗位`} onClick={onOpen}>
    <RoleAppearanceIcon roleId={role?.id ?? 'chat'} icon={iconSpec} color={color}/><span className={r.currentText}>{name}</span><svg className={r.currentArrow} aria-hidden="true" viewBox="0 0 16 16" fill="none"><path d="m6 4 4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
  </button>
}
export function BrowserTaskStatus({ sessionId }: { sessionId?: string }) {
  const { data } = useCapabilities(), [error, setError] = useState('')
  const task = data?.tasks.find(t => t.sessionId === sessionId)
  if (!task || (!task.browserSessions.length && task.status === 'idle')) return null
  const labels = { idle: '浏览器空闲', running: '浏览器执行中', stopping: '正在停止', stopped: '已确认停止', error: '需要处理' }
  return <div className={`${s.page} ${s.tasks}`} role="status">{labels[task.status]}{task.action && ` · ${task.action}`} · {task.browserSessions.length} 个窗口{!['stopped','stopping'].includes(task.status) && <button className={s.button} onClick={() => void capabilityClient.stop(task.sessionId).catch(e => setError(e.message))}>停止浏览器任务</button>}{(error || task.error) && <span className={s.error}>{error || task.error}</span>}</div>
}
