import { useLeaveGuard } from '../../../dsh-plugin-manager/src/client/workbench-navigation.ts'
import React, { useCallback, useEffect, useState } from 'react'
import type { RequirementAvailability, RequirementDefaults } from '../../../dsh-capabilities/src/core/requirements-model.ts'
import s from './ManagedCapabilities.module.css'

export function useRequirementAvailability(revision?: number) {
  const [status, setStatus] = useState<RequirementAvailability | null>(null)
  const [error, setError] = useState('')
  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/capabilities/requirements/config', { credentials: 'same-origin' })
      const value = await response.json()
      if (!response.ok) throw new Error(value.error ?? '需求配置读取失败')
      setStatus(value); setError('')
    } catch (error) { setError(error instanceof Error ? error.message : String(error)) }
  }, [])
  useEffect(() => { void refresh(); window.addEventListener('focus', refresh); return () => window.removeEventListener('focus', refresh) }, [refresh, revision])
  return { status, availability: error ? { error } : status, error, refresh, accept: (value: RequirementAvailability) => { setStatus(value); setError('') } }
}

export function RequirementsSettings({ status, onSaved, disabled = false, onEditingChange }: { status: RequirementAvailability | null; onSaved: (status: RequirementAvailability) => void; disabled?: boolean; onEditingChange: (dirty: boolean) => void }) {
  const [draft, setDraft] = useState<RequirementDefaults | null>(null), [revision, setRevision] = useState(0)
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('')
  useLeaveGuard(draft !== null, () => setDraft(null))
  const value = draft ?? status?.defaults
  useEffect(() => { onEditingChange(draft !== null); return () => onEditingChange(false) }, [draft, onEditingChange])
  if (!value || !status) return <p role="status">正在读取需求分析配置…</p>
  const change = (patch: Partial<RequirementDefaults>) => { if (!draft) setRevision(status.revision); setDraft({ ...value, ...patch }); setMessage('') }
  const save = async () => {
    setBusy(true); setMessage('')
    try {
      const response = await fetch('/api/capabilities/requirements/config', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revision, defaults: value }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? '需求配置保存失败')
      onSaved(result); setDraft(null); setMessage('默认配置已保存，之后新建的分析采用这些设置。')
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)) }
    finally { setBusy(false) }
  }
  return <section aria-label="需求分析默认配置"><p className={s.notice}>默认值作用于之后新建的需求分析。已有分析保留自己的设置；模型账号沿用工作台配置。</p>
    <fieldset disabled={disabled || busy} className={s.compositionFieldset}><div className={s.fields}>
      <label className={s.field}>默认整理深度<select value={value.depth} onChange={e => change({ depth: e.target.value as RequirementDefaults['depth'] })}><option value="brief">简要清单</option><option value="standard">标准需求说明</option><option value="detailed">详细规格</option></select></label>
      <label className={s.field}>提问节奏<select value={value.questionStyle} onChange={e => change({ questionStyle: e.target.value as RequirementDefaults['questionStyle'] })}><option value="short">少量关键问题</option><option value="detailed">逐项详细核对</option></select></label>
      <label className={s.field}>默认模型<input value={value.model} maxLength={240} placeholder="留空使用工作台默认模型" onChange={e => change({ model: e.target.value })}/><small>可填写工作台已配置的模型标识（提供方/模型）；也可在分析对话中选择模型。</small></label>
    </div>{draft && <div className={s.confirmActions}><button className={s.button} onClick={() => { setDraft(null); setMessage('') }}>取消修改</button><button className={`${s.button} ${s.primary}`} onClick={() => void save()}>保存默认配置</button></div>}</fieldset>
    {draft && revision !== status.revision && <p className={s.error}>配置已被更新，请取消修改后重新核对；当前输入仍保留。</p>}
    {message && <p role="status">{message}</p>}
  </section>
}
