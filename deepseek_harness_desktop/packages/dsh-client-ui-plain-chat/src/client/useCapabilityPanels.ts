import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'

export type PanelSide = 'left' | 'right'
const minimum = { left: 210, right: 250 }
const maximum = { left: 360, right: 420 }
const centerMinimum = 380
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

/** Layout state is local to the editor; panels stay mounted when hidden. */
export function useCapabilityPanels(inspectorInitiallyOpen: boolean) {
  const root = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(1240)
  const [opened, setOpened] = useState({ left: true, right: inspectorInitiallyOpen })
  const [widths, setWidths] = useState({ left: 260, right: 300 })
  const [drawer, setDrawer] = useState<PanelSide | null>(null)
  const [resizing, setResizing] = useState<PanelSide | null>(null)
  const [willCollapse, setWillCollapse] = useState(false)
  const drag = useRef<{
    side: PanelSide; pointerId: number; startX: number; startWidth: number; savedWidth: number;
    wasOpen: boolean; delta: number; previousDrawer: PanelSide | null;
  } | null>(null)
  const suppressClick = useRef(false)
  const compact = containerWidth < 900
  const leftOpen = compact ? drawer === 'left' : opened.left
  const rightOpen = compact ? drawer === 'right' : opened.right

  useEffect(() => {
    const element = root.current
    if (!element || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setContainerWidth(entry.contentRect.width)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  // Fit both side panels without shrinking the desktop form below its useful width.
  const available = containerWidth - centerMinimum - (leftOpen ? 14 : 30) - (rightOpen ? 14 : 30)
  const base = (leftOpen ? minimum.left : 0) + (rightOpen ? minimum.right : 0)
  const extra = (leftOpen ? widths.left - minimum.left : 0) + (rightOpen ? widths.right - minimum.right : 0)
  const ratio = extra > 0 ? clamp((available - base) / extra, 0, 1) : 1
  const panelWidth = (side: PanelSide) => compact
    ? Math.min(widths[side], Math.max(210, containerWidth - 62))
    : minimum[side] + (widths[side] - minimum[side]) * ratio
  const leftWidth = panelWidth('left')
  const rightWidth = panelWidth('right')
  const isOpen = (side: PanelSide) => side === 'left' ? leftOpen : rightOpen
  const open = (side: PanelSide) => {
    if (compact) setDrawer(side)
    else setOpened(previous => ({ ...previous, [side]: true }))
  }
  const close = (side: PanelSide) => {
    if (compact) setDrawer(previous => previous === side ? null : previous)
    else setOpened(previous => ({ ...previous, [side]: false }))
  }
  const toggle = (side: PanelSide) => isOpen(side) ? close(side) : open(side)
  const resize = (side: PanelSide, value: number) => {
    const otherWidth = side === 'left' ? (rightOpen ? rightWidth : 0) : (leftOpen ? leftWidth : 0)
    const limit = compact ? containerWidth - 62 : available - otherWidth
    setWidths(previous => ({ ...previous, [side]: clamp(value, minimum[side], Math.min(maximum[side], limit)) }))
  }
  const cancel = () => {
    const current = drag.current
    if (!current) return
    setWidths(previous => ({ ...previous, [current.side]: current.savedWidth }))
    if (compact) setDrawer(current.previousDrawer)
    else setOpened(previous => ({ ...previous, [current.side]: current.wasOpen }))
    drag.current = null
    setResizing(null); setWillCollapse(false)
  }
  const railEvents = (side: PanelSide) => ({
    onPointerDown(event: PointerEvent<HTMLDivElement>) {
      if (event.button !== 0 || drag.current) return
      event.preventDefault()
      event.currentTarget.focus()
      event.currentTarget.setPointerCapture(event.pointerId)
      suppressClick.current = false
      drag.current = { side, pointerId: event.pointerId, startX: event.clientX, startWidth: panelWidth(side), savedWidth: widths[side], wasOpen: isOpen(side), delta: 0, previousDrawer: drawer }
    },
    onPointerMove(event: PointerEvent<HTMLDivElement>) {
      const current = drag.current
      if (!current || current.pointerId !== event.pointerId) return
      current.delta = (event.clientX - current.startX) * (side === 'left' ? 1 : -1)
      if (Math.abs(current.delta) < 5 && !resizing) return
      suppressClick.current = true
      setResizing(side)
      if (!current.wasOpen) {
        if (current.delta > 40) { open(side); resize(side, current.savedWidth + current.delta - 40) }
        else close(side)
      } else {
        setWillCollapse(current.startWidth + current.delta < 140)
        resize(side, current.startWidth + current.delta)
      }
    },
    onPointerUp(event: PointerEvent<HTMLDivElement>) {
      const current = drag.current
      if (!current || current.pointerId !== event.pointerId) return
      if (suppressClick.current && current.wasOpen && current.startWidth + current.delta < 140) {
        close(side)
        setWidths(previous => ({ ...previous, [side]: current.savedWidth }))
      }
      drag.current = null
      setResizing(null); setWillCollapse(false)
      event.currentTarget.releasePointerCapture(event.pointerId)
    },
    onPointerCancel: cancel,
    onLostPointerCapture: cancel,
    onClick() {
      if (suppressClick.current) { suppressClick.current = false; return }
      toggle(side)
    },
    onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
      if (event.key === 'Escape' && drag.current) { event.preventDefault(); event.stopPropagation(); cancel(); return }
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle(side); return }
      if (event.key === 'Home') { event.preventDefault(); close(side); return }
      if (event.key === 'End') { event.preventDefault(); open(side); return }
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      event.preventDefault()
      const delta = (event.key === 'ArrowRight' ? 24 : -24) * (side === 'left' ? 1 : -1)
      if (!isOpen(side)) { if (delta > 0) open(side); return }
      if (panelWidth(side) + delta < minimum[side]) close(side)
      else resize(side, panelWidth(side) + delta)
    },
  })

  const style = {
    '--library-width': `${leftOpen ? leftWidth : 0}px`, '--inspector-width': `${rightOpen ? rightWidth : 0}px`,
    '--left-rail': `${leftOpen ? 14 : 30}px`, '--right-rail': `${rightOpen ? 14 : 30}px`,
  } as CSSProperties
  return { root, compact, leftOpen, rightOpen, leftWidth, rightWidth, resizing, willCollapse, style, railEvents, open, close }
}
