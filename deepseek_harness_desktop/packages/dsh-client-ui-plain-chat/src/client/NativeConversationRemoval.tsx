import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import s from './NativeConversationRemoval.module.css'

export const REMOVE_SESSION_EVENT = 'dsh-plain-chat:remove-session'

type Target = { id: string; title: string }
type InventoryRow = { id: string; childIds?: string[]; running?: boolean }
type DeleteResult = { id: string; status: 'ok' | 'skipped' | 'failed'; reason?: string; detail?: string }
type View = { target: Target; phase: 'checking' | 'ready' | 'deleting' | 'error'; total: number; error: string | null }
type SessionPort = { list: { getSnapshot(): { current?: string } }; clear(): void; refresh?(): Promise<unknown> }

function totalWithDescendants(rows: InventoryRow[], id: string): number {
  const byId = new Map(rows.map(row => [row.id, row]))
  if (!byId.has(id)) throw new Error('未找到这条会话，请刷新后重试。')
  const visited = new Set<string>()
  const pending = [id]
  while (pending.length) {
    const current = pending.pop()!
    if (visited.has(current)) continue
    visited.add(current)
    pending.push(...(byId.get(current)?.childIds ?? []))
  }
  return visited.size
}

export function NativeConversationRemoval({ sessions }: { sessions: SessionPort }) {
  const [view, setView] = useState<View | null>(null)
  const dialog = useRef<HTMLDivElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const handle = (event: Event) => {
      const detail = (event as CustomEvent<Partial<Target>>).detail
      if (typeof detail?.id !== 'string' || typeof detail.title !== 'string') return
      returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      setView({ target: { id: detail.id, title: detail.title }, phase: 'checking', total: 0, error: null })
    }
    window.addEventListener(REMOVE_SESSION_EVENT, handle)
    return () => window.removeEventListener(REMOVE_SESSION_EVENT, handle)
  }, [])

  useEffect(() => {
    if (view?.phase !== 'checking') return
    const { id } = view.target
    const controller = new AbortController()
    fetch('/api/dsh-session-archive/inventory', { credentials: 'same-origin', signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error(`无法读取会话信息（${response.status}）。`)
        return response.json() as Promise<{ rows?: InventoryRow[] }>
      })
      .then(data => {
        if (controller.signal.aborted) return
        const rows = data.rows ?? []
        const current = rows.find(row => row.id === id)
        if (current?.running) throw new Error('这条会话仍在运行，请结束后再移除。')
        const total = totalWithDescendants(rows, id)
        setView(previous => previous?.target.id === id ? { ...previous, phase: 'ready', total } : previous)
      })
      .catch(error => {
        if (controller.signal.aborted) return
        setView(previous => previous?.target.id === id ? { ...previous, phase: 'error', error: error instanceof Error ? error.message : String(error) } : previous)
      })
    return () => controller.abort()
  }, [view?.phase === 'checking' ? view.target.id : null])

  useEffect(() => {
    if (!view) return
    dialog.current?.focus({ preventScroll: true })
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || view.phase === 'deleting') return
      event.preventDefault()
      event.stopPropagation()
      setView(null)
    }
    document.addEventListener('keydown', escape, true)
    return () => document.removeEventListener('keydown', escape, true)
  }, [view?.target.id, view?.phase])

  const close = () => {
    if (view?.phase === 'deleting') return
    setView(null)
    queueMicrotask(() => returnFocus.current?.focus({ preventScroll: true }))
  }
  const remove = async () => {
    if (view?.phase !== 'ready') return
    const { id } = view.target
    const expectedTotal = view.total
    setView({ ...view, phase: 'deleting', error: null })
    try {
      const response = await fetch('/api/dsh-session-archive/delete', {
        method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ids: [id], expectedTotal }),
      })
      const body: { error?: string; results?: DeleteResult[] } = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error === 'plan-mismatch' ? '关联会话数量发生变化，请关闭后重新操作。' : body.error ?? `移除失败（${response.status}）。`)
      const result = body.results?.find(item => item.id === id)
      if (result?.status !== 'ok') throw new Error(result?.reason === 'attached' ? '会话仍被工作台占用，请关闭该会话并重新启动工作台后重试。' : result?.detail ?? `移除失败：${result?.reason ?? '未知原因'}`)
      const incomplete = body.results?.find(item => item.status !== 'ok')
      if (incomplete) throw new Error(`部分关联会话未能移除：${incomplete.detail ?? incomplete.reason ?? '未知原因'}`)
      if (sessions.list.getSnapshot().current === id) sessions.clear()
      try { await sessions.refresh?.() } catch { /* The host feed will reconcile after its next refresh. */ }
      setView(null)
    } catch (error) {
      setView(previous => previous?.target.id === id ? { ...previous, phase: 'error', error: error instanceof Error ? error.message : String(error) } : previous)
    }
  }

  if (!view) return null
  return createPortal(<div className={s.overlay} onMouseDown={event => { if (event.target === event.currentTarget) close() }}>
    <div ref={dialog} className={s.dialog} role="dialog" aria-modal="true" aria-label="移除对话" tabIndex={-1}>
      <h2>移除对话</h2>
      <p>将永久删除“{view.target.title}”的对话记录，无法恢复。</p>
      {view.phase === 'checking' && <p className={s.muted}>正在检查关联会话…</p>}
      {view.phase === 'ready' && view.total > 1 && <p className={s.muted}>关联的 {view.total - 1} 条分支会话也会一并删除。</p>}
      {view.error && <p className={s.error} role="alert">{view.error}</p>}
      <div className={s.actions}>
        <button type="button" onClick={close} disabled={view.phase === 'deleting'}>取消</button>
        <button type="button" className={s.danger} onClick={() => void remove()} disabled={view.phase !== 'ready'}>{view.phase === 'deleting' ? '正在移除…' : '确认移除'}</button>
      </div>
    </div>
  </div>, document.body)
}
