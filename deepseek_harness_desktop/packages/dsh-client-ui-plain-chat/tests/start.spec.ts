import { describe, expect, it, vi } from 'vitest'
import { ChatStart, PRESET_ID, type StartPort } from '../src/core/start.ts'

function fixture() {
  const port: StartPort = { create: vi.fn(async () => ({ ok: true })), adopt: vi.fn(async () => 'session-1'), deliver: vi.fn() }
  return { port, start: new ChatStart(port, 'C:\\workbench\\chat-data', () => 'session-1') }
}
describe('first message transaction', () => {
  it('creates the restricted preset, adopts the same id, then delivers exactly once', async () => {
    const { start, port } = fixture()
    await Promise.all([start.send('hello'), start.send('hello')])
    expect(port.create).toHaveBeenCalledTimes(1)
    expect(port.create).toHaveBeenCalledWith({ sessionId: 'session-1', cwd: 'C:\\workbench\\chat-data', agentPreset: PRESET_ID })
    expect(port.adopt).toHaveBeenCalledWith({ sessionId: 'session-1', cwd: 'C:\\workbench\\chat-data' })
    expect(port.deliver).toHaveBeenCalledExactlyOnceWith('session-1', 'hello')
  })
  it('retains the id across an uncertain creation failure and never delivers the rejected attempt', async () => {
    const { start, port } = fixture()
    vi.mocked(port.create).mockRejectedValueOnce(new Error('network'))
    await expect(start.send('preserve this')).rejects.toThrow('network')
    expect(port.deliver).not.toHaveBeenCalled()
    await start.send('preserve this')
    expect(vi.mocked(port.create).mock.calls.map(([r]) => r.sessionId)).toEqual(['session-1', 'session-1'])
  })
  it('does not navigate or submit after the user has left the draft', async () => {
    const { start, port } = fixture()
    let finish!: (value: { ok: boolean }) => void
    vi.mocked(port.create).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const pending = start.send('old draft')
    start.reset(); finish({ ok: true }); await pending
    expect(port.adopt).not.toHaveBeenCalled()
    expect(port.deliver).not.toHaveBeenCalled()
  })
  it('ignores whitespace and surfaces host refusal without losing the caller draft', async () => {
    const { start, port } = fixture()
    await start.send('  ')
    expect(port.create).not.toHaveBeenCalled()
    vi.mocked(port.create).mockResolvedValueOnce({ ok: false, error: { message: 'preset unavailable' } })
    await expect(start.send('question')).rejects.toThrow('preset unavailable')
    expect(port.adopt).not.toHaveBeenCalled()
  })
})
