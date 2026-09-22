import React, { useEffect, useState } from 'react'
import { actionsOf, actionNames, emptyRole, latest, resolveBinding, type RoleDefinition } from '../../../dsh-capabilities/src/core/model.ts'
import { capabilityClient, editorDrafts, useCapabilities } from './capability-client.ts'
import { ActionFields, ManagedCenter } from './ManagedCenter.tsx'
import { CapabilityGlyph, ManagedWorkbench } from './ManagedWorkbench.tsx'
import { Modal } from './PreviewModal.tsx'
import type { ChatKey } from './locales.ts'
import s from './ManagedCapabilities.module.css'
import r from './Roles.module.css'

export function ManagedRoleEditor({ id, onClose }: { id?: string; onClose: () => void }) {
  const { data } = useCapabilities()
  useEffect(() => {
    const navigate = (event: Event) => { if ((event as CustomEvent).detail?.section === 'plugins') onClose() }
    window.addEventListener('workbench-capability-link', navigate)
    return () => window.removeEventListener('workbench-capability-link', navigate)
  }, [onClose])
  return <Modal title={id ? '编辑岗位助手' : '创建岗位助手'} closeLabel="关闭岗位编辑" onClose={onClose} wide>{data ? <RoleForm key={id ?? 'new'} id={id} onClose={onClose}/> : <p>正在读取岗位…</p>}</Modal>
}
function RoleForm({ id, onClose }: { id?: string; onClose: () => void }) {
  const { data } = useCapabilities(), state = data!.state, role = state.roles.find(r => r.id === id), key = `role:${id ?? 'new'}`, cached = editorDrafts.get(key)
  const [draft, setDraft] = useState<RoleDefinition>(() => structuredClone(cached?.value as RoleDefinition ?? role?.draft ?? emptyRole()))
  const [revision, setRevision] = useState(cached?.revision ?? state.revision), [selected, setSelected] = useState<string | null>(draft.capabilities[0]?.capabilityId ?? null)
  const [center, setCenter] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [review, setReview] = useState(false)
  const change = (value: RoleDefinition) => { setDraft(value); editorDrafts.set(key, { value: structuredClone(value), revision }) }
  const binding = draft.capabilities.find(b => b.capabilityId === selected), cap = state.capabilities.find(c => c.id === selected), version = binding && resolveBinding(state, binding)
  const updateBinding = (patch: Partial<RoleDefinition['capabilities'][number]>) => change({ ...draft, capabilities: draft.capabilities.map(b => b.capabilityId === selected ? { ...b, ...patch } : b) })
  const save = async (publish: boolean) => {
    setBusy(true); setError('')
    try { await capabilityClient.command({ type: 'role.save', id, definition: draft, publish }, revision); editorDrafts.delete(key); onClose() }
    catch (error) { setError(error instanceof Error ? error.message : String(error)) }
    finally { setBusy(false) }
  }
  return <><ManagedWorkbench libraryTitle="能力配件库" title="岗位信息" selected={selected} onSelect={setSelected} onManage={() => setCenter(true)}
    library={state.capabilities.filter(c => c.versions.length).map(c => ({ id: c.id, name: c.draft.name, subtitle: `v${latest(c.versions)!.version} · ${c.enabled ? '已发布' : '已停用'}` }))}
    attached={draft.capabilities.map(b => { const c = state.capabilities.find(c => c.id === b.capabilityId); return { id: b.capabilityId, name: c?.draft.name ?? '能力缺失', subtitle: `v${b.version} · ${!b.enabled ? '岗位中停用' : !c?.enabled ? '能力已停用' : data!.health.state === 'ready' ? '可使用' : '待连接'}` } })}
    onAdd={capabilityId => { const c = state.capabilities.find(c => c.id === capabilityId), v = c && latest(c.versions); if (v && !draft.capabilities.some(b => b.capabilityId === capabilityId)) change({ ...draft, capabilities: [...draft.capabilities, { capabilityId, version: v.version, enabled: true }] }); setSelected(capabilityId) }}
    onRemove={capabilityId => change({ ...draft, capabilities: draft.capabilities.filter(b => b.capabilityId !== capabilityId) })}
    form={<div className={`${s.page} ${s.fields}`}><label className={s.field}>助手名称<input value={draft.name} maxLength={80} placeholder="例如：网页资料分析助手" onChange={e => change({ ...draft, name: e.target.value })}/></label><details><summary>外观与配色</summary><label className={s.field}>标识颜色<input type="color" value={draft.color} onChange={e => change({ ...draft, color: e.target.value })}/></label></details><label className={s.field}>岗位职责<textarea rows={4} maxLength={8000} value={draft.duties} onChange={e => change({ ...draft, duties: e.target.value })}/></label><details><summary>工作要求与输出格式</summary><div className={s.fields}><label className={s.field}>工作要求<textarea rows={3} maxLength={8000} value={draft.requirements} onChange={e => change({ ...draft, requirements: e.target.value })}/></label><label className={s.field}>输出格式<textarea rows={3} maxLength={4000} value={draft.format} onChange={e => change({ ...draft, format: e.target.value })}/></label></div></details>{role && <label className={s.field}>从历史版本恢复到草稿<select value="" onChange={e => { const v = role.versions.find(v => v.version === Number(e.target.value)); if (v) change(structuredClone(v)) }}><option value="">选择版本…</option>{role.versions.map(v => <option key={v.version} value={v.version}>v{v.version} · {v.name}</option>)}</select></label>}</div>}
    inspector={<div className={s.page}>{cap ? <><h3>{cap.draft.name}</h3><p className={s.muted}>{cap.draft.description}</p>{binding ? <><label className={s.check}><input type="checkbox" checked={binding.enabled} onChange={e => updateBinding({ enabled: e.target.checked })}/>在此岗位中启用</label><label className={s.field}>采用的能力版本<select value={binding.version} onChange={e => updateBinding({ version: Number(e.target.value), actions: undefined })}>{cap.versions.map(v => <option key={v.version} value={v.version}>v{v.version} · {v.createdAt.slice(0, 10)}</option>)}</select></label><label className={s.check}><input type="checkbox" checked={binding.actions !== undefined} onChange={e => updateBinding({ actions: e.target.checked ? actionsOf(version) : undefined })}/>为此岗位缩小动作范围</label>{binding.actions !== undefined ? <ActionFields value={binding.actions} available={actionsOf(version)} onChange={actions => updateBinding({ actions })}/> : <p className={s.muted}>继承该版本默认动作：{actionsOf(version).map(a => actionNames[a]).join('、')}</p>}<p className={s.notice}>{data!.health.message}</p></> : <p>先添加此能力，再设置岗位覆盖。</p>}<button className={s.button} onClick={() => setCenter(true)}>查看能力及关联组件 ↗</button></> : <p className={s.empty}>选择已添加的能力以调整设置。</p>}</div>}/>
    <div className={`${s.page} ${s.footer}`}><div>{error ? <p role="alert" className={s.error}>{error}</p> : <p>保存并发布后，新对话将采用这个岗位版本。</p>}{revision !== state.revision && <button className={s.button} onClick={() => setRevision(state.revision)}>保留草稿并更新保存基准</button>}</div><div className={s.actions}><button className={s.button} disabled={busy} onClick={() => void save(false)}>保存草稿</button><button className={`${s.button} ${s.primary}`} disabled={busy || !draft.name.trim()} onClick={() => setReview(true)}>保存并发布</button></div></div>
    {center && <Modal title="能力中心" closeLabel="返回岗位" onClose={() => setCenter(false)}><div className={`${s.page} ${s.dialogBody}`}><button className={s.button} onClick={() => setCenter(false)}>← 返回岗位，保留草稿</button><ManagedCenter embedded initialId={selected ?? undefined}/></div></Modal>}
    {review && <Modal title="发布岗位版本" closeLabel="返回编辑" onClose={() => setReview(false)}><div className={`${s.page} ${s.dialogBody}`}><p>{draft.name} · v{(latest(role?.versions ?? [])?.version ?? 0) + 1}</p><ul className={s.list}>{draft.capabilities.map(b => <li key={b.capabilityId}>{state.capabilities.find(c => c.id === b.capabilityId)?.draft.name} · v{b.version} · {b.enabled ? (b.actions ?? actionsOf(resolveBinding(state, b))).map(a => actionNames[a]).join('、') : '停用'}</li>)}</ul><p className={s.notice}>新增能力和放宽动作只由新对话采用。移除能力或缩小权限会立即限制旧会话，并停止受影响的浏览器任务。</p>{error && <p role="alert" className={s.error}>{error}</p>}<button className={`${s.button} ${s.primary}`} disabled={busy} onClick={() => void save(true)}>{busy ? '保存中…' : '确认发布'}</button></div></Modal>}
  </>
}
export function ManagedRolesSection({ selected, onSelect }: { selected: string; onSelect: (id: string) => void }) {
  const { data, error } = useCapabilities(), [editor, setEditor] = useState<{ id?: string } | null>(null), [message, setMessage] = useState('')
  return <section className={s.page}><div className={s.heading}><div><h2>岗位助手</h2><p className={s.muted}>为岗位装配能力，保存后从新对话中选择。</p></div><button className={`${s.button} ${s.primary}`} onClick={() => setEditor({})}>＋ 创建岗位助手</button></div>{(error || message) && <p role="alert" className={s.error}>{message || error}</p>}
    <div className={s.grid}>{data?.state.roles.map(role => <article className={s.card} key={role.id} style={{ borderTop: `3px solid ${role.draft.color}` }}><h3>{role.draft.name}</h3><p>{role.draft.duties}</p><span className={s.badge}>{role.enabled ? role.versions.length ? `已发布 v${latest(role.versions)!.version}` : '草稿' : '已停用'} · {role.draft.capabilities.length} 个能力 · {data?.tasks.filter(t => t.roleId === role.id && t.status !== 'stopped').length ?? 0} 个活动会话</span><div className={s.actions}><button className={s.button} onClick={() => setEditor({ id: role.id })}>编辑岗位</button><button className={s.button} disabled={!role.enabled || !role.versions.length} aria-pressed={selected === role.id} onClick={() => onSelect(role.id)}>{selected === role.id ? '已选择' : '用于新对话'}</button><button className={s.button} onClick={() => void capabilityClient.command({ type: 'role.toggle', id: role.id, enabled: !role.enabled }).catch(e => setMessage(e.message))}>{role.enabled ? '停用' : '启用'}</button></div></article>)}</div>{data && !data.state.roles.length && <p className={s.empty}>还没有保存的岗位助手。创建后即可装配浏览器能力。</p>}{editor && <ManagedRoleEditor id={editor.id} onClose={() => setEditor(null)}/>}</section>
}
export function ManagedRolePicker({ selected, onSelect, t }: { selected: string; onSelect: (id: string) => void; t: (key: ChatKey) => string }) {
  const { data } = useCapabilities(), [open, setOpen] = useState(false), [editor, setEditor] = useState(false)
  const role = data?.state.roles.find(r => r.id === selected)
  return <><button className={r.picker} aria-haspopup="dialog" onClick={() => setOpen(true)}><CapabilityGlyph/><span>{role?.draft.name ?? t('mode')}</span><span>⌄</span></button>{open && <Modal title="选择岗位助手" closeLabel="关闭" onClose={() => setOpen(false)}><div className={`${s.page} ${s.dialogBody}`}><button className={s.choice} aria-pressed={selected === 'chat'} onClick={() => { onSelect('chat'); setOpen(false) }}><span><strong>普通聊天</strong><small>问答与写作，不执行浏览器或项目工具。</small></span></button>{data?.state.roles.filter(r => r.enabled && r.versions.length).map(r => <button className={s.choice} key={r.id} aria-pressed={selected === r.id} onClick={() => { onSelect(r.id); setOpen(false) }}><CapabilityGlyph/><span><strong>{latest(r.versions)!.name}</strong><small>v{latest(r.versions)!.version} · {latest(r.versions)!.capabilities.length} 个能力</small></span></button>)}<button className={s.button} onClick={() => setEditor(true)}>＋ 创建岗位助手</button><p className={s.muted}>选择仅用于下一次新对话，当前对话的岗位不会改变。</p></div></Modal>}{editor && <ManagedRoleEditor onClose={() => setEditor(false)}/>}</>
}
export function ManagedCurrentAssistant({ selected, preset, onOpen }: { selected: string; preset?: string; onOpen: () => void }) {
  const { data } = useCapabilities()
  const historical = preset ? data?.state.roles.flatMap(r => r.versions).find(v => v.preset === preset) : undefined
  const name = preset ? historical?.name ?? (preset === 'workbench-chat' ? '普通聊天' : preset) : data?.state.roles.find(r => r.id === selected)?.draft.name ?? '普通聊天'
  return <button type="button" className={r.currentAssistant} onClick={onOpen}><CapabilityGlyph/><span>{name}</span>{historical && <span className={r.currentHint}>v{historical.version}</span>}<span>›</span></button>
}
export function BrowserTaskStatus({ sessionId }: { sessionId?: string }) {
  const { data } = useCapabilities(), [error, setError] = useState('')
  const task = data?.tasks.find(t => t.sessionId === sessionId)
  if (!task || (!task.browserSessions.length && task.status === 'idle')) return null
  const labels = { idle: '浏览器空闲', running: '浏览器执行中', stopping: '正在停止', stopped: '已确认停止', error: '需要处理' }
  return <div className={`${s.page} ${s.tasks}`} role="status">{labels[task.status]}{task.action && ` · ${task.action}`} · {task.browserSessions.length} 个窗口{!['stopped','stopping'].includes(task.status) && <button className={s.button} onClick={() => void capabilityClient.stop(task.sessionId).catch(e => setError(e.message))}>停止浏览器任务</button>}{(error || task.error) && <span className={s.error}>{error || task.error}</span>}</div>
}
