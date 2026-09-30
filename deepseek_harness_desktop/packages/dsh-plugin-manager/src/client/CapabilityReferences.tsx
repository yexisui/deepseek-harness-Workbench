import React, { useEffect, useState } from 'react'
import { browserPackage, type Snapshot } from '../../../dsh-capabilities/src/core/model.ts'
import { pluginReferences, pluginRelations, relatedComponents, relationNames } from '../../../dsh-capabilities/src/core/component-registry.ts'
export function useCapabilityReferences() {
  const [data, setData] = useState<Snapshot | null>(null)
  useEffect(() => { let alive = true; const read = () => { void fetch('/api/capabilities/state').then(r => r.ok ? r.json() : null).then(value => { if (alive) setData(value) }).catch(() => { if (alive) setData(null) }) }; read(); const timer = setInterval(read, 15000); return () => { alive = false; clearInterval(timer) } }, [])
  return data
}
export function capabilityLink(section: string, capabilityId?: string, moduleName?: string, context?: { componentId?: string; tab?: string; entryId?: string; scope?: string }) {
  const detail = { section, capabilityId, moduleName, ...context }
  try { sessionStorage.setItem('workbench-capability-link', JSON.stringify(detail)) } catch { /* Optional. */ }
  window.dispatchEvent(new CustomEvent('workbench-capability-link', { detail }))
}
export function CapabilityReferences({ moduleName, data, componentId }: { moduleName: string; data: Snapshot | null; componentId?: string }) {
  if (!data?.components?.length || !data.state?.capabilities) return null
  const catalog = componentId ? data.components.filter(c => c.id === componentId) : data.components
  const refs = pluginReferences(data.state, moduleName, data.tasks, catalog)
  if (!refs.components.length) return null
  return <details style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border-color,#dce2ec)' }}><summary>关联能力 {refs.capabilities.length} · 岗位 {refs.roles.length} · 活动会话 {refs.tasks.length}</summary><p>{refs.components.map(c => <span key={c.id}><button type="button" onClick={() => capabilityLink('component-center', undefined, undefined, { componentId: c.id, tab: 'plugins' })}>{c.name} ↗</button> · {pluginRelations(c).filter(r => r.moduleName === moduleName).map(r => relationNames[r.role]).join('、')}<br/></span>)}此组件被以下能力复用。全局停用或卸载会影响这些引用，配置会保留。</p>{refs.capabilities.map(cap => <p key={cap.id}><button type="button" onClick={() => capabilityLink('capability-center', cap.id)}>{cap.draft.name} ↗</button><small> · {cap.enabled ? '启用' : '停用'}</small></p>)}<p>岗位：{refs.roles.map(r => r.draft.name).join('、') || '暂无'}</p>{refs.tasks.filter(t => t.browserSessions.length || t.status === 'running').map(task => <p key={task.sessionId}>{task.name} · {task.status}<button type="button" onClick={() => void fetch('/api/capabilities/stop', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId: task.sessionId }) })}>停止浏览器任务</button></p>)}{moduleName === browserPackage && <p>工具由岗位适配层按会话加载；全局插件状态与能力连接状态分别展示。</p>}</details>
}
