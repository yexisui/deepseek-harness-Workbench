import React, { useEffect, useState } from 'react'
import { actionsOf, actionNames, emptyRole, latest, resolveBinding, type RoleDefinition } from '../../../dsh-capabilities/src/core/model.ts'
import { capabilityClient, editorDrafts, useCapabilities } from './capability-client.ts'
import { ActionFields, ManagedCenter } from './ManagedCenter.tsx'
import { ManagedWorkbench } from './ManagedWorkbench.tsx'
import { Modal } from './PreviewModal.tsx'
import type { ChatKey } from './locales.ts'
import s from './ManagedCapabilities.module.css'
import r from './Roles.module.css'
import { appearanceStyle, RoleAppearanceIcon, roleAppearanceIconId } from './RoleAppearance.tsx'
import { RoleAppearanceEditor } from './RoleAppearanceEditor.tsx'

const freeChat = { name: '自由聊天', color: '#78869f', description: '日常问答、写作与想法讨论，无需选择工作区。' }

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
  const [initialAppearance] = useState(() => structuredClone({ color: draft.color, icon: draft.icon }))
  const [appearanceBusy, setAppearanceBusy] = useState(false)
  const [appearanceRevision, setAppearanceRevision] = useState(0)
  const [revision, setRevision] = useState(cached?.revision ?? state.revision), [selected, setSelected] = useState<string | null>(draft.capabilities[0]?.capabilityId ?? null)
  const [center, setCenter] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [review, setReview] = useState(false)
  const change = (value: RoleDefinition) => { setDraft(value); editorDrafts.set(key, { value: structuredClone(value), revision }) }
  const binding = draft.capabilities.find(b => b.capabilityId === selected), cap = state.capabilities.find(c => c.id === selected), version = binding && resolveBinding(state, binding)
  const updateBinding = (patch: Partial<RoleDefinition['capabilities'][number]>) => change({ ...draft, capabilities: draft.capabilities.map(b => b.capabilityId === selected ? { ...b, ...patch } : b) })
  const save = async (publish: boolean) => {
    if (appearanceBusy) return
    setBusy(true); setError('')
    try { await capabilityClient.command({ type: 'role.save', id, definition: draft, publish }, revision); editorDrafts.delete(key); onClose() }
    catch (error) { setError(error instanceof Error ? error.message : String(error)) }
    finally { setBusy(false) }
  }
  return <><ManagedWorkbench libraryTitle="能力配件库" title="岗位信息" selected={selected} onSelect={setSelected} onManage={() => setCenter(true)}
    library={state.capabilities.filter(c => !c.removedAt && c.versions.length).map(c => ({ id: c.id, name: c.draft.name, subtitle: `v${latest(c.versions)!.version} · ${c.enabled ? '已发布' : '已停用'}` }))}
    attached={draft.capabilities.map(b => { const c = state.capabilities.find(c => c.id === b.capabilityId); return { id: b.capabilityId, name: c?.draft.name ?? '能力缺失', subtitle: `v${b.version} · ${c?.removedAt ? '能力已移除' : !b.enabled ? '岗位中停用' : !c?.enabled ? '能力已停用' : data!.health.state === 'ready' ? '可使用' : '待连接'}` } })}
    onAdd={capabilityId => { const c = state.capabilities.find(c => c.id === capabilityId), v = c && latest(c.versions); if (v && !c?.removedAt && !draft.capabilities.some(b => b.capabilityId === capabilityId)) change({ ...draft, capabilities: [...draft.capabilities, { capabilityId, version: v.version, enabled: true }] }); setSelected(capabilityId) }}
    onRemove={capabilityId => change({ ...draft, capabilities: draft.capabilities.filter(b => b.capabilityId !== capabilityId) })}
    form={<div className={`${s.page} ${s.fields}`}><label className={s.field}>助手名称<input value={draft.name} maxLength={80} placeholder="例如：网页资料分析助手" onChange={e => change({ ...draft, name: e.target.value })}/></label><RoleAppearanceEditor key={appearanceRevision} roleId={id} value={draft} initialAppearance={initialAppearance} onBusyChange={setAppearanceBusy} onChange={patch => setDraft(current => { const value = { ...current, ...patch }; editorDrafts.set(key, { value: structuredClone(value), revision }); return value })}/><label className={s.field}>岗位职责<textarea rows={4} maxLength={8000} value={draft.duties} onChange={e => change({ ...draft, duties: e.target.value })}/></label><details><summary>工作要求与输出格式</summary><div className={s.fields}><label className={s.field}>工作要求<textarea rows={3} maxLength={8000} value={draft.requirements} onChange={e => change({ ...draft, requirements: e.target.value })}/></label><label className={s.field}>输出格式<textarea rows={3} maxLength={4000} value={draft.format} onChange={e => change({ ...draft, format: e.target.value })}/></label></div></details>{role && <label className={s.field}>从历史版本恢复到草稿<select value="" onChange={e => { const v = role.versions.find(v => v.version === Number(e.target.value)); if (v) { change(structuredClone(v)); setAppearanceRevision(value => value + 1) } }}><option value="">选择版本…</option>{role.versions.map(v => <option key={v.version} value={v.version}>v{v.version} · {v.name}</option>)}</select></label>}</div>}
    inspector={<div className={s.page}>{cap ? <><h3>{cap.draft.name}</h3><p className={s.muted}>{cap.draft.description}</p>{cap.removedAt && <p className={s.notice}>此能力已移除，当前不可执行。可从岗位中移除此配件，或在能力中心恢复。</p>}{binding ? <><label className={s.check}><input type="checkbox" checked={binding.enabled} onChange={e => updateBinding({ enabled: e.target.checked })}/>在此岗位中启用</label><label className={s.field}>采用的能力版本<select value={binding.version} onChange={e => updateBinding({ version: Number(e.target.value), actions: undefined })}>{cap.versions.map(v => <option key={v.version} value={v.version}>v{v.version} · {v.createdAt.slice(0, 10)}</option>)}</select></label><label className={s.check}><input type="checkbox" checked={binding.actions !== undefined} onChange={e => updateBinding({ actions: e.target.checked ? actionsOf(version) : undefined })}/>为此岗位缩小动作范围</label>{binding.actions !== undefined ? <ActionFields value={binding.actions} available={actionsOf(version)} onChange={actions => updateBinding({ actions })}/> : <p className={s.muted}>继承该版本默认动作：{actionsOf(version).map(a => actionNames[a]).join('、')}</p>}<p className={s.notice}>{data!.health.message}</p></> : <p>先添加此能力，再设置岗位覆盖。</p>}<button className={s.button} onClick={() => setCenter(true)}>查看能力及关联组件 ↗</button></> : <p className={s.empty}>选择已添加的能力以调整设置。</p>}</div>}/>
    <div className={`${s.page} ${s.footer}`}><div>{error ? <p role="alert" className={s.error}>{error}</p> : <p>{appearanceBusy ? '请先在外观与配色中完成图片应用或修正颜色，再保存岗位。' : '保存并发布后，新对话将采用这个岗位版本。'}</p>}{revision !== state.revision && <button className={s.button} onClick={() => setRevision(state.revision)}>保留草稿并更新保存基准</button>}</div><div className={s.actions}><button className={s.button} disabled={busy || appearanceBusy} onClick={() => void save(false)}>保存草稿</button><button className={`${s.button} ${s.primary}`} disabled={busy || appearanceBusy || !draft.name.trim()} onClick={() => setReview(true)}>保存并发布</button></div></div>
    {center && <Modal title="能力中心" closeLabel="返回岗位" onClose={() => setCenter(false)}><div className={`${s.page} ${s.dialogBody}`}><button className={s.button} onClick={() => setCenter(false)}>← 返回岗位，保留草稿</button><ManagedCenter embedded initialId={selected ?? undefined}/></div></Modal>}
    {review && <Modal title="发布岗位版本" closeLabel="返回编辑" onClose={() => setReview(false)}><div className={`${s.page} ${s.dialogBody}`}><p>{draft.name} · v{(latest(role?.versions ?? [])?.version ?? 0) + 1}</p><ul className={s.list}>{draft.capabilities.map(b => <li key={b.capabilityId}>{state.capabilities.find(c => c.id === b.capabilityId)?.draft.name} · v{b.version} · {b.enabled ? (b.actions ?? actionsOf(resolveBinding(state, b))).map(a => actionNames[a]).join('、') : '停用'}</li>)}</ul><p className={s.notice}>新增能力和放宽动作只由新对话采用。移除能力或缩小权限会立即限制旧会话，并停止受影响的浏览器任务。</p>{error && <p role="alert" className={s.error}>{error}</p>}<button className={`${s.button} ${s.primary}`} disabled={busy || appearanceBusy} onClick={() => void save(true)}>{busy ? '保存中…' : '确认发布'}</button></div></Modal>}
  </>
}
export function ManagedRolesSection({ selected, onSelect }: { selected: string; onSelect: (id: string) => void }) {
  const { data, error } = useCapabilities(), [editor, setEditor] = useState<{ id?: string } | null>(null), [message, setMessage] = useState('')
  const selectedRole = data?.state.roles.find(role => role.id === selected && role.enabled && role.versions.length)
  const toggleRole = async (id: string, enabled: boolean) => {
    try {
      await capabilityClient.command({ type: 'role.toggle', id, enabled })
      if (!enabled && selected === id) onSelect('chat')
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)) }
  }
  return <section className={r.section}>
    <div className={r.sectionHeader}><div><h2>岗位助手</h2><p>为每一类工作，准备一位熟悉职责的助手。</p></div><button className={r.primary} onClick={() => setEditor({})}>＋ 创建岗位助手</button></div>
    {(error || message) && <p role="alert" className={s.error}>{message || error}</p>}
    <div className={r.selectionStatus}><span role="status">{selected === 'chat' ? `已选定：${freeChat.name}` : selectedRole ? `已选定：${selectedRole.draft.name}` : data ? '当前岗位暂不可用' : '正在读取选定岗位…'}</span>{selected !== 'chat' && <button className={r.textButton} onClick={() => onSelect('chat')}>返回自由聊天</button>}</div>
    <div className={r.cards}>
      {/* 基础聊天沿用 chat / workbench-chat，不创建可发布、停用的岗位记录。 */}
      <article data-role-id="chat" aria-label={freeChat.name} className={`${r.roleCard} ${selected === 'chat' ? r.selectedCard : ''}`} style={appearanceStyle(freeChat.color)}>
        <div className={r.cardBody}>
          <button type="button" className={r.cardSelect} aria-label={`选定助手：${freeChat.name}`} aria-pressed={selected === 'chat'} onClick={() => onSelect('chat')}/>
          <div className={r.cardTop}><RoleAppearanceIcon roleId="chat" color={freeChat.color}/><span className={`${r.exampleBadge} ${selected === 'chat' ? r.selectedBadge : ''}`}>{selected === 'chat' ? '✓ 已选定' : '内置'}</span></div>
          <h3>{freeChat.name}</h3><p className={r.cardSummary}>{freeChat.description}</p>
          <div className={r.tags}><span>内置基础助手</span><span>日常问答</span><span>写作讨论</span></div>
        </div>
        <div className={r.cardControls}><p className={r.chatCardNote}>无需岗位配置，随时开始聊天。</p></div>
      </article>
      {data?.state.roles.map(role => {
      const published = latest(role.versions), selectable = role.enabled && !!published, chosen = selectable && selected === role.id
      return <article key={role.id} data-role-id={role.id} aria-label={role.draft.name} className={`${r.roleCard} ${chosen ? r.selectedCard : ''}`} style={appearanceStyle(role.draft.color)}>
        <div className={r.cardBody}>
          {/* 正文选择与管理操作分开，编辑/停用不会触发卡片选择。 */}
          <button type="button" className={r.cardSelect} aria-label={`选定助手：${role.draft.name}`} aria-pressed={chosen} disabled={!selectable} onClick={() => onSelect(role.id)}/>
          <div className={r.cardTop}><RoleAppearanceIcon roleId={role.id} icon={role.draft.icon} color={role.draft.color}/><span className={`${r.exampleBadge} ${chosen ? r.selectedBadge : ''}`}>{chosen ? '✓ 已选定' : !role.enabled ? '已停用' : published ? '岗位助手' : '草稿'}</span></div>
          <h3>{role.draft.name}</h3><p className={r.cardSummary} title={role.draft.duties}>{role.draft.duties || '点击编辑岗位，填写职责与工作要求。'}</p>
          <div className={r.tags}><span>{published ? `已发布 v${published.version}` : '未发布'}</span><span>{role.draft.capabilities.length} 个能力</span><span>{data.tasks.filter(t => t.roleId === role.id && t.status !== 'stopped').length} 个活动会话</span></div>
        </div>
        <div className={r.cardControls}><button className={r.cardAction} onClick={() => setEditor({ id: role.id })}>编辑岗位<span aria-hidden="true">↗</span></button><button className={r.textButton} onClick={() => void toggleRole(role.id, !role.enabled)}>{role.enabled ? '停用' : '启用'}</button></div>
      </article>
    })}</div>
    {data && !data.state.roles.length && <p className={s.empty}>还没有保存的岗位助手。创建后即可装配能力。</p>}
    <p className={r.sectionNote}>点击卡片选定助手；选择会用于下一次新对话，当前对话保持不变。</p>
    {editor && <ManagedRoleEditor id={editor.id} onClose={() => setEditor(null)}/>}
  </section>
}
export function ManagedRolePicker({ selected, onSelect, t }: { selected: string; onSelect: (id: string) => void; t: (key: ChatKey) => string }) {
  const { data } = useCapabilities(), [open, setOpen] = useState(false), [editor, setEditor] = useState(false)
  const role = data?.state.roles.find(role => role.id === selected)
  return <>
    <button className={r.picker} aria-haspopup="dialog" onClick={() => setOpen(true)}>
      <RoleAppearanceIcon roleId={role?.id ?? 'chat'} icon={role?.draft.icon} color={role?.draft.color ?? freeChat.color}/><span>{role?.draft.name ?? t('mode')}</span><span>⌄</span>
    </button>
    {open && <Modal title="选择岗位助手" closeLabel="关闭" onClose={() => setOpen(false)}><div className={`${s.page} ${s.dialogBody}`}>
      <button className={s.choice} aria-pressed={selected === 'chat'} onClick={() => { onSelect('chat'); setOpen(false) }}><div><RoleAppearanceIcon roleId="chat" color={freeChat.color}/></div><span><strong>{freeChat.name}</strong><small>{freeChat.description}</small></span></button>
      {data?.state.roles.filter(role => role.enabled && role.versions.length).map(role => <button className={s.choice} key={role.id} aria-pressed={selected === role.id} onClick={() => { onSelect(role.id); setOpen(false) }}>
        <div><RoleAppearanceIcon roleId={role.id} icon={role.draft.icon} color={role.draft.color}/></div><span><strong>{latest(role.versions)!.name}</strong><small>v{latest(role.versions)!.version} · {latest(role.versions)!.capabilities.length} 个能力</small></span>
      </button>)}
      <button className={s.button} onClick={() => setEditor(true)}>＋ 创建岗位助手</button><p className={s.muted}>选择仅用于下一次新对话，当前对话的岗位不会改变。</p>
    </div></Modal>}
    {editor && <ManagedRoleEditor onClose={() => setEditor(false)}/>}
  </>
}
export function ManagedCurrentAssistant({ selected, onOpen }: { selected: string; onOpen: () => void }) {
  const { data } = useCapabilities()
  // 此处是全局岗位选择入口；既有会话继续保留自己的预设与配置。
  const role = data?.state.roles.find(role => role.id === selected)
  const name = role?.draft.name ?? freeChat.name, color = role?.draft.color ?? freeChat.color
  const icon = roleAppearanceIconId(role?.id ?? 'chat', role?.draft.icon)
  return <button type="button" data-current-assistant="true" data-role-icon={icon} className={r.currentAssistant} style={appearanceStyle(color)} aria-label={`打开岗位助手：${name}`} title={`当前选定：${name} · 点击管理岗位`} onClick={onOpen}>
    <RoleAppearanceIcon roleId={role?.id ?? 'chat'} icon={role?.draft.icon} color={color}/><span className={r.currentText}>{name}</span><svg className={r.currentArrow} aria-hidden="true" viewBox="0 0 16 16" fill="none"><path d="m6 4 4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
  </button>
}
export function BrowserTaskStatus({ sessionId }: { sessionId?: string }) {
  const { data } = useCapabilities(), [error, setError] = useState('')
  const task = data?.tasks.find(t => t.sessionId === sessionId)
  if (!task || (!task.browserSessions.length && task.status === 'idle')) return null
  const labels = { idle: '浏览器空闲', running: '浏览器执行中', stopping: '正在停止', stopped: '已确认停止', error: '需要处理' }
  return <div className={`${s.page} ${s.tasks}`} role="status">{labels[task.status]}{task.action && ` · ${task.action}`} · {task.browserSessions.length} 个窗口{!['stopped','stopping'].includes(task.status) && <button className={s.button} onClick={() => void capabilityClient.stop(task.sessionId).catch(e => setError(e.message))}>停止浏览器任务</button>}{(error || task.error) && <span className={s.error}>{error || task.error}</span>}</div>
}
