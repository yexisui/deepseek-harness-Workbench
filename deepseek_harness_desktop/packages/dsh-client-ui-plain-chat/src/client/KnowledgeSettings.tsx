import React, { useCallback, useEffect, useState } from 'react'
import type { KnowledgeStatus } from '../../../dsh-capabilities/src/core/knowledge.ts'
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

/** Same read-only service view in both capabilities and the component inspector. */
export function KnowledgeSettings() {
  const { status, error, busy, refresh } = useKnowledgeStatus()
  return <section data-configuration-target="knowledge" aria-label="外部知识库设置">
    <div className={s.row}><div><strong>外部知识库检索</strong><small role="status">{error || status?.message || '正在读取知识库状态…'}</small>
      {status?.available && <small>{status.configured ? status.verified ? '最近检测已通过' : '已配置，未验证' : '未配置'}{status.checkedAt ? ' · ' + new Date(status.checkedAt).toLocaleString() : ''}</small>}
      <small>需求编写、资料问答与智能文档共用检索接口。本次文件可独立使用。</small></div>
      <button className={s.button} disabled={busy} onClick={() => void refresh()}>{busy ? '读取中…' : '刷新状态'}</button></div>
    <p className={s.muted}>实际知识库接入后再提供相应的连接配置；当前不需要填写地址或密钥。查看状态不会检索或上传资料。</p>
  </section>
}
