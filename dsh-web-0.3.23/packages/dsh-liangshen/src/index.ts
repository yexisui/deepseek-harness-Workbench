/**
 * dsh-liangshen — LiangShen (梁神) agent preset plugin.
 *
 * Host half only: on startup it syncs the bundled `presets/` tree into the
 * harness-home agent-presets root (`~/.dsh/.agent-presets`), making the
 * LiangShen preset selectable for new sessions without copying files by hand.
 * The capability announcement is a system-prompt section that ships OFF by
 * default (`announceToAgent: false`) and can be enabled in the web settings
 * surface (plugin config) or the profile patch. No browser half, no routes,
 * no agent tools — the preset itself provides the tools.
 *
 * The preset combines a minimal persona with a staged, promoted tool surface:
 * the system prompt keeps a minimal persona with standing working discipline
 * and workspace instructions, the session's entire first user turn runs a native
 * foundational tool surface ([bash, str_replace_editor, exit_plan_mode, skill],
 * with bash-only preserved as a configuration experiment), and from the second
 * turn this session presents its tools in PTC mode upon successful activation,
 * so the wire carries the single `run_code` transport while the generated SDK
 * bindings and collapse rule travel in the tool list injected as a durable
 * message after the user's message, preserving full input and output key
 * parameter semantics.
 */

import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import type { SettingsNamespace } from '@deepseek-ai/dsh-settings'
import type {} from '@deepseek-ai/dsh-system-prompt'
import z from 'schemastery'
import { dshHome } from './dsh-home.ts'
import { syncPresetTrees } from './sync.ts'
import { mountOnce } from './mount-once.ts'

/** Stable cordis plugin name. */
export const name = 'liangshen'

/** Settings namespace of the plugin (the web settings surface edits it). */
export const LIANGSHEN_SETTINGS_NAMESPACE = 'dsh-liangshen' as SettingsNamespace

/** Prompt assembly must exist before the announcement section can register. */
export const inject = ['systemPrompt']

/** Plugin config, validated by the same-named schemastery schema. */
export interface Config {
  /** Master switch: when false, neither sync nor announcement runs. */
  enabled?: boolean
  /** When true, a system-prompt section announces the plugin (default false — keep prompts clean unless the user opts in). */
  announceToAgent?: boolean
}

export const Config: z<Config> = z.object({
  enabled: z.boolean().default(true),
  announceToAgent: z.boolean().default(false),
})

/** Schema default, re-read for hand-built test contexts. */
const DEFAULT_ANNOUNCE = false

/** Order of the announcement section within the tool-guidance band. */
const SECTION_ORDER = 150

/** Model-facing announcement: plugin presence, principle, and limits. */
export const LIANGSHEN_GUIDANCE = '本机已安装 dsh-liangshen 插件（梁神模式 agent preset）：新建会话的预设选择器中可选「梁神模式」。原理：系统提示词保持极简 persona（minimal-prompt 放行该段与 plan 模式的 plan:policy），persona 内置本模式工作纪律（思维循环即断、先理解需求与方案再实现验证、YAGNI/PDCA、代码不加冗余注释），并在组装时追加工作区目录 Your working directory is <cwd>. 与 AGENTS.md 工作区指令（workspace-instructions 段，65536 字节预算，每次组装重读）；工具清单由 tool-catalog 从第一条用户消息起以 user 消息注入在用户消息之后，形如 skill catalog，仅当工具集变化或该消息离开可见面（压缩、恢复）时重发；wire 上的 schema 按回合分层：首轮整个 user turn 原生呈现基础锚定工具集（默认 [bash, str_replace_editor, exit_plan_mode, skill]，且保留 bash-only 配置实验），第二个回合起在 PTC 成功激活后切换为 PTC 呈现（wire 上只有 run_code，其余工具在程序里以 await tools.<name>({...}) 调用，保留完整输入输出关键参数语义而非 200 字唯一契约；缺失 code runtime 时优雅回退至原生呈现）；注入消息承载 SDK 绑定、程序契约（一段程序编排多步：独立只读调用用 Promise.all 并发、ToolCallError 处理、输出自选）与「激活后只有 run_code 可直接调用」的规则。工作区子目录动态指令支持注册文件工具含 str_replace_editor 及 PTC 内子调用触达的目录（不解析任意 bash/program 代码）。文件操作受宿主沙箱约束，Windows 下 bash 为 Git Bash 子进程且状态不跨调用保留。真实推理探针通过不等于模式集成通过，更不等于统计效果提升。preset 文件由插件维护于 ~/.dsh/.agent-presets，升级插件时自动更新；默认预设由用户自行选择。用户提到「梁神模式 / 锚定模式 / anchored standard」时即指本插件，请据此协作。'
// The harness-home resolution (DSH_HOME override with the platform-home
// fallback and ~ expansion) lives in the family-shared copy ./dsh-home.ts.
// Re-export it so the plugin surface stays stable while the implementation is
// shared across packages. A relative DSH_HOME resolves against the process CWD
// (absolute), which is the shared contract.
export { dshHome } from './dsh-home.ts'

/** Absolute path of the bundled preset tree inside this package. */
export function bundledPresetsRoot(): string {
  return fileURLToPath(new URL('../presets/', import.meta.url))
}

/**
 * Mount the plugin: sync bundled presets into the harness-home agent-presets
 * root, register the settings namespace (enabled / announceToAgent, live),
 * and announce through a system-prompt section when announceToAgent is on
 * (off by default).
 * @param ctx - host plugin context carrying systemPrompt.
 * @param config - resolved plugin config (schema defaults applied by the loader).
 */
export const apply = mountOnce('@linxin666/dsh-liangshen', applyImpl)

function applyImpl(ctx: Context, config?: Config): void {
  // The live source the announcement reads: the settings section once the web
  // settings surface is served, the composition entry otherwise
  // (installSection swaps it when the namespace registers).
  let current: () => Config = () => config ?? {}
  const resolve = (): Config => ({
    announceToAgent: current().announceToAgent ?? DEFAULT_ANNOUNCE,
    enabled: current().enabled ?? true,
  })

  const sync = (): void => {
    const targetRoot = join(dshHome(), '.agent-presets')
    try {
      mkdirSync(targetRoot, { recursive: true })
      const result = syncPresetTrees(bundledPresetsRoot(), targetRoot, ['liangshen-exact'])
      for (const { id, error } of result.failed) {
        ctx.logger?.warn?.(`dsh-liangshen: preset ${id} sync failed: ${error}`)
      }
      if (result.synced.length > 0) {
        ctx.logger?.info?.(`dsh-liangshen: presets synced into ${targetRoot}: ${result.synced.join(', ')}`)
      }
      if (result.retired.length > 0) {
        ctx.logger?.info?.(`dsh-liangshen: retired stale presets from ${targetRoot}: ${result.retired.join(', ')}`)
      }
    } catch (error) {
      ctx.logger?.warn?.(`dsh-liangshen: preset sync failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  let disposeSection: (() => void) | undefined
  const refresh = (): void => {
    disposeSection?.()
    disposeSection = undefined
    if (!resolve().enabled) return
    sync()
    if (resolve().announceToAgent) {
      disposeSection = ctx.systemPrompt.section({
        name: 'plugin:dsh-liangshen',
        order: SECTION_ORDER,
        text: LIANGSHEN_GUIDANCE,
      })
    }
  }

  // The web settings surface gets the plugin's enabled / announceToAgent
  // fields from this namespace; a settings edit re-runs refresh live, and
  // deployments without a settings service keep the composition entry.
  ctx.inject(['settings'], (settingsCtx) => {
    try {
      if (typeof settingsCtx.settings?.installSection === 'function') {
        settingsCtx.settings.installSection(ctx, LIANGSHEN_SETTINGS_NAMESPACE, Config, config ?? {}, {
          setSource: (source) => {
            current = source
            refresh()
          },
          onChange: refresh,
        })
      } else if (typeof settingsCtx.settings?.register === 'function') {
        const scope = settingsCtx.settings.register(LIANGSHEN_SETTINGS_NAMESPACE, Config, { base: config ?? {} })
        current = () => scope?.get?.() ?? (config ?? {})
        scope?.watch?.(() => { refresh() })
        refresh()
      }
    } catch {
      // Defensive fallback against settings registration differences
    }
  })

  refresh()
  ctx.effect(() => () => { disposeSection?.(); disposeSection = undefined }, 'dsh-liangshen: announcement')
}
