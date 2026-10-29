import React, { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import styles from './AssistantToolbar.module.css'

type Mode<Id extends string> = { mode: Id; label: string }
type Drag = { pointerId: number; x: number; y: number; left: number; moved: boolean }

/** Shared chrome only. Business views, role selection and mode routing remain owned by the caller. */
export function AssistantToolbar<Id extends string>({ children, modes, activeMode, scopeKey, onModeChange }: {
  children: ReactNode
  modes: readonly Mode<Id>[]
  activeMode: Id
  scopeKey: string
  onModeChange: (mode: Id) => void
}) {
  const viewport = useRef<HTMLDivElement>(null)
  const strip = useRef<HTMLDivElement>(null)
  const drag = useRef<Drag | null>(null)
  const suppressClick = useRef(false)
  const previousScope = useRef(scopeKey)
  const [scroll, setScroll] = useState({ left: 0, max: 0 })
  const [dragging, setDragging] = useState(false)

  const measure = useCallback(() => {
    const node = viewport.current
    if (!node) return
    const max = Math.max(0, node.scrollWidth - node.clientWidth)
    const left = Math.min(max, Math.max(0, node.scrollLeft))
    setScroll(previous => previous.left === left && previous.max === max ? previous : { left, max })
  }, [])

  const reveal = useCallback((button?: HTMLElement | null) => {
    const node = viewport.current
    const selected = button ?? strip.current?.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (!node || !selected) return
    const bounds = node.getBoundingClientRect(), item = selected.getBoundingClientRect()
    if (item.left < bounds.left) node.scrollLeft -= bounds.left - item.left + 3
    else if (item.right > bounds.right) node.scrollLeft += item.right - bounds.right + 3
    measure()
  }, [measure])

  useLayoutEffect(() => {
    if (previousScope.current !== scopeKey) {
      previousScope.current = scopeKey
      if (viewport.current) viewport.current.scrollLeft = 0
      drag.current = null
      suppressClick.current = false
      setDragging(false)
    }
    reveal()
    measure()
  }, [scopeKey, activeMode, modes, measure, reveal])

  useEffect(() => {
    const node = viewport.current, content = strip.current
    if (!node || !content) return
    const resize = () => { reveal(); measure() }
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(resize)
    observer?.observe(node)
    observer?.observe(content)
    window.addEventListener('resize', resize)
    // A native listener is needed: React delegates wheel events as passive in browsers.
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || node.scrollWidth <= node.clientWidth) return
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
      if (!delta) return
      event.preventDefault()
      node.scrollLeft += delta * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? node.clientWidth : 1)
      measure()
    }
    node.addEventListener('wheel', wheel, { passive: false })
    measure()
    return () => { observer?.disconnect(); window.removeEventListener('resize', resize); node.removeEventListener('wheel', wheel) }
  }, [modes.length > 0, measure, reveal])

  const scrollTo = (left: number) => {
    const node = viewport.current
    if (!node) return
    node.scrollLeft = Math.max(0, Math.min(node.scrollWidth - node.clientWidth, left))
    measure()
  }
  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const current = drag.current
    if (!current || current.pointerId !== event.pointerId) return
    suppressClick.current = current.moved
    drag.current = null
    setDragging(false)
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  const overflowing = scroll.max > 1

  return <header className={styles.toolbar} data-assistant-toolbar="compact">
    <div className={styles.rolePicker}>{children}</div>
    {modes.length > 0 && <nav className={styles.modules} aria-label="岗位能力入口" data-overflow={overflowing}>
      <button type="button" className={styles.arrow} aria-label="向左查看功能模块" title="向左查看功能模块" disabled={!overflowing || scroll.left <= 1} onClick={() => scrollTo(scroll.left - (viewport.current?.clientWidth ?? 200) * .7)}>‹</button>
      <div className={styles.center}>
        <div ref={viewport} className={`${styles.viewport} ${dragging ? styles.dragging : ''}`} data-assistant-module-viewport="true" onScroll={measure}
          onPointerDown={event => {
            if (event.button !== 0 || drag.current) return
            suppressClick.current = false
            if (event.currentTarget.scrollWidth <= event.currentTarget.clientWidth) return
            drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, left: event.currentTarget.scrollLeft, moved: false }
          }}
          onPointerMove={event => {
            const current = drag.current
            if (!current || current.pointerId !== event.pointerId) return
            const dx = event.clientX - current.x, dy = event.clientY - current.y
            if (!current.moved && Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy)) {
              current.moved = true
              setDragging(true)
              event.currentTarget.setPointerCapture?.(event.pointerId)
            }
            if (current.moved) { event.preventDefault(); scrollTo(current.left - dx) }
          }}
          onPointerUp={endDrag} onPointerCancel={endDrag}
          onLostPointerCapture={() => { drag.current = null; setDragging(false) }}
          onDragStart={event => event.preventDefault()}
          onClickCapture={event => {
            if (suppressClick.current && event.detail !== 0) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false }
          }}
          onFocusCapture={event => { const button = (event.target as HTMLElement).closest('button'); if (button) reveal(button) }}
          onKeyDown={event => {
            const buttons = Array.from(strip.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])
            const index = buttons.indexOf(event.target as HTMLButtonElement)
            if (index < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
            event.preventDefault()
            const target = event.key === 'Home' ? buttons[0] : event.key === 'End' ? buttons.at(-1) : buttons[Math.max(0, Math.min(buttons.length - 1, index + (event.key === 'ArrowRight' ? 1 : -1)))]
            target?.focus({ preventScroll: true })
            reveal(target)
          }}>
          <div className={styles.strip} ref={strip}>{modes.map(item => <button key={item.mode} type="button" className={styles.module} aria-pressed={activeMode === item.mode} title={item.label} onClick={() => onModeChange(item.mode)}>{item.label}</button>)}</div>
        </div>
        <input className={styles.scrollbar} type="range" aria-label="左右滑动功能模块" min={0} max={Math.max(1, scroll.max)} step={1} value={scroll.left} disabled={!overflowing} onChange={event => scrollTo(Number(event.target.value))}/>
      </div>
      <button type="button" className={styles.arrow} aria-label="向右查看功能模块" title="向右查看功能模块" disabled={!overflowing || scroll.left >= scroll.max - 1} onClick={() => scrollTo(scroll.left + (viewport.current?.clientWidth ?? 200) * .7)}>›</button>
    </nav>}
  </header>
}
