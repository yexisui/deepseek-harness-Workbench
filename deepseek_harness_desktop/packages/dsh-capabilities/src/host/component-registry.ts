import { createHash, randomUUID } from 'node:crypto'
import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { components, references, type State } from '../core/model.ts'
import { emptyRegistry, type ComponentMetadata, type ComponentRegistry, type ComponentActivity } from '../core/component-registry.ts'
import { InputError, object, text, integer, bool } from '../core/validation.ts'

/** Uses the capability store's writer queue and lock; no second writer or execution configuration copy. */
export class ComponentRegistryStore {
  private value = emptyRegistry()
  constructor(private directory: string, private state: () => State, private activities: () => Promise<ComponentActivity[]>) {}
  async init() {
    await mkdir(this.directory, { recursive: true })
    try {
      const value = JSON.parse(await readFile(join(this.directory, 'component-registry.json'), 'utf8'))
      if (value.schema !== 1 || !Number.isInteger(value.revision) || !value.metadata || !Array.isArray(value.candidates) || !Array.isArray(value.events) || !Array.isArray(value.operations)) throw new Error('组件登记格式不受支持')
      this.value = value
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
  }
  snapshot() { return structuredClone(this.value) }
  async preview(id: string, action: string) {
    if (!['retire', 'restore', 'disable', 'enable', 'purge'].includes(action)) throw new InputError('组件操作无效')
    if (!components.some(c => c.id === id) && !this.value.candidates.some(c => c.id === id)) throw new InputError('组件不存在', 404)
    const state = this.state(), refs = references(state, id), activities = (await this.activities()).filter(t => t.componentIds.includes(id))
    const result = { id, action, revision: this.value.revision, stateRevision: state.revision,
      capabilities: refs.capabilities.map(c => ({ id: c.id, name: c.draft.name, removed: !!c.removedAt, versions: c.versions.filter(v => v.components.some(p => p.componentId === id)).map(v => v.version), draft: c.draft.components.some(p => p.componentId === id) })),
      roles: refs.roles.map(r => ({ id: r.id, name: r.draft.name })), activities }
    return { ...result, token: createHash('sha256').update(JSON.stringify(result)).digest('hex') }
  }
  async command(raw: unknown) {
    const command = object(raw), operation = text(command.operationId, '操作标识', 80, true)
    if (!/^[a-zA-Z0-9-]{16,80}$/.test(operation)) throw new InputError('操作标识无效')
    if (this.value.operations.includes(operation)) return this.snapshot()
    const next = this.snapshot(), at = new Date().toISOString()
    const id = text(command.id ?? '', '组件标识', 100)
    const known = components.some(c => c.id === id), candidate = next.candidates.find(c => c.id === id)
    if (command.type === 'candidate.add') {
      if (integer(command.revision) !== next.revision) throw new InputError('组件清单已更新，请刷新后重试', 409)
      if (next.candidates.length >= 500) throw new InputError('候选组件数量已达上限')
      const provider = text(command.provider, '提供插件', 250, true)
      if (!/^(@[a-z0-9_.-]+\/)?[a-z0-9_.-]+(\/[a-z0-9_.-]+)*$/i.test(provider)) throw new InputError('请填写完整插件包名或导出模块名')
      next.candidates.push({ id: 'candidate-' + randomUUID(), name: text(command.name, '名称', 80, true), description: text(command.description, '说明', 1000), category: text(command.category, '分类', 80) || '未分类', provider, createdAt: at })
    } else {
      if (!known && !candidate) throw new InputError('组件不存在', 404)
      if (command.type === 'metadata.save') {
        const patch = object(command.patch), base = object(command.base)
        const target: ComponentMetadata = known ? next.metadata[id] ?? {} : candidate!
        for (const key of Object.keys(patch)) {
          if (!['name', 'description', 'category', 'pinned'].includes(key)) throw new InputError('不允许修改运行标识或动作契约')
          const field = key as 'name' | 'description' | 'category' | 'pinned'
          if (integer(command.revision) !== next.revision && target[field] !== base[field]) throw new InputError('同一字段已在其他页面修改；当前编辑内容仍保留，请重新核对', 409)
          const value = field === 'pinned' ? bool(patch[field]) : text(patch[field], field, field === 'description' ? 1000 : 80, field === 'name')
          Object.assign(target, { [field]: value })
        }
        if (known) next.metadata[id] = target
      } else {
        const action = text(command.type, '操作', 80, true).replace('component.', '')
        const preview = await this.preview(id, action)
        if (command.token !== preview.token || command.confirm !== true) throw new InputError('引用或活动任务已变化，请重新检查影响范围', 409)
        if (action === 'purge') {
          if (known) throw new InputError('内置组件由插件提供，不能单独永久删除；请使用回收站或插件管理')
          if (!candidate?.retiredAt || preview.capabilities.length || preview.roles.length || preview.activities.length) throw new InputError('请先移入回收站并解除全部历史引用')
          next.candidates = next.candidates.filter(c => c.id !== id)
        } else {
          const target = known ? next.metadata[id] ?? {} : candidate!
          if (action === 'retire') target.retiredAt = at
          else if (action === 'restore') delete target.retiredAt
          else if (known && action === 'disable') Object.assign(target, { enabled: false, revokedAt: Date.now() })
          else if (known && action === 'enable') Object.assign(target, { enabled: true })
          else throw new InputError('候选组件尚未接入运行适配器')
          if (known) next.metadata[id] = target
        }
      }
    }
    next.revision++; next.operations = [...next.operations.slice(-499), operation]
    next.events = [...next.events.slice(-999), { id: operation, componentId: id || next.candidates.at(-1)!.id, at, action: String(command.type) }]
    await this.persist(next); this.value = next; return this.snapshot()
  }
  private async persist(value: ComponentRegistry) {
    const temp = join(this.directory, `components-${randomUUID()}.tmp`), handle = await open(temp, 'wx')
    try { await handle.writeFile(JSON.stringify(value, null, 2)); await handle.sync() } finally { await handle.close() }
    try { await rename(temp, join(this.directory, 'component-registry.json')) } catch (error) { await unlink(temp).catch(() => {}); throw error }
  }
}
