import { useLayoutEffect, useRef } from 'react'

export type NavigationFrame = { kind: string; section: string; label: string; view?: any; origin?: NavigationLocation }
export type NavigationLocation = { section: string; label: string; frames: NavigationFrame[] }
export type WorkbenchLink = { section: string; capabilityId?: string; componentId?: string; moduleName?: string; tab?: string; entryId?: string; scope?: string; returnTo?: 'component-center'; edit?: boolean; addComponent?: boolean; requestId?: string; origin?: NavigationLocation; restore?: NavigationLocation }
type Guard = { dirty: () => boolean; discard: () => void }
type NavigationStore = { frames: Map<symbol,{ depth: number; read: () => NavigationFrame }>; guards: Map<symbol,Guard> }
const storeKey = Symbol.for('dsh.workbench.navigation.v1')
function store(): NavigationStore {
  const host = window as any
  return host[storeKey] ??= { frames: new Map(), guards: new Map() }
}
const key = 'workbench-capability-link'
export function pendingNavigation(section?: string): WorkbenchLink | undefined {
  try { const value = JSON.parse(sessionStorage.getItem(key) ?? 'null'); return value && typeof value.section === 'string' && (!section || value.section === section) ? value : undefined } catch { return undefined }
}
export function consumeNavigation(link?: WorkbenchLink) {
  if (!link) return
  const current = pendingNavigation()
  if (current && JSON.stringify(current) === JSON.stringify(link)) { try { sessionStorage.removeItem(key) } catch {} }
}
export function restoredFrame(location: NavigationLocation | undefined, kind: string): NavigationFrame | undefined { return location?.frames?.find(frame => frame.kind === kind) }
export function useNavigationFrame(kind: string, depth: number, read: () => Omit<NavigationFrame,'kind'>, enabled = true) {
  const current = useRef(read); current.current = read
  useLayoutEffect(() => { if (!enabled) return; const id = Symbol(kind); store().frames.set(id,{depth,read:()=>({kind,...current.current()})}); return () => { store().frames.delete(id) } },[kind,depth,enabled])
}
export function useLeaveGuard(dirty: boolean, discard: () => void) {
  const current = useRef({dirty,discard}); current.current = {dirty,discard}
  useLayoutEffect(() => {
    const id = Symbol('guard'); store().guards.set(id,{dirty:()=>current.current.dirty,discard:()=>{const discard=current.current.discard;current.current.dirty=false;discard()}})
    const beforeLink = (event: Event) => { if (!requestLeave()) { consumeNavigation((event as CustomEvent).detail); event.stopImmediatePropagation() } }
    window.addEventListener('workbench-capability-link',beforeLink,true)
    return () => { store().guards.delete(id);window.removeEventListener('workbench-capability-link',beforeLink,true) }
  },[])
}
export function requestLeave(): boolean {
  if (typeof window === 'undefined') return true
  const dirty = [...store().guards.values()].filter(guard=>guard.dirty())
  if (!dirty.length) return true
  if (!window.confirm('当前配置尚未保存，确定放弃修改并离开？')) return false
  dirty.forEach(guard=>guard.discard()); return true
}
export function captureNavigation(): NavigationLocation | undefined {
  const frames = [...store().frames.values()].sort((a,b)=>a.depth-b.depth).map(entry=>entry.read())
  if (!frames.length) return undefined
  return {section:frames[0]!.section,label:frames[0]!.label,frames}
}
export function openWorkbenchLink(target: WorkbenchLink): boolean {
  // Capture before confirmed departure discards forms or changes their local state.
  const origin = target.restore ? target.origin : target.origin ?? captureNavigation()
  if (!requestLeave()) return false
  const link = {...target,requestId:crypto.randomUUID(),origin}
  try { sessionStorage.setItem(key,JSON.stringify(link)) } catch { /* In-memory event navigation remains available. */ }
  window.dispatchEvent(new CustomEvent('workbench-capability-link',{detail:link})); return true
}
export function returnNavigation(origin?: NavigationLocation): boolean {
  if (!origin) return false
  const component = restoredFrame(origin,'components')?.view, capability = restoredFrame(origin,'capabilities')?.view
  return openWorkbenchLink({section:origin.section,componentId:component?.selected,capabilityId:capability?.selected,tab:component?.tab??capability?.tab,restore:origin,origin:origin.frames.at(-1)?.origin})
}
export function legacyOrigin(link?: WorkbenchLink): NavigationLocation | undefined {
  if (link?.origin) return link.origin
  if (link?.returnTo === 'component-center' || link?.section === 'plugins' && link.componentId) return {section:'component-center',label:'组件中心',frames:[{kind:'components',section:'component-center',label:'组件中心',view:{selected:link.componentId,pane:'detail',...(link.section==='plugins'?{tab:'plugins'}:{})}}]}
  return undefined
}
