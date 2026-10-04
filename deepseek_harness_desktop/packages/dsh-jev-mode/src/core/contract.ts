/** This is a workflow enhancement. Its judgments are not calibrated probabilities. */
export const descriptor = {
  id: 'jev-mode', name: 'JEV 模式', version: '0.1.0-local.1',
  provider: '@linxin666/dsh-jev-mode', scope: 'profile',
  actions: ['任务评估', '关键动作检查', '结果复核'],
  adapters: ['native-agent', 'developer', 'requirements', 'meeting'],
  backend: 'self-owned', officialBackend: 'reserved',
} as const
export type JevConfig = {
  enabled: boolean; backend: 'self-owned' | 'official-reserved'; model: string;
  reasoningEffort: '' | 'low' | 'medium' | 'high'; timeoutMs: number; maxChecks: number; maxContextChars: number;
}
export const defaults: JevConfig = { enabled: false, backend: 'self-owned', model: '', reasoningEffort: '', timeoutMs: 45000, maxChecks: 16, maxContextChars: 24000 }
export type SavedConfig = { schema: 1; revision: number; value: JevConfig }
export class JevError extends Error {
  constructor(message: string, readonly status = 409) { super(message); this.name = 'JevError' }
}
export function config(raw: unknown): JevConfig {
  const d = raw as Record<string, unknown>
  if (!d || typeof d !== 'object' || Array.isArray(d)) throw new JevError('JEV 配置格式无效',400)
  if (typeof d.enabled !== 'boolean' || !['self-owned','official-reserved'].includes(String(d.backend))) throw new JevError('JEV 开关或后端无效',400)
  if (typeof d.model !== 'string' || d.model.length > 250 || /[\r\n]/.test(d.model)) throw new JevError('JEV 决策模型无效',400)
  if (!['','low','medium','high'].includes(String(d.reasoningEffort))) throw new JevError('JEV 思考强度无效',400)
  const number = (key: string,min: number,max: number) => { const n=d[key];if(typeof n!=='number'||!Number.isInteger(n)||n<min||n>max)throw new JevError(`JEV ${key} 超出范围`,400);return n }
  return { enabled:d.enabled,backend:d.backend as JevConfig['backend'],model:d.model.trim(),reasoningEffort:d.reasoningEffort as JevConfig['reasoningEffort'],timeoutMs:number('timeoutMs',5000,120000),maxChecks:number('maxChecks',3,32),maxContextChars:number('maxContextChars',4000,64000) }
}
export type Decision = { decision: 'allow' | 'clarify' | 'block'; summary: string; missing: string[]; checks: { criterion: string; verdict: 'supported' | 'uncertain' | 'unsupported'; evidence: string }[] }
export function decision(raw: string): Decision {
  let d: any
  try { d=JSON.parse(raw.trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'')) } catch { throw new JevError('JEV 模型未返回有效 JSON；本次检查未通过') }
  if (!d || typeof d!=='object' || !['allow','clarify','block'].includes(d.decision) || typeof d.summary!=='string' || !d.summary.trim() || d.summary.length>2000 || !Array.isArray(d.missing) || d.missing.length>10 || !d.missing.every((s:unknown)=>typeof s==='string'&&s.length<=500) || !Array.isArray(d.checks) || d.checks.length<1 || d.checks.length>12 || !d.checks.every((c:any)=>c && typeof c.criterion==='string' && c.criterion.length<=300 && ['supported','uncertain','unsupported'].includes(c.verdict) && typeof c.evidence==='string' && c.evidence.length<=1000)) throw new JevError('JEV 决策结构无效；本次检查未通过')
  if(d.decision==='allow' && (d.missing.length || d.checks.some((c:any)=>c.verdict!=='supported'))) throw new JevError('JEV 决策与证据不一致；本次检查未通过')
  return {decision:d.decision,summary:d.summary,missing:d.missing,checks:d.checks}
}
export type JevTrace = { id: string; at: string; runId: string; scope: string; stage: 'begin'|'action'|'review'; revision: number; config: JevConfig; status: 'allowed'|'clarify'|'blocked'|'error'; summary: string; decision?: Decision; elapsedMs: number }
export type JevDiagnostic = { id: string; config: JevConfig; startedAt: string; finishedAt?: string; status: 'checking'|'passed'|'failed'|'cancelled'; message: string; elapsedMs: number; decision?: Decision }
export type JevConnection = { state: 'unconfigured'|'unverified'|'checking'|'ready'|'error'; message: string; checkedAt?: string }
export type JevActiveRun = { id: string; scope: string; revision: number; enabled: boolean; model: string; startedAt: string; checkingSince?: string; stage?: JevTrace['stage']; phase: 'working'|'checking'; lastStatus?: JevTrace['status'] }
export type JevStatus = { config: SavedConfig; state: 'off'|'ready'|'unavailable'; message: string; descriptor: typeof descriptor; traces: JevTrace[]; connection?: JevConnection; diagnostic?: JevDiagnostic; active?: JevActiveRun[] }
export type JevModel = { id: string; name: string; reasoning?: JevConfig['reasoningEffort'][] }
export type JevAccount = { id: string; name: string; available: boolean; models: JevModel[]; message?: string }
export const connectionConfig = (value: JevConfig) => JSON.stringify({...value,enabled:false})
/** Future official implementations register this same contract explicitly; no official client is shipped. */
export interface JevBackend { id: JevConfig['backend']; assess(input: { stage: JevTrace['stage']; scope: string; context: string; config: JevConfig }, signal: AbortSignal): Promise<Decision> }
