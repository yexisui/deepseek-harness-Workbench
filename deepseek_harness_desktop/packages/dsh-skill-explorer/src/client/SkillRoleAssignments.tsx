import React, { useEffect, useRef, useState } from 'react'
import type { State, Role } from '../../../dsh-capabilities/src/core/model.ts'
import { Modal } from '../../../dsh-client-ui-plain-chat/src/client/PreviewModal.tsx'
import { RoleAppearanceIcon, roleAppearanceDefaults } from '../../../dsh-client-ui-plain-chat/src/client/RoleAppearance.tsx'
import { ManagementIcon } from '../../../../shared/client/ManagementRow.tsx'
import { openWorkbenchLink, captureNavigation, useLeaveGuard } from '../../../dsh-plugin-manager/src/client/workbench-navigation.ts'
import s from '../../../dsh-client-ui-plain-chat/src/client/ManagedCapabilities.module.css'
import css from './role-assignments.module.css'

const activeRoles = (state?: State) => state?.roles.filter(role => !role.archivedAt && !role.removedAt) ?? []
const bindings = (state: State, skillId: string) => activeRoles(state).filter(role => role.draft.skills?.some(skill => skill.id === skillId && skill.enabled)).map(role => role.id)

function RoleIdentity({ role }: { role: Role }) {
  return <><RoleAppearanceIcon className={css.icon} roleId={role.id} icon={role.draft.icon} color={role.draft.color ?? roleAppearanceDefaults(role.id).color}/><span className={css.name}>{role.draft.name}</span></>
}

/** One local selection, saved through the existing role/skill association command. */
export function SkillRoleAssignments({ skillId, busy }: { skillId: string; busy: boolean }) {
  const [state, setState] = useState<State>(), [chosen, setChosen] = useState<string[]>([])
  const [picker, setPicker] = useState(false), [query, setQuery] = useState('')
  const [error, setError] = useState(''), [loading, setLoading] = useState(true), [saving, setSaving] = useState(false)
  const lock = useRef(false), mounted = useRef(false)
  const saved = state ? bindings(state, skillId) : []
  const dirty = !!state && (chosen.length !== saved.length || chosen.some(id => !saved.includes(id)))
  const roles = activeRoles(state), selected = roles.filter(role => chosen.includes(role.id))
  const matches = roles.filter(role => role.draft.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  const disabled = busy || saving
  const cancel = () => { setChosen(saved); setError('') }
  useLeaveGuard(dirty, cancel, '岗位关联尚未保存，确定放弃修改并离开？')

  async function load() {
    setLoading(true); setError('')
    try {
      const response = await fetch('/api/capabilities/state'), value = await response.json()
      if (!response.ok) throw Error(value.error ?? '岗位读取失败')
      if (mounted.current) { setState(value.state); setChosen(bindings(value.state, skillId)) }
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : String(e)) }
    finally { if (mounted.current) setLoading(false) }
  }
  useEffect(() => { mounted.current = true; void load(); return () => { mounted.current = false } }, [skillId])

  async function save() {
    if (lock.current || !state || !dirty) return
    lock.current = true; setSaving(true); setError('')
    try {
      const response = await fetch('/api/capabilities/command', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ revision: state.revision, command: { type: 'role.skills', skillId, roleIds: chosen } }),
      })
      const value = await response.json()
      if (!response.ok) throw Error(value.error ?? '岗位设置保存失败')
      await load()
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : String(e)) }
    finally { lock.current = false; if (mounted.current) setSaving(false) }
  }
  const editRole = (role: Role) => openWorkbenchLink({ section: 'agent-presets', origin: captureNavigation(), restore: { section: 'agent-presets', label: '岗位编辑', frames: [{ kind: 'role-editor', section: 'agent-presets', label: '岗位编辑', view: { id: role.id } }] } })

  return <section className={css.assignments} aria-label="技能岗位关联">
    <div className={css.heading}><h3>已添加岗位 <span className={css.count}>{selected.length}</span></h3><button type="button" className={s.button} disabled={disabled || loading || !state} onClick={() => { setQuery(''); setPicker(true) }}>＋ 添加岗位</button></div>
    {loading && !state ? <p className={s.muted}>正在读取岗位…</p> : selected.length ? <div className={css.list} aria-label="已添加岗位列表">{selected.map(role => <div className={css.row} key={role.id} data-assigned-role={role.id}>
      <button type="button" className={css.identity} disabled={disabled} title={'编辑岗位：' + role.draft.name} aria-label={'编辑岗位：' + role.draft.name} onClick={() => editRole(role)}><RoleIdentity role={role}/></button>
      <button type="button" className={s.iconButton} disabled={disabled} title="解除岗位关联" aria-label={'解除岗位关联：' + role.draft.name} onClick={() => setChosen(ids => ids.filter(id => id !== role.id))}><ManagementIcon kind="remove"/></button>
    </div>)}</div> : state ? <p className={css.empty}>尚未添加岗位</p> : null}
    {error && <p className={s.error} role="alert">{error} {!state && <button className={s.button} disabled={loading} onClick={() => void load()}>重试</button>}</p>}
    <p className={s.muted}>保存后用于所选岗位的新对话。</p>
    {dirty && <div className={css.footer}><span className={s.muted} role="status">有未保存的更改</span><div className={s.actions}><button type="button" className={s.button} disabled={disabled} onClick={cancel}>取消</button><button type="button" className={`${s.button} ${s.primary}`} disabled={disabled || loading} onClick={() => void save()}>{saving ? '保存中…' : '保存'}</button></div></div>}
    {picker && <Modal title="添加岗位" closeLabel="关闭添加岗位" className={`${s.page} ${css.picker}`} onClose={() => setPicker(false)}>
      <div className={css.search}><input className={s.search} aria-label="搜索岗位名称" placeholder="搜索岗位名称" value={query} onChange={e => setQuery(e.target.value)}/></div>
      <div className={css.options} aria-label="可添加岗位列表">{matches.map(role => <div className={css.row} key={role.id} data-picker-role={role.id}><div className={css.optionIdentity}><RoleIdentity role={role}/></div>{chosen.includes(role.id) ? <span className={css.added}>已添加</span> : <button type="button" className={`${s.button} ${css.add}`} disabled={disabled} title={'添加岗位：' + role.draft.name} aria-label={'添加岗位：' + role.draft.name} onClick={() => setChosen(ids => ids.includes(role.id) ? ids : [...ids, role.id])}>＋</button>}</div>)}{!matches.length && <p className={css.empty}>{query.trim() ? '没有找到匹配的岗位' : '暂无可添加的岗位'}</p>}</div>
      <div className={css.pickerFooter}><span className={s.muted}>可连续添加多个岗位</span><button type="button" className={`${s.button} ${s.primary}`} onClick={() => setPicker(false)}>完成</button></div>
    </Modal>}
  </section>
}
