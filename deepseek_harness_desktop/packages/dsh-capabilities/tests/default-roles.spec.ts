import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { initialState, type State } from '../src/core/model.ts'
import { MEETING_CAPABILITY_ID, MEETING_ROLE_ID } from '../src/core/default-roles.ts'
import { REQUIREMENTS_CAPABILITY_ID, REQUIREMENTS_ROLE_ID } from '../src/core/requirements-model.ts'
import { DEVELOPER_CAPABILITY_ID, DEVELOPER_ROLE_ID } from '../src/core/developer-model.ts'
import { allowedActions, browserActions } from '../src/core/policy.ts'
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
describe('restoring managed role assistants', () => {
  it('migrates the developer binding once without publishing unfinished draft fields or replacing past versions', async () => {
    const before = initialState(), role = before.roles.find(r => r.id === DEVELOPER_ROLE_ID)!
    delete before.developerCapabilityVersion
    before.capabilities = before.capabilities.filter(c => c.id !== DEVELOPER_CAPABILITY_ID)
    role.draft.capabilities = []; role.versions[0]!.capabilities = []
    role.draft.name = '尚未发布的自定义名称'; role.draft.requirements = '保留未完成内容'
    const oldVersion = structuredClone(role.versions[0])
    const directory = await mkdtemp(join(tmpdir(), 'dsh-developer-migration-'))
    await writeFile(join(directory, 'state.json'), JSON.stringify(before))
    const store = await open(directory), migrated = store.snapshot(), updated = migrated.roles.find(r => r.id === DEVELOPER_ROLE_ID)!
    expect(updated.draft.name).toBe(role.draft.name); expect(updated.draft.requirements).toBe(role.draft.requirements)
    expect(updated.versions[0]).toEqual(oldVersion)
    expect(updated.versions[1]!.name).toBe(oldVersion!.name)
    expect(updated.versions[1]!.capabilities).toEqual([{ capabilityId: DEVELOPER_CAPABILITY_ID, version: 1, enabled: true }])
    expect(migrated.roles.filter(r => r.id !== DEVELOPER_ROLE_ID)).toEqual(before.roles.filter(r => r.id !== DEVELOPER_ROLE_ID))
    expect(JSON.parse(await readFile(join(directory, 'state-before-developer-capability-v1.json'), 'utf8'))).toEqual(before)
    await store.close(); expect((await open(directory)).snapshot()).toEqual(migrated)
  })
  it('creates usable published defaults with original copy and colors and without granting tools', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'dsh-role-defaults-')), store = await open(directory), state = store.snapshot()
    expect(state.roles.map(r => [r.draft.name, r.draft.color])).toEqual([
      ['需求分析助手', '#4F73E8'], ['市场部助手', '#E58A32'], ['项目经理助手', '#9A62D8'], ['开发助手', '#22A58B'], ['会议纪要助手', '#6683bd'],
    ])
    await writePresets(directory, state)
    for (const role of state.roles) {
      expect(role.versions).toHaveLength(1)
      expect(role.versions[0]!.capabilities).toEqual(role.id === MEETING_ROLE_ID ? [{ capabilityId: MEETING_CAPABILITY_ID, version: 1, enabled: true }] : role.id === DEVELOPER_ROLE_ID ? [{ capabilityId: DEVELOPER_CAPABILITY_ID, version: 1, enabled: true }] : role.id === REQUIREMENTS_ROLE_ID ? [{ capabilityId: REQUIREMENTS_CAPABILITY_ID, version: 1, enabled: true }] : [])
      expect(browserActions(allowedActions(state, role.id, role.versions[0]!))).toEqual([])
      const source = JSON.parse(await readFile(join(directory, '.agent-presets', role.versions[0]!.preset, 'agent.cordis.yml'), 'utf8'))
      for (const field of ['name', 'duties', 'requirements', 'format'] as const) expect(source[0].config.prefix).toContain(role.draft[field])
      expect(source[1].name).toBe('@linxin666/dsh-capabilities/policy')
    }
  })
  it('migrates an already saved empty roster and persists a backup and one-time marker', async () => {
    const before = initialState(); before.roles = []; before.revision = 8
    const directory = await legacy(before), store = await open(directory), migrated = store.snapshot()
    expect(migrated.roles).toHaveLength(5)
    expect(migrated.defaultRolesVersion).toBe(2)
    expect(migrated.revision).toBe(9)
    expect(migrated.capabilities).toEqual(before.capabilities)
    expect(JSON.parse(await readFile(join(directory, 'state-before-default-roles-v2.json'), 'utf8'))).toEqual(before)
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
    expect(migrated.roles).toHaveLength(5)
    expect(migrated.roles.slice(0, 2)).toEqual(before.roles)
    expect(migrated.stoppedSessions).toEqual(before.stoppedSessions)
    expect(migrated.revokedAt).toEqual(before.revokedAt)
    await store.command(migrated.revision, { type: 'role.save', id: analyst.id, definition: { ...analyst.draft, name: '新的名称' }, publish: true })
    const changed = store.snapshot()
    await store.close()
    expect((await open(directory)).snapshot()).toEqual(changed)
  })
  it('adds only the meeting assistant to an existing v1 roster and keeps saved versions intact', async () => {
    const before = initialState()
    before.defaultRolesVersion = 1
    before.roles = before.roles.filter(role => role.id !== MEETING_ROLE_ID)
    before.roles[0]!.draft.name = '我修改过的岗位'
    before.roles[0]!.enabled = false
    const directory = await mkdtemp(join(tmpdir(), 'dsh-role-meeting-v2-'))
    await writeFile(join(directory, 'state.json'), JSON.stringify(before))
    const store = await open(directory), migrated = store.snapshot()
    expect(migrated.roles.slice(0, 4)).toEqual(before.roles)
    expect(migrated.roles.at(-1)?.id).toBe(MEETING_ROLE_ID)
    expect(migrated.roles.at(-1)?.versions[0]?.version).toBe(1)
    expect(migrated.defaultRolesVersion).toBe(2)
    expect(JSON.parse(await readFile(join(directory, 'state-before-default-roles-v2.json'), 'utf8'))).toEqual(before)
  })
})

