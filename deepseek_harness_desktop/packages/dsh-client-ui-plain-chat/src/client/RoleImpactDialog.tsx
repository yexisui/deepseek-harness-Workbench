import React, { useState } from 'react'
import type { Snapshot } from '../../../dsh-capabilities/src/core/model.ts'
import type { ComponentActivity } from '../../../dsh-capabilities/src/core/component-registry.ts'
import { rolePresentation } from '../../../dsh-capabilities/src/core/model.ts'
import { capabilityClient } from './capability-client.ts'
import { Modal } from './PreviewModal.tsx'
import s from './ManagedCapabilities.module.css'
export function roleActivities(data: Snapshot, roleId: string): ComponentActivity[] {
  const merged = new Map<string, ComponentActivity>()
  for (const task of data.tasks.filter(t => t.roleId === roleId && (['running','stopping'].includes(t.status) || t.browserSessions.length))) merged.set('browser:'+task.sessionId, { id:task.sessionId, roleId, roleVersion:task.roleVersion, kind:'browser', name:task.name, status:task.status, componentIds:[] })
  for (const task of data.componentActivities ?? []) if (task.roleId === roleId) merged.set(task.kind+':'+task.id,task)
  return [...merged.values()]
}
export function RoleImpactDialog({data,roleId,onClose,onDone}:{data:Snapshot;roleId:string;onClose:()=>void;onDone:()=>void}) {
  const [revision]=useState(data.state.revision),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const role=data.state.roles.find(role=>role.id===roleId), tasks=roleActivities(data,roleId)
  const confirm=async()=>{setBusy(true);setError('');try{await capabilityClient.command({type:'role.toggle',id:roleId,enabled:false},revision);onDone()}catch(error){setError(error instanceof Error?error.message:String(error))}finally{setBusy(false)}}
  return <Modal title="停用岗位" closeLabel="取消停用" onClose={()=>{if(!busy)onClose()}}><div className={`${s.page} ${s.dialogBody}`}><p>停用“{role && rolePresentation(role).name}”</p><p className={s.notice}>将阻止新建任务及历史任务的后续执行。配置与历史结果保留；重新启用只授权新任务，旧任务不会自动恢复权限。</p><p>当前检测到 {tasks.length} 个活动任务（包含保持打开的浏览器窗口）。</p>{tasks.length>0 && <ul className={s.list}>{tasks.map(task=><li key={task.kind+':'+task.id}>{task.name} · {task.status}</li>)}</ul>}{revision!==data.state.revision && <p role="status">配置已变更，请关闭后重新核对。</p>}{error && <p role="alert">{error}</p>}<div className={s.confirmActions}><button className={s.button} disabled={busy} onClick={onClose}>取消</button><button className={`${s.button} ${s.dangerButton}`} disabled={busy || revision!==data.state.revision || !role} onClick={()=>void confirm()}>{busy?'正在停用…':'确认停用'}</button></div></div></Modal>
}
