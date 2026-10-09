export const DEVELOPER_CAPABILITY_ID = 'developer-workspace'
export const DEVELOPER_ROLE_ID = 'builtin-developer'
export const developerParts = [
  { componentId: 'developer-files', actions: ['develop'] as const },
  { componentId: 'developer-git', actions: ['inspect-git'] as const },
  { componentId: 'developer-checks', actions: ['verify-code'] as const },
]
export type DeveloperContext = { path: string; side: 'before' | 'after'; version: string; start: number; end: number; text: string }
export type DeveloperEvent = { runId?: string; id: string; at: string; kind: 'read' | 'write' | 'git' | 'run' | 'snapshot' | 'system'; text: string; path?: string }
export type DeveloperRound = { id: string; before: string; after?: string; status: 'running' | 'done' | 'failed' | 'stopped' | 'interrupted'; at: string; error?: string; writes: { path: string; before: string; after: string }[] }
export type DeveloperCheck = { id: string; name: string; command: string; cwd: string; fingerprint: string; index: string; head: string; at: string; finishedAt?: string; status: 'running' | 'passed' | 'failed' | 'stopped' | 'interrupted'; output: string; exitCode?: number | null; changedDuringRun?: boolean }
export type DeveloperTask = {
  schema: 1; id: string; revision: number; title: string; cwd: string; roleId: string; roleVersion: number; authorityAt: number; createdAt: string; updatedAt: string;
  permission: 'read' | 'edit'; model: string; baseline: string; draft: string;
  messages: { runId?: string; id: string; role: 'user' | 'assistant'; text: string; at: string; contexts?: DeveloperContext[] }[];
  rounds: DeveloperRound[]; checks: DeveloperCheck[]; checkpoints: { id: string; name: string; at: string; snapshot: string }[]; events: DeveloperEvent[];
}
export type DeveloperSummary = Pick<DeveloperTask, 'id' | 'title' | 'cwd' | 'roleId' | 'roleVersion' | 'updatedAt'> & { running: boolean }
export type DeveloperProject = { revision: number; commands: { id: string; name: string; command: string }[]; editor: 'none' | 'vscode' }
export const developerSummary = (task: DeveloperTask): DeveloperSummary => ({ id: task.id, title: task.title, cwd: task.cwd, roleId: task.roleId, roleVersion: task.roleVersion, updatedAt: task.updatedAt, running: task.rounds.some(r => r.status === 'running') || task.checks.some(r => r.status === 'running') })
