import { describe, expect, it } from 'vitest'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import type { AssistantStreamFrame } from '@deepseek-ai/dsh-agent'
import { emptyProjectionRuntime, projectOfficialEvent, projectAssistantStreamFrame, projectUserQuestion } from './event-projection.ts'
const event = (type: string, data: unknown = {}): SessionEvent => ({ type, data }) as SessionEvent
const stream = (type: string): AssistantStreamFrame => ({ type: 'chunk', chunk: { type, text: 'test' } }) as AssistantStreamFrame

describe('human wait projection on the pinned SDK', () => {
  it('prepares and reasons as thinking, displays text as work, and completes', () => {
    const r = emptyProjectionRuntime()
    expect(projectOfficialEvent(event('turn/start'), r)?.input.phase).toBe('thinking')
    expect(projectOfficialEvent(event('step/start'), r)?.input.phase).toBe('thinking')
    expect(projectAssistantStreamFrame(stream('reasoning-delta'), r)?.input.phase).toBe('thinking')
    expect(projectAssistantStreamFrame(stream('text-delta'), r)?.input.phase).toBe('review')
    expect(projectOfficialEvent(event('turn/end', { turn: 1, reason: { kind: 'completed' } }), r)).toMatchObject({ input: { phase: 'done' }, completedTurn: 1 })
  })
  it('keeps overlapping human waits until all resolve and resumes the latest progress', () => {
    const r = emptyProjectionRuntime()
    projectOfficialEvent(event('turn/start'), r)
    expect(projectOfficialEvent(event('approval/asked', { id: 'a' }), r)?.input.phase).toBe('waiting')
    expect(projectUserQuestion(r, 'q', true).phase).toBe('waiting')
    expect(projectAssistantStreamFrame(stream('text-delta'), r)?.input.phase).toBe('waiting')
    expect(projectOfficialEvent(event('approval/decided', { id: 'a' }), r)?.input.phase).toBe('waiting')
    expect(projectUserQuestion(r, 'q', false).phase).toBe('review')
  })
  it('clears waits at turn termination without losing reward or failure information', () => {
    const r = emptyProjectionRuntime()
    projectUserQuestion(r, 'q', true)
    expect(projectOfficialEvent(event('turn/end', { turn: 2, reason: { kind: 'error' } }), r)?.input.phase).toBe('failed')
    expect(projectUserQuestion(r, 'q', false).phase).toBe('failed')
    expect(r.questions.size).toBe(0)
  })
})
