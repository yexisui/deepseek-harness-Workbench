import type { KnowledgeAccess } from './knowledge-access.ts'
import { join } from 'node:path'
import { readFile } from 'node:fs/promises'
import { CodeAssistantService, moduleAssets } from '@linxin666/dsh-code-assistant'
import type { Context } from '@deepseek-ai/cordis'
import type { CapabilityStore } from './store.ts'
import type { GitService } from '../../../dsh-git-graph/src/host/git-service.ts'
import { allowedActions, wasRevoked } from '../core/policy.ts'
import type { Action } from '../core/model.ts'
import { resolveWorkbenchModel } from './model-text.ts'
import { RoleSkills } from './role-skills.ts'

/** Narrow workbench adapter: models and authority stay in the host, state stays in the module. */
export async function createCodeAssistant(ctx: Context, home: string, store: CapabilityStore, git: GitService, knowledge?: KnowledgeAccess, report?: import('../core/team-contributions.ts').ContributionReporter) {
  const skills = new RoleSkills(home)
  skills.onGuidanceLoaded=ids=>ids.forEach(id=>report?.('skill',id))
  const usingKnowledge=new Set<string>()
  const service = new CodeAssistantService({
    releaseGuidance:(task:{id:string})=>usingKnowledge.delete(task.id),
    root: join(home, 'code-assistant'), toolsRoot: join(home, '..', 'external-tools'), assets: moduleAssets(), workspace: git.workspace,
    projects: () => ctx.workspaceRegistry.list().map(workspace => ({ path: workspace.path, name: workspace.path.split(/[\\/]/).at(-1) || workspace.path })),
    addProject: async (path: string) => { await ctx.workspaceRegistry.create(path, path.split(/[\\/]/).at(-1) || '代码项目') },
    resolveModel: (selected: string) => resolveWorkbenchModel(ctx, selected),
    stream: (options: unknown) => {
      const llm = ctx.get('llm' as never) as { stream(options: unknown): AsyncIterable<unknown> } | undefined
      if (!llm) throw new Error('工作台模型服务尚未加载')
      return llm.stream(options)
    },
    authorize: (task: { roleId: string; roleVersion?: number; authorityAt: number; id?:string }, action: Action) => {
      const state = store.snapshot(), role = state.roles.find(role => role.id === task.roleId)
      task.roleVersion ??= role?.versions.at(-1)?.version
      const version = role?.versions.find(version => version.version === task.roleVersion)
      if(task.id&&usingKnowledge.has(task.id)&&task.roleVersion)knowledge?.assert({taskId:task.id,roleId:task.roleId,roleVersion:task.roleVersion,authorityAt:task.authorityAt})
      if (!version || !allowedActions(state, task.roleId, version).includes(action) || wasRevoked(state, task.roleId, {...version,capabilities:version.capabilities.filter(b=>b.capabilityId==='developer-workspace')}, task.authorityAt)) throw new Error('此岗位的开发能力已停用或授权已改变，请在能力中心检查')
    },
    guidance: async (task: { roleId: string; roleVersion: number; cwd: string; authorityAt: number; id:string }, request?:{message:string;signal:AbortSignal}) => {
      if(request){report?.('capability','developer-workspace');report?.('role',task.roleId)}
      const state = store.snapshot(), version = state.roles.find(role => role.id === task.roleId)?.versions.find(version => version.version === task.roleVersion)
      const rules = await readFile(join(task.cwd, 'AGENTS.md'), 'utf8').catch(() => '')
      const guide=(version ? skills.guidance(state, task.roleId, version, task.cwd, task.authorityAt) : '') + (rules ? '\n项目规则：\n' + rules.slice(0, 32000) : '')
      usingKnowledge.delete(task.id)
      if(knowledge&&request){const context={taskId:task.id,roleId:task.roleId,roleVersion:task.roleVersion,authorityAt:task.authorityAt};if(knowledge.enabled(context)&&knowledge.scope(context))usingKnowledge.add(task.id)}
      return knowledge&&request?knowledge.augment(guide,{taskId:task.id,roleId:task.roleId,roleVersion:task.roleVersion,authorityAt:task.authorityAt,kind:'code'},request.signal,request.message):guide
    },
  })
  await service.init()
  return service
}
