import React from 'react'
import { actionNames, actionsOf, resolveBinding, type Role, type RoleVersion, type Snapshot } from '../../../dsh-capabilities/src/core/model.ts'
import { roleActivities } from './RoleImpactDialog.tsx'
import { Modal } from './PreviewModal.tsx'
import s from './ManagedCapabilities.module.css'
const fields = { name:'名称',duties:'岗位职责',requirements:'工作要求',format:'输出格式',color:'配色',icon:'图标',capabilities:'能力与动作范围',skills:'Skills 技能与版本' } as const
export function roleVersionChanges(version: RoleVersion, previous?: RoleVersion) {
  return previous ? Object.entries(fields).filter(([key]) => JSON.stringify(version[key as keyof typeof fields]) !== JSON.stringify(previous[key as keyof typeof fields])).map(([,label]) => label) : ['首次发布']
}
export function RoleVersionList({data,role,onEdit}:{data:Snapshot;role:Role;onEdit:(version:RoleVersion)=>void}) {
  return <><p className={s.notice}>新对话采用最新发布版本；历史版本保留供旧会话引用。下方仅统计当前活动任务，不代表全部历史会话。</p>{[...role.versions].reverse().map(version=>{
    const previous=role.versions[role.versions.indexOf(version)-1], changed=roleVersionChanges(version,previous)
    const active=roleActivities(data,role.id).filter(task=>task.roleVersion===version.version)
    return <details key={version.version}><summary>v{version.version} · {version.name} · {new Date(version.createdAt).toLocaleString()}</summary><p>{previous ? `较 v${previous.version}：` : ''}{changed.length ? changed.join('、') : '配置无变化'} · {active.length} 个活动任务引用</p><dl>{(['duties','requirements','format'] as const).map(field=><React.Fragment key={field}><dt>{fields[field]}</dt><dd className={s.versionValue}>{version[field] || '未填写'}</dd></React.Fragment>)}</dl><ul className={s.list}>{version.capabilities.map(binding=>{const capability=resolveBinding(data.state,binding);return <li key={binding.capabilityId}>{capability?.name ?? '能力缺失'} · v{binding.version} · {binding.enabled ? (binding.actions ?? actionsOf(capability)).map(action=>actionNames[action]).join('、') || '无执行动作' : '岗位中停用'}</li>})}{version.skills?.map(binding=><li key={'skill:'+binding.id}>{binding.name} · Skill · {binding.hash.slice(0,12)} · {binding.enabled ? '岗位中启用' : '岗位中停用'}</li>)}</ul>{!role.archivedAt && <button className={s.button} onClick={()=>onEdit(version)}>从 v{version.version} 恢复到编辑草稿</button>}</details>
  })}{!role.versions.length && <p>此岗位尚未发布，只有草稿。</p>}</>
}
export function RoleVersionDialog(props:{data:Snapshot;role:Role;onEdit:(version:RoleVersion)=>void;onClose:()=>void}) {
  return <Modal title="岗位版本记录" closeLabel="关闭版本记录" onClose={props.onClose}><div className={`${s.page} ${s.dialogBody}`}><RoleVersionList {...props}/></div></Modal>
}
