import React, { useState } from 'react'
import { latest, type Capability, type Snapshot } from '../../../dsh-capabilities/src/core/model.ts'
import { capabilityClient } from './capability-client.ts'
import { CapabilityGlyph } from './ManagedWorkbench.tsx'
import { Modal } from './PreviewModal.tsx'
import s from './ManagedCapabilities.module.css'

export function CapabilityActionIcon({ kind }: { kind: 'pin' | 'remove' | 'restore' }) {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === 'pin' ? <><path d="M16 3 21 8l-4 1-3 5v3l-7-7h3l5-3z"/><path d="m3 21 7-7"/></> : kind === 'remove' ? <><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></> : <><path d="M3 4v6h6M3 10a9 9 0 1 1 1 8"/></>}
  </svg>
}

export function capabilityImpact(data: Snapshot, id: string) {
  const roles = data.state.roles.filter(r => r.draft.capabilities.some(b => b.capabilityId === id) || latest(r.versions)?.capabilities.some(b => b.capabilityId === id))
  // 活动会话采用历史岗位快照；不能只按岗位当前草稿推算影响。
  const tasks = data.tasks.filter(t => t.status !== 'stopped' && data.state.roles.find(r => r.id === t.roleId)?.versions.find(v => v.version === t.roleVersion)?.capabilities.some(b => b.enabled && b.capabilityId === id))
  return { roles, tasks }
}

export function ManagedCapabilityCard({ capability: c, data, busy, onManage, onPin, onRemove, onRestore }: { capability: Capability; data: Snapshot; busy: boolean; onManage: () => void; onPin: () => void; onRemove: () => void; onRestore: () => void }) {
  const status = c.removedAt ? '已移除' : !c.enabled ? '已停用' : !c.versions.length ? '草稿' : data.health.state === 'ready' ? '可使用' : '待连接'
  const pinLabel = `${c.pinned ? '取消置顶' : '置顶能力'}：${c.draft.name}`
  return <article className={`${s.card} ${c.pinned && !c.removedAt ? s.pinnedCard : ''}`} data-managed-capability={c.id}>
    <div className={s.cardTop}><CapabilityGlyph/><span className={s.cardSource}>{c.source === 'builtin' ? '内置能力' : '我的能力'}</span>{!c.removedAt && <button className={`${s.iconButton} ${c.pinned ? s.pinned : ''}`} type="button" disabled={busy} aria-label={pinLabel} title={pinLabel} aria-pressed={c.pinned} onClick={onPin}><CapabilityActionIcon kind="pin"/></button>}</div>
    <h3>{c.draft.name}</h3><p className={s.cardDescription}>{c.draft.description || '尚未填写能力简介'}</p>
    <div className={s.cardMeta}><span className={s.badge}>{status}</span><span>{capabilityImpact(data, c.id).roles.length} 个岗位引用</span>{c.pinned && !c.removedAt && <span className={s.pinLabel}>已置顶</span>}</div>
    <div className={s.cardFooter}><button className={s.button} onClick={onManage}>{c.removedAt ? '查看配置 →' : '管理能力 →'}</button>{c.removedAt ? <button className={`${s.button} ${s.inlineAction}`} disabled={busy} aria-label={`恢复能力：${c.draft.name}`} onClick={onRestore}><CapabilityActionIcon kind="restore"/>恢复</button> : <button className={`${s.inlineAction} ${s.removeAction}`} disabled={busy} aria-label={`移除能力：${c.draft.name}`} onClick={onRemove}><CapabilityActionIcon kind="remove"/>移除</button>}</div>
  </article>
}

export function RemoveCapabilityDialog({ data, id, onClose, onRemoved }: { data: Snapshot; id: string; onClose: () => void; onRemoved: () => void }) {
  const cap = data.state.capabilities.find(c => c.id === id)!, { roles, tasks } = capabilityImpact(data, id)
  const [revision, setRevision] = useState(data.state.revision), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const changed = revision !== data.state.revision
  const remove = async () => {
    setBusy(true); setError('')
    try { await capabilityClient.command({ type: 'capability.remove', id }, revision); onRemoved() }
    catch (error) { setError(error instanceof Error ? error.message : String(error)) }
    finally { setBusy(false) }
  }
  return <Modal title="移除能力" closeLabel="取消移除" onClose={() => { if (!busy) onClose() }}><div className={`${s.page} ${s.dialogBody}`}>
    <p>将「<strong>{cap.draft.name}</strong>」移入已移除列表。</p>
    <p className={s.notice}>移除后停止提供此能力，不能再添加到岗位。配置、历史版本和已有岗位引用会保留，可在“已移除”中恢复；恢复后需要手动启用。</p>
    <div className={s.removalImpact}><strong>{roles.length} 个岗位引用 · {tasks.length} 个活动会话</strong>{roles.length > 0 && <ul className={s.list}>{roles.map(r => <li key={r.id}>{r.draft.name}</li>)}</ul>}<p className={s.muted}>{tasks.length ? '相关会话的后续调用将被阻止，并请求停止其浏览器任务。' : '没有相关的活动会话。'}共享插件及其他能力保持不变。</p></div>
    {error && <p role="alert" className={s.error}>{error}</p>}
    {changed && <p role="status" className={s.notice}>配置已有更新，请核对上方引用范围。<button className={s.button} disabled={busy} onClick={() => { setRevision(data.state.revision); setError('') }}>已核对，更新操作基准</button></p>}
    <div className={s.confirmActions}><button className={s.button} disabled={busy} onClick={onClose}>取消</button><button className={`${s.button} ${s.dangerButton}`} disabled={busy || changed} onClick={() => void remove()}>{busy ? '正在移除…' : '确认移除'}</button></div>
  </div></Modal>
}
