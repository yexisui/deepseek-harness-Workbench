import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, realpathSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import processTools from 'node:child_process'
import { OfflineInstaller } from '../src/host/offline-installer.ts'
import { inspectOfflinePackage } from '../src/host/offline-package.ts'
import { ClassificationStore } from '../src/host/classification-store.ts'
import { entryKey, entryFacts, initialClassification, removeCategory, validateClassification } from '../src/core/classification.ts'
import seed from '../src/core/classification-seed.json'
import { LocalWorkshopService } from '../../dsh-market/src/core/local-import.ts'

const roots:string[]=[]
function fixture(fail?:()=>void){
 const root=mkdtempSync(path.join(os.tmpdir(),'dsh-offline-test-'));roots.push(root)
 const home=path.join(root,'data'),profileDir=path.join(home,'profiles','web');mkdirSync(profileDir,{recursive:true})
 const facts={profileName:'web',profileDir,packageJsonPath:path.join(profileDir,'package.json'),patchPath:path.join(profileDir,'cordis.patch.yml')}
 writeFileSync(facts.packageJsonPath,JSON.stringify({private:true,dependencies:{},dsh:{profile:{bundles:['official-base'],patchReload:true}},custom:'keep'}));writeFileSync(facts.patchPath,'# preserve\n[]\n')
 const installer=new OfflineInstaller(facts,()=>[],[],fail)
 const pkg=(version='1.0.0',extra:Record<string,unknown>={},code='export const name="example"')=>{
  const dir=path.join(root,'input-'+Math.random().toString(16).slice(2));mkdirSync(dir)
  writeFileSync(path.join(dir,'package.json'),JSON.stringify({name:'example-plugin',version,main:'index.js',type:'module',dsh:{bundle:{patch:'bundle.yml'}},...extra}))
  writeFileSync(path.join(dir,'index.js'),code);writeFileSync(path.join(dir,'bundle.yml'),'- insert:\n    - id: example-row\n      name: example-plugin\n');return dir
 }
 return {root,home,facts,installer,pkg}
}
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();for(const root of roots.splice(0))rmSync(root,{recursive:true,force:true})})
describe('persistent hierarchy',()=>{
 const rows=seed.rows.map(row=>({...row,enabled:true,fiberPhase:'active'}))
 it('accounts for all 178 established entries without duplicate identities',()=>{const c=initialClassification(rows);expect(Object.keys(c.assignments)).toHaveLength(178);expect(new Set(rows.map(entryKey)).size).toBe(178);expect(rows.filter(r=>c.assignments[entryKey(r)]?.startsWith('core-'))).toHaveLength(156)})
 it('keeps new plugins unclassified even if they use an official-looking name',()=>{const row={entryId:'new-entry',moduleName:'@deepseek-ai/dsh-new',enabled:true,fiberPhase:'active'};const c=initialClassification([row]);expect(c.assignments[entryKey(row)]).toBeUndefined();expect(entryFacts(row).source).toBe('待核实来源')})
 it('retains assignments across restart and rejects stale drafts',()=>{const f=fixture(),store=new ClassificationStore(f.home),c=store.read(rows);c.assignments[entryKey(rows[0]!)]=c.modules.at(-1)!.id;const saved=store.save(c,rows);expect(new ClassificationStore(f.home).read(rows)).toEqual(saved);expect(()=>store.save(c,rows)).toThrow('其他窗口')})
 it('moves removed groups to undefined without changing provenance',()=>{const c=initialClassification(rows),source=entryFacts(rows[0]!).source,next=removeCategory(c,'core',true);expect(next.assignments[entryKey(rows[0]!)]).toBe('');expect(entryFacts(rows[0]!).source).toBe(source);expect(()=>validateClassification(next)).not.toThrow()})
 it('rejects dangling module references and invalid schemas',()=>{const c=initialClassification(rows);c.modules[0]!.groupId='missing';expect(()=>validateClassification(c)).toThrow();expect(()=>validateClassification({})).toThrow()})
})
describe('offline installation',()=>{
 it('copies a complete package without any fetch, subprocess or installation script',()=>{
  const f=fixture(),spawn=vi.spyOn(processTools,'spawn'),fetch=vi.fn(()=>{throw Error('network forbidden')});vi.stubGlobal('fetch',fetch)
  const input=f.pkg('1.0.0',{scripts:{install:'node never-run.js'}});const preview=f.installer.inspect(input).preview
  expect(preview.scriptsSkipped).toContain('example-plugin: install');f.installer.install(input,'zip',preview.hash)
  rmSync(input,{recursive:true});const linked=path.join(f.facts.profileDir,'node_modules','example-plugin')
  expect(readFileSync(path.join(linked,'index.js'),'utf8')).toContain('example');expect(realpathSync(linked)).toContain('plugin-management');expect(fetch).not.toHaveBeenCalled();expect(spawn).not.toHaveBeenCalled()
  expect(JSON.parse(readFileSync(f.facts.packageJsonPath,'utf8')).custom).toBe('keep');expect(readFileSync(f.facts.patchPath,'utf8')).toBe('# preserve\n[]\n')
 })
 it('rejects a missing runtime dependency without touching profile',()=>{const f=fixture(),before=readFileSync(f.facts.packageJsonPath,'utf8');expect(()=>f.installer.install(f.pkg('1.0.0',{dependencies:{helper:'^1.0.0'}}),'folder')).toThrow('缺少依赖');expect(readFileSync(f.facts.packageJsonPath,'utf8')).toBe(before)})
 it('accepts a bundled dependency and validates transitive dependencies',()=>{const f=fixture(),input=f.pkg('1.0.0',{dependencies:{helper:'^1.0.0'}}),dep=path.join(input,'node_modules','helper');mkdirSync(dep,{recursive:true});writeFileSync(path.join(dep,'package.json'),JSON.stringify({name:'helper',version:'1.2.0',main:'index.js'}));writeFileSync(path.join(dep,'index.js'),'module.exports=1');expect(f.installer.inspect(input).preview.bundled).toEqual(['helper@1.2.0']);writeFileSync(path.join(dep,'package.json'),JSON.stringify({name:'helper',version:'1.2.0',main:'index.js',dependencies:{missing:'*'}}));expect(()=>f.installer.inspect(input)).toThrow('missing')})
 it('rejects repository source without compiled entry',()=>{const f=fixture();expect(()=>f.installer.inspect(f.pkg('1.0.0',{main:'src/main.ts'}))).toThrow()})
 it('rejects dynamic patch evaluation and mutation of other modules',()=>{const f=fixture(),p=f.pkg();writeFileSync(path.join(p,'bundle.yml'),'- id: terminal\n  disabled: true');expect(()=>f.installer.inspect(p)).toThrow('insert');writeFileSync(path.join(p,'bundle.yml'),'- insert: !!js process.exit(1)');expect(()=>f.installer.inspect(p)).toThrow('YAML')})
 it('rejects row collisions before installation',()=>{const f=fixture();expect(()=>inspectOfflinePackage(f.pkg(),[],new Map([['example-row','existing']]))).toThrow('冲突')})
 it('requires explicit replacement and retains previous version for rollback',()=>{
  const f=fixture(),p1=f.pkg(),p2=f.pkg('2.0.0');f.installer.install(p1,'zip');expect(()=>f.installer.install(p2,'zip')).toThrow('确认')
  const next=f.installer.inspect(p2).preview;f.installer.install(p2,'zip',next.hash,true,next.currentHash);expect(f.installer.item('example-plugin').previousVersion).toBe('1.0.0')
  f.installer.rollback('example-plugin');expect(f.installer.item('example-plugin').version).toBe('1.0.0')
 })
 it('distinguishes identical versions from changed files and avoids duplicate copies',()=>{const f=fixture(),p=f.pkg();f.installer.install(p,'zip');expect(f.installer.inspect(p).preview.disposition).toBe('identical');const p2=f.pkg('1.0.0',{},'export const changed=true');expect(f.installer.inspect(p2).preview.disposition).toBe('replace')})
 it('rejects a stale installation preview',()=>{const f=fixture(),p=f.pkg();const first=f.installer.inspect(p).preview;writeFileSync(path.join(p,'index.js'),'changed');expect(()=>f.installer.install(p,'zip',first.hash)).toThrow('变化')})
 it('atomically restores links, registry and profile on a write failure',()=>{const f=fixture(),p=f.pkg();f.installer.install(p,'zip');const before=readFileSync(f.facts.packageJsonPath,'utf8'),broken=new OfflineInstaller(f.facts,()=>[],[],()=>{throw Error('simulated disk failure')});expect(()=>broken.install(f.pkg('2.0.0'),'zip',undefined,true)).toThrow('simulated');expect(readFileSync(f.facts.packageJsonPath,'utf8')).toBe(before);expect(broken.item('example-plugin').version).toBe('1.0.0');expect(JSON.parse(readFileSync(path.join(f.facts.profileDir,'node_modules/example-plugin/package.json'),'utf8')).version).toBe('1.0.0')})
 it('does not rollback a modified backup',()=>{const f=fixture();f.installer.install(f.pkg(),'zip');const old=realpathSync(path.join(f.facts.profileDir,'node_modules/example-plugin'));f.installer.install(f.pkg('2.0.0'),'zip',undefined,true);writeFileSync(path.join(old,'index.js'),'tamper');expect(()=>f.installer.rollback('example-plugin')).toThrow('变化')})
 it('uninstalls locally while retaining classification and original files',()=>{const f=fixture(),p=f.pkg();f.installer.install(p,'folder');const c=new ClassificationStore(f.home);const original=c.read([]);f.installer.remove('example-plugin');expect(existsSync(p)).toBe(true);expect(JSON.parse(readFileSync(f.facts.packageJsonPath,'utf8')).dependencies).toEqual({});expect(c.read([])).toEqual(original)})
 it('rejects URL, npm, and arbitrary local path install requests',()=>{const f=fixture();for(const spec of ['@scope/plugin','https://github.com/x/y','file:'+f.pkg()])expect(()=>f.installer.installSpec(spec)).toThrow()})
 it('reports pending restart, then clears it in the next host process',()=>{const f=fixture();f.installer.install(f.pkg(),'zip');expect(f.installer.pending()).toHaveLength(1);expect(f.installer.item('example-plugin').requiresRestart).toBe(true);const next=new OfflineInstaller(f.facts,()=>[],[]);expect(next.pending()).toEqual([])})
 it('reuses Workshop verified local imports with the same offline installer',async()=>{const f=fixture(),service=new LocalWorkshopService({dshHome:f.home}),input=f.pkg(),id=service.start('plugin','folder');for(const name of ['package.json','index.js','bundle.yml'])await service.uploadFile(id,name,(async function*(){yield readFileSync(path.join(input,name))})());expect(service.inspect(id).id).toBe('example-plugin');const resource=await service.commit(id);expect(resource.managed).toBe(true)})
})
