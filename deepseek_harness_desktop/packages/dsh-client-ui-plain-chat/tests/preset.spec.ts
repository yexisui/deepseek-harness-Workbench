import { readFileSync } from 'node:fs'
import { load } from 'js-yaml'
import { describe, expect, it, vi } from 'vitest'

import { apply, inject, name } from '../presets/workbench-chat/no-tools.mjs'

const presetRoot = new URL('../presets/workbench-chat/', import.meta.url)

interface PresetRow {
  id: string
  name: string
  config?: Record<string, unknown>
}

describe('workbench-chat preset', () => {
  it('ships only a persona and the conversation-only capability boundary', () => {
    const rows = load(readFileSync(new URL('agent.cordis.yml', presetRoot), 'utf8')) as PresetRow[]
    expect(rows.map(row => row.name)).toEqual([
      '@deepseek-ai/dsh-persona',
      './no-tools.mjs',
    ])
    expect(rows[0]?.config).toMatchObject({ complete: true, includeRuntimeContext: false })
    expect(rows[0]?.config?.prefix).toEqual(expect.stringContaining('conversation-only session'))
    expect(rows[0]?.config?.prefix).toEqual(expect.stringContaining("Respond in the user's"))
  })

  it('exposes a distinct ordinary-chat entry instead of redefining the standard preset', () => {
    const metadata = load(readFileSync(new URL('preset.yml', presetRoot), 'utf8')) as Record<string, unknown>
    expect(metadata.name).toBe('普通聊天')
    expect(metadata.description).toEqual(expect.stringContaining('不执行命令'))
    expect(metadata.order).toBeLessThan(0)
    expect(name).toBe('workbench-chat-no-tools')
    expect(inject).toEqual(['tools'])
  })

  it('hides every inherited capability, including capabilities added after mounting', () => {
    const restrict = vi.fn()
    const guard = vi.fn()
    apply({ tools: { restrict, guard } } as unknown as Parameters<typeof apply>[0])

    expect(restrict).toHaveBeenCalledExactlyOnceWith({ allow: [] })
    const restriction = restrict.mock.calls[0]?.[0] as { allow: string[] }
    for (const tool of ['bash', 'pwsh', 'read_file', 'write_file', 'future-plugin-tool']) {
      expect(restriction.allow.includes(tool)).toBe(false)
    }
  })

  it('also denies execution of same-scope and later-added tools', () => {
    const restrict = vi.fn()
    const guard = vi.fn()
    apply({ tools: { restrict, guard } } as unknown as Parameters<typeof apply>[0])

    expect(guard).toHaveBeenCalledTimes(1)
    const reject = guard.mock.calls[0]?.[0] as (execution: unknown) => string | undefined
    for (const tool of ['bash', 'run_code', 'new-local-tool']) {
      expect(reject({ tool, args: {} })).toEqual(expect.stringContaining('cannot execute tools'))
    }
  })
})
