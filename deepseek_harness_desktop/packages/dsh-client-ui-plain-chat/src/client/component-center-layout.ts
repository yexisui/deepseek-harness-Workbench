import { useLayoutEffect, useState, type RefObject } from 'react'

export type CenterView = {
  selected: string; tab: string; query: string; filter: string; category: string; pane: 'list' | 'detail'
  tabs: Record<string, string>; scroll: Record<string, number>; folds?: Record<string, boolean>
}
const fallback = new Map<string, CenterView>()
export function readCenterView(key: string): Partial<CenterView> {
  try {
    const value = JSON.parse(sessionStorage.getItem('workbench-component-center:' + key) ?? '{}')
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  }
  catch { return fallback.get(key) ?? {} }
}
export function rememberCenterView(key: string, view: CenterView) {
  fallback.set(key, view)
  try { sessionStorage.setItem('workbench-component-center:' + key, JSON.stringify(view)) } catch { /* Optional navigation memory. */ }
}

/** The settings sidebar and dialog header consume space independently of the viewport. */
export function useCenterLayout(ref: RefObject<HTMLElement>, active: boolean) {
  const [layout, setLayout] = useState({ width: 0, height: undefined as number | undefined, wide: false, narrow: false })
  useLayoutEffect(() => {
    const element = ref.current
    if (!active || !element) return
    const boundaries: HTMLElement[] = []
    for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
      const style = getComputedStyle(parent)
      if (/auto|scroll|hidden|clip/.test(style.overflowY) || parent.matches('dialog,[role="dialog"]')) boundaries.push(parent)
    }
    const measure = () => {
      const rect = element.getBoundingClientRect(), width = Math.round(rect.width || element.clientWidth)
      let bottom = window.visualViewport ? window.visualViewport.height + window.visualViewport.offsetTop : window.innerHeight
      for (const parent of boundaries) { const bound = parent.getBoundingClientRect(); if (bound.height > 0) bottom = Math.min(bottom, bound.bottom) }
      const height = width > 0 && bottom > rect.top ? Math.max(0, Math.floor(bottom - rect.top - 16)) : undefined
      setLayout(previous => previous.width === width && previous.height === height ? previous : { width, height, wide: width >= 1040, narrow: width > 0 && width < 560 })
    }
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure)
    observer?.observe(element)
    if (element.parentElement) observer?.observe(element.parentElement)
    for (const boundary of boundaries) observer?.observe(boundary)
    window.addEventListener('resize', measure)
    window.visualViewport?.addEventListener('resize', measure)
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); window.visualViewport?.removeEventListener('resize', measure) }
  }, [active, ref])
  return layout
}
