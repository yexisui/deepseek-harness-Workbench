import { randomUUID } from 'node:crypto'
import { mkdir, readFile, open, rename, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { initialState, latest, type State, type Command, type Role, type RoleDefinition } from '../core/model.ts'
import { defaultRoles } from '../core/default-roles.ts'
import { bool, definition, id, InputError, integer, issues, list, object, roleDefinition, text } from '../core/validation.ts'

/** One writer, atomic replacement and optimistic revisions; no silent overwrite on corruption. */
export class CapabilityStore {
  private state!: State
  private tail: Promise<unknown> = Promise.resolve()
  private lock?: Awaited<ReturnType<typeof open>>
  private listeners = new Set<() => void>()
  constructor(readonly directory: string) {}
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
        if (raw.defaultRolesVersion !== undefined && raw.defaultRolesVersion !== 1) throw new Error('Unsupported default role migration')
        if (raw.stoppedSessions !== undefined && (!Array.isArray(raw.stoppedSessions) || raw.stoppedSessions.some((value: unknown) => typeof value !== 'string' || !value || value.length > 150))) throw new Error('Invalid stopped session data')
        if (raw.revokedAt !== undefined && Object.entries(object(raw.revokedAt)).some(([key, value]) => !/^(role|capability):[a-z][a-z0-9-]*$/.test(key) || !Number.isSafeInteger(value) || Number(value) < 0)) throw new Error('Invalid revocation data')
        // Validate persisted references too. Invalid state must never become execution authority.
        for (const cap of this.state.capabilities) { id(cap.id); bool(cap.enabled); definition(cap.draft); for (const version of cap.versions) { integer(version.version); definition(version) } }
        for (const role of this.state.roles) { id(role.id); bool(role.enabled); roleDefinition(role.draft, this.state); for (const version of role.versions) { integer(version.version); roleDefinition(version, this.state) } }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
        this.state = initialState(); await this.persist(this.state)
      }
      if (this.state.defaultRolesVersion !== 1) {
        // 只迁移一次；保留用户已有的同名岗位、修改、停用状态和历史版本。
        const next = this.snapshot(), now = new Date().toISOString()
        next.roles.push(...defaultRoles(now).filter(role => !next.roles.some(existing => existing.id === role.id || existing.draft.name.trim() === role.draft.name)))
        next.defaultRolesVersion = 1; next.revision++; next.updatedAt = now
        const backup = await open(join(this.directory, 'state-before-default-roles-v1.json'), 'wx').catch(error => { if (error.code !== 'EEXIST') throw error; return undefined })
        if (backup) { try { await backup.writeFile(JSON.stringify(this.state, null, 2)); await backup.sync() } finally { await backup.close() } }
        await this.persist(next); this.state = next
      }
    } catch (error) { await this.close(); throw error }
  }
  snapshot(): State { return structuredClone(this.state) }
  subscribe(fn: () => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn) } }
  revokeSession(sessionId: string): Promise<void> {
    const run = async () => {
      if (!this.lock) throw new InputError('能力服务未运行', 503)
      text(sessionId, '会话标识', 150, true)
      if (this.state.stoppedSessions?.includes(sessionId)) return
      const next = this.snapshot()
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
      const command = object(raw) as unknown as Command, next = this.snapshot(), now = new Date().toISOString()
      let target = 'id' in command && command.id !== undefined ? id(command.id) : `local-${randomUUID()}`
      if (command.type === 'capability.save') {
        const value = definition(command.definition), publish = bool(command.publish)
        if (publish && issues(value).length) throw new InputError(issues(value).join('；'))
        let cap = next.capabilities.find(c => c.id === target)
        if (command.id && !cap) throw new InputError('能力不存在', 404)
        if (!cap) { cap = { id: target, source: 'local', enabled: true, pinned: false, draft: value, versions: [] }; next.capabilities.push(cap) }
        cap.draft = value
        if (publish) {
          const version = (latest(cap.versions)?.version ?? 0) + 1
          cap.versions.push({ ...structuredClone(value), version, createdAt: now })
          const selectedRoles = list(command.applyToRoles ?? []).map(id)
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
        target = `local-${randomUUID()}`
        next.capabilities.push({ id: target, source: 'local', enabled: true, pinned: false, draft: { ...structuredClone(original.draft), name: `${original.draft.name} 副本`.slice(0, 80) }, versions: [] })
      } else if (command.type === 'capability.toggle' || command.type === 'capability.pin') {
        const cap = next.capabilities.find(c => c.id === target)
        if (!cap) throw new InputError('能力不存在', 404)
        if (command.type === 'capability.toggle') { cap.enabled = bool(command.enabled); if (!cap.enabled) (next.revokedAt ??= {})[`capability:${target}`] = Date.parse(now) }
        else cap.pinned = bool(command.pinned)
      } else if (command.type === 'role.save') {
        const value = roleDefinition(command.definition, next), publish = bool(command.publish)
        let role = next.roles.find(r => r.id === target)
        if (command.id && !role) throw new InputError('岗位不存在', 404)
        if (!role) { role = { id: target, enabled: true, draft: value, versions: [] }; next.roles.push(role) }
        role.draft = value
        if (publish) this.publishRole(role, value, now)
      } else if (command.type === 'role.toggle') {
        const role = next.roles.find(r => r.id === target)
        if (!role) throw new InputError('岗位不存在', 404)
        role.enabled = bool(command.enabled)
        if (!role.enabled) (next.revokedAt ??= {})[`role:${target}`] = Date.parse(now)
      } else throw new InputError('未知操作')
      next.revision++; next.updatedAt = now
      await this.persist(next); this.state = next
      for (const listener of this.listeners) listener()
      return { state: this.snapshot(), id: target }
    }
    const attempt = this.tail.then(run); this.tail = attempt.catch(() => {}); return attempt
  }
  private publishRole(role: Role, value: RoleDefinition, now: string) {
    const version = (latest(role.versions)?.version ?? 0) + 1
    role.versions.push({ ...structuredClone(value), version, preset: `workbench-role-${role.id}-v${version}`, createdAt: now })
  }
}
