import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dshHome } from '../../../shared/host/dsh-home.ts'

export const name = 'workbench-plain-chat'
export const inject = ['webServer']

export function escapeAttribute(value: string): string {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)
}

/** Owns only this plugin's preset and its neutral data directory. */
export function apply(ctx: { webServer: { tapIndex(fn: (html: string) => string): () => void }; effect(fn: () => (() => void), label: string): unknown }): void {
  const home = dshHome()
  const chatRoot = join(dirname(home), 'chat-data')
  mkdirSync(chatRoot, { recursive: true })
  const preset = join(home, '.agent-presets', 'workbench-chat')
  mkdirSync(preset, { recursive: true })
  const source = fileURLToPath(new URL('../presets/workbench-chat/', import.meta.url))
  for (const filename of ['agent.cordis.yml', 'preset.yml', 'no-tools.mjs']) {
    copyFileSync(join(source, filename), join(preset, filename))
  }
  ctx.effect(() => ctx.webServer.tapIndex(html => html.replace('</head>', `<meta name="dsh-plain-chat-root" content="${escapeAttribute(chatRoot)}"></head>`)), 'plain-chat: boot metadata')
}
