import { useState } from 'react'
import type { MeetingAvailability } from './meeting-capability-status.ts'
import s from './ManagedCapabilities.module.css'

type Props = { status: MeetingAvailability | null; refresh: () => Promise<void>; disabled?: boolean; onEditingChange?: (editing: boolean) => void }

async function post(path: string, body: object) {
  const response = await fetch(`/api/capabilities/meeting/${path}`, {
    method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  })
  const result = await response.json() as { error?: string; apiKey?: string }
  if (!response.ok) throw new Error(result.error || `保存失败（${response.status}）`)
  return result
}

function EyeIcon({ visible }: { visible: boolean }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/>
    {!visible && <path d="M3 21 21 3"/>}
  </svg>
}

export function MeetingAsrSettings({ status, refresh, disabled, onEditingChange }: Props) {
  const [editing, setEditing] = useState(false)
  const [endpoint, setEndpoint] = useState(''), [model, setModel] = useState('')
  const [format, setFormat] = useState<'json' | 'verbose_json'>('verbose_json'), [maxMb, setMaxMb] = useState(25)
  const [keyDraft, setKeyDraft] = useState(''), [keyDirty, setKeyDirty] = useState(false), [keyVisible, setKeyVisible] = useState(false)
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const start = () => {
    setEndpoint(status?.endpoint ?? ''); setModel(status?.asrModel ?? '')
    setFormat(status?.format === 'json' ? 'json' : 'verbose_json'); setMaxMb(status?.maxMb ?? 25)
    setKeyDraft(''); setKeyDirty(false); setKeyVisible(false); setError(''); setNotice(''); setEditing(true); onEditingChange?.(true)
  }
  const stop = () => { setEditing(false); setKeyDraft(''); setKeyVisible(false); setKeyDirty(false); setError(''); onEditingChange?.(false) }
  const toggleKey = async () => {
    if (keyVisible) { setKeyVisible(false); if (!keyDirty) setKeyDraft(''); return }
    if (!keyDraft && status?.keySource === 'saved') {
      setBusy(true); setError('')
      try { const value = await post('config/reveal', {}); setKeyDraft(value.apiKey ?? '') }
      catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); return }
      finally { setBusy(false) }
    } else if (!keyDraft && status?.keySource === 'environment') {
      setError('环境变量提供的密钥不能在界面查看；可直接输入新密钥覆盖。')
      return
    }
    setKeyVisible(true)
  }
  const save = async (clearKey = false) => {
    if (!endpoint.trim() || !model.trim()) { setError('请填写服务地址和识别模型'); return }
    if (!Number.isInteger(maxMb) || maxMb < 1 || maxMb > 100) { setError('录音大小限制应为 1–100 MB'); return }
    setBusy(true); setError(''); setNotice('')
    try {
      await post('config', { revision: status?.revision, endpoint: endpoint.trim(), model: model.trim(), format, maxMb,
        ...(clearKey ? { clearKey: true } : keyDirty && keyDraft.trim() ? { apiKey: keyDraft.trim() } : {}) })
      await refresh(); stop(); setNotice(clearKey ? '已移除界面保存的密钥。' : '识别配置已保存并生效。')
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)) }
    finally { setBusy(false) }
  }
  const reset = async () => {
    if (!window.confirm('恢复使用工作台环境变量中的语音识别配置？')) return
    setBusy(true); setError('')
    try { await post('config', { revision: status?.revision, reset: true }); await refresh(); stop(); setNotice('已恢复使用环境变量配置。') }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)) }
    finally { setBusy(false) }
  }
  return <>
    <div className={s.row}><div><strong>兼容语音识别接口</strong><small>服务地址：{status?.endpoint || '待配置'}</small><small>识别模型：{status?.asrModel || '待配置'}</small><small>API Key：{status?.hasKey ? '********' : '未配置或本地服务无需密钥'}{status?.keySource === 'environment' ? '（环境变量）' : ''}</small></div>
      {!editing && <button className={s.button} disabled={disabled || !status?.editable} onClick={start}>编辑识别配置</button>}</div>
    {editing && <div className={s.fields} data-meeting-asr-editor>
      <label className={s.field}>服务地址<input aria-label="语音识别服务地址" value={endpoint} onChange={event => setEndpoint(event.target.value)} placeholder="https://.../v1/audio/transcriptions"/></label>
      <label className={s.field}>识别模型<input aria-label="语音识别模型" value={model} onChange={event => setModel(event.target.value)} placeholder="例如 whisper-1"/></label>
      <label className={s.field}>API Key<div className={s.secretField}><input aria-label="语音识别 API Key" type={keyVisible ? 'text' : 'password'} value={keyDraft} placeholder={status?.hasKey ? '********' : '可选，本地服务可留空'} autoComplete="off" spellCheck={false} onChange={event => { setKeyDraft(event.target.value); setKeyDirty(true) }}/><button type="button" className={s.iconButton} aria-label={keyVisible ? '隐藏 API Key' : '显示 API Key'} title={keyVisible ? '隐藏 API Key' : '显示 API Key'} disabled={busy} onClick={() => void toggleKey()}><EyeIcon visible={keyVisible}/></button></div></label>
      <div className={s.actions}><label className={s.field}>响应格式<select value={format} onChange={event => setFormat(event.target.value as 'json' | 'verbose_json')}><option value="verbose_json">verbose_json（含时间片段）</option><option value="json">json</option></select></label><label className={s.field}>录音大小上限（MB）<input aria-label="录音大小上限" type="number" min="1" max="100" value={maxMb} onChange={event => setMaxMb(Number(event.target.value))}/></label></div>
      <div className={s.actions}><button className={`${s.button} ${s.primary}`} disabled={busy} onClick={() => void save()}>{busy ? '保存中…' : '保存配置'}</button><button className={s.button} disabled={busy} onClick={stop}>取消</button>{status?.keySource === 'saved' && <button className={s.button} disabled={busy} onClick={() => void save(true)}>移除已保存密钥</button>}{status?.configSource === 'saved' && <button className={s.button} disabled={busy} onClick={() => void reset()}>恢复环境变量配置</button>}</div>
    </div>}
    {error && <p className={s.error} role="alert">{error}</p>}{notice && <p className={s.notice} role="status">{notice}</p>}
    <p className={s.muted}>录音转写使用这里的接口；纪要生成模型仍在会议对话中选择。保存后无需重启工作台。</p>
  </>
}
