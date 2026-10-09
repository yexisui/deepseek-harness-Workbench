import React, { useEffect, useState } from 'react'
import { capabilityDeletionReferences, type Snapshot } from '../../../dsh-capabilities/src/core/model.ts'
import { capabilityClient, editorDrafts } from './capability-client.ts'
import { CapabilityActionIcon, ManagedCapabilityCard } from './ManagedCapabilityCards.tsx'
import { CapabilitySelection } from './CapabilitySelection.tsx'
import { Modal } from './PreviewModal.tsx'
import s from './ManagedCapabilities.module.css'

function DeleteCapabilitiesDialog({ data, ids, emptying, onClose, onDeleted }: { data: Snapshot; ids: string[]; emptying: boolean; onClose: () => void; onDeleted: (ids: string[], protectedCount: number) => void }) {
  const [revision, setRevision] = useState(data.state.revision), [busy, setBusy] = useState(false), [error, setError] = useState('')
  // 固定打开确认框时的目标集合；后续刷新不能悄悄扩大清空范围。
  const candidates = data.state.capabilities.filter(c => ids.includes(c.id) && c.removedAt)
  const protectedItems = candidates.map(cap => ({ cap, roles: capabilityDeletionReferences(data.state, cap.id) })).filter(x => x.roles.length)
  const eligible = candidates.filter(c => !protectedItems.some(x => x.cap.id === c.id))
  const changed = revision !== data.state.revision
  const purge = async () => {
    setBusy(true); setError('')
    const deleting = eligible.map(c => c.id)
    try {
      await capabilityClient.command({ type: 'capability.purge', ids: deleting }, revision)
      deleting.forEach(id => editorDrafts.delete(`capability:${id}`))
      onDeleted(deleting, protectedItems.length)
    } catch (error) { setError(error instanceof Error ? error.message : String(error)) }
    finally { setBusy(false) }
  }
  return <Modal title={emptying ? '清空回收站' : '永久删除能力'} closeLabel="取消永久删除" onClose={() => { if (!busy) onClose() }}><div className={`${s.page} ${s.dialogBody}`}>
    <p className={s.notice}>{emptying ? '清空范围为打开此窗口时回收站中的全部能力，包含搜索结果之外的项目。' : '仅处理本次选中的能力。'}可永久删除 <strong>{eligible.length}</strong> 项，保留 <strong>{protectedItems.length}</strong> 项。</p>
    {eligible.length > 0 && <><p>以下能力的设置将永久删除，<strong>无法通过回收站恢复</strong>：</p><ul className={`${s.list} ${s.deleteList}`}>{eligible.map(c => <li key={c.id}>{c.draft.name}</li>)}</ul></>}
    {protectedItems.length > 0 && <div className={s.removalImpact}><strong>以下能力有引用，将继续保留</strong><ul className={`${s.list} ${s.deleteList}`}>{protectedItems.map(({ cap, roles }) => <li key={cap.id}><strong>{cap.draft.name}</strong><br/><span className={s.muted}>当前使用岗位：{roles.map(r => r.draft.name).join('、')}</span></li>)}</ul><p className={s.muted}>先从以上岗位移除该能力，即可删除。</p></div>}
    {!candidates.length && <p>这些能力已不在回收站中，请关闭后刷新列表。</p>}
    {error && <p role="alert" className={s.error}>{error}</p>}
    {changed && <p role="status" className={s.notice}>配置已有更新，请重新核对以上范围。<button className={s.button} disabled={busy} onClick={() => { setRevision(data.state.revision); setError('') }}>已核对，更新操作基准</button></p>}
    <div className={s.confirmActions}><button className={s.button} disabled={busy} onClick={onClose}>取消</button><button className={`${s.button} ${s.dangerButton}`} disabled={busy || changed || !eligible.length} onClick={() => void purge()}>{busy ? '正在删除…' : `永久删除 ${eligible.length} 项`}</button></div>
  </div></Modal>
}

export function ManagedRecycleBin({ data, query, onInspect, onNotice }: { data: Snapshot; query: string; onInspect: (id: string) => void; onNotice: (message: string) => void }) {
  const [checked, setChecked] = useState<string[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [deleting, setDeleting] = useState<{ ids: string[]; emptying: boolean } | null>(null)
  const removed = data.state.capabilities.filter(c => c.removedAt).sort((a, b) => b.removedAt!.localeCompare(a.removedAt!))
  const visible = removed.filter(c => `${c.draft.name} ${c.draft.description}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  // 搜索切换后只对当前结果的勾选项操作，恢复或外部删除后自动剔除失效选择。
  const selected = checked.filter(id => visible.some(c => c.id === id)), all = visible.length > 0 && selected.length === visible.length
  useEffect(() => { setChecked([]) }, [query])
  const toggle = (id: string) => setChecked(selected.includes(id) ? selected.filter(value => value !== id) : [...selected, id])
  const restore = async (ids: string[]) => {
    setBusy(true); setError('')
    try { await capabilityClient.command({ type: 'capability.restoreMany', ids }, data.state.revision); setChecked(current => current.filter(id => !ids.includes(id))); onNotice(`已恢复 ${ids.length} 项能力，当前保持停用。可在“全部”中检查并启用。`) }
    catch (error) { setError(error instanceof Error ? error.message : String(error)) }
    finally { setBusy(false) }
  }
  return <div data-recycle-bin>
    <p className={s.muted}>移除的能力保存在回收站中。恢复后保持停用；永久删除后无法恢复。</p>
    {removed.length > 0 && <div className={s.recycleToolbar} role="group" aria-label="回收站批量操作">
      <div className={s.selectionSummary}><CapabilitySelection checked={all} mixed={selected.length > 0 && !all} disabled={busy || !visible.length} label={query.trim() ? '全选当前搜索结果' : '全选回收站能力'} onChange={() => setChecked(all ? [] : visible.map(c => c.id))}/><span>{query.trim() ? '全选结果' : '全选'}</span><span className={s.muted}>已选 {selected.length} / {visible.length} 项</span></div>
      <div className={s.actions}><button className={`${s.button} ${s.inlineAction}`} disabled={busy || !selected.length} onClick={() => void restore(selected)}><CapabilityActionIcon kind="restore"/>恢复选中</button><button className={s.button} disabled={busy || !selected.length} onClick={() => setDeleting({ ids: selected, emptying: false })}>删除选中</button><button className={`${s.button} ${s.inlineAction}`} disabled={busy} onClick={() => setDeleting({ ids: removed.map(c => c.id), emptying: true })}><CapabilityActionIcon kind="remove"/>清空回收站</button></div>
    </div>}
    {error && <p role="alert" className={s.error}>{error}</p>}
    <div className={s.grid}>{visible.map(c => <ManagedCapabilityCard key={c.id} capability={c} data={data} busy={busy} onManage={() => onInspect(c.id)} onPin={() => {}} onRemove={() => {}} onRestore={() => void restore([c.id])} onPurge={() => setDeleting({ ids: [c.id], emptying: false })} selection={{ checked: selected.includes(c.id), onChange: () => toggle(c.id) }}/>)}</div>
    {!visible.length && <div className={s.empty}><CapabilityActionIcon kind="remove"/><p>{removed.length ? '回收站中没有匹配的能力。' : '回收站为空'}</p><span className={s.muted}>{removed.length ? '试试其他名称或清除搜索条件。' : '移除的能力会显示在这里。'}</span></div>}
    {deleting && <DeleteCapabilitiesDialog data={data} ids={deleting.ids} emptying={deleting.emptying} onClose={() => setDeleting(null)} onDeleted={(ids, protectedCount) => { setDeleting(null); setChecked(current => current.filter(id => !ids.includes(id))); onNotice(`已永久删除 ${ids.length} 项能力${protectedCount ? `，${protectedCount} 项因当前岗位使用而保留` : ''}。`) }}/>}
  </div>
}
