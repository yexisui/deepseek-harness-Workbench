import React from 'react'
export function MessageTime({ value, label = '' }: { value?: string; label?: string }) {
  const date = value ? new Date(value) : null
  const valid = date && Number.isFinite(date.getTime())
  return <div style={{ marginTop: 8, fontSize: 12, fontWeight: 400, lineHeight: 1.5, color: 'var(--dsw-alias-label-secondary, #758095)' }}>{valid ? <time dateTime={date.toISOString()}>{label}{date.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</time> : '时间未记录'}</div>
}
