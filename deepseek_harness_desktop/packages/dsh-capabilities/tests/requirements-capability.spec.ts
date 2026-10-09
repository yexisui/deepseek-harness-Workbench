import { afterEach, expect, it } from 'vitest'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { initialState, latest } from '../src/core/model.ts'
import { REQUIREMENTS_CAPABILITY_ID as capabilityId, REQUIREMENTS_ROLE_ID as roleId } from '../src/core/requirements-model.ts'
import { CapabilityStore } from '../src/host/store.ts'
import { allowedActions } from '../src/core/policy.ts'

const stores: CapabilityStore[] = []
afterEach(async () => { for (const store of stores.splice(0)) await store.close() })
const open = async (directory: string) => { const store = new CapabilityStore(directory); await store.init(); stores.push(store); return store }
it('migrates from the published analyst without publishing unfinished edits or changing historic authority', async () => {
  const before = initialState(), role = before.roles.find(r => r.id === roleId)!
  delete before.requirementsCapabilityVersion
  before.capabilities = before.capabilities.filter(c => c.id !== capabilityId)
  role.draft.capabilities = []; role.versions[0]!.capabilities = []
  role.draft.name = '未发布名称'; role.draft.color = '#123456'; role.draft.duties = '正在编辑的职责'; role.enabled = false
  const oldVersion = structuredClone(role.versions[0])
  const dir = await mkdtemp(join(tmpdir(), 'requirements-migration-'))
  await writeFile(join(dir, 'state.json'), JSON.stringify(before))
  const store = await open(dir), migrated = store.snapshot(), saved = migrated.roles.find(r => r.id === roleId)!
  expect(saved.enabled).toBe(false)
  expect(saved.draft).toMatchObject({ name: '未发布名称', color: '#123456', duties: '正在编辑的职责' })
  expect(saved.versions[0]).toEqual(oldVersion)
  expect(saved.versions).toHaveLength(2)
  expect(saved.versions[1]).toMatchObject({ name: oldVersion!.name, color: oldVersion!.color, duties: oldVersion!.duties, capabilities: [{ capabilityId, version: 1, enabled: true }] })
  expect(JSON.parse(await readFile(join(dir, 'state-before-requirements-capability-v1.json'), 'utf8'))).toEqual(before)
  await store.close()
  expect((await open(dir)).snapshot()).toEqual(migrated)
})
it('saves an incomplete requirement capability draft without changing execution; blocks publish then supports restoring', async () => {
  const store = await open(await mkdtemp(join(tmpdir(), 'requirements-components-')))
  let state = store.snapshot(), cap = state.capabilities.find(c => c.id === capabilityId)!
  const missing = { ...cap.draft, components: [] }
  await store.command(state.revision, { type: 'capability.save', id: capabilityId, definition: missing, publish: false })
  state = store.snapshot()
  expect(allowedActions(state, roleId, latest(state.roles.find(r => r.id === roleId)!.versions)!)).toContain('analyze-requirements')
  await expect(store.command(state.revision, { type: 'capability.save', id: capabilityId, definition: missing, publish: true })).rejects.toThrow('缺少必需组件')
  await store.command(state.revision, { type: 'capability.save', id: capabilityId, definition: cap.draft, publish: true })
  expect(latest(store.snapshot().capabilities.find(c => c.id === capabilityId)!.versions)!.version).toBe(2)
})
it('publishes custom requirements roles combined with other capabilities', async () => {
  const store = await open(await mkdtemp(join(tmpdir(), 'requirements-custom-role-')))
  let state = store.snapshot(), value = structuredClone(state.roles.find(r => r.id === roleId)!.draft)
  value.name = '自定义需求岗位'
  const created = await store.command(state.revision, { type: 'role.save', definition: value, publish: true })
  state = store.snapshot()
  expect(allowedActions(state, created.id, latest(state.roles.find(r => r.id === created.id)!.versions)!)).toEqual(['analyze-requirements'])
  value.capabilities.push({ capabilityId: 'browser', version: 1, enabled: true })
  await store.command(state.revision, { type: 'role.save', id: created.id, definition: value, publish: false })
  await expect(store.command(store.snapshot().revision, { type: 'role.save', id: created.id, definition: value, publish: true })).resolves.toBeDefined()
  await expect(store.command(store.snapshot().revision, { type: 'capability.copy', id: capabilityId })).rejects.toThrow('暂不支持复制')
})
