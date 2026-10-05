import type { Classification } from '../core/classification.ts'

export type CategoryItem = { kind: 'group' | 'module'; id: string }
export type CategorySlot = { groupId: string; before?: string }

// Display order only; stable module IDs keep all plugin assignments intact.
export function moveCategory(value: Classification, item: CategoryItem, slot: CategorySlot): Classification {
  if (item.kind === 'group') {
    const source = value.groups.find(g => g.id === item.id)
    if (!source || slot.before === item.id || (slot.before && !value.groups.some(g => g.id === slot.before))) return value
    const groups = value.groups.filter(g => g.id !== item.id)
    groups.splice(slot.before ? groups.findIndex(g => g.id === slot.before) : groups.length, 0, source)
    return { ...value, groups }
  }
  const source = value.modules.find(m => m.id === item.id)
  if (!source || !value.groups.some(g => g.id === slot.groupId) || slot.before === item.id) return value
  if (slot.before && !value.modules.some(m => m.id === slot.before && m.groupId === slot.groupId)) return value
  const rest = value.modules.filter(m => m.id !== item.id)
  const siblings = rest.filter(m => m.groupId === slot.groupId)
  siblings.splice(slot.before ? siblings.findIndex(m => m.id === slot.before) : siblings.length, 0, { ...source, groupId: slot.groupId })
  return { ...value, modules: value.groups.flatMap(g => g.id === slot.groupId ? siblings : rest.filter(m => m.groupId === g.id)) }
}
