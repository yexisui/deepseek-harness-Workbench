/**
 * Live-benchmark harness: the pure steps that decide what a run MEANS.
 *
 * The harness exists so a comparison cannot quietly measure the wrong thing, so
 * these tests pin every place that could:
 * - `materializePreset` rewrites the variant's composition. The shipped file also
 *   names `anchorTools: [bash]` inside its prose, so a rewrite that matched the
 *   first occurrence would report a variant it never applied.
 * - `replacePersonaPrefix` edits a YAML block scalar, so it must stop at the
 *   next composition row and keep the candidate text indented inside the scalar.
 * - `summarizeSession` reads the durable session shapes. The tool surface and the
 *   real model route live under `request/header` -> `data.header`, not at the top
 *   level, and an unread shape must stay visibly empty rather than look verified.
 * - `summarizeUsage` must not double-count one attempt's usage chunk and message.
 */

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { validateAgentCordis } from '../src/schema.ts'

import {
  CANDIDATE_PERSONA,
  LIVE_VARIANTS,
  assertPriceEntry,
  evaluateCheck,
  hashTree,
  loadTaskFile,
  materializePreset,
  officialMinimalPresetDir,
  priceRun,
  routePrices,
  runLiveSuite,
  replacePersonaPrefix,
  suitePlan,
  summarizeSession,
  summarizeUsage,
  taskRevision,
} from '../tools/benchmark-live-run.mjs'

const scratch: string[] = []

function scratchDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'liangshen-bench-test-'))
  scratch.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function composition(variantId: string): string {
  const target = materializePreset(scratchDir(), variantId, LIVE_VARIANTS[variantId as keyof typeof LIVE_VARIANTS])
  return readFileSync(join(target, 'agent.cordis.yml'), 'utf8')
}

describe('benchmark variant materialization', () => {
  it('keeps the shipped persona and tool strategy for the baseline group', () => {
    const text = composition('B')
    expect(text).toMatch(/^\s*anchorTools: \[bash, str_replace_editor, exit_plan_mode, skill\]$/m)
    expect(text).toMatch(/^\s*ptcPresentation: true$/m)
    expect(text).toContain('You are a helpful software engineer assistant.')
    expect(text).toContain('Avoid falling into repetitive loops during thinking')
  })

  it('applies the candidate persona without touching the anchor config', () => {
    const text = composition('P')
    expect(text).toMatch(/^\s*anchorTools: \[bash, str_replace_editor, exit_plan_mode, skill\]$/m)
    for (const line of CANDIDATE_PERSONA.split('\n')) {
      if (line === '') continue
      expect(text).toContain(line)
    }
    expect(text).not.toContain('Avoid falling into repetitive loops during thinking')
    expect(text).not.toContain('without pre-rehearsing specific code implementation')
  })

  it('stages PTC from the first turn for group T by emptying the anchor list', () => {
    const text = composition('T')
    expect(text).toMatch(/^\s*anchorTools: \[\]$/m)
    expect(text).toMatch(/^\s*ptcPresentation: true$/m)
  })

  it('turns PTC off and disables staging for the native group', () => {
    const text = composition('N')
    expect(text).toMatch(/^\s*anchorTools: \[\]$/m)
    expect(text).toMatch(/^\s*ptcPresentation: false$/m)
  })

  it('uses the official Minimal preset for the external reference group', () => {
    expect(officialMinimalPresetDir()).toContain('presets')
    const text = composition('M')
    expect(text).toContain('complete: true')
    expect(text).not.toContain('liangshen-tool-catalog')
    expect(text).not.toContain('anchorTools')
  })

  it('keeps every derived composition structurally valid for the preset loader', () => {
    for (const variantId of ['P', 'T', 'N']) {
      expect(validateAgentCordis(composition(variantId)), variantId).toEqual([])
    }
  })

  it('copies the whole preset so its plugins travel with it', () => {
    const target = materializePreset(scratchDir(), 'B', LIVE_VARIANTS.B)
    expect(readFileSync(join(target, 'minimal-prompt.mjs'), 'utf8')).toContain('liangshen-minimal-prompt')
    expect(readFileSync(join(target, 'tool-catalog.mjs'), 'utf8')).toContain('liangshen-tool-catalog')
  })

  it('replacePersonaPrefix edits only the block scalar and stops at the next row', () => {
    const text = [
      '  config:',
      '    prefix: |-',
      '      Shipped wording.',
      '',
      '      Second line.',
      '',
      '# A following comment',
      '- id: next',
      '',
    ].join('\n')
    const replaced = replacePersonaPrefix(text, 'Candidate line one.\nCandidate line two.')
    expect(replaced).toContain('    prefix: |-\n      Candidate line one.\n      Candidate line two.\n\n# A following comment')
    expect(replaced).toContain('- id: next')
    expect(replaced).not.toContain('Shipped wording.')
  })

  it('hashes a preset tree by name and content', () => {
    const dir = scratchDir()
    writeFileSync(join(dir, 'a.txt'), 'one', 'utf8')
    writeFileSync(join(dir, 'b.txt'), 'two', 'utf8')
    const before = hashTree(dir)
    writeFileSync(join(dir, 'b.txt'), 'three', 'utf8')
    expect(hashTree(dir)).not.toBe(before)
  })
})

describe('benchmark task corpus and acceptance checks', () => {
  it('loads the shipped seed corpus with unique ids and a check for every task', () => {
    const corpus = loadTaskFile(join(process.cwd(), 'tools', 'tasks', 'liangshen-v41-flash.json'))
    expect(corpus.tasks.length).toBeGreaterThanOrEqual(10)
    const ids = corpus.tasks.map((task: { id: string }) => task.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const task of corpus.tasks) {
      expect(task.turns.length).toBeGreaterThan(0)
      expect(typeof task.check).toBe('string')
    }
    const revision = taskRevision(corpus)!
    expect(revision.tasks).toBe(corpus.tasks.length)
    expect(revision.hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('fails every seed task on its initial workspace, so no task passes without work', async () => {
    const corpus = loadTaskFile(join(process.cwd(), 'tools', 'tasks', 'liangshen-v41-flash.json'))
    for (const task of corpus.tasks as { id: string; files?: Record<string, string>, check: string }[]) {
      const dir = scratchDir()
      for (const [name, content] of Object.entries(task.files ?? {})) {
        const target = join(dir, name)
        mkdirSync(dirname(target), { recursive: true })
        writeFileSync(target, content, 'utf8')
      }
      const result = await evaluateCheck(dir, task.check)
      expect(result.passed, `${task.id} passed on its seeded workspace`).toBe(false)
    }
  })

  it('refuses a budget gate it cannot price instead of never triggering it', async () => {
    const corpus = { id: 'stub', version: 1, tasks: [{ id: 't', turns: ['do it'], files: {}, check: 'true' }] }
    await expect(runLiveSuite({
      tasks: corpus,
      groups: ['B'],
      maxSessions: 1,
      budgetUsd: 5,
      outDir: scratchDir(),
    })).rejects.toThrow(/--budget-usd needs a price entry/)
  })

  it('rejects a budget whose price table has no usable rates', async () => {
    const corpus = { id: 'stub', version: 1, tasks: [{ id: 't', turns: ['do it'], files: {}, check: 'true' }] }
    await expect(runLiveSuite({
      tasks: corpus,
      groups: ['B'],
      maxSessions: 1,
      budgetUsd: 5,
      prices: { 'deepseek-flash': {} },
      outDir: scratchDir(),
    })).rejects.toThrow(/needs a finite non-negative input rate/)
  })

  it('interleaves every group inside each task so a limit cannot starve later groups', () => {
    const plan = suitePlan(['B', 'P', 'T', 'N', 'M'], [{ id: 't1' }, { id: 't2' }], 2)
    expect(plan).toHaveLength(20)
    expect(plan.slice(0, 5).map((entry: { group: string }) => entry.group)).toEqual(['B', 'P', 'T', 'N', 'M'])
    expect(plan.slice(0, 5).every((entry: { task: { id: string } }) => entry.task.id === 't1')).toBe(true)
    expect(plan[5]).toMatchObject({ group: 'B', repetition: 2 })
  })

  it('grades a task by running its Node check in the workspace', async () => {
    const dir = scratchDir()
    writeFileSync(join(dir, 'value.mjs'), 'export const value = 7\n', 'utf8')
    const passed = await evaluateCheck(dir, "const m = await import('./value.mjs'); if (m.value !== 7) throw new Error('wrong')")
    expect(passed.passed).toBe(true)
    const failed = await evaluateCheck(dir, "const m = await import('./value.mjs'); if (m.value !== 8) throw new Error('wrong')")
    expect(failed.passed).toBe(false)
    expect(failed.exitCode).not.toBe(0)
  })
})

describe('benchmark usage accounting', () => {
  it('sums stream usage without double-counting the same attempt message usage', () => {
    const usage = summarizeUsage([
      {
        type: 'assistant/message',
        data: {
          stream: [{ type: 'usage', usage: { inputTokens: 10, outputTokens: 4, totalTokens: 20, cacheReadTokens: 6 } }],
          message: { usage: { inputTokens: 999, outputTokens: 999 } },
        },
      },
      {
        type: 'assistant/message',
        data: { message: { usage: { inputTokens: 5, outputTokens: 2 } } },
      },
      { type: 'tool/call', data: {} },
    ])
    expect(usage.attempts).toBe(2)
    expect(usage.uncachedInputTokens).toBe(15)
    expect(usage.outputTokens).toBe(6)
    expect(usage.cacheReadTokens).toBe(6)
    expect(usage.totalTokens).toBe(27)
  })

  it('prices usage per million tokens and stays unpriced without a table', () => {
    const usage = { uncachedInputTokens: 1_000_000, outputTokens: 500_000, cacheReadTokens: 0, cacheWriteTokens: 0 }
    expect(priceRun(usage, null, { provider: 'deepseek-official', model: 'deepseek-flash' })).toBeNull()
    const cost = priceRun(usage, { 'deepseek-official/deepseek-flash': { input: 1, output: 2 } }, { provider: 'deepseek-official', model: 'deepseek-flash' })
    expect(cost).toBeCloseTo(2, 6)
  })

  it('resolves a route price by provider/model or bare model and refuses unusable rates', () => {
    const route = { provider: 'deepseek-official', model: 'deepseek-flash' }
    expect(routePrices({ 'deepseek-flash': { input: 1, output: 2 } }, route)).toEqual({ input: 1, output: 2 })
    expect(routePrices({ 'other/model': { input: 1, output: 2 } }, route)).toBeUndefined()
    expect(() => assertPriceEntry({}, 'deepseek-official/deepseek-flash')).toThrow(/needs a finite non-negative input rate/)
    expect(() => assertPriceEntry({ input: 1, output: -1 }, 'deepseek-official/deepseek-flash')).toThrow(/output rate/)
    expect(() => priceRun({ uncachedInputTokens: 10, outputTokens: 10 }, { 'deepseek-flash': {} }, route))
      .toThrow(/needs a finite non-negative input rate/)
  })
})

describe('benchmark live harness session evidence', () => {
  function log(events: unknown[]): string {
    const path = join(scratchDir(), 'session.v3.jsonl')
    writeFileSync(path, events.map((event) => JSON.stringify(event)).join('\n'), 'utf8')
    return path
  }

  it('reads the wire surface and the real model route from request/header', () => {
    const path = log([
      { type: 'request/header', seq: 12, data: { header: { config: { provider: 'deepseek-official', model: 'deepseek-flash', reasoningEffort: 'max' }, tools: [{ name: 'bash' }] } } },
      { type: 'request/header', seq: 32, data: { header: { config: { provider: 'deepseek-official', model: 'deepseek-flash', reasoningEffort: 'max' }, tools: [{ name: 'run_code' }] } } },
    ])
    const evidence = summarizeSession(path)
    expect(evidence.requests.map((request: { tools: string[] }) => request.tools)).toEqual([['bash'], ['run_code']])
    expect(evidence.requests[0]?.provider).toBe('deepseek-official')
    expect(evidence.requests[0]?.reasoningEffort).toBe('max')
  })

  it('reports an unreadable shape as empty instead of looking verified', () => {
    const path = log([{ type: 'request/header', seq: 1, data: {} }])
    const evidence = summarizeSession(path)
    expect(evidence.requests[0]?.tools).toEqual([])
    expect(evidence.requests[0]?.provider).toBeUndefined()
  })

  it('flags which prompt facts each assembled system message carries', () => {
    const path = log([
      { type: 'system/message', seq: 7, data: { turn: 1, step: 1, message: { role: 'system', content: [{ type: 'text', text: 'You are a helpful software engineer assistant.\n\nYour working directory is /work.\n\nInstructions from: AGENTS.md' }] } } },
      { type: 'system/message', seq: 29, data: { turn: 2, step: 1, message: { role: 'system', content: [{ type: 'text', text: 'You are a helpful software engineer assistant.\ndeclare const tools: ToolArgsMap\nrun_code is the only tool' }] } } },
    ])
    const evidence = summarizeSession(path)
    expect(evidence.prompts[0]).toMatchObject({ turn: 1, carriesPersona: true, carriesWorkspaceLine: true, carriesWorkspaceInstructions: true, carriesSdkSection: false })
    expect(evidence.prompts[1]).toMatchObject({ turn: 2, carriesSdkSection: true, carriesPtcRule: true })
  })

  it('counts tool calls, tool errors, ptc dispatches, and human interventions', () => {
    const path = log([
      { type: 'tool/call', seq: 20, data: { name: 'bash' } },
      { type: 'tool/call', seq: 21, data: { name: 'ask_user_question' } },
      { type: 'tool/result', seq: 22, data: { error: { name: 'ToolCallError', code: 'E_BAD' } } },
      { type: 'tool/ptc-dispatch-start', seq: 33, data: {} },
      { type: 'tool/ptc-dispatch', seq: 34, data: {} },
      { type: 'approval/asked', seq: 35, data: {} },
    ])
    const evidence = summarizeSession(path)
    expect(evidence.toolCalls).toBe(2)
    expect(evidence.toolCallsByName).toEqual({ bash: 1, ask_user_question: 1 })
    expect(evidence.toolErrors).toBe(1)
    expect(evidence.humanInterventions).toBe(1)
    expect(evidence.approvalsAsked).toBe(1)
    expect(evidence.ptcDispatches).toBe(1)
  })

  it('skips unparsable lines rather than failing the whole report', () => {
    const path = join(scratchDir(), 'session.v3.jsonl')
    writeFileSync(path, ['not json', JSON.stringify({ type: 'tool/call', seq: 1, data: {} })].join('\n'), 'utf8')
    expect(summarizeSession(path).toolCalls).toBe(1)
  })
})
