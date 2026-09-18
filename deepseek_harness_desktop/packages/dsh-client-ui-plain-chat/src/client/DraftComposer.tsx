import React, { useEffect, useRef, useState } from 'react'
import type { ChatStart } from '../core/start.ts'
import type { ChatKey } from './locales.ts'
import styles from './Chat.module.css'

export function DraftComposer({ start, t, available, previewOnly = false, onReturnChat }: { start: ChatStart; t: (key: ChatKey) => string; available: boolean; previewOnly?: boolean; onReturnChat?: () => void }) {
  const [draft, setDraft] = useState(() => { try { return sessionStorage.getItem('workbench-chat-draft') ?? '' } catch { return '' } })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false; start.reset() } }, [start])
  const update = (value: string) => {
    setDraft(value)
    try { sessionStorage.setItem('workbench-chat-draft', value) } catch { /* Session storage is optional. */ }
  }
  const send = async () => {
    if (busy || previewOnly || !available || !draft.trim()) return
    setBusy(true); setError(false)
    try {
      await start.send(draft)
      if (alive.current) update('')
    } catch { if (alive.current) setError(true) }
    finally { if (alive.current) setBusy(false) }
  }
  return <div className={styles.card} data-dsh-plugin="plain-chat" data-dsh-part="composer">
    {previewOnly && <div className={styles.previewNotice} role="status"><span>{t('rolesChatOnly')}</span><button type="button" onClick={onReturnChat}>{t('rolesReturnChat')}</button></div>}
    <textarea className={styles.input} value={draft} onChange={event => update(event.target.value)} placeholder={t(previewOnly ? 'rolesComposer' : 'placeholder')} aria-label={t(previewOnly ? 'rolesComposer' : 'placeholder')} readOnly={busy}
      onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) { event.preventDefault(); void send() } }} />
    <div className={styles.row}><span className={styles.hint}>{t('hint')}<br />{t('model')}</span>
      <button className={styles.send} disabled={busy || previewOnly || !available || !draft.trim()} onClick={() => void send()} aria-label={t('send')}>{busy ? t('sending') : '↑'}</button></div>
    {(!available || error) && <div role="alert" className={styles.error}>{t(available ? 'failed' : 'unavailable')}</div>}
  </div>
}
