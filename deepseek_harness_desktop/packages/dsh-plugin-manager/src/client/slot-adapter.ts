import type { ComponentType } from 'react'

export interface Entry { component: unknown }
export interface Registry {
  entries(key: string): readonly Entry[]
  subscribe(key: string, fn: () => void): () => void
}

/** Version-scoped compatibility seam: retain the resident entry's inject, children and stores.
 * The SDK supports shadowing but cannot delegate a declared child tree. A reversible
 * component decorator avoids redeclaring that tree or patching installed SDK files.
 */
export function decorateSlot(registry: Registry, key: string, expected: string, wrap: (original: ComponentType<any>) => ComponentType<any>): () => void {
  const changes = new Map<Entry, { original: ComponentType<any>; decorated: ComponentType<any> }>()
  const sync = () => {
    for (const entry of registry.entries(key)) {
      if (changes.has(entry) || typeof entry.component !== 'function' || entry.component.name !== expected) continue
      const original = entry.component as ComponentType<any>
      const decorated = wrap(original)
      changes.set(entry, { original, decorated })
      entry.component = decorated
    }
  }
  const unsubscribe = registry.subscribe(key, sync)
  sync()
  return () => {
    unsubscribe()
    for (const [entry, { original, decorated }] of changes) {
      if (entry.component === decorated) entry.component = original
    }
    changes.clear()
  }
}
