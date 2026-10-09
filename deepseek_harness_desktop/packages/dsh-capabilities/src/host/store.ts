import { applyCapabilitySettings, saveRoleSettings } from '../core/current-settings.ts'
import {ManagedSkills} from '../../../dsh-skill-explorer/src/managed.ts'
import {dirname} from 'node:path'
import { catalogFor, manifest, digestPattern, packageDefinition } from '../core/distribution.ts'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, open, rename, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { capabilityDeletionReferences, initialState, latest, meetingCapability, requirementsCapability, type State, type Command, type Role, type RoleDefinition } from '../core/model.ts'
import { REQUIREMENTS_CAPABILITY_ID, REQUIREMENTS_ROLE_ID } from '../core/requirements-model.ts'
import { DEVELOPER_CAPABILITY_ID, DEVELOPER_ROLE_ID } from '../core/developer-model.ts'
import { developerCapability } from '../core/model.ts'
import { roleCapabilityReason } from '../core/role-capability-catalog.ts'
import { defaultRoles, MEETING_CAPABILITY_ID, MEETING_ROLE_ID } from '../core/default-roles.ts'
import { bool, definition, id, InputError, integer, issues, list, object, roleDefinition, roleCompositionIssues, text } from '../core/validation.ts'
import { RoleIconStore } from './icons.ts'
import { compatibilityIssues } from '../core/composition.ts'

/** One writer, atomic replacement and optimistic revisions; no silent overwrite on corruption. */
export class CapabilityStore {
  private state!: State
  private tail: Promise<unknown> = Promise.resolve()
  private lock?: Awaited<ReturnType<typeof open>>
  private listeners = new Set<() => void>()
  readonly icons: RoleIconStore
  constructor(readonly directory: string) { this.icons = new RoleIconStore(join(directory, 'icons')) }
  async init() {
    await mkdir(this.directory, { recursive: true })
    // A desktop host may be killed without disposal. Recover only a provably dead writer.
    const lockPath = join(this.directory, 'writer.lock')
    try {
      const saved = await readFile(lockPath, 'utf8'), owner = JSON.parse(saved)
      if (Number.isSafeInteger(owner.pid) && owner.pid > 0) {
        try { process.kill(owner.pid, 0) }
        catch (error) { if ((error as NodeJS.ErrnoException).code === 'ESRCH' && await readFile(lockPath, 'utf8') === saved) await unlink(lockPath) }
      }
    } catch { /* Missing, malformed or inaccessible locks are not forcibly reclaimed. */ }
    try { this.lock = await open(join(this.directory, 'writer.lock'), 'wx'); await this.lock.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })) }
    catch { throw new Error('能力数据已由另一个服务锁定。请先停止该服务；异常退出后核实 writer.lock 中的进程再恢复。') }
    try {
      try {
        const raw = JSON.parse(await readFile(join(this.directory, 'state.json'), 'utf8'))
        if (raw.schema !== 1 || !Array.isArray(raw.capabilities) || !Array.isArray(raw.roles) || !Number.isSafeInteger(raw.revision)) throw new Error('Unsupported capability data')
        this.state = raw
        if (raw.defaultRolesVersion !== undefined && raw.defaultRolesVersion !== 1 && raw.defaultRolesVersion !== 2) throw new Error('Unsupported default role migration')
        if (raw.meetingCapabilityVersion !== undefined && raw.meetingCapabilityVersion !== 1) throw new Error('Unsupported meeting capability migration')
        if (raw.requirementsCapabilityVersion !== undefined && raw.requirementsCapabilityVersion !== 1) throw new Error('Unsupported requirements capability migration')
        if (raw.developerCapabilityVersion !== undefined && raw.developerCapabilityVersion !== 1) throw new Error('Unsupported developer capability migration')
        if (raw.stoppedSessions !== undefined && (!Array.isArray(raw.stoppedSessions) || raw.stoppedSessions.some((value: unknown) => typeof value !== 'string' || !value || value.length > 150))) throw new Error('Invalid stopped session data')
        if (raw.revokedAt !== undefined && Object.entries(object(raw.revokedAt)).some(([key, value]) => !/^(role|capability):[a-z][a-z0-9-]*$/.test(key) || !Number.isSafeInteger(value) || Number(value) < 0)) throw new Error('Invalid revocation data')
        for (const [hash, release] of Object.entries(raw.packageReleases ?? {})) { const data = object(release); if (!digestPattern.test(hash) || data.hash !== hash) throw new Error('Invalid package digest'); manifest(data.manifest) }
        // Validate persisted references too. Invalid state must never become execution authority.
        for (const cap of this.state.capabilities) {
          id(cap.id); bool(cap.enabled); definition(cap.draft, catalogFor(this.state))
          if (cap.removedAt !== undefined && (typeof cap.removedAt !== 'string' || !Number.isFinite(Date.parse(cap.removedAt)) || cap.enabled || cap.pinned)) throw new Error('Invalid removed capability data')
          for (const version of cap.versions) { integer(version.version); definition(version, catalogFor(this.state)); if (version.packageHash && !this.state.packageReleases?.[version.packageHash]) throw new Error('Missing package release') }
        }
        for (const role of this.state.roles) { if (role.removedAt !== undefined && (typeof role.removedAt !== 'string' || !Number.isFinite(Date.parse(role.removedAt)) || !role.archivedAt || role.enabled)) throw new Error('Invalid removed role data'); if (role.archivedAt !== undefined && (typeof role.archivedAt !== 'string' || !Number.isFinite(Date.parse(role.archivedAt)) || role.enabled)) throw new Error('Invalid archived role data'); id(role.id); bool(role.enabled); roleDefinition(role.draft, this.state); for (const version of role.versions) { integer(version.version); if (version.directSave !== undefined) bool(version.directSave); roleDefinition(version, this.state) } }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
        this.state = initialState(); await this.persist(this.state)
      }
      if (this.state.meetingCapabilityVersion !== 1) {
        const next = this.mutableSnapshot(), now = new Date().toISOString()
        if (!next.capabilities.some(cap => cap.id === MEETING_CAPABILITY_ID)) next.capabilities.push(meetingCapability(now))
        const role = next.roles.find(item => item.id === MEETING_ROLE_ID)
        if (role && !role.draft.capabilities.some(binding => binding.capabilityId === MEETING_CAPABILITY_ID)) {
          const binding = { capabilityId: MEETING_CAPABILITY_ID, version: 1, enabled: true }
          role.draft.capabilities.push(binding)
          // Existing meeting conversations keep their published version; only new ones use the binding.
          this.publishRole(role, role.draft, now)
        }
        next.meetingCapabilityVersion = 1; next.revision++; next.updatedAt = now
        const backup = await open(join(this.directory, 'state-before-meeting-capability-v1.json'), 'wx').catch(error => { if (error.code !== 'EEXIST') throw error; return undefined })
        if (backup) { try { await backup.writeFile(JSON.stringify(this.state, null, 2)); await backup.sync() } finally { await backup.close() } }
        await this.persist(next); this.state = next
      }
      if (this.state.requirementsCapabilityVersion !== 1) {
        const next = this.mutableSnapshot(), now = new Date().toISOString()
        if (!next.capabilities.some(cap => cap.id === REQUIREMENTS_CAPABILITY_ID)) next.capabilities.push(requirementsCapability(now))
        const role = next.roles.find(item => item.id === REQUIREMENTS_ROLE_ID)
        const current = role && latest(role.versions)
        const binding = { capabilityId: REQUIREMENTS_CAPABILITY_ID, version: 1, enabled: true }
        if (role) {
          // Keep unfinished edits private. Publish only from the previous published definition.
          // Existing executable combinations remain intact and can be adjusted in the role editor.
          if (!role.draft.capabilities.some(item => item.capabilityId === REQUIREMENTS_CAPABILITY_ID) && !role.draft.capabilities.some(item => item.enabled)) role.draft.capabilities.push(structuredClone(binding))
          if (current && !current.capabilities.some(item => item.capabilityId === REQUIREMENTS_CAPABILITY_ID) && !current.capabilities.some(item => item.enabled)) this.publishRole(role, { ...structuredClone(current), capabilities: [...current.capabilities, binding] }, now)
        }
        next.requirementsCapabilityVersion = 1; next.revision++; next.updatedAt = now
        const backup = await open(join(this.directory, 'state-before-requirements-capability-v1.json'), 'wx').catch(error => { if (error.code !== 'EEXIST') throw error; return undefined })
        if (backup) { try { await backup.writeFile(JSON.stringify(this.state, null, 2)); await backup.sync() } finally { await backup.close() } }
        await this.persist(next); this.state = next
      }
      if (this.state.developerCapabilityVersion !== 1) {
        const next = this.mutableSnapshot(), now = new Date().toISOString()
        if (!next.capabilities.some(cap => cap.id === DEVELOPER_CAPABILITY_ID)) next.capabilities.push(developerCapability(now))
        const role = next.roles.find(item => item.id === DEVELOPER_ROLE_ID), current = role && latest(role.versions)
        const binding = { capabilityId: DEVELOPER_CAPABILITY_ID, version: 1, enabled: true }
        if (role && current && !current.capabilities.some(item => item.enabled)) {
          // An unfinished role draft is never published by a migration.
          if (!role.draft.capabilities.some(item => item.enabled) && !role.draft.capabilities.some(item => item.capabilityId === binding.capabilityId)) role.draft.capabilities.push(structuredClone(binding))
          this.publishRole(role, { ...structuredClone(current), capabilities: [...current.capabilities, binding] }, now)
        }
        const backup = await open(join(this.directory, 'state-before-developer-capability-v1.json'), 'wx').catch(error => { if (error.code !== 'EEXIST') throw error; return undefined })
        if (backup) { try { await backup.writeFile(JSON.stringify(this.state, null, 2)); await backup.sync() } finally { await backup.close() } }
        next.developerCapabilityVersion = 1; next.revision++; next.updatedAt = now; await this.persist(next); this.state = next
      }
      if (this.state.defaultRolesVersion !== 2) {
        // V1 users already have four managed roles. Add the meeting role under its
        // existing conversation ID without touching their drafts or history.
        const next = this.mutableSnapshot(), now = new Date().toISOString()
        const defaults = defaultRoles(now).filter(role => this.state.defaultRolesVersion !== 1 || role.id === MEETING_ROLE_ID)
        next.roles.push(...defaults.filter(role => !next.roles.some(existing => existing.id === role.id || (role.id !== MEETING_ROLE_ID && existing.draft.name.trim() === role.draft.name))))
        next.defaultRolesVersion = 2; next.revision++; next.updatedAt = now
        const backup = await open(join(this.directory, 'state-before-default-roles-v2.json'), 'wx').catch(error => { if (error.code !== 'EEXIST') throw error; return undefined })
        if (backup) { try { await backup.writeFile(JSON.stringify(this.state, null, 2)); await backup.sync() } finally { await backup.close() } }
        await this.persist(next); this.state = next
      }
    } catch (error) { await this.close(); throw error }
  }
  componentRestrictions: () => NonNullable<State['componentRestrictions']> = () => ({})
  prepareCommit: (next: State, previous: State) => Promise<undefined | (() => Promise<void>)> = async () => undefined
  enableIssues: (id: string) => string[] = () => []
  publishIssues: (ids: string[]) => string[] = () => []
  private mutableSnapshot(): State { return structuredClone(this.state) }
  snapshot(): State { const state = this.mutableSnapshot(); state.capabilities = state.capabilities.filter(c => !c.purgedAt); return { ...state, componentRestrictions: this.componentRestrictions() } }
  notify() { this.listeners.forEach(fn => fn()) }
  exclusive<T>(run: () => Promise<T>): Promise<T> { const attempt = this.tail.then(run); this.tail = attempt.then(() => {}, () => {}); return attempt }

  subscribe(fn: () => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn) } }
  /** Package assets are prepared first; this is the only authority commit for an installation. */
  transaction<T>(expectedRevision: unknown, update: (next: State) => Promise<T> | T, rollbackAssets?: () => Promise<void>): Promise<T> {
    return this.exclusive(async () => {
      if (!this.lock) throw new InputError('能力服务未运行', 503)
      if (integer(expectedRevision) !== this.state.revision) throw new InputError('能力清单已更新，请重新预览后重试', 409)
      try {
      const next = this.mutableSnapshot(), result = await update(next)
      const catalog = catalogFor(next)
      for (const cap of next.capabilities) { definition(cap.draft, catalog); for (const v of cap.versions) definition(v, catalog) }
      for (const role of next.roles) { roleDefinition(role.draft, next); for (const v of role.versions) roleDefinition(v, next) }
      next.revision++; next.updatedAt = new Date().toISOString()
      const rollback = await this.prepareCommit(next, this.snapshot())
      try { await this.persist(next) } catch (error) { await rollback?.(); throw error }
      this.state = next
      for (const listener of this.listeners) { try { listener() } catch { /* Already committed. */ } }
      return result
      } catch (error) { await rollbackAssets?.(); throw error }
    })
  }
  revokeSession(sessionId: string): Promise<void> {
    const run = async () => {
      if (!this.lock) throw new InputError('能力服务未运行', 503)
      text(sessionId, '会话标识', 150, true)
      if (this.state.stoppedSessions?.includes(sessionId)) return
      const next = this.mutableSnapshot()
      next.stoppedSessions = [...(next.stoppedSessions ?? []), sessionId]
      await this.persist(next); this.state = next
    }
    const attempt = this.tail.then(run); this.tail = attempt.catch(() => {}); return attempt
  }
  private async persist(next: State) {
    const temp = join(this.directory, `state-${randomUUID()}.tmp`)
    const file = await open(temp, 'wx')
    try { await file.writeFile(JSON.stringify(next, null, 2)); await file.sync() } finally { await file.close() }
    try { await rename(temp, join(this.directory, 'state.json')) } catch (error) { await unlink(temp).catch(() => {}); throw error }
  }
  async close() { await this.tail; if (this.lock) { await this.lock.close(); this.lock = undefined; await unlink(join(this.directory, 'writer.lock')) } }
  command(expectedRevision: unknown, raw: unknown): Promise<{ state: State; id: string }> {
    const run = async () => {
      if (!this.lock) throw new InputError('能力服务未运行', 503)
      if (integer(expectedRevision) !== this.state.revision) throw new InputError('配置已被其他页面更新，请刷新后重试；当前草稿仍保留。', 409)
      const command = object(raw) as unknown as Command, next = this.mutableSnapshot(), now = new Date().toISOString()
      let target = 'id' in command && command.id !== undefined ? id(command.id) : `local-${randomUUID()}`
      if (command.type.startsWith('capability.') && next.capabilities.some(c => c.id === target && c.purgedAt)) throw new InputError('能力已移除', 404)
      if (command.type === 'capability.save') {
        const directSave = command.directSave === undefined ? false : bool(command.directSave)
        const value = definition(command.definition, catalogFor(next)), publish = directSave || bool(command.publish)
        // Incomplete drafts are editable; unsupported execution combinations are never accepted.
        const previous = next.capabilities.find(c => c.id === target)?.draft
        const newlyAdded = value.components.filter(p => !previous?.components.some(old => old.componentId === p.componentId)).map(p => p.componentId)
        const problems = [...(publish && !directSave ? issues(value, target, catalogFor(next)) : compatibilityIssues(value, target, catalogFor(next))), ...(directSave ? [] : this.publishIssues(publish ? value.components.map(p => p.componentId) : newlyAdded))]
        const currentHash = next.capabilities.find(c => c.id === target)?.versions.at(-1)?.packageHash
        if (publish && currentHash) {
          const original = packageDefinition(next.packageReleases![currentHash]!.manifest)
          if (value.components.some(p => p.actions.some(a => !original.components.some(c => c.componentId === p.componentId && c.actions.includes(a))))) problems.push('当前代码版本未提供这些动作，请导入提供该动作的能力更新')
        }
        if (problems.length) throw new InputError(problems.join('；'))
        let cap = next.capabilities.find(c => c.id === target)
        if (command.id && !cap) throw new InputError('能力不存在', 404)
        if (cap?.removedAt) throw new InputError('此能力已移除，请先恢复后再编辑')
        if (!cap) { cap = { id: target, source: 'local', enabled: true, pinned: false, draft: value, versions: [] }; next.capabilities.push(cap) }
        cap.draft = value
        if (publish && (!directSave || !latest(cap.versions) || JSON.stringify(definition(latest(cap.versions), catalogFor(next))) !== JSON.stringify(value))) {
          const version = (latest(cap.versions)?.version ?? 0) + 1
          cap.versions.push({ ...structuredClone(value), ...(directSave ? { directSave: true } : {}), version, createdAt: now, ...(latest(cap.versions)?.packageHash ? { packageHash: latest(cap.versions)!.packageHash } : {}) })
          if (directSave) applyCapabilitySettings(next, cap.id, version, now)
          const selectedRoles = directSave ? [] : list(command.applyToRoles ?? []).map(id)
          for (const roleId of selectedRoles) {
            const role = next.roles.find(r => r.id === roleId), current = role && latest(role.versions)
            if (!role || !current || !current.capabilities.some(b => b.capabilityId === target)) throw new InputError('应用范围包含没有引用此能力的岗位')
            const updated = structuredClone(current)
            updated.capabilities = updated.capabilities.map(b => b.capabilityId === target ? { ...b, version, ...(b.actions ? { actions: b.actions.filter(a => value.components.some(p => p.actions.includes(a))) } : {}) } : b)
            this.publishRole(role, updated, now)
          }
        }
      } else if (command.type === 'capability.copy') {
        const original = next.capabilities.find(c => c.id === target)
        if (!original) throw new InputError('能力不存在', 404)
        if (original.packageOrigin) throw new InputError('导入能力保留唯一作品身份；请从外部工程使用新作品标识制作派生版本')
        if (target === MEETING_CAPABILITY_ID) throw new InputError('内置会议录音转写不能复制；可编辑说明和服务配置')
        if (target === DEVELOPER_CAPABILITY_ID) throw new InputError('开发工作区使用专用执行路由，暂不支持复制；可由多个岗位引用同一能力')
        if (target === REQUIREMENTS_CAPABILITY_ID) throw new InputError('需求分析服务使用独立工作区，暂不支持复制能力或混合浏览器流程；可由多个岗位引用同一已发布能力')
        if (original.removedAt) throw new InputError('此能力已移除，请先恢复后再复制')
        target = `local-${randomUUID()}`
        next.capabilities.push({ id: target, source: 'local', enabled: true, pinned: false, draft: { ...structuredClone(original.draft), name: `${original.draft.name} 副本`.slice(0, 80) }, versions: [] })
      } else if (command.type === 'capability.toggle' || command.type === 'capability.pin') {
        const cap = next.capabilities.find(c => c.id === target)
        if (!cap) throw new InputError('能力不存在', 404)
        if (cap.removedAt) throw new InputError('此能力已移除，请先恢复后再操作')
        if (command.type === 'capability.toggle') { if (command.enabled && cap.packageOrigin) { const problems = this.enableIssues(cap.id); if (problems.length) throw new InputError(problems.join('；')) }; cap.enabled = bool(command.enabled); if (!cap.enabled) (next.revokedAt ??= {})[`capability:${target}`] = Date.parse(now) }
        else cap.pinned = bool(command.pinned)
      } else if (command.type === 'capability.remove' || command.type === 'capability.restore') {
        const cap = next.capabilities.find(c => c.id === target)
        if (!cap) throw new InputError('能力不存在', 404)
        if (command.type === 'capability.remove') {
          if (cap.removedAt) throw new InputError('此能力已移除，可从“回收站”中恢复')
          // 软移除保留岗位引用和不可变历史；同时撤销未加载的旧会话权限。
          cap.removedAt = now; cap.enabled = false; cap.pinned = false
          next.revokedAt ??= {}; next.revokedAt[`capability:${target}`] = Date.parse(now)
        } else {
          if (!cap.removedAt) throw new InputError('此能力未移除，无需恢复')
          delete cap.removedAt
          // 恢复配置不等于重新授权，必须由用户另行启用；旧撤销记录继续生效。
          cap.enabled = false; cap.pinned = false
        }
      } else if (command.type === 'capability.restoreMany' || command.type === 'capability.purge') {
        const ids = list(command.ids, 10000).map(id)
        if (!ids.length) throw new InputError('请先选择回收站中的能力')
        if (new Set(ids).size !== ids.length) throw new InputError('能力标识不能重复')
        // 先校验整批范围，任何一项失效均不写入，避免部分恢复或部分永久删除。
        const capabilities = ids.map(capabilityId => {
          const cap = next.capabilities.find(candidate => candidate.id === capabilityId)
          if (!cap || cap.purgedAt) throw new InputError('能力不存在，请刷新后重试', 404)
          if (!cap.removedAt) throw new InputError('只能操作回收站中的能力')
          if (command.type === 'capability.purge' && capabilityDeletionReferences(next, capabilityId).length) throw new InputError(`“${cap.draft.name}”仍被当前岗位使用，请先从岗位移除`)
          return cap
        })
        target = ids[0]!
        if (command.type === 'capability.restoreMany') {
          for (const cap of capabilities) {
            delete cap.removedAt
            // 批量恢复同样只恢复配置，不恢复授权、收藏或旧会话的执行权限。
            cap.enabled = false; cap.pinned = false
          }
        } else {
          const selected = new Set(ids)
          // Historical tasks can still read their saved configuration, without keeping a recoverable management entry.
          next.capabilities = next.capabilities.filter(cap => {
            if (!selected.has(cap.id)) return true
            if (next.roles.some(role => role.versions.some(v => v.capabilities.some(b => b.capabilityId === cap.id)) || role.draft.capabilities.some(b => b.capabilityId === cap.id))) { cap.purgedAt = now; return true }
            return false
          })
        }
       } else if(command.type==='role.skills'){
        const row=new ManagedSkills(dirname(this.directory),()=>[]).read().skills.find(s=>s.id===command.skillId&&!s.removed);if(!row)throw new InputError('技能不存在或已移除');
        if(!Array.isArray(command.roleIds)||command.roleIds.some(id=>typeof id!=='string'||!next.roles.some(r=>r.id===id&&!r.archivedAt)))throw new InputError('岗位已改变，请刷新后重试');
        const selected=new Set(command.roleIds);
        for (const role of next.roles.filter(r => !r.archivedAt)) {
          const update = (bindings: NonNullable<RoleDefinition['skills']>) => {
            const old = bindings.find(b => b.id === row.id)
            return selected.has(role.id) ? old ? bindings.map(b => b.id === row.id ? { ...b, hash: row.hash, enabled: true } : b) : [...bindings, { id: row.id, name: row.name, hash: row.hash, enabled: true }] : old ? bindings.map(b => b.id === row.id ? { ...b, enabled: false } : b) : bindings
          }
          const current = latest(role.versions)
          role.draft.skills = update(role.draft.skills ?? [])
          saveRoleSettings(role, current ? { ...current, skills: update(current.skills ?? []) } : role.draft, now)
        }
        target=row.id;
      } else if (command.type === 'role.save') {
        const directSave = command.directSave === undefined ? false : bool(command.directSave)
        const value = roleDefinition(command.definition, next), publish = directSave || bool(command.publish)
        if (publish && roleCompositionIssues(value).length) throw new InputError(roleCompositionIssues(value).join('；'))
        if (value.icon?.kind === 'png') await this.icons.read(value.icon.assetId)
        let role = next.roles.find(r => r.id === target)
        if (command.id && !role) throw new InputError('岗位不存在', 404)
        if (role?.removedAt) throw new InputError('岗位已永久移除', 404)
        if (role?.archivedAt) throw new InputError('岗位已归档，请先恢复后编辑')
        const existingBindings = [...(role?.draft.capabilities ?? []), ...(role ? latest(role.versions)?.capabilities ?? [] : [])]
        for (const binding of value.capabilities) {
          if (existingBindings.some(old => old.capabilityId === binding.capabilityId && old.version === binding.version)) continue
          const capability = next.capabilities.find(c => c.id === binding.capabilityId)!
          const reason = roleCapabilityReason(target, capability, capability.versions.find(v => v.version === binding.version))
          if (reason) throw new InputError(reason)
        }
        const newComponents = value.capabilities.filter(binding => !existingBindings.some(old => old.capabilityId === binding.capabilityId && old.version === binding.version)).flatMap(binding => next.capabilities.find(c => c.id === binding.capabilityId)?.versions.find(v => v.version === binding.version)?.components.map(p => p.componentId) ?? [])
        const registryProblems = directSave ? [] : this.publishIssues(newComponents)
        if (registryProblems.length) throw new InputError(registryProblems.join('；'))
        if (value.capabilities.some(binding => next.capabilities.find(c => c.id === binding.capabilityId)?.removedAt && !existingBindings.some(existing => existing.capabilityId === binding.capabilityId && existing.version === binding.version))) throw new InputError('不能添加已移除的能力，请先在能力中心恢复')
        if (!role) { role = { id: target, enabled: true, draft: value, versions: [] }; next.roles.push(role) }
        role.draft = value
        if (publish) {
          const current = latest(role.versions)
          if (!directSave || !current || JSON.stringify(roleDefinition(current,next)) !== JSON.stringify(value)) {
            this.publishRole(role, value, now)
            if (directSave) latest(role.versions)!.directSave = true
          }
        }
      } else if (command.type === 'role.copy') {
        const original = next.roles.find(role => role.id === target)
        if (!original) throw new InputError('岗位不存在', 404)
        if (original.removedAt) throw new InputError('岗位已永久移除', 404)
        if (original.archivedAt) throw new InputError('岗位已归档，请先恢复后复制')
        const definition = structuredClone(latest(original.versions) ?? original.draft)
        target = 'local-' + randomUUID()
        next.roles.push({ id: target, enabled: true, draft: { ...definition, name: (definition.name + ' 副本').slice(0, 80) }, versions: [] })
      } else if (command.type === 'role.archive' || command.type === 'role.restore' || command.type === 'role.remove') {
        const role = next.roles.find(role => role.id === target)
        if (!role) throw new InputError('岗位不存在', 404)
        if (role.removedAt) throw new InputError('岗位已永久移除', 404)
        if (command.type === 'role.remove') {
          if (!role.archivedAt) throw new InputError('请先归档岗位，再移除')
          // Retain only the existing identity/configuration record for historical task references.
          role.removedAt = now; role.enabled = false
          ;(next.revokedAt ??= {})['role:' + target] = Date.parse(now)
        } else if (command.type === 'role.archive') {
          if (role.archivedAt) throw new InputError('岗位已归档')
          role.archivedAt = now; role.enabled = false
          ;(next.revokedAt ??= {})['role:' + target] = Date.parse(now)
        } else {
          if (!role.archivedAt) throw new InputError('岗位未归档')
          delete role.archivedAt; role.enabled = false
        }
      } else if (command.type === 'role.toggle') {
        const role = next.roles.find(r => r.id === target)
        if (!role) throw new InputError('岗位不存在', 404)
        if (role.archivedAt) throw new InputError('岗位已归档，请先恢复后启用')
        role.enabled = bool(command.enabled)
        if (!role.enabled) (next.revokedAt ??= {})[`role:${target}`] = Date.parse(now)
      } else throw new InputError('未知操作')
      next.revision++; next.updatedAt = now
      const rollback = await this.prepareCommit(next, this.snapshot())
      try { await this.persist(next) } catch (error) { await rollback?.(); throw error }
      this.state = next
      // Persistence is already committed. A notification failure must not report a failed save.
      for (const listener of this.listeners) { try { listener() } catch { /* Other subscribers and the response still receive the committed state. */ } }
      return { state: this.snapshot(), id: target }
    }
    const attempt = this.tail.then(run); this.tail = attempt.catch(() => {}); return attempt
  }
  private publishRole(role: Role, value: RoleDefinition, now: string) {
    const version = (latest(role.versions)?.version ?? 0) + 1
    role.versions.push({ ...structuredClone(value), version, preset: `workbench-role-${role.id}-v${version}`, createdAt: now })
  }
}
