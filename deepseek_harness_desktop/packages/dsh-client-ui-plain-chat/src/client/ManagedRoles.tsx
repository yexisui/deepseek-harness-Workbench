import { capabilityCatalog, roleCapabilityReason } from '../../../dsh-capabilities/src/core/role-capability-catalog.ts'
import { RoleCapabilityInspector } from './RoleCapabilityInspector.tsx'
import {useRoleSkillCatalog,RoleSkillInspector} from './RoleSkills.tsx'
import { consumeNavigation, pendingNavigation, requestLeave, restoredFrame, useNavigationFrame, type NavigationLocation } from '../../../dsh-plugin-manager/src/client/workbench-navigation.ts'
import React, { useEffect, useRef, useState } from 'react'
import { emptyRole, latest, rolePresentation, roleHasUnpublishedChanges, resolveBinding, type RoleDefinition } from '../../../dsh-capabilities/src/core/model.ts'
import { MEETING_CAPABILITY_ID, MEETING_ROLE_ID } from '../../../dsh-capabilities/src/core/default-roles.ts'
import { capabilityClient, editorDrafts, useCapabilities } from './capability-client.ts'
import { ManagedCenter } from './ManagedCenter.tsx'
import { ManagedWorkbench } from './ManagedWorkbench.tsx'
import { Modal } from './PreviewModal.tsx'
import type { ChatKey } from './locales.ts'
import s from './ManagedCapabilities.module.css'
import r from './Roles.module.css'
import { appearanceStyle, RoleAppearanceIcon, roleAppearanceIconId } from './RoleAppearance.tsx'
import { RoleAppearanceEditor } from './RoleAppearanceEditor.tsx'
import { useRequirementAvailability } from './RequirementsSettings.tsx'
import { usesRequirements } from './requirements-routing.ts'

import { RoleImpactDialog, roleActivities } from './RoleImpactDialog.tsx'
import { capabilityDisplayDefinition, capabilityPresentation } from './capability-presentation.ts'
import { useMeetingAvailability } from './meeting-capability-status.ts'

const freeChat = { name: '自由聊天', color: '#78869f', description: '日常问答、写作与想法讨论，无需选择工作区。' }
export const MEETING_DEMO_ROLE_ID = MEETING_ROLE_ID

function useMeetingStatus() {
  return useMeetingAvailability().status
}

export function ManagedRoleEditor({ id, onClose, restore }: { id?: string; onClose: (saved?: boolean) => void; restore?: NavigationLocation }) {
  const { data } = useCapabilities()
  const cancel = useRef<() => void>(() => onClose())
  useEffect(() => {
    const navigate = (event: Event) => { if ((event as CustomEvent).detail?.section === 'plugins') onClose() }
    window.addEventListener('workbench-capability-link', navigate)
    return () => window.removeEventListener('workbench-capability-link', navigate)
  }, [onClose])
  return <Modal title={id ? '编辑岗位助手' : '创建岗位助手'} closeLabel="关闭岗位编辑" onClose={()=>{if(requestLeave())cancel.current()}} wide>{data ? <RoleForm key={id ?? 'new'} id={id} restore={restore} onClose={onClose} cancelRef={cancel}/> : <p>正在读取岗位…</p>}</Modal>
}
function RoleForm({ id, onClose, restore, cancelRef }: { id?: string; onClose: (saved?: boolean) => void; restore?: NavigationLocation; cancelRef: React.MutableRefObject<() => void> }) {
  const restored=restoredFrame(restore,'role-editor')?.view
  const { data } = useCapabilities(), state = data!.state, role = state.roles.find(r => r.id === id), key = `role:${id ?? 'new'}`, cached = editorDrafts.get(key)
  const {skills:skillCatalog,error:skillCatalogError}=useRoleSkillCatalog()
  const meetingStatus = useMeetingStatus()
  const { availability: requirementsStatus } = useRequirementAvailability(state.revision)
  const [draft, setDraft] = useState<RoleDefinition>(() => structuredClone(cached?.value as RoleDefinition ?? role?.draft ?? emptyRole()))
  const [initialAppearance] = useState(() => structuredClone({ color: draft.color, icon: draft.icon }))
  const [appearanceBusy, setAppearanceBusy] = useState(false)
  const [revision, setRevision] = useState(cached?.revision ?? state.revision), [selected, setSelected] = useState<string | null>(restored?.selected ?? (draft.capabilities[0]?.capabilityId ?? null))
  const [center, setCenter] = useState(!!restored?.center), [busy, setBusy] = useState(false), [error, setError] = useState(''), [discard, setDiscard] = useState(false)
  useNavigationFrame('role-editor',10,()=>({section:'agent-presets',label:'岗位编辑',view:{id,center,selected}}))
  const change = (value: RoleDefinition) => { setDraft(value); editorDrafts.set(key, { value: structuredClone(value), revision }) }
  const skillId=selected?.startsWith('skill:')?selected.slice(6):undefined,skillBinding=draft.skills?.find(b=>b.id===skillId),selectedSkill=skillCatalog.find(s=>s.id===skillId)
  const binding = draft.capabilities.find(b => b.capabilityId === selected), cap = state.capabilities.find(c => c.id === selected), version = binding && resolveBinding(state, binding)
  const describe = (c: typeof cap, v = c && latest(c.versions)) => c ? capabilityPresentation(data!, c, v, meetingStatus, requirementsStatus) : { icon: 'document' as const, label: '能力缺失', message: '能力已不存在' }
  const catalog = capabilityCatalog(state.capabilities)
  const skills = skillCatalog.filter(skill => skill.name !== 'browser-skill')
  const addable = catalog.filter(c => !roleCapabilityReason(id, c) && !draft.capabilities.some(b => b.capabilityId === c.id)).length
  const updateBinding = (patch: Partial<RoleDefinition['capabilities'][number]>) => change({ ...draft, capabilities: draft.capabilities.map(b => b.capabilityId === selected ? { ...b, ...patch } : b) })
  const changed = JSON.stringify(draft) !== JSON.stringify(role?.draft ?? emptyRole())
  const unsaved = changed || !role?.versions.length || !!role && roleHasUnpublishedChanges(role)
  const abandon = () => { editorDrafts.delete(key); onClose() }
  const cancel = () => { if (busy) return; if (changed || appearanceBusy) setDiscard(true); else abandon() }
  cancelRef.current = cancel
  const save = async () => {
    if (appearanceBusy) return
    setBusy(true); setError('')
    try { await capabilityClient.command({ type: 'role.save', id, definition: draft, publish: true, directSave: true }, revision); editorDrafts.delete(key); onClose(true) }
    catch (error) { setError(error instanceof Error ? error.message : String(error)) }
    finally { setBusy(false) }
  }
  return <><ManagedWorkbench banner="保存后即可使用；已有任务保留原配置。移除配件不会卸载共享能力。" libraryTitle="能力配件库" title="岗位信息" selected={selected} onSelect={setSelected} onManage={() => setCenter(true)}
    libraryNote={`能力共 ${catalog.length} 项 · 可添加 ${addable} 项 · Skills 技能 ${skills.length} 项`} library={[...catalog.map(c => { const presentation = describe(c), reason = roleCapabilityReason(id, c); return { id: c.id, name: capabilityDisplayDefinition(c).name, icon: presentation.icon, subtitle: [presentation.label, reason].filter(Boolean).join(' · '), disabled: !!reason, disabledReason: reason, group: '能力' } }),...skills.map(s=>({id:'skill:'+s.id,name:s.name,subtitle:'Skill · '+s.description,icon:'document' as const,group:'Skills 技能'}))]}
    attached={[...draft.capabilities.map(b => { const c = state.capabilities.find(c => c.id === b.capabilityId), presentation = describe(c, resolveBinding(state, b)); return { id: b.capabilityId, name: c?.draft.name ?? '能力缺失', icon: presentation.icon, subtitle: `${c?.removedAt ? '能力已移除' : !b.enabled ? '岗位中停用' : !c?.enabled ? '能力已停用' : presentation.label}`, removable: true } }),...(draft.skills??[]).map(b=>({id:'skill:'+b.id,name:b.name,subtitle:'Skill'+(b.enabled?'':' · 岗位中停用'),icon:'document' as const,removable:true}))]}
    onAdd={capabilityId => {if(capabilityId.startsWith('skill:')){const row=skillCatalog.find(s=>s.id===capabilityId.slice(6));if(row&&!draft.skills?.some(b=>b.id===row.id))change({...draft,skills:[...draft.skills??[],{id:row.id,name:row.name,hash:row.hash,enabled:true}]});setSelected(capabilityId);return} const c = state.capabilities.find(c => c.id === capabilityId), v = c && latest(c.versions); if (!c || roleCapabilityReason(id, c)) return; if (v && !c.removedAt && !draft.capabilities.some(b => b.capabilityId === capabilityId)) change({ ...draft, capabilities: [...draft.capabilities, { capabilityId, version: v.version, enabled: true }] }); setSelected(capabilityId) }}
    onRemove={capabilityId => {if(capabilityId.startsWith('skill:')){change({...draft,skills:(draft.skills??[]).filter(b=>b.id!==capabilityId.slice(6))});return} change({ ...draft, capabilities: draft.capabilities.filter(b => b.capabilityId !== capabilityId) }) }}
    compositionNotice={skillCatalogError?<p role="alert" className={s.error}>{skillCatalogError}</p>:undefined}
    form={<div className={`${s.page} ${s.fields}`}><label className={s.field}>助手名称<input value={draft.name} maxLength={80} placeholder="例如：网页资料分析助手" onChange={e => change({ ...draft, name: e.target.value })}/></label><RoleAppearanceEditor roleId={id} value={draft} initialAppearance={initialAppearance} onBusyChange={setAppearanceBusy} onChange={patch => setDraft(current => { const value = { ...current, ...patch }; editorDrafts.set(key, { value: structuredClone(value), revision }); return value })}/><label className={s.field}>岗位职责<textarea rows={4} maxLength={8000} value={draft.duties} onChange={e => change({ ...draft, duties: e.target.value })}/></label><details><summary>工作要求与输出格式</summary><div className={s.fields}><label className={s.field}>工作要求<textarea rows={3} maxLength={8000} value={draft.requirements} onChange={e => change({ ...draft, requirements: e.target.value })}/></label><label className={s.field}>输出格式<textarea rows={3} maxLength={4000} value={draft.format} onChange={e => change({ ...draft, format: e.target.value })}/></label></div></details></div>}
    inspector={<div className={s.page}>{skillId?<RoleSkillInspector binding={skillBinding} skill={selectedSkill} onChange={value=>change({...draft,skills:(draft.skills??[]).map(b=>b.id===value.id?value:b)})}/>:cap ? <RoleCapabilityInspector capability={cap} binding={binding} version={version} allowActionScope={true} message={roleCapabilityReason(id,cap) ?? (cap.id===MEETING_CAPABILITY_ID?meetingStatus?.message:describe(cap,version).message)} manageLabel={cap.id===MEETING_CAPABILITY_ID?'管理录音转写能力':'查看能力及关联组件'} onChange={updateBinding} onManage={()=>setCenter(true)}/> : id === MEETING_ROLE_ID ? <div className={s.notice}><h3>会议录音转纪要</h3><p>快速生成、引导整理与录音转写由会议流程提供。语音识别接口在服务端配置，密钥不会保存到岗位草稿。</p><button className={s.button} onClick={() => setCenter(true)}>查看能力中心 →</button></div> : <p className={s.empty}>选择已添加的能力以调整设置。</p>}</div>}/>
    <div className={s.page + ' ' + s.footer}><div>{error ? <p role="alert" className={s.error}>{error}</p> : <p role="status">{appearanceBusy ? '请先完成外观编辑，再保存岗位。' : unsaved ? '尚未保存' : '已保存'}</p>}{revision !== state.revision && <button className={s.button} onClick={() => setRevision(state.revision)}>保留修改并重新检查</button>}</div><div className={s.actions}><button className={s.button} disabled={busy} onClick={cancel}>取消</button><button className={s.button + ' ' + s.primary} disabled={busy || appearanceBusy || !draft.name.trim()} onClick={() => void save()}>{busy ? '保存中…' : '保存'}</button></div></div>
    {center && <Modal title="能力中心" closeLabel="返回岗位" onClose={() => {if(requestLeave())setCenter(false)}}><div className={`${s.page} ${s.dialogBody}`}><button className={s.button} onClick={() => {if(requestLeave())setCenter(false)}}>← 返回岗位，保留修改</button><ManagedCenter embedded restore={restore} initialId={selected ?? undefined}/></div></Modal>}
    {discard && <Modal title="放弃修改？" closeLabel="继续编辑" onClose={() => setDiscard(false)}><div className={s.page}><p>当前修改尚未保存，是否放弃？</p><div className={s.actions}><button className={s.button} onClick={() => setDiscard(false)}>继续编辑</button><button className={s.button} onClick={abandon}>放弃修改</button></div></div></Modal>}
  </>
}
export function ManagedRolesSection({ selected, onSelect }: { selected: string; onSelect: (id: string) => void }) {
  const [entry]=useState(()=>pendingNavigation('agent-presets')), [restoration,setRestoration]=useState(entry?.restore)
  const { data, error } = useCapabilities(), [editor, setEditor] = useState<{ id?: string } | null>(()=>{const frame=restoredFrame(entry?.restore,'role-editor');return frame?{id:frame.view?.id}:null}), [message, setMessage] = useState('')
  useEffect(()=>{consumeNavigation(entry);const open=(event:Event)=>{const link=(event as CustomEvent).detail;if(link?.section!=='agent-presets')return;const frame=restoredFrame(link.restore,'role-editor');setRestoration(link.restore);setEditor(frame?{id:frame.view?.id}:null);consumeNavigation(link)};window.addEventListener('workbench-capability-link',open);return()=>window.removeEventListener('workbench-capability-link',open)},[entry])
  const [pendingAction, setPendingAction] = useState<{id:string;action:'disable'|'archive'|'remove'} | null>(null), [archived, setArchived] = useState(false)
  const meetingStatus = useMeetingStatus()
  const displayedRoles = [...(data?.state.roles ?? [])].filter(role => !role.removedAt && !!role.archivedAt === archived).sort((left, right) => Number(right.id === MEETING_ROLE_ID) - Number(left.id === MEETING_ROLE_ID))
  const selectedRole = data?.state.roles.find(role => role.id === selected && role.enabled && role.versions.length)
  const restoreRole = async (id: string) => { try { await capabilityClient.command({ type: 'role.restore', id }); setArchived(false) } catch(error) { setMessage(error instanceof Error ? error.message : String(error)) } }
  const copyRole = (id: string) => {
    const original = data?.state.roles.find(role => role.id === id)
    if (!original || original.archivedAt) return
    const value = structuredClone(rolePresentation(original))
    value.name = (value.name + ' 副本').slice(0, 80)
    editorDrafts.set('role:new', { value, revision: data!.state.revision })
    setEditor({})
  }
  const toggleRole = async (id: string, enabled: boolean) => {
    try {
      await capabilityClient.command({ type: 'role.toggle', id, enabled })
      if (!enabled && selected === id) onSelect('chat')
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)) }
  }
  return <section className={r.section}>
    <div className={r.sectionHeader}><div><h2>岗位助手</h2><p>为每一类工作，准备一位熟悉职责的助手。</p></div><button className={r.primary} onClick={() => setEditor({})}>＋ 创建岗位助手</button></div>
    {(error || message) && <p role={message === '已保存' && !error ? 'status' : 'alert'} className={message === '已保存' && !error ? s.muted : s.error}>{error || message}</p>}
    <PresetRepairNotice issues={data?.presetIssues ?? []}/>
    <div className={r.selectionStatus}><span role="status">{selected === 'chat' ? `已选定：${freeChat.name}` : selectedRole ? `已选定：${rolePresentation(selectedRole).name}` : data ? '当前岗位暂不可用' : '正在读取选定岗位…'}</span>{selected !== 'chat' && <button className={r.textButton} onClick={() => onSelect('chat')}>返回自由聊天</button>}</div>
    <button className={r.textButton} aria-pressed={archived} onClick={() => setArchived(value => !value)}>{archived ? '返回可用岗位' : `已归档（${data?.state.roles.filter(role => role.archivedAt && !role.removedAt).length ?? 0}）`}</button>
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
          <div className={r.cardTop}><RoleAppearanceIcon roleId={role.id} icon={displayed.icon} color={displayed.color}/><span className={`${r.exampleBadge} ${chosen ? r.selectedBadge : ''}`}>{chosen ? '✓ 已选定' : role.archivedAt ? '已归档' : !role.enabled ? '已停用' : published ? '岗位助手' : '待保存'}</span></div>
          <h3>{displayed.name}</h3><p className={r.cardSummary} title={displayed.duties}>{displayed.duties || '点击编辑岗位，填写职责与工作要求。'}</p>
          <div className={r.tags}>{roleHasUnpublishedChanges(role) && <span>有待保存修改</span>}{published?.capabilities.some(b=>b.enabled&&b.capabilityId===MEETING_CAPABILITY_ID) ? <><span>快速生成 · 引导整理</span><span title={meetingStatus?.message}>{meetingStatus?.ready === true ? '录音转写已配置' : meetingStatus?.state === 'disabled' ? '录音转写不可用' : meetingStatus?.ready === false ? '录音转写待配置' : '正在检测录音转写'}</span></> : usesRequirements(data?.state, published) ? <><span>快速整理 · 引导分析</span><span>需求工作区</span></> : role.id === 'builtin-analyst' ? <><span>{displayed.capabilities.length} 个能力</span><span>可编辑岗位，选择需求分析能力</span></> : <><span>{displayed.capabilities.length} 个能力</span></>}<span>{roleActivities(data!, role.id).length} 个活动任务</span></div>
        </div>
        <div className={r.cardControls}>{!role.archivedAt && <><button className={r.cardAction} disabled={!!role.archivedAt} onClick={() => setEditor({ id: role.id })}>编辑岗位<span aria-hidden="true">↗</span></button><button className={r.textButton} disabled={!!role.archivedAt} title="复制当前岗位配置" onClick={() => void copyRole(role.id)}>复制岗位</button></>}<button className={r.textButton} onClick={() => role.archivedAt ? void restoreRole(role.id) : role.enabled ? setPendingAction({id:role.id,action:'disable'}) : void toggleRole(role.id, true)}>{role.archivedAt ? '恢复岗位' : role.enabled ? '停用' : '启用'}</button>{role.archivedAt ? <button className={r.textButton} onClick={() => setPendingAction({id:role.id,action:'remove'})}>移除岗位</button> : <button className={r.textButton} onClick={() => setPendingAction({id:role.id,action:'archive'})}>归档</button>}</div>
      </article>
    })}</div>
    {data && !displayedRoles.length && <p className={s.empty}>{archived ? '暂无已归档岗位。' : '还没有保存的岗位助手。创建后即可装配能力。'}</p>}
    <p className={r.sectionNote}>点击卡片选定助手；选择会用于下一次新对话，当前对话保持不变。</p>

    {data && pendingAction && <RoleImpactDialog data={data} roleId={pendingAction.id} action={pendingAction.action} onClose={() => setPendingAction(null)} onDone={() => { if (selected === pendingAction.id) onSelect('chat'); setPendingAction(null) }}/> }
    {editor && <ManagedRoleEditor restore={restoration} id={editor.id} onClose={saved => { setEditor(null); if (saved) setMessage('已保存') }}/>}
  </section>
}
export function PresetRepairNotice({ issues }: { issues: string[] }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('')
  const repair = async () => {
    if (busy || !window.confirm('将根据已保存的岗位设置修复关联配置。是否继续？')) return
    setBusy(true); setError(''); setMessage('')
    try { await capabilityClient.repairPresets(); setMessage('岗位配置已修复。') }
    catch (error) { setError(error instanceof Error ? error.message : String(error)) }
    finally { setBusy(false) }
  }
  if (!issues.length && !error && !message) return null
  return <div className={s.notice}>
    {!!issues.length && <><p>部分岗位配置需要修复；其他配置仍可正常保存。</p><details><summary>查看 {issues.length} 项问题</summary><ul className={s.presetIssues}>{issues.map(issue => <li key={issue}>{issue}</li>)}</ul></details><button className={s.button} disabled={busy} onClick={() => void repair()}>{busy ? '正在修复…' : '修复岗位配置'}</button></>}
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
        <div><RoleAppearanceIcon roleId={role.id} icon={rolePresentation(role).icon} color={rolePresentation(role).color}/></div><span><strong>{latest(role.versions)!.name}</strong><small>{latest(role.versions)!.capabilities.some(b=>b.enabled&&b.capabilityId===MEETING_CAPABILITY_ID) ? '快速生成 / 引导整理' : usesRequirements(data?.state, latest(role.versions)) ? '快速整理 / 引导分析' : `${latest(role.versions)!.capabilities.length} 个能力`}</small></span>
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
