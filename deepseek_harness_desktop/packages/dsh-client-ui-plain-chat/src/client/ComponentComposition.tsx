import React, { useState } from 'react'
import { actionNames, components, type Component, type Definition, type Snapshot } from '../../../dsh-capabilities/src/core/model.ts'
import { addAssociation, availableComponents, compositionIds, compositionSupported, dependencyName, dependencyUsers, missingAssociations, missingDependencies, removeAssociation, requiredComponents, supportDependencies } from '../../../dsh-capabilities/src/core/composition.ts'
import { CapabilityActionIcon } from './ManagedCapabilityCards.tsx'
import { capabilityClient, openCapabilityLink } from './capability-client.ts'
import { Modal } from './PreviewModal.tsx'
import { useCapabilityDefinition } from './useCapabilityDefinition.ts'
import { CapabilityGlyph, type WorkbenchItem } from './ManagedWorkbench.tsx'
import { ComponentEnvironment, componentService } from './ComponentService.tsx'
import type { RequirementAvailability } from '../../../dsh-capabilities/src/core/requirements-model.ts'
import type { MeetingAvailability } from './meeting-capability-status.ts'
import s from './ManagedCapabilities.module.css'

export const associationName = (id: string, catalog: readonly Component[] = components) => catalog.find(c => c.id === id)?.name ?? dependencyName(id)
export function compositionItems(draft: Definition, capabilityId?: string, data?: Snapshot): WorkbenchItem[] {
  return compositionIds(draft,data?.components).map(id => {
    const part = draft.components.find(p => p.componentId === id)
    return { id, name: data?.components.find(c=>c.id===id)?.name ?? associationName(id,data?.components), icon: (data?.components??components).find(c => c.id === id)?.icon ?? 'support', subtitle: part ? `${requiredComponents(capabilityId,data?.components).some(c => c.id === id) ? '必需组件' : '业务组件'} · ${part.actions.map(a => actionNames[a]).join(' · ') || '未选择动作'}` : `必需支持 · ${dependencyUsers(draft, id,data?.components).map(c => c.name).join('、')}` }
  })
}
export function compositionLibrary(draft: Definition, capabilityId?: string, data?: Snapshot): WorkbenchItem[] {
  const business = availableComponents(capabilityId,data?.components).map(c=>data?.components.find(d=>d.id===c.id)??c)
  const support = [...new Set(business.flatMap(c => c.dependencies.filter(id => id.startsWith('@'))))]
  const needed = supportDependencies(draft,data?.components)
  return [...business.map(c => ({ id: c.id, name: c.name, icon: c.icon, subtitle: data?.registry?.metadata[c.id]?.retiredAt?'已移入回收站':data?.registry?.metadata[c.id]?.enabled===false?'全局停用':`v${c.version} · ${c.sourceLabel}`, disabled: !!data?.registry?.metadata[c.id]?.retiredAt || data?.registry?.metadata[c.id]?.enabled===false, group: '业务组件' })),
    ...support.map(id => ({ id, name: dependencyName(id), icon: 'support' as const, subtitle: needed.includes(id) ? missingDependencies(draft,data?.components).includes(id) ? '缺少关联 · 拖入补回' : '必需支持' : '先添加对应业务组件', disabled: !needed.includes(id), group: '支持组件' }))]
}
const compositionKey = (value: Definition) => JSON.stringify([value.components, value.excludedDependencies, value.componentOrder])
export function useAssociationEditing(draft: Definition, change: (value: Definition) => void, capabilityId?: string, data?: Snapshot) {
  const [removing, setRemoving] = useState<string | null>(null)
  const [undo, setUndo] = useState<{ before: Definition; after: string; name: string } | null>(null)
  const canUndo = undo && undo.after === compositionKey(draft)
  const feedback = canUndo ? <div className={s.compositionFeedback} role="status"><span>已移除 {undo.name} 的关联。</span><button className={s.button} onClick={() => { change({ ...draft, components: undo.before.components, excludedDependencies: undo.before.excludedDependencies, componentOrder: undo.before.componentOrder }); setUndo(null) }}>撤销移除</button></div> : null
  const request = (id: string) => setRemoving(id)
  const dialog = removing ? <RemoveAssociationDialog id={removing} draft={draft} capabilityId={capabilityId} data={data} onClose={() => setRemoving(null)} onConfirm={() => {
    const next = removeAssociation(draft, removing,data?.components)
    setUndo({ before: structuredClone(draft), after: compositionKey(next), name: associationName(removing,data?.components) })
    change(next); setRemoving(null)
  }}/> : null
  return { request, dialog, feedback }
}
function RemoveAssociationDialog({ id, draft, capabilityId, data, onClose, onConfirm }: { data?: Snapshot; id: string; draft: Definition; capabilityId?: string; onClose: () => void; onConfirm: () => void }) {
  const users = dependencyUsers(draft, id,data?.components), required = users.length > 0 || requiredComponents(capabilityId,data?.components).some(c => c.id === id)
  const part = draft.components.find(p => p.componentId === id)
  const actions = [...new Set(users.length ? draft.components.filter(p => users.some(c => c.id === p.componentId)).flatMap(p => p.actions) : part?.actions ?? [])]
  return <Modal title={`移除 ${associationName(id,data?.components)} 组件关联？`} closeLabel="取消移除关联" onClose={onClose}><div className={`${s.page} ${s.dialogBody}`}>
    <p>当前能力：<strong>{draft.name || '未命名能力'}</strong></p>
    <div className={s.removalImpact}>{required ? <><p><strong>{users.length ? '必需支持组件' : '必需组件'}</strong> · {users.length ? users.map(c => c.name).join('、') : '当前能力的执行流程'}需要此组件。</p><p>移除后，当前草稿将缺少必需依赖。可以保存草稿，补回后才能发布。</p></> : <p>将从当前草稿移除此业务组件，其不再使用的自动关联也会一并解除。</p>}
      <p>涉及动作：{actions.map(a => actionNames[a]).join('、') || '无已选动作'}</p>
    </div>
    <p className={s.muted}>本次只修改当前能力草稿。共享插件不会卸载，其他能力、已发布版本和当前会话保持原状。</p>
    <p className={s.muted}>服务配置、凭据和历史处理结果（包括录音、转写及纪要）均保留。</p>
    <div className={s.confirmActions}><button className={s.button} onClick={onClose}>取消</button><button className={`${s.button} ${s.dangerButton}`} onClick={onConfirm}>移除关联</button></div>
  </div></Modal>
}
export function MissingAssociations({ draft, change, capabilityId, data, disabled = false }: { data?: Snapshot; draft: Definition; capabilityId?: string; change: (value: Definition) => void; disabled?: boolean }) {
  const missing = missingAssociations(draft, capabilityId,data?.components)
  return missing.length ? <div className={s.missingAssociations} role="status"><strong>草稿缺少 {missing.length} 个必需组件，暂时无法发布</strong>{missing.map(id => <div className={s.missingRow} key={id}><span>{associationName(id,data?.components)}<small> · {dependencyUsers(draft, id,data?.components).map(c => c.name).join('、') || '当前能力'}需要</small></span><button className={s.button} disabled={disabled} onClick={() => change(addAssociation(draft, id,data?.components))}>补回 {associationName(id,data?.components)}</button></div>)}</div> : null
}
export function SupportInspector({ id, draft, data, change }: { id: string; draft: Definition; data: Snapshot; change: (value: Definition) => void }) {
  const users = dependencyUsers(draft, id,data?.components), status = data.dependencies?.find(d => d.id === id)
  const missing = missingDependencies(draft,data?.components).includes(id)
  return <><h3>{dependencyName(id)}</h3><p className={s.muted}>{id}</p><p>必需支持组件</p><p>当前系统：{status?.loaded ? '已加载' : status?.installed ? '已安装，未加载' : status ? '未安装' : '尚未检测'}</p><p>当前能力：{!users.length ? '尚无业务组件需要' : missing ? '缺少关联' : '已关联'}</p><p>由{users.map(c => c.name).join('、') || '对应业务组件'}使用。</p>{users.length > 0 && missing && <button className={s.button} onClick={() => change(addAssociation(draft, id,data?.components))}>补回组件</button>}<p className={s.muted}>移除当前能力中的关联不会停用共享服务。展示顺序不代表执行顺序。</p></>
}

export function BusinessInspector({ component, draft, capabilityId, data, meetingStatus, requirementsStatus, onConfigure, children }: { component: Component; draft: Definition; capabilityId?: string; data: Snapshot; meetingStatus?: MeetingAvailability | null; requirementsStatus?: RequirementAvailability | null; onConfigure?: () => void; children?: React.ReactNode }) {
  const part = draft.components.find(p => p.componentId === component.id), info = componentService(component, { data, meetingStatus, requirementsStatus })
  return <><h3>{component.name}</h3><p className={s.muted}>{component.sourceLabel} · v{component.version}</p><p>{info.description}</p>
    {requiredComponents(capabilityId,data?.components).some(c => c.id === component.id) && <p className={s.notice}>必需组件 · 可从草稿移除，补回组件并选择动作后才能发布。</p>}
    {children ?? <p>当前动作：{part?.actions.map(a => actionNames[a]).join('、') || '未选择动作'}</p>}
    {component.dependencies.length > 0 && <><h4>依赖要求</h4><ul className={s.list}>{component.dependencies.map(dep => <li key={dep}>{dependencyName(dep)} · {dep.startsWith('@') ? missingDependencies(draft,data?.components).includes(dep) ? '缺少关联' : part ? '已关联' : '待添加' : '运行环境'}</li>)}</ul><p className={s.muted}>添加业务组件时自动关联支持组件；缺少必需组件的草稿暂时无法发布。</p></>}
    <p className={s.muted}>组件展示顺序不代表执行顺序。配置状态与草稿完整性分别检查。</p>
    <ComponentEnvironment component={component} data={data} meetingStatus={meetingStatus} requirementsStatus={requirementsStatus} onConfigure={onConfigure}/>
  </>
}

export function ComponentRelations({ data, capabilityId, onEdit, meetingStatus, requirementsStatus, onConfigure }: { data: Snapshot; capabilityId: string; onEdit: () => void; meetingStatus?: MeetingAvailability | null; requirementsStatus?: RequirementAvailability | null; onConfigure?: () => void }) {
  const cap = data.state.capabilities.find(c => c.id === capabilityId)!
  const { draft, change, dirty, revision, discard } = useCapabilityDefinition(capabilityId, data)
  const edit = useAssociationEditing(draft, change, capabilityId,data)
  const [inspecting, setInspecting] = useState<Component | null>(null)
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [discarding, setDiscarding] = useState(false)
  const save = async () => {
    setBusy(true); setMessage('')
    try { await capabilityClient.command({ type: 'capability.save', id: capabilityId, definition: draft, publish: false }, revision); discard(); setMessage('草稿已保存。已发布版本保持原状。') }
    catch (error) { setMessage(error instanceof Error ? error.message : String(error)) }
    finally { setBusy(false) }
  }
  const referenced = data.state.roles.filter(r => r.draft.capabilities.some(b => b.capabilityId === capabilityId) || r.versions.at(-1)?.capabilities.some(b => b.capabilityId === capabilityId))
  const disabled = busy || !!cap.removedAt || !compositionSupported(data, capabilityId)
  const statusMessage = dirty && message === '草稿已保存。已发布版本保持原状。' ? '有未保存的组件修改' : message || '有未保存的组件修改'
  return <section aria-label="关联组件组合">
    {!compositionSupported(data, capabilityId) && <p className={s.notice} role="status">组件组合服务待更新。请保存当前工作并正常重启工作台后编辑，避免旧服务忽略新的关联配置。</p>}
    <div className={s.heading}><div><h3>当前组件组合</h3><small className={s.muted}>草稿 · {compositionIds(draft,data?.components).length} 个关联 · {referenced.length} 个岗位引用</small></div><button className={s.button} disabled={disabled} onClick={onEdit}>编辑组件组合</button><button className={s.button} onClick={()=>openCapabilityLink({section:'component-center',componentId:draft.components[0]?.componentId})}>管理组件库 ↗</button></div>
    <p className={s.muted}>拖入和排序可在组合编辑器中完成。移除关联只修改当前能力草稿。</p>
    <fieldset className={s.compositionFieldset} disabled={disabled}>
      {edit.feedback}<MissingAssociations draft={draft} change={change} capabilityId={capabilityId} data={data} disabled={disabled}/>
      {compositionItems(draft, capabilityId, data).map(item => {
        const business = data.components.find(c => c.id === item.id), status = data.dependencies?.find(d => d.id === (business?.provider ?? item.id))
        const info = business && componentService(business, { data, meetingStatus, requirementsStatus })
        const required = requiredComponents(capabilityId,data?.components).some(c => c.id === item.id)
        return <div className={s.associationRow} key={item.id} data-association={item.id}><div className={s.associationIdentity}><CapabilityGlyph kind={item.icon}/><div><strong>{item.name}</strong><span className={s.badge}>{business ? required ? '必需组件' : '业务组件' : '必需支持'}</span><small>{business ? `${business.sourceLabel} · v${business.version}` : item.id}</small><small>{item.subtitle}</small><small>{info?.status ?? `${status?.pendingRestart ? '待重启' : status?.loaded ? '系统已加载' : status?.installed ? '系统已安装' : status ? '系统未安装' : '状态待检测'}${status?.version ? ` · ${status.version}` : ''}`}</small></div></div><div className={s.associationActions}><button className={s.button} onClick={() => business && !business.pluginModule ? setInspecting(business) : openCapabilityLink({ section: 'plugins', moduleName: business?.pluginModule ?? item.id, capabilityId })}>{business && !business.pluginModule ? '查看详情' : '查看组件 ↗'}</button>{info?.configuration && onConfigure && <button className={s.button} onClick={onConfigure}>{info.configuration}</button>}<button className={`${s.iconButton} ${s.removeAction}`} title={`移除关联：${item.name}`} aria-label={`移除关联：${item.name}`} onClick={() => edit.request(item.id)}><CapabilityActionIcon kind="remove"/></button></div></div>
      })}
      {!draft.components.length && <p className={s.empty}>当前草稿没有业务组件。打开组合编辑器，拖入组件开始组合。</p>}
    </fieldset>
    {(dirty || message) && <div className={s.compositionToolbar}><span role="status">{statusMessage}</span>{dirty && <div className={s.actions}><button className={s.button} disabled={disabled} onClick={() => setDiscarding(true)}>放弃修改</button><button className={`${s.button} ${s.primary}`} disabled={disabled} onClick={() => void save()}>{busy ? '保存中…' : '保存草稿'}</button></div>}</div>}
    {dirty && revision !== data.state.revision && <p className={s.error}>配置已在其他页面变化。当前草稿保留；请在组合编辑器核对最新配置后再保存。</p>}
    {availableComponents(capabilityId,data?.components).filter((c, i, all) => all.findIndex(other => other.management === c.management) === i).map(component => <ComponentEnvironment key={component.id} component={component} data={data} meetingStatus={meetingStatus} requirementsStatus={requirementsStatus} onConfigure={onConfigure} disabled={!!cap.removedAt}/>)}
    {inspecting && <Modal title="组件详情" closeLabel="关闭组件详情" onClose={() => setInspecting(null)}><div className={`${s.page} ${s.dialogBody}`}><BusinessInspector component={inspecting} draft={draft} capabilityId={capabilityId} data={data} meetingStatus={meetingStatus} requirementsStatus={requirementsStatus} onConfigure={onConfigure ? () => { setInspecting(null); onConfigure() } : undefined}/></div></Modal>}
    {edit.dialog}
    {discarding && <Modal title="放弃本次组件修改？" closeLabel="继续编辑" onClose={() => setDiscarding(false)}><div className={`${s.page} ${s.dialogBody}`}><p>将恢复至上次保存的能力草稿，包括本次未保存的名称、说明和组件调整。</p><div className={s.confirmActions}><button className={s.button} onClick={() => setDiscarding(false)}>继续编辑</button><button className={s.button} onClick={() => { discard(); setMessage(''); setDiscarding(false) }}>放弃修改</button></div></div></Modal>}
  </section>
}
