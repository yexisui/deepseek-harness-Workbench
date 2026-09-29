import type { Context } from '@deepseek-ai/cordis'
import type {} from './index.ts'
export const name = 'workbench-browser-provider'
export const inject = ['capabilities']
/** Separately manageable provider; unloading it leaves capability definitions intact. */
export async function apply(ctx: Context) {
  const runtime = ctx.capabilities
  await runtime.loadProvider()
  ctx.effect(() => () => runtime.unloadProvider(), 'capabilities: BrowserSkill provider')
}
