import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { initialState, type State } from '../src/core/model.ts'
import { allowedActions } from '../src/core/policy.ts'
import { CapabilityStore } from '../src/host/store.ts'
import { writePresets } from '../src/host/presets.ts'

const stores: CapabilityStore[] = []
afterEach(async () => { for (const store of stores.splice(0)) await store.close() })
async function open(directory: string) {
  const store = new CapabilityStore(directory); await store.init(); stores.push(store); return store
}
async function legacy(state: State) {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-role-migration-'))
  delete state.defaultRolesVersion
  await writeFile(join(directory, 'state.json'), JSON.stringify(state))
  return directory
}
describe('restoring the four existing role assistants', () => {
  it('creates usable published defaults with original copy and colors and without granting tools', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'dsh-role-defaults-')), store = await open(directory), state = store.snapshot()
    expect(state.roles.map(r => [r.draft.name, r.draft.color])).toEqual([
      ['需求分析助手', '#4F73E8'], ['市场部助手', '#E58A32'], ['项目经理助手', '#9A62D8'], ['开发助手', '#22A58B'],
    ])
    await writePresets(directory, state)
    for (const role of state.roles) {
      expect(role.versions).toHaveLength(1)
      expect(role.versions[0]!.capabilities).toEqual([])
      expect(allowedActions(state, role.id, role.versions[0]!)).toEqual([])
      const source = JSON.parse(await readFile(join(directory, '.agent-presets', role.versions[0]!.preset, 'agent.cordis.yml'), 'utf8'))
      for (const field of ['name', 'duties', 'requirements', 'format'] as const) expect(source[0].config.prefix).toContain(role.draft[field])
      expect(source[1].name).toBe('@linxin666/dsh-capabilities/policy')
    }
  })
  it('migrates an already saved empty roster and persists a backup and one-time marker', async () => {
    const before = initialState(); before.roles = []; before.revision = 8
    const directory = await legacy(before), store = await open(directory), migrated = store.snapshot()
    expect(migrated.roles).toHaveLength(4)
    expect(migrated.defaultRolesVersion).toBe(1)
    expect(migrated.revision).toBe(9)
    expect(migrated.capabilities).toEqual(before.capabilities)
    expect(JSON.parse(await readFile(join(directory, 'state-before-default-roles-v1.json'), 'utf8'))).toEqual(before)
    await store.close()
    const reopened = await open(directory)
    expect(reopened.snapshot()).toEqual(migrated)
  })
  it('preserves existing custom, same-name and disabled roles, drafts, versions and revocations', async () => {
    const before = initialState(), analyst = before.roles[0]!, marketing = before.roles[1]!
    analyst.enabled = false; analyst.draft.name = '我修改过的需求助手'; analyst.draft.requirements = '保留此草稿'
    marketing.id = 'local-existing'; marketing.draft.duties = '自定义市场职责'
    before.roles = [analyst, marketing]
    before.stoppedSessions = ['stopped-before-migration']; before.revokedAt = { 'role:builtin-analyst': 100 }
    const directory = await legacy(before), store = await open(directory), migrated = store.snapshot()
    expect(migrated.roles).toHaveLength(4)
    expect(migrated.roles.slice(0, 2)).toEqual(before.roles)
    expect(migrated.stoppedSessions).toEqual(before.stoppedSessions)
    expect(migrated.revokedAt).toEqual(before.revokedAt)
    await store.command(migrated.revision, { type: 'role.save', id: analyst.id, definition: { ...analyst.draft, name: '新的名称' }, publish: true })
    const changed = store.snapshot()
    await store.close()
    expect((await open(directory)).snapshot()).toEqual(changed)
  })
})

