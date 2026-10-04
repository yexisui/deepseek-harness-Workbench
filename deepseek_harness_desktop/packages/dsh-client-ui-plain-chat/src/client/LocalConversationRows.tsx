import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { LocalConversation } from './local-conversations.ts'
export type ConversationHistoryRow = Omit<LocalConversation, 'kind'> & { kind: LocalConversation['kind'] | 'requirements' | 'developer' }
import s from './LocalConversationRows.module.css'

/** Share the native Chat group when present; saved records also need a home in an empty tree. */
export function LocalConversationRows({ host, label, rows, activeId, onOpen, onRemove, onLoadMore, loading, error, fallbackLabel = '聊天记录' }: {
  host: HTMLDivElement | null; label: string; rows: ConversationHistoryRow[]; activeId: string | null
  onOpen: (id: string) => void; onRemove: (id: string) => void; onLoadMore?: () => void; loading?: boolean; error?: string; fallbackLabel?: string
}) {
  const [target, setTarget] = useState<HTMLDivElement | null>(null)
  const [standalone, setStandalone] = useState(false)
  const [menu, setMenu] = useState<{ id: string; left: number; top: number } | null>(null)
  const trigger = useRef<HTMLButtonElement | null>(null)
  const menuItem = useRef<HTMLButtonElement | null>(null)
  const hasRows = rows.length > 0
  useEffect(() => {
    if (!menu) return
    menuItem.current?.focus({ preventScroll: true })
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && (menuItem.current?.parentElement?.contains(event.target) || trigger.current?.contains(event.target))) return
      setMenu(null)
    }
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setMenu(null)
      trigger.current?.focus()
    }
    const closeOnMove = () => setMenu(null)
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeEscape)
    window.addEventListener('resize', closeOnMove)
    window.addEventListener('scroll', closeOnMove, true)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeEscape)
      window.removeEventListener('resize', closeOnMove)
      window.removeEventListener('scroll', closeOnMove, true)
    }
  }, [menu])
  useLayoutEffect(() => {
    if (!host) return
    let container: HTMLDivElement | null = null
    const placeholders = new Map<HTMLElement, { hidden: boolean; display: string }>()
    const restorePlaceholders = () => {
      for (const [element, previous] of placeholders) { element.hidden = previous.hidden; element.style.display = previous.display }
      placeholders.clear()
    }
    const place = () => {
      const plus = Array.from(host.querySelectorAll<HTMLButtonElement>('button[aria-label]')).find(button => button.getAttribute('aria-label') === label)
      const header = plus?.closest<HTMLElement>('[role="treeitem"]')
      const group = header?.parentElement
      if (!container) {
        container = document.createElement('div')
        container.dataset.localConversationHost = 'true'
        setTarget(container)
      }
      if (header && group) {
        restorePlaceholders()
        container.hidden = header.getAttribute('aria-expanded') === 'false'
        container.dataset.localConversationPlacement = 'native'
        if (container.parentElement !== group || container.previousElementSibling !== header) group.insertBefore(container, header.nextSibling)
        setStandalone(false)
      } else {
        const tree = host.querySelector<HTMLElement>('[role="tree"]')
        const parent = tree ?? host
        container.hidden = false
        container.dataset.localConversationPlacement = 'standalone'
        if (container.parentElement !== parent || container !== parent.firstElementChild) parent.insertBefore(container, parent.firstChild)
        if (tree && hasRows) {
          // The native empty-state element is a direct child of the session tree.
          // Hide only that placeholder while our saved rows occupy the same list.
          for (const element of Array.from(tree.children)) {
            if (!(element instanceof HTMLElement) || !Array.from(element.classList).some(name => name.endsWith('_empty'))) continue
            if (!placeholders.has(element)) placeholders.set(element, { hidden: element.hidden, display: element.style.display })
            element.hidden = true; element.style.display = 'none'
          }
        } else restorePlaceholders()
        setStandalone(true)
      }
    }
    place()
    const observer = new MutationObserver(place)
    observer.observe(host, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-expanded'] })
    return () => { observer.disconnect(); restorePlaceholders(); container?.remove() }
  }, [host, label, hasRows])
  if (!target || (!rows.length && !error && !loading)) return null
  const openMenu = (id: string, button: HTMLButtonElement) => {
    if (menu?.id === id) { setMenu(null); return }
    trigger.current = button
    const rect = button.getBoundingClientRect()
    const width = 214
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))
    const top = rect.bottom + 6 + 54 > window.innerHeight ? Math.max(8, rect.top - 60) : rect.bottom + 6
    setMenu({ id, left, top })
  }
  return <>{createPortal(<div className={s.rows} data-local-conversations="true">
    {standalone && <div className={s.fallbackHeading}>{fallbackLabel}</div>}
    {rows.map(row => <div className={`${s.row} ${activeId === row.id ? s.active : ''}`} key={row.id}>
      <button type="button" className={s.open} onClick={() => onOpen(row.id)} aria-label={`打开本地会话：${row.title}`} aria-current={activeId === row.id ? 'page' : undefined}>
        <span className={s.icon} aria-hidden="true">{row.kind === 'developer' ? '⌘' : row.kind === 'requirements' ? '▧' : row.kind === 'demo' ? '▤' : '◌'}</span><span className={s.title}>{row.title}</span><small>{row.kind === 'developer' ? '开发' : row.kind === 'requirements' ? '需求' : row.kind === 'demo' ? '会议' : row.draft.trim() ? '草稿' : '临时'}</small>
      </button>
      <button type="button" className={s.menuTrigger} onClick={event => openMenu(row.id, event.currentTarget)} aria-label={`会话操作：${row.title}`} aria-haspopup="menu" aria-expanded={menu?.id === row.id}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><circle cx="3" cy="8" r="1.2"/><circle cx="8" cy="8" r="1.2"/><circle cx="13" cy="8" r="1.2"/></svg>
      </button>
    </div>)}
    {error && <p role="alert">{error}</p>}
    {loading && <p role="status">正在读取需求记录…</p>}
    {onLoadMore && <button type="button" className={s.open} disabled={loading} onClick={onLoadMore}>{error ? "重试读取需求记录" : "加载更多需求记录"}</button>}
  </div>, target)}{menu && createPortal(<div className={s.menu} role="menu" aria-label="会话操作" style={{ left: menu.left, top: menu.top }}>
    <button ref={menuItem} type="button" role="menuitem" onClick={() => { const id = menu.id; setMenu(null); onRemove(id) }}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 4.5h10M6 4.5V3h4v1.5M4.5 4.5l.6 8h5.8l.6-8M6.5 7v3.5M9.5 7v3.5"/></svg>
      移除对话
    </button>
  </div>, document.body)}</>
}
