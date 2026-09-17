import { describe, expect, it } from 'vitest'
import { decorateSlot } from '../src/client/slot-adapter.ts'

describe('version-scoped slot adapter', () => {
  it('preserves the entry identity and ownership, then restores the resident component', () => {
    function ConversationRoot() { return null }
    function Decorated() { return null }
    const inject = () => ({})
    const entry = { component: ConversationRoot, children: { a: {} }, inject }
    let listener = () => {}
    const registry = { entries: () => [entry], subscribe: (_: string, fn: () => void) => { listener = fn; return () => {} } }
    const dispose = decorateSlot(registry, 'main.conversation', 'ConversationRoot', () => Decorated)
    expect(entry.component).toBe(Decorated)
    expect(entry.inject).toBe(inject)
    expect(entry.children).toEqual({ a: {} })
    listener(); expect(entry.component).toBe(Decorated)
    dispose(); expect(entry.component).toBe(ConversationRoot)
  })
  it('does not wrap unknown versions or overwrite a subsequent owner on cleanup', () => {
    function OtherVersion() { return null }
    function SidebarRoot() { return null }
    function Decorated() { return null }
    const entries = [{ component: OtherVersion }, { component: SidebarRoot }]
    const registry = { entries: () => entries, subscribe: () => () => {} }
    const dispose = decorateSlot(registry, 'sidebar', 'SidebarRoot', () => Decorated)
    expect(entries[0].component).toBe(OtherVersion)
    entries[1].component = OtherVersion
    dispose(); expect(entries[1].component).toBe(OtherVersion)
  })
})
