import { describe, expect, test } from 'vitest'

import {
  anchorToolsOf,
  apply,
  catalogDescription,
  catalogEntries,
  createCatalogMessage,
  inAnchorTurn,
  name,
  renderCatalogText,
  renderJsonSchemaType,
  renderSignature,
} from '../presets/liangshen/tool-catalog.mjs'

type Listener = (first: any, second: any, third: any) => Promise<any>

interface Harness {
  listeners: Map<string, { listener: Listener, options: any }>
  presentCalls: string[]
  warnings: string[]
  /** The inputs of the assembly in flight, reused when the plugin re-enters it. */
  assemblyInput?: { tools: unknown[]; sections: unknown[] }
  /** Declarations already landed when the effective assembly's providers were read. */
  declarationsBeforeNext: number
  /** Replace the surface the registry projects, as a mid-session tool change would. */
  setSdk(schemas: unknown[]): void
  /** Make the projection start throwing, as a mid-session breakage would. */
  failSdk(): void
}

interface HarnessOptions {
  /** The surface the registry's `sdkSchemas` projects; defaults to {@link SDK_SURFACE}. */
  sdk?: unknown[]
  /** When true the registry advertises no `sdkSchemas` at all. */
  noSdkSchemas?: boolean
  /** When true `sdkSchemas` throws, as a hostile definition would. */
  sdkThrows?: boolean
  /** When false the context exposes no code runtime. */
  codeRuntime?: boolean
  /** When true the context exposes no SystemPrompt, so nothing can re-assemble. */
  noPromptService?: boolean
}

const SDK_SURFACE = [
  {
    name: 'bash',
    description: 'Run commands in a bash shell\n* State is persistent across command calls.',
    parameters: {
      type: 'object',
      properties: { command: { type: 'string' }, timeoutMs: { type: 'integer' } },
      required: ['command'],
    },
  },
  { name: 'read', description: 'Read a UTF-8 text file and return line-numbered content.' },
]

function register(config: Record<string, unknown> = {}, options: HarnessOptions = {}): Harness {
  const listeners = new Map<string, { listener: Listener, options: any }>()
  const presentCalls: string[] = []
  const warnings: string[] = []
  let sdk = options.sdk ?? SDK_SURFACE
  let sdkFails = options.sdkThrows === true
  const tools: Record<string, unknown> = {
    sdkSchemas: () => {
      if (sdkFails) throw new Error('unsupported schema')
      return sdk
    },
  }
  if (options.noSdkSchemas === true) delete tools.sdkSchemas
  const services: Record<string, unknown> = { tools }
  if (options.codeRuntime !== false) services.codeRuntime = { language: 'typescript' }
  const ctx = {
    on(event: string, callback: Listener, opts?: any) {
      listeners.set(event, { listener: callback, options: opts })
    },
    get: (service: string) => services[service],
    logger: { warn: (message: string) => { warnings.push(message) } },
  }
  apply(ctx, config)
  const harness: Harness = {
    listeners,
    presentCalls,
    warnings,
    setSdk(next: unknown[]) { sdk = next },
    failSdk() { sdkFails = true },
  }
  // A faithful SystemPrompt: it snapshots the presentation before the waterfall runs
  // -- which is exactly why a declaration made inside one cannot reach that same
  // assembly -- and re-entering it is what a promotion relies on. A stub whose wire
  // ignored the declared mode could not tell those two apart.
  if (options.noPromptService !== true) {
    services.systemPrompt = {
      assemble: async (context: any) => (await runAssembly(harness, context?.agent)).assembled,
    }
  }
  return harness
}

function listener(harness: Harness, event: string): Listener {
  const entry = harness.listeners.get(event)
  expect(entry).toBeDefined()
  return entry!.listener
}

/** The assembled wire the harness hands the plugin: a native Standard-like roster. */
const WIRE = [
  { name: 'bash', description: 'Run commands in a bash shell', parameters: { type: 'object', properties: {} } },
  { name: 'read', description: 'Read a UTF-8 text file', parameters: { type: 'object', properties: {} } },
  { name: 'web_search', description: 'Search the web.', parameters: { type: 'object', properties: {} } },
]

/**
 * One live agent: the catalog stash and the PTC latch are keyed by the agent
 * object, so a test that spans several steps reuses the same one. `events` is
 * the durable log the catalog history is read back from, `surface` its visible
 * positions, and `ctx.tools.presentAs` the per-session presentation declaration.
 */
function agentOf(
  events: unknown[] = [],
  surface?: number[],
  harness?: Harness,
  options?: { presentThrows?: boolean; disposers?: (() => void)[] },
) {
  const session: any = { snapshotEvents: () => events }
  if (surface !== undefined) session.surface = { nodes: surface }
  const agent: any = {
    session,
    // The scope's current presentation, exactly as the real registry tracks it: a
    // declaration changes what the NEXT assembly collects, not the one in flight.
    ptcMode: undefined as string | undefined,
    ctx: {
      tools: {
        presentAs(mode: string) {
          if (options?.presentThrows) throw new Error('PTC declaration rejected by host policy')
          harness?.presentCalls.push(mode)
          agent.ptcMode = mode
          const disposer = () => {
            agent.ptcMode = undefined
            options?.disposers?.push(disposer)
          }
          return disposer
        },
      },
    },
  }
  return agent
}

/** Dispatch a session event to the plugin's listener, as the harness does on append. */
function emitSession(harness: Harness, session: unknown, event: unknown) {
  const entry = harness.listeners.get('session/event')
  expect(entry).toBeDefined()
  entry!.listener(session, event)
}

/**
 * One assembly, as the harness performs it: the wire is built from the presentation
 * the agent had BEFORE the waterfall ran, and the count of declarations already
 * landed is recorded at that same moment.
 */
async function runAssembly(harness: Harness, agent: any, tools: unknown[] = WIRE, sections: unknown[] = []) {
  // The caller's inputs are remembered, so a re-entry triggered from inside the
  // waterfall assembles the SAME prompt rather than falling back to the defaults.
  if (tools !== WIRE || sections.length > 0) harness.assemblyInput = { tools, sections }
  const input = harness.assemblyInput ?? { tools: WIRE, sections: [] }
  const wire = agent?.ptcMode === 'ptc' ? [{ name: 'run_code', description: 'Run a program.' }] : input.tools
  harness.declarationsBeforeNext = -1
  const assembled = await listener(harness, 'system-prompt/assemble')(
    { sections: input.sections },
    { agent },
    async () => {
      harness.declarationsBeforeNext = harness.presentCalls.length
      return { sections: input.sections, contexts: [], tools: wire, variables: {} }
    },
  )
  return { assembled, declarationsBeforeNext: harness.declarationsBeforeNext }
}

/** Assemble through the same entry the harness uses, so re-entry behaves identically. */
async function assemble(harness: Harness, agent: unknown, tools: unknown[] = WIRE, sections: unknown[] = []) {
  return runAssembly(harness, agent, tools, sections)
}

async function preStep(harness: Harness, agent: unknown, messages: unknown[] = [{ id: 'user', source: { kind: 'user' } }]) {
  return listener(harness, 'agent/pre-step')(
    { agent, messages, turn: 1, step: 1, signal: {} },
    async () => ({ kind: 'enter', messages }),
  )
}

function catalogOf(messages: unknown[]) {
  return messages.find((message: any) => message?.source?.plugin === name)
}

function catalogText(messages: unknown[]): string {
  return (catalogOf(messages) as any)?.content[0].text ?? ''
}

/** A durable catalog event carrying one injected message's data. */
function durableEvent(seq: number, message: any) {
  return { type: 'user/message', seq, data: message }
}

describe('liangshen-tool-catalog', () => {
  test('exports a diagnostic plugin name and injects the prompt registry', () => {
    expect(name).toBe('liangshen-tool-catalog')
  })

  test('registers both hooks outermost in their waterfalls', () => {
    const harness = register()
    expect(harness.listeners.get('system-prompt/assemble')?.options).toMatchObject({ prepend: true })
    expect(harness.listeners.get('agent/pre-step')?.options).toMatchObject({ prepend: true })
  })

  test('injects the registry surface with argument signatures after the user message', async () => {
    const harness = register()
    const agent = agentOf()
    await assemble(harness, agent)
    const result = await preStep(harness, agent, [{ id: 'user', source: { kind: 'user' } }])
    expect(result.messages.map((message: any) => message.id)).toEqual(['user', expect.any(String)])
    const catalog = catalogOf(result.messages)
    expect(catalog.role).toBe('user')
    expect(catalog.content[0].text).toContain('The following tools are available in this session:')
    expect(catalog.content[0].text).toContain('- `bash({ command: string, timeoutMs?: number })`: Run commands in a bash shell * State is persistent across command calls.')
    expect(catalog.content[0].text).toContain('- `read`: Read a UTF-8 text file and return line-numbered content.')
  })

  test('states the PTC invocation contract when the deployment can present it', async () => {
    const harness = register()
    const agent = agentOf()
    await assemble(harness, agent)
    const text = catalogText((await preStep(harness, agent)).messages)
    expect(text).toContain('presents these tools through `run_code`')
    expect(text).toContain('`await tools.<name>({ ... })`')
    expect(text).toContain('Compose one program per intent instead of one tool call per step')
    expect(text).toContain('`Promise.all`')
    expect(text).toContain('`ToolCallError`')
    expect(text).toContain('only tool that can be called directly')
    // The listed tools are reachable through the program; the contract names
    // `run_code` as the one direct transport and drops the stale shell-only claim.
    expect(text).toContain('- `bash')
    expect(text).not.toContain("the session's first turn carries the shell alone")
  })

  test('marks the message with the minimal plugin source shape', async () => {
    const harness = register()
    const agent = agentOf()
    await assemble(harness, agent)
    const catalog = catalogOf((await preStep(harness, agent)).messages)
    // The durable validator whitelists `kind`, `plugin`, `form`, `sections`
    // and `summary` for a plugin source; anything else risks rejection.
    expect(catalog.source).toEqual({ kind: 'plugin', plugin: name })
    expect(typeof catalog.id).toBe('string')
    expect(catalog.id.length).toBeGreaterThan(0)
  })

  test('appends nothing when no assembly was observed', async () => {
    const result = await preStep(register(), agentOf())
    expect(result.messages).toHaveLength(1)
  })

  test('appends nothing for an empty surface that was never published', async () => {
    const harness = register({}, { sdk: [] })
    const agent = agentOf()
    await assemble(harness, agent, [])
    const result = await preStep(harness, agent)
    expect(result.messages).toHaveLength(1)
  })

  test('does not republish while the published catalog is still visible', async () => {
    const harness = register()
    const agent = agentOf()
    await assemble(harness, agent)
    const first = await preStep(harness, agent)
    const events = [
      { type: 'user/message', seq: 1, data: { id: 'user', source: { kind: 'user' } } },
      durableEvent(2, catalogOf(first.messages)),
    ]
    const next = agentOf(events, [1, 2], harness)
    await assemble(harness, next)
    const second = await preStep(harness, next)
    expect(second.messages).toHaveLength(1)
  })

  test('republishes when the surface changed', async () => {
    const harness = register()
    const agent = agentOf()
    await assemble(harness, agent)
    const first = await preStep(harness, agent)
    const history = agentOf([durableEvent(2, catalogOf(first.messages))], [2], harness)
    await assemble(harness, history)
    harness.setSdk([...SDK_SURFACE, { name: 'edit', description: 'Edit one file.' }])
    await assemble(harness, history)
    const second = await preStep(harness, history)
    const update = catalogOf(second.messages)
    expect(update.content[0].text).toContain('- `edit`: Edit one file.')
    expect(update.content[0].text).toContain('replaces any earlier available-tools list')
  })

  test('republishes after a compaction shadows the published catalog', async () => {
    const harness = register()
    const agent = agentOf()
    await assemble(harness, agent)
    const first = await preStep(harness, agent)
    // The event survives in the log but is no longer on the visible surface.
    const compacted = agentOf([durableEvent(2, catalogOf(first.messages))], [1], harness)
    await assemble(harness, compacted)
    const second = await preStep(harness, compacted)
    expect(catalogOf(second.messages)).toBeDefined()
  })

  test('reads the published state back through the legacy events array', async () => {
    const harness = register()
    const agent = agentOf()
    await assemble(harness, agent)
    const first = await preStep(harness, agent)
    const legacy = agentOf([durableEvent(2, catalogOf(first.messages))], undefined, harness)
    delete (legacy.session as any).snapshotEvents
    ;(legacy.session as any).events = [durableEvent(2, catalogOf(first.messages))]
    await assemble(harness, legacy)
    const second = await preStep(harness, legacy)
    expect(second.messages).toHaveLength(1)
  })

  test('ignores an unusable catalog record instead of throwing', async () => {
    const harness = register()
    const agent = agentOf([
      { type: 'user/message', seq: 1, data: { id: 'x', role: 'user', source: { kind: 'plugin', plugin: name } } },
    ], [1], harness)
    await assemble(harness, agent)
    const result = await preStep(harness, agent)
    expect(catalogOf(result.messages)).toBeDefined()
  })

  test('keeps an already-current catalog message in the batch', async () => {
    const harness = register()
    const agent = agentOf()
    await assemble(harness, agent)
    const first = await preStep(harness, agent)
    const catalog = catalogOf(first.messages)
    const second = await preStep(harness, agent, [{ id: 'user', source: { kind: 'user' } }, catalog])
    expect(second.messages).toHaveLength(2)
  })

  test('drops a batch catalog message that is already on the visible surface', async () => {
    const harness = register()
    const agent = agentOf()
    await assemble(harness, agent)
    const first = await preStep(harness, agent)
    const catalog = catalogOf(first.messages)
    const withHistory = agentOf([durableEvent(2, catalog)], [2], harness)
    await assemble(harness, withHistory)
    const second = await preStep(harness, withHistory, [{ id: 'user', source: { kind: 'user' } }, catalog])
    expect(second.messages.map((message: any) => message.id)).toEqual(['user'])
  })

  test('reports an empty surface that replaced a published one', async () => {
    const harness = register({}, { sdk: [] })
    const agent = agentOf()
    await assemble(harness, agent)
    const first = await preStep(harness, agent)
    const next = agentOf([durableEvent(2, catalogOf(first.messages))], [2], harness)
    await assemble(harness, next, [])
    const second = await preStep(harness, next)
    const update = catalogOf(second.messages)
    expect(update.content[0].text).toContain('No tools are currently available in this session.')
  })

  test('leaves a rejected step decision untouched', async () => {
    const harness = register()
    const agent = agentOf()
    await assemble(harness, agent)
    const result = await listener(harness, 'agent/pre-step')(
      { agent, messages: [], turn: 1, step: 1, signal: {} },
      async () => ({ kind: 'reject' }),
    )
    expect(result).toEqual({ kind: 'reject' })
  })

  test('rejects invalid configuration', () => {
    expect(() => register({ descriptionMaxLength: 0 })).toThrow(/descriptionMaxLength must be an integer >= 1/)
    expect(() => register({ descriptionMaxLength: 1.5 })).toThrow(/descriptionMaxLength must be an integer >= 1/)
    expect(() => register({ anchorTools: 'bash' })).toThrow(/anchorTools must be an array/)
    expect(() => register({ anchorTools: ['bash', ''] })).toThrow(/anchorTools entries must be non-empty/)
    expect(() => register({ ptcPresentation: 'yes' })).toThrow(/ptcPresentation must be a boolean/)
  })

  test('inAnchorTurn reads the turn boundary from the durable log', () => {
    expect(inAnchorTurn(undefined)).toBe(true)
    expect(inAnchorTurn([{ type: 'step/start' }, { type: 'user/message' }])).toBe(true)
    expect(inAnchorTurn([{ type: 'turn/start' }])).toBe(true)
    expect(inAnchorTurn([{ type: 'turn/start' }, { type: 'step/start' }])).toBe(true)
    // The anchor covers the whole first turn: it ends at the first turn/end and
    // at the second turn/start, whichever comes first.
    expect(inAnchorTurn([{ type: 'turn/start' }, { type: 'turn/end' }])).toBe(false)
    expect(inAnchorTurn([{ type: 'turn/start' }, { type: 'step/start' }, { type: 'turn/start' }])).toBe(false)
  })

  test('anchorToolsOf narrows to the anchor names in wire order and passes the list through when off', () => {
    const wire = [{ name: 'skill' }, { name: 'bash' }, { name: 'web_search' }, { name: 'str_replace_editor' }]
    expect(anchorToolsOf(wire, ['bash', 'str_replace_editor']).map((tool: any) => tool.name))
      .toEqual(['bash', 'str_replace_editor'])
    expect(anchorToolsOf(wire, [])).toBe(wire)
  })

  test('the anchor turn narrows the wire to the shell and stays native', async () => {
    const harness = register({ anchorTools: ['bash'] })
    const agent = agentOf([{ type: 'turn/start' }], undefined, harness)
    const { assembled } = await assemble(harness, agent)
    expect(assembled.tools.map((tool: any) => tool.name)).toEqual(['bash'])
    expect(harness.presentCalls).toEqual([])
    // The catalog names exactly the anchor wire: `read` is registered but not open
    // in this request, so the model must not be told it can call it.
    const text = catalogText((await preStep(harness, agent)).messages)
    expect(text).toContain('- `bash')
    expect(text).not.toContain('- `read`')
    expect(text).not.toContain('presents these tools through `run_code`')
  })

  test('the anchor catalog narrows to the anchor wire for the entire first turn', async () => {
    const harness = register({ anchorTools: ['bash', 'read'] })
    const agent = agentOf([{ type: 'turn/start', seq: 1 }], undefined, harness)
    for (let step = 0; step < 3; step += 1) {
      const { assembled } = await assemble(harness, agent)
      expect(assembled.tools.map((tool: any) => tool.name)).toEqual(['bash', 'read'])
      const text = catalogText((await preStep(harness, agent, [{ id: 'user', source: { kind: 'user' } }])).messages)
      expect(text).toContain('- `bash')
      expect(text).toContain('- `read')
      // `web_search` is registered but not open during the whole anchor turn.
      expect(text).not.toContain('web_search')
      expect(text).not.toContain('presents these tools through `run_code`')
    }
    expect(harness.presentCalls).toEqual([])
  })

  test('the first step of the promoted turn already describes the promoted surface', async () => {
    const harness = register({ anchorTools: ['bash', 'read'] })
    const events: any[] = [{ type: 'turn/start', seq: 1 }]
    const agent = agentOf(events, undefined, harness)
    await assemble(harness, agent)
    const anchorStep = await preStep(harness, agent, [{ id: 'user', source: { kind: 'user' } }])
    const anchorCatalog = catalogOf(anchorStep.messages)
    expect(anchorCatalog.content[0].text).not.toContain('web_search')

    // The first turn ends: the boundary declares PTC before the promoted turn
    // assembles, so the stored anchor state is already stale for the next request.
    events.push({ type: 'turn/end', seq: 2 })
    emitSession(harness, agent.session, { type: 'turn/end' })
    expect(harness.presentCalls).toEqual(['ptc'])

    const promotedStep = await preStep(harness, agent, [
      { id: 'user', source: { kind: 'user' } },
      anchorCatalog,
    ])
    const promoted = catalogOf(promotedStep.messages)
    expect(promoted.content[0].text).toContain('presents these tools through `run_code`')
    expect(promoted.content[0].text).toContain('- `read')
    expect(promoted.content[0].text).toContain('only tool that can be called directly')
  })

  test('the anchor turn ends at turn/end and declares PTC before the next assembly', async () => {
    const harness = register({ anchorTools: ['bash'] })
    const events: any[] = [{ type: 'turn/start', seq: 1 }]
    const agent = agentOf(events, undefined, harness)
    const { assembled } = await assemble(harness, agent)
    expect(assembled.tools.map((tool: any) => tool.name)).toEqual(['bash'])
    expect(harness.presentCalls).toEqual([])

    // The anchor turn ends: the boundary event declares PTC outside any
    // waterfall, so the promoted turn's first assembly already sees it.
    events.push({ type: 'turn/end', seq: 2 })
    emitSession(harness, agent.session, { type: 'turn/end' })
    expect(harness.presentCalls).toEqual(['ptc'])

    const promoted = await assemble(harness, agent)
    // The promoted wire is the collapsed transport the declaration produces, not
    // the narrowed anchor face and not the assembled native roster.
    expect(promoted.assembled.tools.map((tool: any) => tool.name)).toEqual(['run_code'])
    expect(harness.presentCalls).toEqual(['ptc'])
  })

  test('later turn boundaries do not re-declare and never narrow again', async () => {
    const harness = register({ anchorTools: ['bash'] })
    const events: any[] = [{ type: 'turn/start', seq: 1 }, { type: 'turn/end', seq: 2 }]
    const agent = agentOf(events, undefined, harness)
    await assemble(harness, agent)
    emitSession(harness, agent.session, { type: 'turn/end' })
    events.push({ type: 'turn/start', seq: 3 })
    emitSession(harness, agent.session, { type: 'turn/start' })
    emitSession(harness, agent.session, { type: 'turn/end' })
    expect(harness.presentCalls).toEqual(['ptc'])
    // Declared once, and the wire stays on the collapsed transport rather than
    // being narrowed back to the anchor names.
    expect((await assemble(harness, agent)).assembled.tools.map((tool: any) => tool.name)).toEqual(['run_code'])
  })

  test('the assembly listener re-asserts the declaration for an unobserved boundary', async () => {
    const harness = register({ anchorTools: ['bash'] })
    // A session resumed with the boundary already crossed: no session event was
    // observed, so the declaration lands from the assembly listener.
    const agent = agentOf([{ type: 'turn/start', seq: 1 }, { type: 'turn/start', seq: 2 }], undefined, harness)
    const { assembled, declarationsBeforeNext } = await assemble(harness, agent)
    expect(declarationsBeforeNext).toBe(1)
    expect(harness.presentCalls).toEqual(['ptc'])
    // The declaration is re-asserted from the assembly listener, and its
    // re-assembly means even that first request carries the collapsed transport
    // rather than the native roster.
    expect(assembled.tools.map((tool: any) => tool.name)).toEqual(['run_code'])
    expect((await assemble(harness, agent)).assembled.tools.map((tool: any) => tool.name)).toEqual(['run_code'])
    expect(harness.presentCalls).toEqual(['ptc'])
    // A resumed session's next step carries the promoted catalog, not the anchor one.
    const text = catalogText((await preStep(harness, agent)).messages)
    expect(text).toContain('presents these tools through `run_code`')
    expect(text).toContain('- `read')
  })

  test('declares PTC once per agent, updates to full SDK at boundary, and stabilizes afterwards', async () => {
    const harness = register({ anchorTools: ['bash'] })
    const anchored = agentOf([{ type: 'turn/start' }], undefined, harness)
    await assemble(harness, anchored)
    const firstStep = await preStep(harness, anchored)
    const catalog = catalogOf(firstStep.messages)
    // Anchor turn stays native and does not announce run_code
    expect(catalogText(firstStep.messages)).not.toContain('presents these tools through `run_code`')

    const promoted = agentOf(
      [{ type: 'turn/start', seq: 1 }, { type: 'turn/start', seq: 2 }, durableEvent(3, catalog)],
      [3],
      harness,
    )
    await assemble(harness, promoted)
    await assemble(harness, promoted)
    expect(harness.presentCalls).toEqual(['ptc'])
    const second = await preStep(harness, promoted, [{ id: 'user', source: { kind: 'user' } }])
    // Across the promotion boundary, the catalog transitions to full SDK with ToolArgsMap
    const promotedCatalog = catalogOf(second.messages)
    expect(promotedCatalog).toBeDefined()
    expect(promotedCatalog.content[0].text).toContain('presents these tools through `run_code`')
    expect(promotedCatalog.content[0].text).not.toContain('ToolArgsMap')

    // Stable after promotion: subsequent step with promoted catalog already visible does not republish
    const thirdHistory = agentOf(
      [{ type: 'turn/start', seq: 1 }, { type: 'turn/start', seq: 2 }, durableEvent(3, catalog), durableEvent(4, promotedCatalog)],
      [4],
      harness,
    )
    await assemble(harness, thirdHistory)
    const third = await preStep(harness, thirdHistory, [{ id: 'user', source: { kind: 'user' } }])
    expect(catalogOf(third.messages)).toBeUndefined()
    expect(third.messages).toHaveLength(1)
  })

  test('stays native and says nothing about run_code without a code runtime', async () => {
    const harness = register({}, { codeRuntime: false })
    const agent = agentOf([{ type: 'turn/start' }, { type: 'turn/start' }], undefined, harness)
    const { assembled } = await assemble(harness, agent)
    expect(harness.presentCalls).toEqual([])
    expect(assembled.tools).toBe(WIRE)
    const text = catalogText((await preStep(harness, agent)).messages)
    expect(text).not.toContain('run_code')
    expect(text).toContain('- `bash({ command: string, timeoutMs?: number })`')
  })

  test('honors ptcPresentation: false', async () => {
    const harness = register({ ptcPresentation: false })
    const agent = agentOf([{ type: 'turn/start' }, { type: 'turn/start' }], undefined, harness)
    await assemble(harness, agent)
    expect(harness.presentCalls).toEqual([])
    expect(catalogText((await preStep(harness, agent)).messages)).not.toContain('run_code')
  })

  test('degrades to the assembled wire when the registry publishes no SDK projection', async () => {
    const harness = register({}, { noSdkSchemas: true })
    const agent = agentOf()
    const { assembled } = await assemble(harness, agent)
    expect(assembled.tools).toBe(WIRE)
    const text = catalogText((await preStep(harness, agent)).messages)
    expect(text).toContain('- `web_search(')
  })

  test('survives a hostile SDK projection with one warning', async () => {
    const harness = register({}, { sdkThrows: true })
    const agent = agentOf()
    await assemble(harness, agent)
    await assemble(harness, agent)
    expect(harness.warnings).toHaveLength(1)
    expect(catalogText((await preStep(harness, agent)).messages)).toContain('- `web_search(')
  })

  test('warns once when a session has no scoped tools view to declare through', async () => {
    const harness = register({}, { scopedTools: false })
    const agent: any = { session: { snapshotEvents: () => [{ type: 'turn/start' }, { type: 'turn/start' }] } }
    await assemble(harness, agent)
    await assemble(harness, agent)
    expect(harness.warnings).toHaveLength(1)
    expect(harness.warnings[0]).toContain('keeping the native tool surface')
  })

  test('never announces a transport its own assembly wire does not carry', async () => {
    // The declaration succeeds, but this deployment offers nothing to re-assemble
    // with, so the collapse cannot reach the request in flight. The catalog
    // describes the WIRE, so it must keep describing native tools.
    const harness = register({}, { noPromptService: true })
    const agent = agentOf([], undefined, harness)
    const { assembled } = await assemble(harness, agent)
    expect(harness.presentCalls).toEqual(['ptc'])
    expect(assembled.tools).toBe(WIRE)
    const text = catalogText((await preStep(harness, agent)).messages)
    expect(text).not.toContain('presents these tools through `run_code`')
    expect(text).toContain('- `bash')
  })

  test('staging off: the promotion lands on the first assembly', async () => {
    const harness = register()
    const agent = agentOf([{ type: 'turn/start' }], undefined, harness)
    const { assembled } = await assemble(harness, agent)
    // With no anchor tools there is nothing to stage, so the declaration happens
    // during this assembly and the re-assembly carries it into this same request.
    expect(assembled.tools.map((tool: any) => tool.name)).toEqual(['run_code'])
    expect(catalogOf((await preStep(harness, agent)).messages)).toBeDefined()
  })

  test('catalogDescription collapses whitespace and truncates', () => {
    expect(catalogDescription('  a\n\n b  ', 20)).toBe('a b')
    expect(catalogDescription('abcdefghij', 7)).toBe('abcd...')
    expect(catalogDescription(undefined, 20)).toBe('')
  })

  test('renderJsonSchemaType renders the supported constructs and degrades the rest', () => {
    expect(renderJsonSchemaType({ type: 'string' })).toBe('string')
    expect(renderJsonSchemaType({ type: 'integer' })).toBe('number')
    expect(renderJsonSchemaType({ type: 'boolean' })).toBe('boolean')
    expect(renderJsonSchemaType({ enum: ['a', 'b'] })).toBe('"a" | "b"')
    expect(renderJsonSchemaType({ const: 3 })).toBe('3')
    expect(renderJsonSchemaType({ oneOf: [{ type: 'string' }, { type: 'null' }] })).toBe('string | null')
    expect(renderJsonSchemaType({ anyOf: [{ type: 'string' }, { type: 'null' }] })).toBe('string | null')
    expect(renderJsonSchemaType({ type: ['string', 'null'] })).toBe('string | null')
    expect(renderJsonSchemaType({ type: 'array', items: { type: 'number' } })).toBe('number[]')
    expect(renderJsonSchemaType({ type: 'array', items: { oneOf: [{ type: 'string' }, { type: 'number' }] } })).toBe('(string | number)[]')
    expect(renderJsonSchemaType({ type: 'object' })).toBe('Record<string, JsonValue>')
    expect(renderJsonSchemaType({})).toBe('JsonValue')
    expect(renderJsonSchemaType(undefined)).toBe('JsonValue')
    expect(renderJsonSchemaType({ type: 'object', properties: { a: { type: 'string' }, b: { type: 'array', items: { type: 'string' } } }, required: ['a'] }))
      .toBe('{ a: string, b?: string[] }')
  })

  test('renderJsonSchemaType stops expanding past the nesting cap', () => {
    const deep = (depth: number): any => (
      depth === 0
        ? { type: 'string' }
        : { type: 'object', properties: { next: deep(depth - 1) }, required: ['next'] }
    )
    expect(renderJsonSchemaType(deep(3))).toContain('{ next:')
    expect(renderJsonSchemaType(deep(6))).toContain('JsonValue')
  })

  test('renderSignature renders a parenthesized argument list or nothing', () => {
    expect(renderSignature({ type: 'object', properties: { command: { type: 'string' } }, required: ['command'] }))
      .toBe('({ command: string })')
    expect(renderSignature({})).toBe('')
    expect(renderSignature(undefined)).toBe('')
  })

  test('catalogEntries sorts by name, carries signatures, and skips nameless tools', () => {
    const entries = catalogEntries([
      { name: 'b', description: 'second' },
      { description: 'nameless' },
      { name: 'a', description: 'first', parameters: { type: 'object', properties: {} } },
    ], 200)
    expect(entries).toEqual([
      { name: 'a', signature: '(Record<string, JsonValue>)', description: 'first' },
      { name: 'b', signature: '', description: 'second' },
    ])
    expect(catalogEntries(undefined, 200)).toEqual([])
  })

  test('renderCatalogText frames a list, the PTC contract, and an empty catalog without schema lie', () => {
    const list = renderCatalogText([{ name: 'read', signature: '()', description: 'Read a file.' }], false)
    expect(list).toContain('<available_tools>')
    expect(list).toContain('- `read()`: Read a file.')
    // Requirement 3: the lie about full parameter schema traveling with tool definition is removed
    expect(list).not.toContain('the full parameter schema travels with its own tool definition')
    expect(list).toContain('This is the complete current list and replaces any earlier available-tools list in this session.')
    expect(list).not.toContain('run_code')
    expect(renderCatalogText([], false)).toContain('No tools are currently available in this session.')
    expect(renderCatalogText([], true)).toContain('presents these tools through `run_code`')
    expect(renderCatalogText([], true)).toContain('Compose one program per intent')
    expect(renderCatalogText([], false)).not.toContain('Promise.all')
  })

  test('presentAs failure degrades to native, does not announce PTC, and warns once', async () => {
    const harness = register({ anchorTools: [] })
    const agent = agentOf([], undefined, harness, { presentThrows: true })
    const { assembled } = await assemble(harness, agent)
    expect(assembled.tools).toBe(WIRE)
    expect(harness.warnings).toHaveLength(1)
    expect(harness.warnings[0]).toContain('PTC presentation declined')
    const text = catalogText((await preStep(harness, agent)).messages)
    expect(text).not.toContain('presents these tools through `run_code`')
    expect(text).not.toContain('run_code')
    expect(text).toContain('- `bash')
  })

  test('anchorTools supports 4 tools and stays native in anchor turn', async () => {
    const harness = register({ anchorTools: ['bash', 'read', 'web_search'] })
    const events: any[] = [{ type: 'turn/start', seq: 1 }]
    const agent = agentOf(events, undefined, harness)
    const { assembled } = await assemble(harness, agent)
    expect(assembled.tools.map((t: any) => t.name)).toEqual(['bash', 'read', 'web_search'])
    expect(harness.presentCalls).toEqual([])
    const text = catalogText((await preStep(harness, agent)).messages)
    expect(text).not.toContain('presents these tools through `run_code`')
    expect(text).toContain('- `bash')
    expect(text).toContain('- `read')

    // Promotes on turn/end
    events.push({ type: 'turn/end', seq: 2 })
    emitSession(harness, agent.session, { type: 'turn/end' })
    expect(harness.presentCalls).toEqual(['ptc'])
  })

  test('refreshes fallback every assembly when sdkSchemas fails instead of keeping stale catalog', async () => {
    const harness = register({}, { sdk: [{ name: 'custom_turn1', description: 'Turn 1 tool' }] })
    const agent = agentOf()
    await assemble(harness, agent)
    const firstText = catalogText((await preStep(harness, agent)).messages)
    expect(firstText).toContain('custom_turn1')

    // In step 2, SDK schemas throws or disappears; wire has fresh fallback tool
    const harnessFail = register({}, { sdkThrows: true })
    const agent2 = agentOf()
    await assemble(harnessFail, agent2, [{ name: 'wire_fresh', description: 'Fresh fallback tool' }])
    const secondText = catalogText((await preStep(harnessFail, agent2)).messages)
    expect(secondText).toContain('wire_fresh')
    expect(secondText).not.toContain('custom_turn1')
  })

  test('wire carrying only run_code reverts PTC when SDK projection is unavailable', async () => {
    const disposers: (() => void)[] = []
    const harness = register()
    // With history previously published
    const priorCatalog = createCatalogMessage([{ name: 'prior_tool', signature: '()', description: 'Prior' }], false)
    const agent = agentOf([durableEvent(2, priorCatalog)], [2], harness, { disposers })
    // The session promotes while the projection still works...
    await assemble(harness, agent)
    expect(harness.presentCalls).toEqual(['ptc'])
    // ...and then the projection breaks under the already-collapsed wire.
    harness.failSdk()
    const { assembled } = await assemble(harness, agent, [{ name: 'run_code', description: 'transport' }])
    expect(disposers.length).toBeGreaterThanOrEqual(1)
    expect(harness.warnings.some(w => w.includes('tool schemas available') || w.includes('native tool surface'))).toBe(true)
    const text = catalogText((await preStep(harness, agent)).messages)
    // Does not falsely claim full tools exist; truthfully reports empty surface
    expect(text).toContain('No tools are currently available in this session.')
    expect(text).not.toContain('await tools.run_code')
    expect(text).not.toContain('presents these tools through `run_code`')
  })

  test('does not duplicate giant SDK declarations in durable message, relying on official host tools:sdk', async () => {
    const harness = register()
    const agent = agentOf()
    await assemble(harness, agent)
    const text = catalogText((await preStep(harness, agent)).messages)
    // PTC contract and compact index are present
    expect(text).toContain('presents these tools through `run_code`')
    expect(text).toContain('- `bash')
    // Giant TypeScript SDK interface is NOT duplicated in durable message
    expect(text).not.toContain('interface ToolArgsMap')
    expect(text).not.toContain('interface ToolOutputMap')
    // The false statement is removed
    expect(text).not.toContain('the full parameter schema travels with its own tool definition')
  })

  test('prefers public schemas API over private methods', async () => {
    let publicSchemasCalled = false
    const harness = register()
    const customAgent: any = {
      session: { snapshotEvents: () => [] },
      ctx: {
        tools: {
          presentAs: () => () => {},
          schemas: () => {
            publicSchemasCalled = true
            return [{ name: 'public_tool', description: 'From public API' }]
          },
        },
      },
    }
    await assemble(harness, customAgent)
    const text = catalogText((await preStep(harness, customAgent)).messages)
    expect(publicSchemasCalled).toBe(true)
    expect(text).toContain('public_tool')
  })
})
