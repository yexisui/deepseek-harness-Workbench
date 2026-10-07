import { useLeaveGuard, openWorkbenchLink } from '../../../dsh-plugin-manager/src/client/workbench-navigation.ts'
import { useEffect, useRef, useState } from 'react'
import type { MeetingAvailability } from './meeting-capability-status.ts'
import s from './ManagedCapabilities.module.css'

type Choice = { id: string; name: string; provider: string; selectable: boolean; reason?: string }
type Check = { at: string; text: string; timestamps: boolean; speakers: boolean }
type Props = { status: MeetingAvailability | null; refresh: () => Promise<void>; disabled?: boolean; onEditingChange?: (editing: boolean) => void }
async function api(path: string, body?: object) {
  const response = await fetch(`/api/capabilities/${path}`, { method: body ? 'POST' : 'GET', credentials: 'same-origin', headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined })
  const value = await response.json()
  if (!response.ok) throw new Error(value.error || `操作失败（${response.status}）`)
  return value
}
export function MeetingAsrSettings({ status, refresh, disabled, onEditingChange }: Props) {
  const [editing, setEditing] = useState(false), [models, setModels] = useState<Choice[]>([])
  const [selected, setSelected] = useState(''), [search, setSearch] = useState('')
  const [format, setFormat] = useState<'json' | 'verbose_json'>('json'), [maxMb, setMaxMb] = useState(25)
  const [busy, setBusy] = useState(''), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const [result, setResult] = useState<Check | null>(null)
  const sequence = useRef(0)
  const reload = async () => { try { const data = await api('models'); if (!Array.isArray(data.models)) throw new Error('模型列表暂不可用，请刷新或重启工作台后重试'); setModels(data.models) } catch (e) { setError(e instanceof Error ? e.message : '读取模型失败') } }
  useEffect(() => { void reload(); return () => { sequence.current++ } }, [])
  const stop = () => { sequence.current++; setEditing(false); setBusy(''); setError(''); setResult(null); onEditingChange?.(false) }
  useLeaveGuard(editing, stop)
  const start = () => { setSelected(status?.modelRef || ''); setFormat(status?.modelRef ? status.format || 'json' : 'json'); setMaxMb(status?.maxMb || 25); setError(''); setNotice(''); setResult(null); setEditing(true); onEditingChange?.(true); void reload() }
  const check = async () => {
    const version = ++sequence.current
    setBusy('check'); setError(''); setResult(null)
    try { const data = await api('meeting/check-model', { modelRef: selected, format, maxMb }); if (version === sequence.current) setResult(data) }
    catch (e) { if (version === sequence.current) setError(e instanceof Error ? e.message : '检测失败') }
    finally { if (version === sequence.current) setBusy('') }
  }
  const save = async () => {
    setBusy('save'); setError('')
    try { await api('meeting/config', { revision: status?.revision, modelRef: selected, format, maxMb }); await refresh(); stop(); setNotice('模型选择已保存，新转写任务立即生效。') }
    catch (e) { setError(e instanceof Error ? e.message : '保存失败') }
    finally { setBusy('') }
  }
  const chosen = models.find(model => model.id === selected)
  const filtered = models.filter(model => model.id === selected || `${model.name} ${model.provider} ${model.id}`.toLowerCase().includes(search.toLowerCase()))
  return <>
    <div className={s.row}><div style={{ minWidth: 0, overflowWrap: 'anywhere' }}><strong>语音识别模型</strong><small>{status?.modelRef || (status?.endpoint ? `旧版配置：${status.asrModel}（选择统一模型后切换）` : '待选择')}</small><small>地址和 API Key 由模型模块统一管理</small><small>{status?.verified ? `转写已验证 · ${new Date(status.verified.at).toLocaleString()}` : '尚未验证转写支持'}</small></div>{!editing && <button className={s.button} disabled={disabled || !status?.editable} onClick={start}>选择模型</button>}</div>
    {editing && <div className={s.fields} data-meeting-asr-editor>
      <label className={s.field}>搜索模型<input value={search} onChange={e => setSearch(e.target.value)} aria-label="搜索语音模型" placeholder="模型名称或服务商" disabled={!!busy}/></label>
      <label className={s.field}>识别模型<select aria-label="语音识别模型" value={selected} disabled={!!busy} onChange={e => { setSelected(e.target.value); setResult(null); setError('') }}><option value="">请选择已管理的模型</option>{selected && !models.some(m => m.id === selected) && <option value={selected} disabled>{selected}（已移除或停用）</option>}{[...new Set(filtered.map(m => m.provider))].map(provider => <optgroup key={provider} label={provider}>{filtered.filter(m => m.provider === provider).map(m => <option key={m.id} value={m.id} disabled={!m.selectable}>{m.name}{m.selectable ? ' · 待检测转写支持' : ' · 未适配'}</option>)}</optgroup>)}</select></label>
      {chosen?.reason && <p className={s.muted}>{chosen.reason}</p>}
      <div className={s.actions}><button className={s.button} disabled={!!busy} onClick={() => void reload()}>刷新模型</button><button className={s.button} disabled={!!busy} onClick={() => openWorkbenchLink({ section: 'models' })}>管理模型 ↗</button></div>
      <details><summary>转写选项</summary><div className={s.actions}><label className={s.field}>响应格式<select disabled={!!busy} value={format} onChange={e => { setFormat(e.target.value as 'json' | 'verbose_json'); setResult(null) }}><option value="json">JSON（通用文本）</option><option value="verbose_json">详细 JSON（服务支持时含时间片段）</option></select></label><label className={s.field}>录音上限（MB）<input type="number" min={1} max={100} disabled={!!busy} value={maxMb} onChange={e => { setMaxMb(Number(e.target.value)); setResult(null) }}/></label></div></details>
      <p className={s.muted}>检测将向所选模型发送一段内置短语音，不使用你的录音；可能产生少量调用费用。检测不保存选择。</p>
      <div className={s.actions}><button className={s.button} disabled={!!busy || !chosen?.selectable} onClick={() => void check()}>{busy === 'check' ? '正在检测…' : '检测转写'}</button><button className={`${s.button} ${s.primary}`} disabled={!!busy || !chosen?.selectable} onClick={() => void save()}>{busy === 'save' ? '保存中…' : '保存选择'}</button><button className={s.button} disabled={!!busy} onClick={stop}>取消</button></div>
      {result && <p className={s.notice} role="status">转写检测通过：{result.text}<br/>时间片段：{result.timestamps ? '本次返回' : '本次未返回'}；说话人：{result.speakers ? '本次返回' : '本次未返回'}</p>}
    </div>}
    {error && <p className={s.error} role="alert">{error}</p>}{notice && <p className={s.notice} role="status">{notice}</p>}
    <p className={s.muted}>识别模型负责录音转文字，纪要模型仍在会议对话中选择。已配置不代表支持语音，请先检测。</p>
  </>
}
