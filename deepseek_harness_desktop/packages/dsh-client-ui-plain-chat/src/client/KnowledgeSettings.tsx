import React, { useCallback, useEffect, useState } from 'react'
import type { KnowledgeStatus, KnowledgeScope } from '../../../dsh-capabilities/src/core/knowledge.ts'
import { KnowledgeTrial } from './KnowledgeTrial.tsx'
import { capabilityClient, openCapabilityLink } from './capability-client.ts'
import { KnowledgeConnectionEditor } from './KnowledgeConnection.tsx'
import { KnowledgeLibraries } from './KnowledgeLibraries.tsx'
import s from './ManagedCapabilities.module.css'

export function useKnowledgeStatus() {
  const [status, setStatus] = useState<KnowledgeStatus>(), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const refresh = useCallback(async () => {
    setBusy(true)
    try {
      const response = await fetch('/api/capabilities/knowledge/status', { credentials: 'same-origin' })
      const value = await response.json()
      if (!response.ok) throw Error(value.error || '知识库状态读取失败')
      setStatus(value); setError('')
    } catch (error) { setStatus(undefined); setError(error instanceof Error ? error.message : '知识库状态读取失败') }
    finally { setBusy(false) }
  }, [])
  useEffect(() => { void refresh(); window.addEventListener('focus', refresh); return () => window.removeEventListener('focus', refresh) }, [refresh])
  return { status, error, busy, refresh }
}

export function KnowledgeLink(){return <div className={s.row}><div><strong>外部知识库</strong><small>在岗位中关联独立模块并选择资料范围，连接配置统一管理。</small></div><button type="button" className={s.button} onClick={()=>openCapabilityLink({section:'capability-center',capabilityId:'external-knowledge',tab:'settings'})}>管理外部知识库 ↗</button></div>}

/** The only service configuration and trial entry; business pages link here. */
export function KnowledgeSettings({disabled=false,onEditingChange}:{disabled?:boolean;onEditingChange?:(value:boolean)=>void}) {
  const [libraryEditing,setLibraryEditing]=useState(false),[connectionEditing,setConnectionEditing]=useState(false)
  useEffect(()=>{onEditingChange?.(libraryEditing||connectionEditing)},[libraryEditing,connectionEditing,onEditingChange])
  const { status, error, busy, refresh } = useKnowledgeStatus()
  const refreshAll = async () => { await refresh(); await capabilityClient.refresh(true) }
  const [scope,setScope]=useState<KnowledgeScope>(),[trialRevision,setTrialRevision]=useState(0),[trialFocus,setTrialFocus]=useState(0)
  return <section data-configuration-target="knowledge" aria-label="外部知识库设置">
    <KnowledgeLibraries disabled={disabled} onEditingChange={setLibraryEditing} onChanged={async()=>{setTrialRevision(v=>v+1);await refreshAll()}} providerId={status?.providerId} onSelect={id=>{setScope({collectionIds:[id],providerId:status?.providerId});setTrialRevision(v=>v+1);setTrialFocus(v=>v+1)}}/>
    <details className={s.compositionInfo}><summary>已有 HTTP 检索服务</summary><div className={s.row}><div><strong>外部知识库检索</strong><small role="status">{error || status?.message || '正在读取知识库状态…'}</small>
      {status?.available && <small>{status.configured ? status.verified ? '最近检测已通过' : '已配置，未验证' : '未配置'}{status.checkedAt ? ' · ' + new Date(status.checkedAt).toLocaleString() : ''}</small>}
      <small>现有和新建助手共用此模块；各岗位的引用范围分别保存。</small></div>
      <button className={s.button} disabled={busy} onClick={() => void refreshAll()}>{busy ? '读取中…' : '刷新状态'}</button></div>
    <KnowledgeConnectionEditor disabled={disabled} onEditingChange={setConnectionEditing} onSaved={async()=>{setScope(undefined);setTrialRevision(v=>v+1);await refreshAll()}}/>
    </details>
    <KnowledgeTrial status={status} disabled={disabled} scope={scope} onScopeChange={setScope} revision={trialRevision} focusRequest={trialFocus}/>
  </section>
}
