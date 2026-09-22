import React, { createContext, useContext, useState, useSyncExternalStore } from 'react'
import { catalog, defaults, type Capability, type Options } from './capability-catalog.ts'

type Draft = { pinned: boolean; instructions: string | null; options: Options }
/** UI demonstration state only: no storage, host API, plugin or permission mutation. */
export function createCapabilityPreview() {
  let drafts = Object.fromEntries(catalog.map(item => [item.id, { pinned: item.id === 'browser', instructions: null, options: defaults() }])) as Record<Capability, Draft>
  const listeners = new Set<() => void>()
  return {
    getSnapshot: () => drafts,
    subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } },
    update: (id: Capability, patch: Partial<Draft>) => {
      drafts = { ...drafts, [id]: { ...drafts[id], ...patch } }
      listeners.forEach(fn => fn())
    },
  }
}
export type CapabilityPreviewStore = ReturnType<typeof createCapabilityPreview>
export const CapabilityPreviewContext = createContext<CapabilityPreviewStore | null>(null)
export function useCapabilityPreview(supplied?: CapabilityPreviewStore) {
  const context = useContext(CapabilityPreviewContext)
  const [fallback] = useState(createCapabilityPreview)
  const store = supplied ?? context ?? fallback
  const drafts = useSyncExternalStore(store.subscribe, store.getSnapshot)
  return { store, drafts }
}
