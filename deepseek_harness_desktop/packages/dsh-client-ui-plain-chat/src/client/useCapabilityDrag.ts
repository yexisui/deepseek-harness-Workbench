import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent } from 'react'
import type { Capability } from './capability-catalog.ts'

/** Pointer dragging distinguishes a deliberate drag from a card or add-button click. */
export function useCapabilityDrag(add: (id: Capability) => void) {
  const zone = useRef<HTMLDivElement>(null)
  const callback = useRef(add)
  callback.current = add
  const gesture = useRef<{ id: Capability; pointer: number; x: number; y: number; moved: boolean; source: HTMLElement } | null>(null)
  const suppressClickUntil = useRef(0)
  const [drag, setDrag] = useState<{ id: Capability; x: number; y: number } | null>(null)
  const [over, setOver] = useState(false)
  useEffect(() => {
    const isOver = (x: number, y: number) => {
      // Hit-test the visible surface: clipped portions must not cover the footer.
      const target = document.elementFromPoint?.(x, y)
      return !!target && !!zone.current?.contains(target)
    }
    const clear = () => {
      const current = gesture.current
      gesture.current = null
      if (current?.source.hasPointerCapture?.(current.pointer)) current.source.releasePointerCapture(current.pointer)
      setDrag(null); setOver(false)
    }
    const move = (event: PointerEvent) => {
      const current = gesture.current
      if (!current || current.pointer !== event.pointerId) return
      if (!current.moved && Math.hypot(event.clientX-current.x, event.clientY-current.y) < 7) return
      if (!current.moved) {
        current.moved = true
        current.source.setPointerCapture?.(current.pointer)
        zone.current?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
      }
      event.preventDefault()
      setDrag({ id: current.id, x: event.clientX, y: event.clientY })
      setOver(isOver(event.clientX, event.clientY))
    }
    const finish = (event: PointerEvent) => {
      const current = gesture.current
      if (!current || current.pointer !== event.pointerId) return
      if (current.moved) {
        suppressClickUntil.current = Date.now() + 250
        if (isOver(event.clientX, event.clientY)) callback.current(current.id)
      }
      clear()
    }
    const cancel = () => { if (gesture.current?.moved) suppressClickUntil.current = Date.now() + 250; clear() }
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape' && gesture.current?.moved) { event.preventDefault(); event.stopPropagation(); cancel() } }
    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', cancel)
    window.addEventListener('blur', cancel)
    window.addEventListener('keydown', key, true)
    return () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', cancel); window.removeEventListener('blur', cancel); window.removeEventListener('keydown', key, true)
    }
  }, [])
  return {
    zone, drag, over,
    start: (id: Capability, event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0 || gesture.current || (event.target as HTMLElement).closest('[data-capability-add]')) return
      gesture.current = { id, pointer: event.pointerId, x: event.clientX, y: event.clientY, moved: false, source: event.currentTarget }
    },
    click: (event: ReactMouseEvent) => { if (Date.now() < suppressClickUntil.current) { event.preventDefault(); event.stopPropagation() } },
  }
}
