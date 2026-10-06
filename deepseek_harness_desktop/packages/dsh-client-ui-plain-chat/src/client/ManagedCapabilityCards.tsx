import React, { useState } from 'react'
import { capabilityDeletionReferences, latest, type Capability, type Snapshot } from '../../../dsh-capabilities/src/core/model.ts'
import { MEETING_CAPABILITY_ID } from '../../../dsh-capabilities/src/core/default-roles.ts'
import { DEVELOPER_CAPABILITY_ID } from '../../../dsh-capabilities/src/core/developer-model.ts'
import { REQUIREMENTS_CAPABILITY_ID, type RequirementAvailability } from '../../../dsh-capabilities/src/core/requirements-model.ts'
import type { MeetingAvailability } from './meeting-capability-status.ts'
import { capabilityClient } from './capability-client.ts'
import { CapabilityGlyph } from './ManagedWorkbench.tsx'
import { capabilityPresentation } from './capability-presentation.ts'
import { CapabilitySelection } from './CapabilitySelection.tsx'
import { Modal } from './PreviewModal.tsx'
import s from './ManagedCapabilities.module.css'

export function CapabilityActionIcon({ kind }: { kind: 'pin' | 'remove' | 'restore' | 'settings' }) {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === 'settings' ? <><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="var(--role-bg)"/><circle cx="15" cy="17" r="3" fill="var(--role-bg)"/></> : kind === 'pin' ? <><path d="M16 3 21 8l-4 1-3 5v3l-7-7h3l5-3z"/><path d="m3 21 7-7"/></> : kind === 'remove' ? <><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></> : <><path d="M3 4v6h6M3 10a9 9 0 1 1 1 8"/></>}
  </svg>
}

export function capabilityImpact(data: Snapshot, id: string) {
  const roles = data.state.roles.filter(r => r.draft.capabilities.some(b => b.capabilityId === id) || latest(r.versions)?.capabilities.some(b => b.capabilityId === id))
  // 活动会话采用历史岗位快照；不能只按岗位当前草稿推算影响。
  const tasks = data.tasks.filter(t => t.status !== 'stopped' && data.state.roles.find(r => r.id === t.roleId)?.versions.find(v => v.version === t.roleVersion)?.capabilities.some(b => b.enabled && b.capabilityId === id))
  const componentIds = new Set(data.state.capabilities.find(c=>c.id===id)?.versions.flatMap(v=>v.components.map(p=>p.componentId)) ?? [])
  for (const activity of data.componentActivities ?? []) if(activity.kind==='package'&&!activity.roleId&&activity.componentIds.some(component=>componentIds.has(component))) tasks.push({sessionId:activity.id,roleId:'',roleVersion:0,name:activity.name,status:activity.status==='stopping'?'stopping':'running',browserSessions:[]})
  return { roles, tasks }
}

export function ManagedCapabilityCard({ capability: c, data, busy, onManage, onPin, onRemove, onRestore, onPurge, selection, meetingStatus, requirementsStatus }: { capability: Capability; data: Snapshot; busy: boolean; onManage: () => void; onPin: () => void; onRemove: () => void; onRestore: () => void; onPurge?: () => void; selection?: { checked: boolean; onChange: () => void }; meetingStatus?: MeetingAvailability | null; requirementsStatus?: RequirementAvailability | null }) {
  const presentation = capabilityPresentation(data, c, latest(c.versions), meetingStatus, requirementsStatus), status = presentation.label
  const pinLabel = `${c.pinned ? '取消收藏' : '收藏能力'}：${c.draft.name}`
  return <article className={`${s.card} ${c.pinned && !c.removedAt ? s.pinnedCard : ''} ${selection?.checked ? s.selectedCard : ''}`} data-managed-capability={c.id} data-selected={selection?.checked} onClick={event => { if (selection && !busy && !(event.target as HTMLElement).closest('button,input,label')) selection.onChange() }}>
    <div className={s.cardTop}><CapabilityGlyph kind={presentation.icon}/><span className={s.cardSource}>{c.source === 'builtin' ? '内置能力' : '我的能力'}</span>{selection && <CapabilitySelection checked={selection.checked} disabled={busy} label={`选择能力：${c.draft.name}`} onChange={selection.onChange}/>} {!c.removedAt && <button className={`${s.iconButton} ${c.pinned ? s.pinned : ''}`} type="button" disabled={busy} aria-label={pinLabel} title={pinLabel} aria-pressed={c.pinned} onClick={onPin}><CapabilityActionIcon kind="pin"/></button>}</div>
    <h3>{c.draft.name}</h3><p className={s.cardDescription}>{c.draft.description || '尚未填写能力简介'}</p>
    <div className={s.cardMeta}><span className={s.badge} title={presentation.message}>{status}</span><span>{capabilityImpact(data, c.id).roles.length} 个岗位引用</span>{c.pinned && !c.removedAt && <span className={s.pinLabel}>已收藏</span>}</div>
    {c.removedAt && <div className={s.cardMeta}><span>移除于 {new Date(c.removedAt).toLocaleString()}</span>{capabilityDeletionReferences(data.state, c.id).length > 0 && <span className={s.badge} title="岗位配置或历史版本仍在引用，清空回收站时会保留">引用保护</span>}</div>}
    <div className={s.cardFooter}><button className={s.button} onClick={onManage}>{c.removedAt ? '查看配置 →' : '管理能力 →'}</button>{c.removedAt ? <div className={s.actions}><button className={`${s.button} ${s.inlineAction}`} disabled={busy} aria-label={`恢复能力：${c.draft.name}`} onClick={onRestore}><CapabilityActionIcon kind="restore"/>恢复</button>{onPurge && <button className={`${s.iconButton} ${s.removeAction}`} disabled={busy} aria-label={`永久删除能力：${c.draft.name}`} title={`永久删除能力：${c.draft.name}`} onClick={onPurge}><CapabilityActionIcon kind="remove"/></button>}</div> : <button className={`${s.iconButton} ${s.removeAction}`} disabled={busy} aria-label={`移除能力：${c.draft.name}`} title={`移除能力：${c.draft.name}`} onClick={onRemove}><CapabilityActionIcon kind="remove"/></button>}</div>
  </article>
}

export function RemoveCapabilityDialog({ data, id, onClose, onRemoved }: { data: Snapshot; id: string; onClose: () => void; onRemoved: () => void }) {
  const cap = data.state.capabilities.find(c => c.id === id), { roles, tasks } = capabilityImpact(data, id)
  const [revision, setRevision] = useState(data.state.revision), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const changed = revision !== data.state.revision
  const remove = async () => {
    setBusy(true); setError('')
    try { await capabilityClient.command({ type: 'capability.remove', id }, revision); onRemoved() }
    catch (error) { setError(error instanceof Error ? error.message : String(error)) }
    finally { setBusy(false) }
  }
  if (!cap) return <Modal title="能力已不存在" closeLabel="取消移除" onClose={onClose}><div className={`${s.page} ${s.dialogBody}`}><p role="status">此能力已被其他页面永久删除。关闭后可继续管理其他能力。</p><div className={s.confirmActions}><button className={s.button} onClick={onClose}>关闭</button></div></div></Modal>
  return <Modal title="移除能力" closeLabel="取消移除" onClose={() => { if (!busy) onClose() }}><div className={`${s.page} ${s.dialogBody}`}>
    <p>将「<strong>{cap.draft.name}</strong>」移入回收站。</p>
    <p className={s.notice}>移除后停止提供此能力，不能再添加到岗位。配置、历史版本和已有岗位引用会保留，可在“回收站”中恢复；恢复后需要手动启用。</p>
    <div className={s.removalImpact}><strong>{roles.length} 个岗位引用 · {tasks.length} 个活动会话</strong>{roles.length > 0 && <ul className={s.list}>{roles.map(r => <li key={r.id}>{r.draft.name}</li>)}</ul>}<p className={s.muted}>{cap.packageOrigin ? '移除后将停止此能力的执行任务并撤销后续调用；构建版本、岗位引用与结果记录保留。' : cap.id === DEVELOPER_CAPABILITY_ID ? '移除后将阻止开发任务后续执行，已有代码、任务和验证记录保留。' : cap.id === REQUIREMENTS_CAPABILITY_ID ? '移除后将阻止新建需求分析和继续调用模型；已保存的需求记录与确认版本仍保留。' : cap.id === MEETING_CAPABILITY_ID ? '移除后将无法新建或继续处理会议录音；已有会议记录仍保留。' : tasks.length ? '相关会话的后续调用将被阻止，并请求停止其浏览器任务。' : '没有相关的活动会话。'}共享插件及其他能力保持不变。</p></div>
    {error && <p role="alert" className={s.error}>{error}</p>}
    {changed && <p role="status" className={s.notice}>配置已有更新，请核对上方引用范围。<button className={s.button} disabled={busy} onClick={() => { setRevision(data.state.revision); setError('') }}>已核对，更新操作基准</button></p>}
    <div className={s.confirmActions}><button className={s.button} disabled={busy} onClick={onClose}>取消</button><button className={`${s.button} ${s.dangerButton}`} disabled={busy || changed} onClick={() => void remove()}>{busy ? '正在移除…' : '确认移除'}</button></div>
  </div></Modal>
}
