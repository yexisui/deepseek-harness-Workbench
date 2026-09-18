import type { PreviewRole } from './role-catalog.ts'

/** Shared UI state; never changes a host preset or existing session. */
export function createRoleSelection() {
  let selected: PreviewRole = 'chat'
  const listeners = new Set<() => void>()
  return {
    getSnapshot: () => selected,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    select: (role: PreviewRole) => { selected = role; listeners.forEach(listener => listener()) },
  }
}
export function createSettingsNavigation() {
  let revision = 0
  const listeners = new Set<() => void>()
  return {
    getSnapshot: () => revision,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    openPresets: () => { revision++; listeners.forEach(listener => listener()) },
  }
}
export type SettingsNavigation = ReturnType<typeof createSettingsNavigation>
