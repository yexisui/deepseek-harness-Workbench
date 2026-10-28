import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type KeyboardEvent } from 'react'
type Side = 'left' | 'right'
type Layout = { leftOpen: boolean; rightOpen: boolean; left: number; right: number }
const key = 'workbench-code-panels-v1', min = { left: 140, right: 300 }, max = { left: 320, right: 720 }
const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n))
function read(): Layout {
  try { const x = JSON.parse(localStorage.getItem(key) || '{}'); return { leftOpen: x.leftOpen !== false, rightOpen: x.rightOpen !== false, left: Number.isFinite(x.left) ? clamp(x.left, 140, 320) : 190, right: Number.isFinite(x.right) ? clamp(x.right, 300, 720) : 460 } }
  catch { return { leftOpen: true, rightOpen: true, left: 190, right: 460 } }
}
export function useCodePanels() {
  const root = useRef<HTMLDivElement>(null), [layout, setLayout] = useState(read), latest = useRef(layout); latest.current = layout
  const [width, setWidth] = useState(1200), [dragging, setDragging] = useState<Side | null>(null)
  const drag = useRef<{ side: Side; id: number; x: number; width: number; saved: Layout } | null>(null)
  const compact = width < 840, rail = 32
  const available = width - 220 - (layout.leftOpen ? 8 : rail) - (layout.rightOpen ? 8 : rail)
  const minimum = (layout.leftOpen ? min.left : 0) + (layout.rightOpen ? min.right : 0)
  const extra = (layout.leftOpen ? layout.left - min.left : 0) + (layout.rightOpen ? layout.right - min.right : 0)
  const ratio = extra ? clamp((available - minimum) / extra, 0, 1) : 1
  const actual = { left: min.left + (layout.left - min.left) * ratio, right: min.right + (layout.right - min.right) * ratio }
  const persist = (next: Layout) => { try { localStorage.setItem(key, JSON.stringify(next)) } catch {} }
  const update = (patch: Partial<Layout>, save = true) => { const next = { ...latest.current, ...patch }; latest.current = next; setLayout(next); if (save) persist(next) }
  const open = (side: Side) => layout[side === 'left' ? 'leftOpen' : 'rightOpen']
  const toggle = (side: Side, value = !open(side)) => update({ [side === 'left' ? 'leftOpen' : 'rightOpen']: value })
  useEffect(() => {
    if (!root.current || typeof ResizeObserver === 'undefined') return
    const measure = () => { if (root.current) setWidth(root.current.clientWidth) }; measure()
    const observer = new ResizeObserver(measure); observer.observe(root.current); return () => observer.disconnect()
  }, [])
  const limit = (side: Side) => Math.max(min[side], Math.min(max[side], available - (open(side === 'left' ? 'right' : 'left') ? actual[side === 'left' ? 'right' : 'left'] : 0)))
  const resize = (side: Side, value: number, save = true) => update({ [side]: clamp(value, min[side], limit(side)) }, save)
  const finish = (cancel = false) => { const current = drag.current; if (!current) return; drag.current = null; setDragging(null); if (cancel) { latest.current = current.saved; setLayout(current.saved) } else persist(latest.current) }
  const events = (side: Side) => ({
    onPointerDown(event: PointerEvent<HTMLButtonElement>) { if (event.button !== 0) return; event.preventDefault(); event.currentTarget.focus(); event.currentTarget.setPointerCapture?.(event.pointerId); drag.current = { side, id: event.pointerId, x: event.clientX, width: actual[side], saved: { ...latest.current } }; setDragging(side) },
    onPointerMove(event: PointerEvent<HTMLButtonElement>) { const d = drag.current; if (d && d.id === event.pointerId) resize(side, d.width + (event.clientX - d.x) * (side === 'left' ? 1 : -1), false) },
    onPointerUp(event: PointerEvent<HTMLButtonElement>) { finish(); if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) },
    onPointerCancel() { finish(true) }, onLostPointerCapture() { finish(true) },
    onKeyDown(event: KeyboardEvent<HTMLButtonElement>) { if (event.key === 'Escape') { finish(true); return }; if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return; event.preventDefault(); resize(side, event.key === 'Home' ? min[side] : event.key === 'End' ? limit(side) : actual[side] + (event.key === 'ArrowRight' ? 1 : -1) * (side === 'left' ? 1 : -1) * (event.shiftKey ? 40 : 10)) }
  })
  const style = { '--ca-left': `${layout.leftOpen ? actual.left : rail}px`, '--ca-right': `${layout.rightOpen ? actual.right : rail}px`, '--ca-left-gap': layout.leftOpen ? '8px' : '0px', '--ca-right-gap': layout.rightOpen ? '8px' : '0px', '--ca-left-rail': layout.leftOpen ? '0px' : `${rail}px`, '--ca-right-rail': layout.rightOpen ? '0px' : `${rail}px` } as CSSProperties
  return { root, compact, dragging, layout, actual, style, toggle, events, limit }
}
