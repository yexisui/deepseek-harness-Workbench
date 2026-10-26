import { KnowledgeLink } from './KnowledgeSettings.tsx'
import { useLeaveGuard, openWorkbenchLink } from '../../../dsh-plugin-manager/src/client/workbench-navigation.ts'
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
  const [models,setModels]=useState<{id:string;name:string}[]>([])
  useEffect(()=>{let alive=true;void fetch('/api/capabilities/models',{credentials:'same-origin'}).then(async r=>{if(!r.ok)throw Error('模型列表暂不可用');return r.json()}).then(v=>{if(alive)setModels(Array.isArray(v.models)?v.models:[])}).catch(()=>{});return()=>{alive=false}},[])
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
    <div data-configuration-target="document" className={s.row}><div><strong>模板文档处理</strong><small>导入DOCX模板，编辑既有段落/单元格并导出；原文件和样式保留。复杂对象需在Word中核对。</small></div></div>
    <div data-configuration-target="review" className={s.row}><div><strong>文档审阅与版本</strong><small>AI候选审阅后采用；支持局部撤回、版本比较和恢复。缺少组件时可保存组合，再从组件库补回。</small></div></div>
    <fieldset disabled={disabled || busy} className={s.compositionFieldset}><div className={s.fields}>
      <div data-configuration-target="legacy"><strong>旧需求整理</strong><p className={s.muted}>以下深度与提问节奏只作用于旧需求整理，不改变模板编写。</p></div>
      <label className={s.field}>默认整理深度<select value={value.depth} onChange={e => change({ depth: e.target.value as RequirementDefaults['depth'] })}><option value="brief">简要清单</option><option value="standard">标准需求说明</option><option value="detailed">详细规格</option></select></label>
      <label className={s.field}>提问节奏<select value={value.questionStyle} onChange={e => change({ questionStyle: e.target.value as RequirementDefaults['questionStyle'] })}><option value="short">少量关键问题</option><option value="detailed">逐项详细核对</option></select></label>
      <div data-configuration-target="writing"><div data-configuration-target="questions"><label className={s.field}>编写与问答默认模型<select value={value.model} onChange={e=>change({model:e.target.value})}><option value="">工作台默认模型</option>{value.model&&!models.some(m=>m.id===value.model)&&<option value={value.model}>{value.model}（已保存）</option>}{models.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select><small>新建模板、资料问答及旧整理任务采用此默认值；已有任务保持原设置。</small></label><button type="button" className={s.button} onClick={()=>openWorkbenchLink({section:"models"})}>管理模型 ↗</button><p className={s.muted}>账号、地址和密钥统一在模型设置维护；此处不另存一份。</p></div></div>
    </div>{draft && <div className={s.confirmActions}><button className={s.button} onClick={() => { setDraft(null); setMessage('') }}>取消修改</button><button className={`${s.button} ${s.primary}`} onClick={() => void save()}>保存默认配置</button></div>}</fieldset>
    {draft && revision !== status.revision && <p className={s.error}>配置已被更新，请取消修改后重新核对；当前输入仍保留。</p>}
    {message && <p role="status">{message}</p>}
    <KnowledgeLink/>
  </section>
}
