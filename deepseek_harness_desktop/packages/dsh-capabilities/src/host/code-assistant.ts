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
export async function createCodeAssistant(ctx: Context, home: string, store: CapabilityStore, git: GitService) {
  const skills = new RoleSkills(home)
  const service = new CodeAssistantService({
    root: join(home, 'code-assistant'), toolsRoot: join(home, '..', 'external-tools'), assets: moduleAssets(), workspace: git.workspace,
    projects: () => ctx.workspaceRegistry.list().map(workspace => ({ path: workspace.path, name: workspace.path.split(/[\\/]/).at(-1) || workspace.path })),
    addProject: async (path: string) => { await ctx.workspaceRegistry.create(path, path.split(/[\\/]/).at(-1) || '代码项目') },
    resolveModel: (selected: string) => resolveWorkbenchModel(ctx, selected),
    stream: (options: unknown) => {
      const llm = ctx.get('llm' as never) as { stream(options: unknown): AsyncIterable<unknown> } | undefined
      if (!llm) throw new Error('工作台模型服务尚未加载')
      return llm.stream(options)
    },
    authorize: (task: { roleId: string; roleVersion?: number; authorityAt: number }, action: Action) => {
      const state = store.snapshot(), role = state.roles.find(role => role.id === task.roleId)
      task.roleVersion ??= role?.versions.at(-1)?.version
      const version = role?.versions.find(version => version.version === task.roleVersion)
      if (!version || !allowedActions(state, task.roleId, version).includes(action) || wasRevoked(state, task.roleId, version, task.authorityAt)) throw new Error('此岗位的开发能力已停用或授权已改变，请在能力中心检查')
    },
    guidance: async (task: { roleId: string; roleVersion: number; cwd: string; authorityAt: number }) => {
      const state = store.snapshot(), version = state.roles.find(role => role.id === task.roleId)?.versions.find(version => version.version === task.roleVersion)
      const rules = await readFile(join(task.cwd, 'AGENTS.md'), 'utf8').catch(() => '')
      return (version ? skills.guidance(state, task.roleId, version, task.cwd, task.authorityAt) : '') + (rules ? '\n项目规则：\n' + rules.slice(0, 32000) : '')
    },
  })
  await service.init()
  return service
}
