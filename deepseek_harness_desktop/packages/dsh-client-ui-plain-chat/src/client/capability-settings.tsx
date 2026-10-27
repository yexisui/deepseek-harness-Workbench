import type { ComponentType } from 'react'

/** The existing settings list contract; contributes one page without replacing the shell. */
interface SettingsRegistry {
  inject(name: 'settings.section', setup: () => () => void): unknown
  register(options: { name: 'settings.section'; id: string; order: number; label: () => string; locale: string }, component: ComponentType): () => void
}
export function registerTeamContributions(slots:SettingsRegistry,component:ComponentType){slots.inject('settings.section',()=>slots.register({name:'settings.section',id:'team-contributions',order:153,label:()=> '团队贡献',locale:'workbench-chat'},component))}
export function registerCapabilityCenter(slots: SettingsRegistry, label: () => string, component: ComponentType) {
  slots.inject('settings.section', () => slots.register({ name: 'settings.section', id: 'capability-center', order: 21, label, locale: 'workbench-chat' }, component))
}
