import { useEffect, useReducer, useState } from 'react'
import { emptyDefinition, type Definition, type Snapshot } from '../../../dsh-capabilities/src/core/model.ts'
import { editorDrafts } from './capability-client.ts'

const changed = 'workbench-capability-draft'
export function clearCapabilityDraft(id?: string) {
  editorDrafts.delete(`capability:${id ?? 'new'}`)
  window.dispatchEvent(new Event(changed))
}
/** Detail and editor share the same uncommitted draft and optimistic save revision. */
export function useCapabilityDefinition(id: string | undefined, data: Snapshot) {
  const [, refresh] = useReducer(n => n + 1, 0), [empty] = useState(emptyDefinition)
  useEffect(() => { window.addEventListener(changed, refresh); return () => window.removeEventListener(changed, refresh) }, [])
  const key = `capability:${id ?? 'new'}`, cached = editorDrafts.get(key)
  const saved = data.state.capabilities.find(c => c.id === id)?.draft ?? empty
  const draft = cached?.value as Definition ?? saved, revision = cached?.revision ?? data.state.revision
  const change = (value: Definition, base = revision) => {
    editorDrafts.set(key, { value: structuredClone(value), revision: base })
    window.dispatchEvent(new Event(changed))
  }
  return { draft, revision, change, dirty: JSON.stringify(draft) !== JSON.stringify(saved), discard: () => clearCapabilityDraft(id), rebase: () => change(draft, data.state.revision) }
}
