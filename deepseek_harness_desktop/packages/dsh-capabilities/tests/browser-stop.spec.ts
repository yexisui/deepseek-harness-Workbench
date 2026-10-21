import { describe, expect, it, vi } from 'vitest'
import { CapabilityRuntime } from '../src/host/runtime.ts'
import { initialState } from '../src/core/model.ts'

function fixture() {
  const state = initialState(), role = state.roles[0]!, version = role.versions.at(-1)!
  version.capabilities = [{ capabilityId: 'browser', version: 1, enabled: true }]
  const owned = new Set(['first', 'second'])
  const runtime = new CapabilityRuntime({} as never, { snapshot: () => state } as never, { bskPath: '', bskHome: '', port: 0 })
  runtime.health.loaded = true
  const live = { agent: { id: 'test-agent', session: { header: { createdAt: 1 } } }, roleId: role.id, version, task: { status: 'idle' }, calls: new Map(), stopped: false }
  const stopSession = vi.fn(async (id: string) => owned.delete(id))
  const internal = runtime as any
  internal.registry = { ownedIds: () => [...owned], dshOwnersOf: () => ['test-agent'] }
  internal.observation = { stopSession }
  internal.live.set(live.agent.id, live)
  const args = { action: 'stop', session: 'first' }
  const exec = { name: 'browser_session', arguments: args, agent: live.agent, callId: 'test-call', signal: new AbortController().signal }
  const execute = vi.fn(async () => { owned.delete(args.session); return { stopped: args.session } })
  const run = () => internal.execute(live, { name: exec.name, execute }, args, exec)
  return { state, role, runtime, live, owned, stopSession, args, exec, execute, run }
}

describe('browser window stop completion', () => {
  it('reports a successful close and preserves another window belonging to the same task', async () => {
    const f = fixture()
    await expect(f.run()).resolves.toEqual({ stopped: 'first' })
    expect([...f.owned]).toEqual(['second'])
    expect(f.stopSession).not.toHaveBeenCalled()
    expect(f.live.task.status).toBe('idle')
  })

  it('rejects an unowned window before calling the browser', async () => {
    const f = fixture(); f.args.session = 'foreign'
    await expect(f.run()).rejects.toThrow('必须显式传入')
    expect(f.execute).not.toHaveBeenCalled()
    expect([...f.owned]).toEqual(['first', 'second'])
  })

  it.each(['revoked', 'disabled', 'unloaded', 'cancelled'])('still rejects completion after %s during a close', async reason => {
    const f = fixture()
    f.execute.mockImplementation(async () => {
      f.owned.delete('first')
      if (reason === 'revoked') f.state.revokedAt = { 'capability:browser': Date.now() }
      if (reason === 'disabled') f.state.capabilities.find(c => c.id === 'browser')!.enabled = false
      if (reason === 'unloaded') f.runtime.health.loaded = false
      if (reason === 'cancelled') f.live.calls.get(f.exec.callId).abort.abort()
      return { stopped: 'first' }
    })
    await expect(f.run()).rejects.toThrow('权限已撤销')
    expect(f.stopSession).toHaveBeenCalledWith('second')
    expect(f.owned.size).toBe(0)
  })

  it('does not waive ownership checks for a read whose window disappeared', async () => {
    const f = fixture(); f.exec.name = 'browser_inspect'; f.args.action = 'observe'
    await expect(f.run()).rejects.toThrow('权限已撤销')
  })

  it('preserves browser stop failures without closing sibling windows', async () => {
    const f = fixture(); f.execute.mockRejectedValue(new Error('Browser disconnected'))
    await expect(f.run()).rejects.toThrow('Browser disconnected')
    expect([...f.owned]).toEqual(['first', 'second'])
    expect(f.stopSession).not.toHaveBeenCalled()
  })
})
