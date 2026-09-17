# dsh-liangshen — LiangShen Mode (minimal persona + PTC tool surface)

English | [中文](README.zh.md)

Ships the LiangShen preset as a one-command plugin of the dsh-web family: on host startup it syncs the bundled preset into `~/.dsh/.agent-presets`, so new sessions can pick "梁神模式" from the preset picker, and its browser half adds a slot-machine lever beside the model selector on the new-session screen for switching that mode on and off. The preset keeps a minimal persona with standing working discipline, session workspace directory, and AGENTS.md-style workspace instructions in the system prompt, and delivers its tool surface as a durable user message after the user's message from the first turn on — the way the harness injects the skill catalog, naming exactly the tools that request opens — while the wire is staged: the session's entire first user turn natively presents a foundational tool surface (default `[bash, str_replace_editor, exit_plan_mode, skill]`, with bash-only preserved as a configuration experiment), and from the second turn the session presents its tools in PTC mode upon successful activation, where the wire carries the single `run_code` transport and other tools are reached via the generated SDK. Deterministic turn boundary transition occurs when PTC is actually activated, preserving full input and output key parameter semantics with no reasoning gating and no output-token cap. Built entirely on the official NPM SDK — no dsh source changes.

## Why

DeepSeek V4 models condition strongly on the initial prompt and the first-turn model-visible tool surface when choosing their execution trajectory. Exposing an unbounded tool surface prematurely can scatter execution trajectories, while completely omitting editing or planning tools restricts the completion of complex tasks.

LiangShen mode adopts a staged tool and compact prompt architecture: the anchoring portion (the system prompt) keeps a minimal persona with standing working discipline and workspace instructions; the capability portion (the tool surface) is announced from the first user message via a skill-catalog-style injection, while the entire first user turn natively presents a foundational anchor tool set (`[bash, str_replace_editor, exit_plan_mode, skill]`) covering discovery, editing, exiting plan mode, and skill lookups; from the second turn onward, upon meeting code runtime requirements and successful declaration, it smoothly transitions to PTC (program-as-tool) mode. Under PTC presentation, the injected message carries generated SDK bindings, complete input and output key parameter semantics, the program contract ("one program per intent"), and the rule that only `run_code` may be called directly. This mode makes no overcommitments regarding "exact identity with official Minimal", "community benchmark scores proving this version is universally superior", or "prompt cache prefix hits equating to behavioral identity", but rather ensures execution stability through a well-defined tiered contract.

## How it works

1. `minimal-prompt` narrows every assembled prompt to the persona section — the one-line persona, the mode's standing working discipline (exit thinking loops immediately, design-first reasoning over pre-rehearsed code, YAGNI and PDCA, no redundant code comments), and one appended orientation line, `Your working directory is <cwd>.` read from the session header — so the harness identity, web-surface, tool-guidance, file-reference, and structured-output sections do not reach the model by default; plan mode's `plan:policy` is kept, because that section is the only thing that enforces plan mode (its exit tool stays registered in every mode);
2. the AGENTS.md-style workspace instructions join the system prompt itself: at assembly time `minimal-prompt` reads the harness's baseline chain (`$DSH_HOME/AGENTS.md`, then `AGENTS.md` / `CLAUDE.md` and their `.local` overlays from the project root down to the session cwd) and appends the content as one `workspace-instructions` section after the stable prefix, under a byte budget that omits broadest files first and truncates the most specific last; the read happens on every assembly, so file edits propagate without durable messages, and the harness's own agent-instructions injections are dropped instead of duplicating the prompt. Subdirectory dynamic rules will subsequently support registered file tools (including `str_replace_editor`) and sub-calls inside PTC reaching target directories; arbitrary bash/program code is not parsed, and automatic discovery of file accesses performed directly within shell commands is not guaranteed;
3. the anchor turn (the session's entire first user turn, rather than merely a single first step) keeps the wire on the foundational anchor tool set: default `[bash, str_replace_editor, exit_plan_mode, skill]`, presented natively (`anchorTools`); the `[bash]` single-shell experimental configuration is also preserved and supported (without requiring extra preset registration or registry changes). From the second turn, when a code runtime exists and presentation declaration succeeds, `tool-catalog` activates PTC presentation for that session (`agent.ctx.tools.presentAs('ptc')`, declared on anchor turn end), collapsing the wire to `run_code` where other tools are invoked via the generated SDK; if code runtime is absent or activation fails, it gracefully degrades to the native tool surface with a one-time warning;
4. `tool-catalog` appends the tool list as a durable user message after the user's message from the first turn on, preserving complete input and output key parameter semantics rather than an oversimplified 200-character-only contract (`descriptionMaxLength: 200` only caps single-line summaries, without stripping key parameter structures). It names exactly the tools the current request opens: the anchor set during the native anchor turn, and, under PTC, the SDK-reachable roster plus the program contract — one program per intent instead of one call per step, `run_code`'s `code`/`description` shape, independent read-only calls overlapping under `Promise.all`, `ToolCallError` handling, curated program output, and the rule that `run_code` is the only directly callable tool once on the wire. It republishes only when that surface changed or the published copy left the visible surface (a compaction, a resume), so the promotion boundary carries one contract update without insisting on absolute context immutability;
5. runtime contexts (the sandbox and approval snapshots) and the skill catalog flow as in Standard mode.

## Security model

This mode operates strictly within the official host security architecture and complies with sandbox policies:

- **Host sandbox constraints**: All file tools (whether `str_replace_editor` and Standard file tools natively presented in the first turn, or file operations invoked via PTC `run_code` later) are subject to host file sandbox policies, inheriting the current session's sandbox level (e.g., `danger-full-access` or workspace-restricted/read-only). Bare local filesystem access does not exist (no `dsh-fs-local` mount); all reads and writes across workspaces are guarded by host policy.
- **Windows platform limitations and Git Bash**: DSH's PTY backend is Linux/Darwin-only. On Windows (win32), the persistent-shell group is disabled, and `bash` is provided by `presets/liangshen/custom-bash.mjs` through system Git Bash subprocess invocation:
  - Windows Git Bash runs through an ordinary subprocess seam; subject to Windows platform constraints, it lacks namespace/cgroups-based OS sandbox isolation;
  - The shell process does not persist across invocations, so command state (environment variables, current directory, etc.) does not carry over;
  - Non-zero exits are returned as results rather than thrown;
  - Users and developers must not modify `custom-bash.mjs` to bypass security policies; privileged actions must follow host prompts and environment security guidelines.
- **PTC code sandbox**: In PTC mode, `run_code` scripts execute within an isolated worker thread context, with access to system resources strictly bounded by the SDK's exposed tools.

## The lever

The browser half adds a slot-machine lever to the composer tool row, immediately left of the model selector, on the new-session screen:

- pull the lever down — drag it, click it, or press it with the keyboard — and the session about to start composes LiangShen mode; a landed pull plays the jackpot burst (flash, shockwave, sparks, and a banner reading 梁神模式 over classical Chinese, binary, and Morse lines);
- push it up and the preset you were on before comes back — with nothing remembered yet, that is the deployment default;
- the arm always reports the session's real preset, so a reload shows the true state, and the lever renders only while the session is still blank — in a session that has started, the host refuses to recompose, and the row disappears from the composer entirely;
- a refused switch prints the host's reason under the lever and never plays the burst, and `prefers-reduced-motion` keeps the state change while dropping the animation.

The lever drives the session's preset through the agent-preset Remote namespace the browser session is already authenticated for, so it needs no additional permissions. It acts on the preset only while the session is blank, which is exactly the new-session screen it renders on.

## Preset configuration

Both preset-local plugins are configured in `agent.cordis.yml`:

| Key | Default | Behavior |
| --- | --- | --- |
| `keepPlanPolicy` | `true` | Keep plan mode's `plan:policy` section in the otherwise one-line system prompt. Set `false` for the strict one-line surface, which leaves plan mode with no policy text behind it. |
| `instructionSource` | `system-prompt` | Where workspace instructions reach the model. `system-prompt` reads the AGENTS.md-style chain at assembly time and appends it to the system prompt (the harness's own injections are dropped); `hint` restores the pointer behavior: the first injection becomes a one-time non-imperative reference-file hint and later injections are dropped. |
| `instructionMaxBytes` | `65536` | Byte budget for the rendered workspace-instructions section (system-prompt mode): broadest files are omitted first, the most specific file is truncated last. |
| `descriptionMaxLength` | `200` | Cap for one tool's one-line summary in the injected catalog. Complete key parameter semantics and contracts remain fully preserved by the SDK itself. |
| `anchorTools` | `[bash, str_replace_editor, exit_plan_mode, skill]` | Tool set natively presented on the wire throughout the entire first user turn; promoted surface engages from the second turn. Shipped default includes the core four tools; can also be configured as `[bash]` for single-shell experiments (without modifying registry). Empty disables staging. |
| `ptcPresentation` | `true` | Attempt to declare PTC presentation from the second turn onward; upon successful activation, wire collapses to `run_code` preserving complete input/output key parameter semantics. Requires a mounted code runtime and a readable tool projection; without either it keeps native presentation with a single warning. The injected catalog always describes the transport the request's own wire carries, and never announces PTC for an assembly the declaration could not reach. Set `false` to keep assembled native roster from second turn. |

## Install

```sh
# Option 1: family bundle (recommended)
dsh plugin --profile web add @linxin666/dsh-web-all@latest

# Option 2: standalone
dsh plugin --profile web add @linxin666/dsh-liangshen@latest

# Pick ONE of the two: the bundle and the standalone @linxin666/dsh-liangshen
# both mount this preset. If you switch between them, remove the other first:
dsh plugin --profile web remove @linxin666/dsh-liangshen
```

Fully restart `dsh web`, open a NEW empty session, and pick "梁神模式" as the preset. The plugin syncs the presets into `~/.dsh/.agent-presets` at startup (upgrades refresh them automatically on next restart).

## Verify

Export the session JSONL and inspect `request/header`:

- the first header's `system` should be exactly the persona block (the minimal persona, the working-discipline list, and the workspace line `Your working directory is <cwd>.`), plus plan mode's policy while plan mode is on, plus the `workspace-instructions` section carrying the AGENTS.md chain;
- the entire first user turn's header tools should be exactly the anchor surface — default `[bash, str_replace_editor, exit_plan_mode, skill]`, presented natively — never the promoted roster and never an unactivated `run_code`;
- the anchor turn's admitted messages should hold one `plugin`-sourced message from `liangshen-tool-catalog` after the user message, naming exactly the anchor tools by argument signature; from the promoted turn on, that message names the SDK-reachable roster and states the `run_code` program contract, including that `run_code` is the only directly callable tool;
- from the second turn on, provided PTC successfully activates, headers carry exactly one tool, `run_code` (PTC presentation); without code runtime it gracefully degrades to native roster with a single warning;
- after a compaction the catalog is republished once as a replacement list and the session stays in its current presentation mode;
- file writes obey the host file sandbox policy — there is no bare local-filesystem bypass.

### Real session validation conditions and benchmark evaluation

When validating mode behavior and evaluating performance, verification tiers must be strictly distinguished:

1. **Real inference probe ≠ Mode integration pass ≠ Statistical improvement**:
   - **Real inference probe**: Verifies only transport connectivity and minimal model response capability to specific formats (e.g. using a headless probe to verify output parsing); a single successful probe demonstrates absence of blockers, but never that mode integration has succeeded.
   - **Mode integration pass**: Requires full session verification of complete headers, tiered tool transitions, actual PTC activation, SDK parameter semantics parsing, and sandbox policy enforcement.
   - **Statistical improvement**: Must be evaluated across multiple comparative benchmark rounds in an isolated environment with recorded fixed routes and source hashes, evaluating task completion rate, tool failure rate, rule violation rate, human intervention frequency, and time/token costs. Single or few smoke runs do not constitute evidence of performance improvement.
2. **Benchmark tooling**: the isolated runner is `packages/dsh-liangshen/tools/benchmark-live-run.mjs`. It writes the evaluated preset into a temporary root selected through the roster's own `roots` config, redirects session persistence into the run directory, and records a baseline (repository commit, shipped preset hash, DSH version, fixed route, task revision) with every run. The candidate matrix is `B` (shipped persona and two-stage strategy), `P` (candidate persona), `T` (candidate persona, PTC from the first turn), `N` (candidate persona, full native roster throughout), and `M` (the bundle's official Minimal preset, an external reference rather than a single-factor arm). Run one smoke case with `node tools/benchmark-live-run.mjs --variant B`, or the bounded matrix over the seed corpus with `node tools/benchmark-live-run.mjs --tasks tools/tasks/liangshen-v41-flash.json --groups B,P,T,N,M --repeat 3 --max-sessions 60 --budget-usd 5`; aggregate the run records in a results directory with `node tools/benchmark-report.mjs .benchmark-results`, which reports per-group success rates with Wilson intervals, paired per-task deltas with confidence intervals, token and cost totals, infrastructure failures separately, and the recorded baseline. Smoke runs validate the protocol and the cost estimate; they are not evidence of a general coding gain.

## Configuration

| Key | Default | Behavior |
| --- | --- | --- |
| `enabled` | `true` | Master switch: when false, neither preset sync nor announcement runs. |
| `announceToAgent` | `false` | Opt-in: when true, a system-prompt section announces the plugin. Off by default so agent system prompts stay clean. |

Both fields are editable in the web settings surface (plugin config, live) or through the profile patch (`dsh plugin` / `cordis.patch.yml`).

## Behavior and limits

- The system prompt is stable for the whole session: the persona block (persona, working discipline, workspace directory), plus plan mode's policy while plan mode is on, plus the workspace-instructions section. Nothing is appended after a tool call, and no output-token cap is applied;
- The workspace-instructions section is re-read at every assembly, so instruction-file edits propagate on the next request without a durable message; the section renders last, after the stable prefix, so the anchor's cache prefix stays intact. Subdirectory dynamic rules will subsequently support registered file tools (including `str_replace_editor`) and sub-calls inside PTC reaching target directories; arbitrary bash/program code is not parsed, and automatic discovery of file accesses performed directly within shell commands is not guaranteed;
- The wire's schema set stays on the foundational anchor tool set during the entire first user turn (default `[bash, str_replace_editor, exit_plan_mode, skill]`, supporting `[bash]` experiments); from the second turn onward, upon successful PTC activation, it collapses to `run_code`; the catalog message is written once per session plus one replacement when the exposed surface changes — the promotion boundary included — or a compaction shadows it;
- The injected catalog is durable: it is written once per session, plus one replacement when the tool surface changes or a compaction shadows the published copy, and it stays in the history for later requests;
- A step whose prompt assembly was not observed injects nothing — the catalog is never guessed from a stale view;
- A composition exposing none of the accepted persona section names (`deployment:persona-prefix`, `deployment:persona`, `persona`) keeps the assembled prompt and warns once instead of sending an empty system prompt;
- Plan mode is supported through its `plan:policy` section; with `keepPlanPolicy: false` the mode keeps its tool but loses the policy text that enforces it;
- PTC presentation is declared per session and needs a mounted code runtime (the shipped web and headless compositions mount `dsh-code-runtime-worker-thread`); without one or upon activation failure, the mode stays native with a one-time warning;
- The roster is the builtin PTC preset's model-authored surface: the `workflow` tool is not published beside `run_code`, while the workflow engine stays mounted for `ralph`;
- The persistent `bash` replaces the Standard ephemeral shell for the whole session (both tools register the name `bash`), so shell state survives across calls; on win32 `custom-bash` provides the same-named tool through Git Bash, with no OS sandbox confinement and non-persistent state;
- The file tools inherit the host file sandbox (no bare `dsh-fs-local` filesystem);
- The preset carries the same trust level as shell access — review `presets/liangshen/` before installing;
- The plugin makes no network requests and adds no telemetry;
- Do not switch presets mid-conversation;
- Requires DSH 0.1.5-rc.1+ (preset mechanism, the `system-prompt/assemble` waterfall, the persona `prefix` schema, and the PTC presentation API).

## License

Plugin body Apache-2.0 (zhu1090093659). `presets/liangshen/agent.cordis.yml` derives from the DeepSeek Harness builtin Minimal, Standard, and PTC presets (MIT), and `custom-bash.mjs` comes from xiaobright/dsh-anchored-standard (MIT) — copyright and license notices are kept in the preset's `NOTICE`.
