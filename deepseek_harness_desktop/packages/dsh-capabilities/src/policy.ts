import type { Context } from '@deepseek-ai/cordis'
import type {} from './index.ts'
export const name = 'workbench-role-policy'
// Keep the deny mask alive even when the capability manager is disabled.
// Depending on capabilities here would dispose the guard alongside that service.
export const inject = ['tools']
/** Presets fail closed if the manager is unavailable, including tools registered later. */
export function apply(ctx: Context) {
  ctx.tools.restrict({ allow: [] })
  ctx.tools.presentAs('native')
  ctx.tools.guard(exec => {
    const runtime = ctx.get('capabilities')
    return runtime ? runtime.authorize(exec) : '能力服务已停用；此岗位暂时不能执行工具。'
  })
}
