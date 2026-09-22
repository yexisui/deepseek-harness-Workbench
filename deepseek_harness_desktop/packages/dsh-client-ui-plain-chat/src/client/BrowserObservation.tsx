import React, { useEffect, useState } from 'react'
import s from './ManagedCapabilities.module.css'
type Observation = { sessionId: string; dshSessionIds?: string[]; url?: string; action: string; thumbnailAttachmentId?: string; lastError?: string; dead?: boolean }
/** The official observation service supplies events and images; display only this conversation. */
export function BrowserObservation({ sessionId }: { sessionId?: string }) {
  const [rows, setRows] = useState<Observation[]>([]), [error, setError] = useState('')
  useEffect(() => {
    if (!sessionId) { setRows([]); return }
    const stream = new EventSource('/bsk-observation/events')
    const update = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'snapshot') setRows(data.sessions ?? [])
        else if (data.type === 'reset') setRows([])
        else if (data.type === 'remove') setRows(rows => rows.filter(row => row.sessionId !== data.session?.sessionId))
        else if (data.type === 'upsert' && data.session) setRows(rows => [...rows.filter(row => row.sessionId !== data.session.sessionId), data.session])
        setError('')
      } catch { setError('浏览器状态格式异常，请重新检测连接。') }
    }
    stream.onmessage = update
    stream.onerror = () => { setError('浏览器观察连接中断，正在重连。') }
    return () => stream.close()
  }, [sessionId])
  const current = rows.filter(row => row.dshSessionIds?.[0] === sessionId)
  if (!current.length) return null
  return <details className={`${s.page} ${s.tasks}`}><summary>查看浏览器 · {current.length} 个窗口</summary>{error && <p role="status">{error}</p>}{current.map(row => <figure key={row.sessionId} style={{ margin: '12px 0' }}><figcaption>{row.url || '新建页面'} · {row.dead ? '连接丢失' : row.action}</figcaption>{row.thumbnailAttachmentId && <img src={`/bsk-observation/thumbnail/${encodeURIComponent(row.thumbnailAttachmentId)}`} alt="当前浏览器页面截图" style={{ maxWidth: '100%', maxHeight: 260, objectFit: 'contain', borderRadius: 8 }}/ >}{row.lastError && <p className={s.error}>{row.lastError}</p>}</figure>)}</details>
}
