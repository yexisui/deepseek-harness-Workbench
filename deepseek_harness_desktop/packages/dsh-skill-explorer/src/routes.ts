/**
 * The /api/dsh-skill-explorer route family: list (grouped by source), set
 * enabled (rewrites SKILL.md frontmatter), create, delete (move to .trash)
 * and health. Every route carries the shared trust fence (loopback by
 * default; a live paired-device cookie is an extra allow path when
 * remote-web-ui is loaded) plus browser same-origin markers — the write
 * routes touch real skill files, so unpaired LAN clients must not reach them.
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import { isSkillExplorerAllowed } from './access.ts'
import { buildPayload, collectSkills, findProjectRoot, projectSkillRoot, trashSkillFile, userSkillRoot, writeSkillFile, type CollectOptions, type SkillEntry } from './collect.ts'
import { setFrontmatterField } from './frontmatter.ts'
import { readJsonBody, writeJson } from './http.ts'
import { ManagedSkills } from './managed.ts'
import {join as joinPath} from 'node:path'

/** Route paths (client bundle mirrors these literals; tests assert both sides). */
export const ROUTES = {
  list: '/api/dsh-skill-explorer/list',
  setEnabled: '/api/dsh-skill-explorer/set-enabled',
  create: '/api/dsh-skill-explorer/create',
  delete: '/api/dsh-skill-explorer/delete',
  health: '/api/dsh-skill-explorer/health',
} as const

/** URL query helper (first value, decoded). */
function queryParam(url: URL, name: string): string | undefined {
  const value = url.searchParams.get(name)
  return value === null ? undefined : value
}

/** Skill name pattern shared by the routes (kebab-case). */
const NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/

/** Route family dependencies (tests inject fakes). */
export interface SkillRoutesDeps {
  /** User dsh config root (~/.dsh). */
  dshHome: string
  /** User agents config root (~/.agents). */
  agentsHome: string
  /** Extra custom skill roots from plugin config. */
  customSkillDirs: string[]
  /** ctx.skills registry (snapshot). */
  registry: CollectOptions['registry']
  /** Active session cwd list (project root base). */
  activeSessionCwds(): string[]
  /** Logger. */
  logger: { warn(error: unknown): void }
}

/** Default process cwd fallback (overridable in tests). */
export const DEFAULT_CWD = (): string => process.cwd()

/**
 * Build every /api/dsh-skill-explorer route (exact paths).
 * @param ctx - host context; may expose remoteWebUiPairing.
 * @param deps - dshHome/agentsHome/registry/sessions.
 * @returns the route list for ctx.webServer.register.
 */
export function makeRoutes(ctx: Context, deps: SkillRoutesDeps): WebRoute[] {
  const { dshHome, agentsHome, customSkillDirs, registry, activeSessionCwds, logger } = deps

  /** Guard helper: fence + method check. */
  const guard = (req: IncomingMessage, res: ServerResponse, method: string): boolean => {
    if (!isSkillExplorerAllowed(ctx, req)) {
      writeJson(res, 403, { error: 'forbidden: loopback-only' })
      return false
    }
    if (req.method !== method) {
      writeJson(res, 405, { error: `method not allowed: ${req.method}` })
      return false
    }
    return true
  }

  /** Active session cwd list (degraded to [] when sessions throw). */
  const safeSessionCwds = (): string[] => {
    try {
      return activeSessionCwds()
    } catch {
      return []
    }
  }

  /** Active session project roots (degraded to [] when sessions throw). */
  const sessionProjectRoots = (): string[] => {
    try {
      return safeSessionCwds().map((sessionCwd) => findProjectRoot(sessionCwd))
    } catch {
      return []
    }
  }

  const managed = new ManagedSkills(dshHome, sessionProjectRoots)
  const managedRoute = (action: string, method: string): WebRoute => ({kind:'exact',path:'/api/dsh-skill-explorer/manage/'+action,handler:async(req,res)=>{
    if(!guard(req,res,method))return
    try {
      if(method==='GET') {
        if(action==='resource'){const q=new URL(req.url??'','http://localhost').searchParams;writeJson(res,200,managed.resource(q.get('id')??'',q.get('path')??''));return}
        if(action==='detail'){writeJson(res,200,managed.detail(new URL(req.url??'','http://localhost').searchParams.get('id')??''));return}
        if(action==='export'){const id=new URL(req.url??'','http://localhost').searchParams.get('id')??'',out=managed.export(id);res.writeHead(200,{'content-type':'application/zip','content-disposition':`attachment; filename="${out.name}"`,'cache-control':'no-store'});res.end(out.bytes);return}
        writeJson(res,200,{...managed.read(),projects:sessionProjectRoots()});return
      }
      const b=(await readJsonBody(req,{maxBytes:46*1024*1024,objectOnly:true})) as Record<string,any>|null
      if(!b)throw Error('无效请求')
      const result=action==='tags'?managed.tagChange(Number(b.revision),String(b.from),b.to):action==='inspect'?managed.inspect(b as Parameters<ManagedSkills['inspect']>[0]):action==='commit'?managed.commit(String(b.id),b.choices,b.enabled===true):action==='discard'?managed.discard(String(b.id)):managed.change(String(b.id),Number(b.revision),String(b.action),b.value)
      writeJson(res,200,result??{ok:true})
    }catch(error){writeJson(res,400,{error:error instanceof Error?error.message:String(error)})}
  }})

  /** Collect options shared by list/set-enabled/delete/health handlers. */
  const collectOptions = (cwd: string): CollectOptions => ({
    cwd,
    projectRoots: sessionProjectRoots(),
    customSkillDirs,
    dshHome,
    agentsHome,
    registry,
  })

  /** Find a skill by name from a fresh collection pass (trusts scanned paths only). */
  const findSkill = async (name: string, cwd: string): Promise<SkillEntry | undefined> => {
    const { skills } = await collectSkills(collectOptions(cwd))
    return skills.find((candidate) => candidate.name === name)
  }

  /** Resolve the exact editable file shown by the client, rejecting stale same-name fallbacks. */
  const resolveMutationSkill = async (
    name: string,
    expectedPath: string,
    cwd: string,
    res: ServerResponse,
  ): Promise<(SkillEntry & { path: string }) | undefined> => {
    const skill = await findSkill(name, cwd)
    if (skill?.path === undefined) {
      writeJson(res, 404, { error: `skill ${name} has no editable file` })
      return undefined
    }
    if (skill.path !== expectedPath) {
      writeJson(res, 409, { error: `skill ${name} changed since the panel loaded; refresh and retry` })
      return undefined
    }
    return skill as SkillEntry & { path: string }
  }

  const routes: WebRoute[] = [
    ...['list','export','detail','resource'].map(action=>managedRoute(action,'GET')),
    ...['inspect','commit','discard','change','tags'].map(action=>managedRoute(action,'POST')),
    {
      kind: 'exact',
      path: ROUTES.list,
      handler: async (req: IncomingMessage, res: ServerResponse) => {
        if (!guard(req, res, 'GET')) return
        try {
          const url = new URL(req.url ?? '/', 'http://x')
          // Project root base: explicit ?cwd= first, then active session
          // workspaces, process.cwd() last.
          const sessionCwds = safeSessionCwds()
          const cwd = queryParam(url, 'cwd') ?? sessionCwds[0] ?? DEFAULT_CWD()
          const projectRoots = sessionProjectRoots()
          const { skills, complete } = await collectSkills(collectOptions(cwd))
          const owned=new Set(managed.read().skills.map(s=>joinPath(s.root,s.name,'SKILL.md')))
          writeJson(res, 200, buildPayload(skills.filter(s=>!s.path||!owned.has(s.path)), complete, cwd, [...new Set(projectRoots)]))
        } catch (error) {
          logger.warn(error)
          writeJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
        }
      },
    },
    {
      kind: 'exact',
      path: ROUTES.setEnabled,
      handler: async (req: IncomingMessage, res: ServerResponse) => {
        if (!guard(req, res, 'POST')) return
        try {
          const body = await readJsonBody(req, { maxBytes: 128 * 1024, objectOnly: true })
          if (body === null) {
            writeJson(res, 400, { error: 'invalid JSON body' })
            return
          }
          const payload = body as Record<string, unknown>
          const { name, path, enabled } = payload
          if (typeof name !== 'string' || !NAME_PATTERN.test(name) || typeof path !== 'string' || path.trim() === '' || typeof enabled !== 'boolean') {
            writeJson(res, 400, { error: 'expected { name, path, enabled }' })
            return
          }
          const managedState=managed.read(),owned=managedState.skills.find(s=>joinPath(s.root,s.name,'SKILL.md')===path)
          if(owned){managed.change(owned.id,managedState.revision,'enabled',enabled);writeJson(res,200,{name,enabled,modelInvocable:enabled&&owned.auto,path});return}
          // The client path is only an identity claim: a fresh scan must
          // resolve the same effective skill before any file is touched.
          const skill = await resolveMutationSkill(name, path, DEFAULT_CWD(), res)
          if (skill === undefined) return
          // Disabled = disable-model-invocation: true; enabled = false.
          const frontmatter = setFrontmatterField(skill.path, 'disable-model-invocation', enabled ? false : true)
          writeJson(res, 200, {
            name,
            enabled: frontmatter.disableModelInvocation !== true,
            modelInvocable: frontmatter.disableModelInvocation !== true,
            path: skill.path,
          })
        } catch (error) {
          logger.warn(error)
          writeJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
        }
      },
    },
    {
      kind: 'exact',
      path: ROUTES.create,
      handler: async (req: IncomingMessage, res: ServerResponse) => {
        if (!guard(req, res, 'POST')) return
        try {
          const body = await readJsonBody(req, { maxBytes: 128 * 1024, objectOnly: true })
          if (body === null) {
            writeJson(res, 400, { error: 'invalid JSON body' })
            return
          }
          const payload = body as Record<string, unknown>
          const { root, name, description, whenToUse, content, cwd } = payload
          if (root !== 'user' && root !== 'project') {
            writeJson(res, 400, { error: 'root must be user (~/.dsh/skills) or project (project .dsh/skills)' })
            return
          }
          if (typeof cwd !== 'string' || cwd.trim() === '') {
            writeJson(res, 400, { error: 'cwd is required (the workspace shown by the panel)' })
            return
          }
          if (typeof name !== 'string' || !NAME_PATTERN.test(name)) {
            writeJson(res, 400, { error: 'name must be kebab-case (lowercase letters/digits first)' })
            return
          }
          if (typeof description !== 'string' || description.trim() === '') {
            writeJson(res, 400, { error: 'description is required' })
            return
          }
          if (typeof content !== 'string' || content.trim() === '') {
            writeJson(res, 400, { error: 'content is required' })
            return
          }
          if (Buffer.byteLength(content, 'utf8') > 64 * 1024) {
            writeJson(res, 400, { error: 'content exceeds 64KB limit' })
            return
          }
          const baseDir = root === 'user'
            ? userSkillRoot(dshHome)
            : projectSkillRoot(findProjectRoot(cwd))
          const target = await writeSkillFile(baseDir, name, description, typeof whenToUse === 'string' ? whenToUse : undefined, content)
          writeJson(res, 200, { ok: true, name, path: target })
        } catch (error) {
          if (error instanceof Error && /already exists/.test(error.message)) {
            writeJson(res, 409, { error: error.message })
            return
          }
          logger.warn(error)
          writeJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
        }
      },
    },
    {
      kind: 'exact',
      path: ROUTES.delete,
      handler: async (req: IncomingMessage, res: ServerResponse) => {
        if (!guard(req, res, 'POST')) return
        try {
          const body = await readJsonBody(req, { maxBytes: 128 * 1024, objectOnly: true })
          if (body === null) {
            writeJson(res, 400, { error: 'invalid JSON body' })
            return
          }
          const payload = body as Record<string, unknown>
          const { name, path } = payload
          if (typeof name !== 'string' || !NAME_PATTERN.test(name) || typeof path !== 'string' || path.trim() === '') {
            writeJson(res, 400, { error: 'expected { name, path }' })
            return
          }
          if(managed.read().skills.some(s=>joinPath(s.root,s.name,'SKILL.md')===path)){
            writeJson(res,409,{error:'此技能由 Skills 导入模块管理，请从该模块移除以保留完整资源和恢复记录'})
            return
          }
          const skill = await resolveMutationSkill(name, path, DEFAULT_CWD(), res)
          if (skill === undefined) return
          // A linked skill lives behind a symlink (mount-of-intent content, not
          // created under this root). Deleting it would move the target's real
          // SKILL.md out of place, escaping this skill root — refuse deletion.
          if (skill.linked === true) {
            writeJson(res, 400, { error: `skill ${name} is a linked skill and cannot be deleted` })
            return
          }
          const moved = await trashSkillFile(skill.path)
          writeJson(res, 200, { ok: true, name, moved })
        } catch (error) {
          logger.warn(error)
          writeJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
        }
      },
    },
    {
      kind: 'exact',
      path: ROUTES.health,
      handler: async (req: IncomingMessage, res: ServerResponse) => {
        if (!guard(req, res, 'GET')) return
        try {
          const { skills } = await collectSkills(collectOptions(DEFAULT_CWD()))
          writeJson(res, 200, { ok: true, plugin: 'skill-explorer', skills: skills.length })
        } catch (error) {
          logger.warn(error)
          writeJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
        }
      },
    },
  ]
  return routes
}
