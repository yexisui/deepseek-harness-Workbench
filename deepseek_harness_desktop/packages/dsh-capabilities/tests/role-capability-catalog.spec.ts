import { expect, it } from 'vitest'
import { initialState } from '../src/core/model.ts'
import { capabilityCatalog, roleCapabilityReason } from '../src/core/role-capability-catalog.ts'
import { MEETING_ROLE_ID } from '../src/core/default-roles.ts'

it('keeps unpublished and disabled records visible and only excludes removed records', () => {
  const state = initialState(), first = state.capabilities[0]!
  first.versions = []; first.enabled = false
  expect(capabilityCatalog(state.capabilities)).toHaveLength(state.capabilities.length)
  expect(roleCapabilityReason('builtin-manager', first)).toContain('未发布')
  first.removedAt = new Date().toISOString()
  expect(capabilityCatalog(state.capabilities).some(c => c.id === first.id)).toBe(false)
})
it('explains meeting compatibility while allowing the implemented segment extension', () => {
  const state = initialState(), meeting = state.capabilities.find(c => c.id === 'meeting-transcription')!
  expect(roleCapabilityReason('builtin-manager', meeting)).toContain('仅供会议纪要助手')
  expect(roleCapabilityReason(MEETING_ROLE_ID, meeting)).toBeUndefined()
  const cap = structuredClone(state.capabilities[0]!)
  expect(roleCapabilityReason(MEETING_ROLE_ID, cap)).toContain('尚未接入')
  cap.versions[0]!.components = [{componentId:'pkg:audio:segments',actions:['pack:audio:segments:plan-audio-segments']}]
  expect(roleCapabilityReason(MEETING_ROLE_ID, cap)).toBeUndefined()
  cap.enabled = false
  expect(roleCapabilityReason(MEETING_ROLE_ID, cap)).toBeUndefined()
})
