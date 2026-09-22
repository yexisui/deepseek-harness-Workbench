import React, { useEffect, useState } from 'react'
import { browserPackage, components, references, type Snapshot } from '../../../dsh-capabilities/src/core/model.ts'
export function useCapabilityReferences() {
  const [data, setData] = useState<Snapshot | null>(null)
  useEffect(() => { let alive = true; const read = () => { void fetch('/api/capabilities/state').then(r => r.ok ? r.json() : null).then(value => { if (alive) setData(value) }).catch(() => { if (alive) setData(null) }) }; read(); const timer = setInterval(read, 15000); return () => { alive = false; clearInterval(timer) } }, [])
  return data
}
export function capabilityLink(section: string, capabilityId?: string, moduleName?: string) {
  const detail = { section, capabilityId, moduleName }
  try { sessionStorage.setItem('workbench-capability-link', JSON.stringify(detail)) } catch { /* Optional. */ }
  window.dispatchEvent(new CustomEvent('workbench-capability-link', { detail }))
}
export function CapabilityReferences({ moduleName, data }: { moduleName: string; data: Snapshot | null }) {
  if (!data) return null
  const descriptor = components.find(c => moduleName === c.provider || c.dependencies.includes(moduleName) || moduleName.startsWith('@linxin666/dsh-capabilities'))
  if (!descriptor) return null
  const refs = references(data.state, descriptor.id, data.tasks)
  return <details style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border-color,#dce2ec)' }}><summary>关联能力 {refs.capabilities.length} · 岗位 {refs.roles.length} · 活动会话 {refs.tasks.length}</summary><p>此组件被以下能力复用。全局停用或卸载会影响这些引用，配置会保留。</p>{refs.capabilities.map(cap => <p key={cap.id}><button type="button" onClick={() => capabilityLink('capability-center', cap.id)}>{cap.draft.name} ↗</button><small> · {cap.enabled ? '启用' : '停用'}</small></p>)}<p>岗位：{refs.roles.map(r => r.draft.name).join('、') || '暂无'}</p>{refs.tasks.filter(t => t.browserSessions.length || t.status === 'running').map(task => <p key={task.sessionId}>{task.name} · {task.status}<button type="button" onClick={() => void fetch('/api/capabilities/stop', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId: task.sessionId }) })}>停止浏览器任务</button></p>)}{moduleName === browserPackage && <p>工具由岗位适配层按会话加载；全局插件状态与能力连接状态分别展示。</p>}</details>
}
