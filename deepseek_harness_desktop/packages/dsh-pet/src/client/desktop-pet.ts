import { useEffect, useRef, useState } from 'react'

type Position = { right: number; bottom: number }
type Bridge = {
  petWindow: (action: string, value?: unknown) => Promise<Position | undefined>
  onPetLayout: (callback: (position: Position) => void) => () => void
  onPetClosed: (callback: () => void) => () => void
}
export type DesktopPetSurface = {
  detached: boolean
  error: string
  detach: (width: number, height: number, cursor?: boolean) => void
  attach: () => void
  dragStart: (x: number, y: number) => void
  dragEnd: () => void
  resize: (width: number, height: number) => void
}
const bridge = (): Bridge | undefined => {
  const desktop = (window as unknown as { desktop?: Bridge }).desktop
  return desktop?.petWindow ? desktop : undefined
}
let detached = false
export const isDesktopPetDetached = (): boolean => detached
const announce = (value: boolean): void => {
  detached = value
  window.dispatchEvent(new Event('workbench-pet-surface-changed'))
}

/** A same-origin native window hosts the existing React portal and its services. */
export function useDesktopPet(): {
  surface?: DesktopPetSurface; target?: HTMLElement; view?: Window; position?: Position
} {
  const api = bridge()
  const popup = useRef<Window | null>(null)
  const cleanup = useRef<(() => void) | undefined>(undefined)
  const [state, setState] = useState<{ target: HTMLElement; view: Window; position?: Position }>()
  const [error, setError] = useState('')
  const reset = (): void => {
    cleanup.current?.(); cleanup.current = undefined; popup.current = null
    announce(false); setState(undefined)
  }
  useEffect(() => {
    if (!api) return
    const offLayout = api.onPetLayout(position => setState(old => old && (old.position?.right !== position.right || old.position?.bottom !== position.bottom) ? { ...old, position } : old))
    const offClosed = api.onPetClosed(reset)
    return () => {
      offLayout(); offClosed(); cleanup.current?.(); popup.current?.close(); announce(false)
    }
  }, [])
  const detach = async (width: number, height: number, cursor = false): Promise<void> => {
    if (!api || popup.current) return
    setError('')
    let child: Window | null = null
    let observer: MutationObserver | undefined
    try {
      child = window.open('about:blank', 'workbench-desktop-pet')
      if (!child) throw Error('无法打开桌面宠物，请重启桌面端后重试。')
      popup.current = child
      const doc = child.document
      doc.title = '桌面宠物'
      const base = doc.createElement('base'); base.href = document.baseURI; doc.head.append(base)
      const copyStyles = (): void => {
        doc.head.querySelectorAll('[data-pet-style]').forEach(node => node.remove())
        document.head.querySelectorAll('style,link[rel="stylesheet"]').forEach(node => {
          const copy = node.cloneNode(true) as HTMLElement; copy.dataset.petStyle = ''; doc.head.append(copy)
        })
        for (const attr of Array.from(document.documentElement.attributes)) doc.documentElement.setAttribute(attr.name, attr.value)
        doc.body.className = document.body.className
        const clear = doc.createElement('style'); clear.dataset.petStyle = ''
        clear.textContent = 'html,body{margin:0!important;background:transparent!important;background-image:none!important;overflow:hidden!important;min-width:0!important;min-height:0!important}body::before,body::after{display:none!important}'
        doc.head.append(clear)
      }
      copyStyles()
      observer = new MutationObserver(copyStyles)
      observer.observe(document.head, { childList: true, subtree: true, characterData: true })
      observer.observe(document.documentElement, { attributes: true })
      observer.observe(document.body, { attributes: true })
      const target = doc.createElement('div'); target.dataset.dshPlugin = 'pet'; target.dataset.dshPetRoot = ''; doc.body.append(target)
      const position = await api.petWindow('place', { width, height, cursor })
      if (popup.current !== child || child.closed) { observer.disconnect(); return }
      setState({ target, view: child, position }); announce(true)
      let shown = false
      let lastRegions = ''
      const updateRegions = (): void => {
        if (child!.closed) return
        const rects = Array.from(target.querySelectorAll<HTMLElement>('[data-pet-hit],button,input,select,textarea,a'))
          .filter(node => child!.getComputedStyle(node).visibility !== 'hidden')
          .map(node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height } })
          .filter(r => r.width > 0 && r.height > 0).slice(0, 200)
        const key = JSON.stringify(rects)
        if (key !== lastRegions) { lastRegions = key; void api.petWindow('hit-regions', rects).catch(() => {}) }
        if (!shown && rects.length) { shown = true; void api.petWindow('show').catch(() => {}) }
      }
      // Geometry changes only when controls/layout change; canvas frame paints
      // do not need IPC or forced layout. Keep a slow fallback for CSS motion.
      let pending = 0
      const scheduleRegions = (): void => {
        if (!pending) pending = child!.requestAnimationFrame(() => { pending = 0; updateRegions() })
      }
      const geometry = new MutationObserver(scheduleRegions)
      geometry.observe(target, { childList: true, subtree: true, attributes: true, characterData: true })
      child.addEventListener('resize', scheduleRegions)
      const timer = window.setInterval(updateRegions, 250)
      scheduleRegions()
      cleanup.current = () => { observer?.disconnect(); geometry.disconnect(); child?.removeEventListener('resize', scheduleRegions); if (pending) child?.cancelAnimationFrame(pending); window.clearInterval(timer) }
    } catch (e) {
      observer?.disconnect(); child?.close(); reset(); setError(e instanceof Error ? e.message : String(e))
    }
  }
  if (!api) return {}
  return { ...state, surface: {
    detached: !!state, error,
    detach: (width, height, cursor) => { void detach(width, height, cursor) },
    attach: () => { void api.petWindow('close').catch(() => { popup.current?.close(); reset() }) },
    dragStart: (x, y) => { void api.petWindow('drag-start', { x, y }).catch(() => {}) },
    dragEnd: () => { void api.petWindow('drag-end').catch(() => {}) },
    resize: (width, height) => { void api.petWindow('place', { width, height }).catch(() => {}) },
  } }
}

export function raisePetOwner(): void { void bridge()?.petWindow('show-main') }
