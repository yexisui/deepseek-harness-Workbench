import type { PreviewRole } from './role-catalog.ts'
import { requestLeave } from '../../../dsh-plugin-manager/src/client/workbench-navigation.ts'

/** Shared UI state; never changes a host preset or existing session. */
export function createRoleSelection<T extends string = PreviewRole>() {
  let selected: T = 'chat' as T
  const listeners = new Set<() => void>()
  return {
    getSnapshot: () => selected,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    select: (role: T) => { selected = role; listeners.forEach(listener => listener()) },
  }
}
export function createSettingsNavigation() {
  let revision = 0
  let section = 'agent-presets'
  const listeners = new Set<() => void>()
  return {
    getSnapshot: () => revision,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    getSection: () => section,
    openSection: (value: string) => { if (!requestLeave()) return; section = value; revision++; listeners.forEach(listener => listener()) },
    openPresets: () => { if (!requestLeave()) return; section = 'agent-presets'; revision++; listeners.forEach(listener => listener()) },
  }
}
export type SettingsNavigation = ReturnType<typeof createSettingsNavigation>
