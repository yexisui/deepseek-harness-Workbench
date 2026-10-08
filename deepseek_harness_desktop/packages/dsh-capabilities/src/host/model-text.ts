import type { Context } from '@deepseek-ai/cordis'
import { randomUUID } from 'node:crypto'

/** Both business workflows use the workbench's existing model accounts and routing. */
export function resolveWorkbenchModel(ctx: Context, selectedModel: string): string {
  if (selectedModel) {
    const slash = selectedModel.indexOf('/')
    if (slash < 1 || slash === selectedModel.length - 1) throw new Error('模型选择无效，请重新选择工作台模型')
    return selectedModel
  }
  let route: { provider?: string; model?: string } | undefined
  try { const settings = ctx.get('settings' as never) as { get(ns: string): unknown } | undefined; route = settings?.get('agent-default-model') as typeof route } catch { /* No default configured. */ }
  return route?.provider && route.model ? `${route.provider}/${route.model}` : ''
}
export async function workbenchText(ctx: Context, prompt: string, selectedModel: string, system: string, maxTokens: number | undefined, signal?: AbortSignal, timeoutMs: number | null = 180_000): Promise<string> {
  const route = resolveWorkbenchModel(ctx,selectedModel), slash = route.indexOf('/')
  let llm: { stream(options: unknown): AsyncIterable<{ type: string; text?: string; reason?: { kind: string; failure?: { message?: string } } }> } | undefined
  try { llm=ctx.get('llm' as never) as typeof llm } catch { /* Report missing service below. */ }
  if(!llm || slash < 1)throw new Error('请在工作台配置默认模型，或选择本次分析使用的模型')
  // null removes the workflow deadline while retaining cancellation and provider connection handling.
  const timeout=timeoutMs===null?undefined:AbortSignal.timeout(timeoutMs), combined=timeout?(signal?AbortSignal.any([signal,timeout]):timeout):signal
  let result=''
  for await(const chunk of llm.stream({provider:route.slice(0,slash),model:route.slice(slash+1),system,messages:[{id:randomUUID(),role:'user',content:[{type:'text',text:prompt}],source:{kind:'user'}}],temperature:0.1,...(maxTokens === undefined ? {} : { maxTokens }),signal:combined})) {
    if(combined?.aborted)throw new Error(signal?.aborted?'本次分析已停止':'模型处理超时，请重试')
    if(chunk.type==='text-delta')result+=chunk.text??''
    if(result.length>512_000)throw new Error('模型返回内容过长，请缩小分析范围')
    if(chunk.type==='finish'&&chunk.reason?.kind==='max-tokens')throw new Error('模型输出达到所选模型的 token 上限，正文可能被截断；请在模型设置中调整最大输出 token 数后重试')
    if(chunk.type==='finish'&&chunk.reason?.kind==='error')throw new Error(chunk.reason.failure?.message||'工作台模型处理失败')
  }
  if(!result.trim())throw new Error('工作台模型没有返回内容')
  return result
}
