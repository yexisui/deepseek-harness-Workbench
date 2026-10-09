import { afterEach, expect, it } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CapabilityStore } from '../src/host/store.ts'
import { emptyRole, latest } from '../src/core/model.ts'
import { allowedActions } from '../src/core/policy.ts'
import { ManagedSkills } from '../../dsh-skill-explorer/src/managed.ts'
import { RoleSkills } from '../src/host/role-skills.ts'

const fixtures: { home: string; store: CapabilityStore }[] = []
async function fixture() { const home = await mkdtemp(join(tmpdir(), 'simple-settings-')); const store = new CapabilityStore(join(home, 'capabilities')); await store.init(); fixtures.push({ home, store }); return { home, store } }
afterEach(async () => { for (const { home, store } of fixtures.splice(0)) { await store.close(); await rm(home, { recursive: true, force: true, maxRetries: 5 }) } })

it('one capability save updates new role tasks, preserves unrelated pending edits and old task configuration', async () => {
  const { store } = await fixture(), send = (command: unknown) => store.command(store.snapshot().revision, command)
  const { id } = await send({ type: 'role.save', definition: { ...emptyRole(), name: 'Test', capabilities: [{ capabilityId: 'browser', version: 1, enabled: true }] }, publish: true, directSave: true })
  const original = store.snapshot().roles.find(r => r.id === id)!, old = latest(original.versions)!
  await send({ type: 'role.save', id, definition: { ...original.draft, name: 'Unfinished name' }, publish: false })
  const cap = store.snapshot().capabilities.find(c => c.id === 'browser')!, definition = { ...cap.draft, instructions: 'Updated instructions', components: [{ componentId: 'browserskill', actions: ['read'] }] }
  await send({ type: 'capability.save', id: cap.id, definition, publish: true, directSave: true })
  const current = store.snapshot(), role = current.roles.find(r => r.id === id)!, adopted = latest(role.versions)!
  expect(role.draft.name).toBe('Unfinished name'); expect(adopted.name).toBe('Test')
  expect(adopted.capabilities[0].version).toBe(latest(current.capabilities.find(c => c.id === cap.id)!.versions)!.version)
  expect(allowedActions(current, id, adopted)).toEqual(['read']); expect(allowedActions(current, id, old)).toContain('navigate')
  await send({ type: 'capability.save', id: cap.id, definition, publish: true, directSave: true })
  expect(store.snapshot().capabilities.find(c => c.id === cap.id)!.versions).toHaveLength(2)
  await store.close(); await store.init(); expect(latest(store.snapshot().roles.find(r => r.id === id)!.versions)).toEqual(adopted)
})

it('incomplete component settings can be saved and reopened without granting missing actions', async () => {
  const { store } = await fixture(), cap = store.snapshot().capabilities.find(c => c.id === 'browser')!
  await store.command(store.snapshot().revision, { type: 'capability.save', id: cap.id, definition: { ...cap.draft, components: [] }, publish: true, directSave: true })
  await store.close(); await store.init()
  expect(store.snapshot().capabilities.find(c => c.id === cap.id)!.draft.components).toEqual([])
  expect(latest(store.snapshot().capabilities.find(c => c.id === cap.id)!.versions)!.components).toEqual([])
})

it('historical references no longer block deletion after removal from current roles, including after restart', async () => {
  const { store } = await fixture(), send = (command: unknown) => store.command(store.snapshot().revision, command)
  const capId = (await send({ type: 'capability.save', definition: { ...store.snapshot().capabilities[0].draft, name: 'Disposable' }, publish: true, directSave: true })).id
  const definition = { ...emptyRole(), name: 'Test', capabilities: [{ capabilityId: capId, version: 1, enabled: true }] }
  const roleId = (await send({ type: 'role.save', definition, publish: true, directSave: true })).id
  const history = store.snapshot().roles.find(r => r.id === roleId)!.versions[0]
  await send({ type: 'capability.remove', id: capId })
  await expect(send({ type: 'capability.purge', ids: [capId] })).rejects.toThrow('当前岗位')
  await send({ type: 'role.save', id: roleId, definition: { ...definition, capabilities: [] }, publish: true, directSave: true })
  await send({ type: 'capability.purge', ids: [capId] })
  expect(store.snapshot().capabilities.some(c => c.id === capId)).toBe(false)
  expect(store.snapshot().roles.find(r => r.id === roleId)!.versions[0]).toEqual(history)
  await expect(send({ type: 'capability.restore', id: capId })).rejects.toThrow('已移除')
  await store.close(); await store.init(); expect(store.snapshot().capabilities.some(c => c.id === capId)).toBe(false)
})

function install(managed: ManagedSkills, content: string) {
  const p = managed.inspect({ scope: 'global', files: [{ path: 'SKILL.md', data: Buffer.from('---\nname: review\ndescription: Test\n---\n' + content).toString('base64') }] })
  managed.commit(p.id, [{ key: p.candidates[0].key, mode: 'update' }], true)
  return managed.read().skills[0]
}

it('saving selected roles activates the skill immediately and imported updates apply only to new tasks', async () => {
  const { home, store } = await fixture(), managed = new ManagedSkills(home, () => []), assets = new RoleSkills(home), row = install(managed, 'first')
  const roleId = (await store.command(store.snapshot().revision, { type: 'role.save', definition: { ...emptyRole(), name: 'Skill test' }, publish: true, directSave: true })).id
  await store.command(store.snapshot().revision, { type: 'role.skills', skillId: row.id, roleIds: [roleId] })
  const role = store.snapshot().roles.find(r => r.id === roleId)!, version = latest(role.versions)!, at = Date.now()
  expect(version.skills?.[0].enabled).toBe(true)
  expect(assets.guidance(store.snapshot(), roleId, version, undefined, at)).toContain('first')
  await new Promise(resolve => setTimeout(resolve, 5)); install(managed, 'second')
  expect(assets.guidance(store.snapshot(), roleId, version, undefined, Date.now())).toContain('second')
  expect(assets.guidance(store.snapshot(), roleId, version, undefined, at)).toContain('first')
  await store.command(store.snapshot().revision, { type: 'role.skills', skillId: row.id, roleIds: [] })
  expect(latest(store.snapshot().roles.find(r => r.id === roleId)!.versions)!.skills?.[0].enabled).toBe(false)
})
