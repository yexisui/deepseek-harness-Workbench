import { afterEach, expect, it, vi } from 'vitest'
import { mkdtemp, mkdir, readFile, writeFile, readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { CapabilityStore } from '../src/host/store.ts'
import { preparePresets, writePresets } from '../src/host/presets.ts'
const stores: CapabilityStore[] = []
const homes: string[] = []
afterEach(async () => { vi.restoreAllMocks(); for (const store of stores.splice(0)) await store.close(); for (const home of homes.splice(0)) await rm(home, {recursive:true,force:true}) })
async function setup() {
 const home = await mkdtemp(join(tmpdir(), 'audit-r03-')), store = new CapabilityStore(join(home,'capabilities'))
 homes.push(home); await store.init(); stores.push(store); store.prepareCommit = (next, previous) => preparePresets(home,next,previous)
 await writePresets(home, store.snapshot()); return {home,store}
}
it('isolates historical conflicts from unrelated saves, preserves edits, and repairs with a byte-for-byte backup', async () => {
 const {home,store} = await setup(), preset=store.snapshot().roles[0]!.versions[0]!.preset
 const file = join(home,'.agent-presets',preset,'preset.yml'), original=await readFile(file,'utf8')
 await writeFile(file, original+'\n'); expect(await writePresets(home,store.snapshot())).toEqual([])
 await writeFile(file, 'external edit')
 expect(await writePresets(home,store.snapshot())).toHaveLength(1)
 await expect(store.command(store.snapshot().revision,{type:'capability.pin',id:'browser',pinned:false})).resolves.toBeDefined()
 expect(await readFile(file,'utf8')).toBe('external edit')
 expect(await writePresets(home,store.snapshot(),true)).toEqual([])
 const backups=await readdir(join(home,'capabilities/preset-backups'))
 expect(await readFile(join(home,'capabilities/preset-backups',backups[0]!,preset,'preset.yml'),'utf8')).toBe('external edit')
 expect(await readFile(file,'utf8')).toBe(original)
})
it('rejects a conflicting new preset before changing durable state or revision', async () => {
 const {home,store}=await setup(), before=store.snapshot(), role=before.roles[0]!
 const beforeBytes = await readFile(join(home,'capabilities/state.json'))
 const directory=join(home,'.agent-presets',`workbench-role-${role.id}-v${role.versions.at(-1)!.version+1}`)
 await mkdir(directory,{recursive:true}); await writeFile(join(directory,'agent.cordis.yml'),'external')
 await expect(store.command(before.revision,{type:'role.save',id:role.id,definition:role.draft,publish:true})).rejects.toThrow('尚未保存')
 expect(store.snapshot()).toEqual(before)
 expect(await readFile(join(home,'capabilities/state.json'))).toEqual(beforeBytes)
 expect(await readdir(directory)).toEqual(['agent.cordis.yml'])
})
it('rolls back newly generated files when state persistence fails', async () => {
 const {home,store}=await setup(), before=store.snapshot(), role=before.roles[0]!
 vi.spyOn(store as any,'persist').mockRejectedValueOnce(new Error('disk full'))
 await expect(store.command(before.revision,{type:'role.save',id:role.id,definition:role.draft,publish:true})).rejects.toThrow('disk full')
 expect(store.snapshot()).toEqual(before)
 expect(await readdir(join(home,'.agent-presets',`workbench-role-${role.id}-v${role.versions.at(-1)!.version+1}`))).toEqual([])
})
it('commits both immutable presets and state for a successful publication', async () => {
 const {home,store}=await setup(), before=store.snapshot(), role=before.roles[0]!
 const result=await store.command(before.revision,{type:'role.save',id:role.id,definition:{...role.draft,name:'新发布名称'},publish:true})
 const published=result.state.roles[0]!.versions.at(-1)!
 expect(JSON.parse(await readFile(join(home,'.agent-presets',published.preset,'preset.yml'),'utf8')).name).toBe(`新发布名称 · v${published.version}`)
 expect(result.state.revision).toBe(before.revision+1)
})
it('backs up non-UTF8 external bytes exactly and preserves healthy history during repair', async () => {
 const {home,store}=await setup(), role=store.snapshot().roles[0]!,preset=role.versions[0]!.preset
 const file=join(home,'.agent-presets',preset,'preset.yml'), policy=join(home,'.agent-presets',preset,'agent.cordis.yml'), policyBefore=await readFile(policy)
 const bytes=Buffer.from([0xff,0xfe,0x80,0,13,10]); await writeFile(file,bytes)
 expect(await writePresets(home,store.snapshot())).toHaveLength(1)
 expect(await readFile(file)).toEqual(bytes)
 expect(await writePresets(home,store.snapshot(),true)).toEqual([])
 const backups=await readdir(join(home,'capabilities/preset-backups'))
 expect(await readFile(join(home,'capabilities/preset-backups',backups[0]!,preset,'preset.yml'))).toEqual(bytes)
 expect(await readFile(policy)).toEqual(policyBefore)
})
it('accepts harmless JSON formatting and property order changes without replacing user bytes', async () => {
 const {home,store}=await setup(), preset=store.snapshot().roles[0]!.versions[0]!.preset,file=join(home,'.agent-presets',preset,'preset.yml')
 const original=JSON.parse(await readFile(file,'utf8')),formatted=JSON.stringify({order:original.order,description:original.description,name:original.name},null,4)+'\n'
 await writeFile(file,formatted); expect(await writePresets(home,store.snapshot())).toEqual([]); expect(await readFile(file,'utf8')).toBe(formatted)
})
it('returns successful committed state even if a notification subscriber fails', async () => {
 const {home,store}=await setup(), before=store.snapshot(), notified=vi.fn()
 store.subscribe(()=>{throw Error('subscriber failure')});store.subscribe(notified)
 const result=await store.command(before.revision,{type:'role.toggle',id:before.roles[0]!.id,enabled:false})
 expect(result.state.revision).toBe(before.revision+1);expect(notified).toHaveBeenCalledOnce()
 expect(JSON.parse(await readFile(join(home,'capabilities/state.json'),'utf8')).roles[0].enabled).toBe(false)
})
