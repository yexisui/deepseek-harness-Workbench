import { useEffect, useRef, useState, type PointerEvent } from 'react'

export function useCompositionSort(move?: (id: string, target: string) => void) {
  const root = useRef<HTMLDivElement>(null), callback = useRef(move)
  callback.current = move
  const gesture = useRef<{ id: string; pointer: number; x: number; y: number; moved: boolean; handle: HTMLElement } | null>(null)
  const [sorting, setSorting] = useState<{ id: string; target: string | null } | null>(null)
  useEffect(() => {
    const hit = (event: globalThis.PointerEvent) => {
      const row = document.elementFromPoint?.(event.clientX, event.clientY)?.closest<HTMLElement>('[data-composition-row]')
      return row && root.current?.contains(row) ? row.dataset.compositionRow! : null
    }
    const clear = () => {
      const current = gesture.current; gesture.current = null; setSorting(null)
      if (current?.handle.hasPointerCapture?.(current.pointer)) current.handle.releasePointerCapture(current.pointer)
    }
    const move = (event: globalThis.PointerEvent) => {
      const current = gesture.current
      if (!current || current.pointer !== event.pointerId) return
      if (!current.moved && Math.hypot(event.clientX - current.x, event.clientY - current.y) < 7) return
      current.moved = true; event.preventDefault()
      current.handle.setPointerCapture?.(current.pointer)
      setSorting({ id: current.id, target: hit(event) })
      const scroll = root.current?.closest<HTMLElement>('section'), box = scroll?.getBoundingClientRect()
      if (scroll && box) { if (event.clientY < box.top + 45) scroll.scrollTop -= 12; else if (event.clientY > box.bottom - 45) scroll.scrollTop += 12 }
    }
    const finish = (event: globalThis.PointerEvent) => {
      const current = gesture.current
      if (!current || current.pointer !== event.pointerId) return
      const target = hit(event)
      if (current.moved && target && target !== current.id) callback.current?.(current.id, target)
      clear()
    }
    const cancel = (event: KeyboardEvent) => { if (event.key === 'Escape' && gesture.current) { event.preventDefault(); event.stopPropagation(); clear() } }
    window.addEventListener('pointermove', move, { passive: false }); window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', clear); window.addEventListener('blur', clear); window.addEventListener('keydown', cancel, true)
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', finish); window.removeEventListener('pointercancel', clear); window.removeEventListener('blur', clear); window.removeEventListener('keydown', cancel, true); gesture.current = null }
  }, [])
  return { root, sorting, start: (id: string, event: PointerEvent<HTMLElement>) => {
    if (!callback.current || event.button !== 0) return
    event.stopPropagation()
    gesture.current = { id, pointer: event.pointerId, x: event.clientX, y: event.clientY, moved: false, handle: event.currentTarget }
  } }
}
