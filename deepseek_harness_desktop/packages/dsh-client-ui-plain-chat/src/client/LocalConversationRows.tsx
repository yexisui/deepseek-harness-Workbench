import React, { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { LocalConversation } from './local-conversations.ts'
export type ConversationHistoryRow = Omit<LocalConversation, 'kind'> & { kind: LocalConversation['kind'] | 'requirements' | 'developer' }
import { Modal } from './PreviewModal.tsx'
import s from './LocalConversationRows.module.css'

/** Share the native Chat group when present; saved records also need a home in an empty tree. */
export function LocalConversationRows({ host, label, rows, activeId, onOpen, onRemove, onRename, onLoadMore, loading, error, historyExtras, fallbackLabel = '聊天记录' }: {
  historyExtras?: ReactNode; host: HTMLDivElement | null; label: string; rows: ConversationHistoryRow[]; activeId: string | null
  onOpen: (id: string) => void; onRemove: (id: string) => void; onRename?: (id: string, title: string) => Promise<void>; onLoadMore?: () => void; loading?: boolean; error?: string; fallbackLabel?: string
}) {
  const [target, setTarget] = useState<HTMLDivElement | null>(null)
  const [standalone, setStandalone] = useState(false)
  const [menu, setMenu] = useState<{ id: string; left: number; top: number } | null>(null)
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [renameError, setRenameError] = useState('')
  const renameInput = useRef<HTMLInputElement>(null)
  useEffect(() => { if (renaming) { renameInput.current?.focus(); renameInput.current?.select() } }, [renaming?.id])
  const closeRename = () => { if (!saving) { setRenaming(null); trigger.current?.focus() } }
  const saveRename = async () => {
    if (!renaming || saving || !onRename) return
    const title = renaming.title.trim()
    if (!title) { setRenameError('请输入会话名称'); return }
    setSaving(true); setRenameError('')
    try { await onRename(renaming.id, title); setRenaming(null); trigger.current?.focus() }
    catch (error) { setRenameError(error instanceof Error ? error.message : String(error)) }
    finally { setSaving(false) }
  }
  const trigger = useRef<HTMLButtonElement | null>(null)
  const menuItem = useRef<HTMLButtonElement | null>(null)
  const hasRows = rows.length > 0 || Boolean(historyExtras || loading || error)
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
  if (!target || (!rows.length && !error && !loading && !historyExtras)) return null
  const openMenu = (id: string, button: HTMLButtonElement) => {
    if (menu?.id === id) { setMenu(null); return }
    trigger.current = button
    const rect = button.getBoundingClientRect()
    const width = 214
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))
    const top = rect.bottom + 6 + (onRename ? 96 : 54) > window.innerHeight ? Math.max(8, rect.top - (onRename ? 102 : 60)) : rect.bottom + 6
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
    {historyExtras}
    {onLoadMore && <button type="button" className={s.open} disabled={loading} onClick={onLoadMore}>{error ? "重试读取需求记录" : "加载更多需求记录"}</button>}
  </div>, target)}{menu && createPortal(<div className={s.menu} role="menu" aria-label="会话操作" style={{ left: menu.left, top: menu.top }}>
    {onRename && <button ref={menuItem} type="button" role="menuitem" onClick={() => { const row = rows.find(row => row.id === menu.id); setMenu(null); if (row) { setRenameError(''); setRenaming({ id: row.id, title: row.title }) } }}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m10 3 3 3M3 10l7-7a2.1 2.1 0 0 1 3 3l-7 7-4 1 1-4Z"/></svg>重命名
    </button>}
    <button ref={onRename ? undefined : menuItem} type="button" role="menuitem" onClick={() => { const id = menu.id; setMenu(null); onRemove(id) }}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 4.5h10M6 4.5V3h4v1.5M4.5 4.5l.6 8h5.8l.6-8M6.5 7v3.5M9.5 7v3.5"/></svg>
      移除对话
    </button>
  </div>, document.body)}{renaming && <Modal title="重命名会话" closeLabel="关闭重命名" onClose={closeRename}>
    <form className={s.renameForm} onSubmit={event => { event.preventDefault(); void saveRename() }}>
      <label>会话名称<input ref={renameInput} value={renaming.title} maxLength={120} disabled={saving} onChange={event => { setRenaming({ ...renaming, title: event.target.value }); setRenameError('') }}/></label>
      {renameError && <p role="alert">{renameError}</p>}
      <div><button type="button" disabled={saving} onClick={closeRename}>取消</button><button type="submit" disabled={saving || !renaming.title.trim()}>{saving ? '正在保存…' : '保存'}</button></div>
    </form>
  </Modal>}</>
}
