import { describe, it, expect } from 'vitest'
import { mkdtemp, rm, writeFile, readFile, mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import { CapabilityStore } from '../src/host/store.ts'
import { FileSearchService } from '../src/host/file-search.ts'
import { EverythingEngine } from '../src/host/everything.ts'
import { filenameTerms } from '../src/core/file-search.ts'

describe('local file search', () => {
 it('migrates once, persists results, protects source files, and enforces component/capability authorization', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-search-')), store = new CapabilityStore(join(root, 'capabilities'))
  try {
   await store.init(); const previous = store.snapshot(), role = previous.roles.find(r => r.id === 'builtin-file-search')!
   expect(role.versions[0]!.capabilities[0]!.capabilityId).toBe('local-file-search')
   await writeFile(join(root, 'source.txt'), 'keep me')
   const engine = { status: async () => ({ state: 'ready' as const, message: 'ready' }), close: async () => {}, query: async () => ({ items: [{ name: 'source.txt', path: join(root, 'source.txt'), size: 7, directory: false, modifiedAt: '' }], hasMore: false }) }
   const service = new FileSearchService(join(root, 'searches'), () => store.snapshot(), engine); await service.init()
   expect((await service.config()).roleId).toBe(role.id)
   const row = await service.search({ query: 'source', path: '' }); expect(row.roleId).toBe(role.id)
   const restarted = new FileSearchService(join(root, 'searches'), () => store.snapshot(), engine); await restarted.init(); expect(restarted.list()).toHaveLength(1)
   await restarted.command({ id: row.id, action: 'delete' }); expect(await readFile(join(root, 'source.txt'), 'utf8')).toBe('keep me')
   const definition=store.snapshot().capabilities.find(c=>c.id==='local-file-search')!.draft
   await store.command(store.snapshot().revision,{type:'capability.save',id:'local-file-search',definition:{...definition,components:[]},publish:true,directSave:true})
   expect(store.snapshot().capabilities.find(c=>c.id==='local-file-search')!.draft.components).toHaveLength(0)
   await expect(service.search({query:'source'})).rejects.toThrow('归属岗位')
   await store.command(store.snapshot().revision,{type:'capability.save',id:'local-file-search',definition,publish:true,directSave:true})
   const next=await service.search({query:'source'});expect(next.roleVersion).toBeGreaterThan(row.roleVersion);expect(row.roleVersion).toBe(1)
   await store.command(store.snapshot().revision, { type: 'capability.toggle', id: 'local-file-search', enabled: false })
   await expect(service.search({ query: 'source' })).rejects.toThrow('归属岗位')
   await store.command(store.snapshot().revision, { type: 'capability.toggle', id: 'local-file-search', enabled: true })
   store.componentRestrictions = () => ({ 'everything-search': { enabled: false } })
   await expect(service.search({ query: 'source' })).rejects.toThrow('归属岗位')
   const revision = store.snapshot().revision; await store.close(); await store.init(); expect(store.snapshot().revision).toBe(revision)
   expect(store.snapshot().roles.filter(r => r.id === role.id)).toHaveLength(1)
  } finally { await store.close(); await rm(root, { recursive: true, force: true }) }
 })
 it('cancels without storing a successful result', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-search-cancel-')), store = new CapabilityStore(join(root, 'caps'))
  try {
   await store.init()
   const service = new FileSearchService(join(root, 'searches'), () => store.snapshot(), {status: async () => ({state:'ready',message:''}), close:async()=>{}, query: (_q,_p,signal) => new Promise((_,reject)=>signal?.addEventListener('abort',()=>reject(Error('cancelled'))))})
   await service.init(); const id = randomUUID(), pending = service.search({id,query:'file'}); service.cancel(id)
   await expect(pending).rejects.toThrow('cancelled'); expect(service.list()).toHaveLength(0)
  } finally { await store.close(); await rm(root,{recursive:true,force:true}) }
 })
 it('treats operators as filename characters and retains wildcard matching', () => {
  expect(filenameTerms('会议 *.pdf -exit a|b')).toEqual(['nopath:regex:会议','nopath:regex:^.*\\x{2e}pdf$','nopath:regex:-exit','nopath:regex:a\\x{7c}b'])
 })
 it.skipIf(!process.env.DSH_SEARCH_TEST_TOOLS)('queries the real Everything index: Chinese, spaces, wildcards, scope and safe switches', async () => {
  const tools = resolve(process.env.DSH_SEARCH_TEST_TOOLS!), root = await mkdtemp(join(tmpdir(),'dsh-search-real-')), fixture = join(root,'中文 目录'), instance = 'DSHTest-'+randomUUID().slice(0,8)
  await mkdir(fixture); await mkdir(join(root,'outside'))
  await writeFile(join(fixture,'2026会议 纪要.pdf'),'test'); await writeFile(join(fixture,'会议记录.txt'),'test'); await writeFile(join(root,'outside','会议外部.pdf'),'test'); await writeFile(join(fixture,'-exit.txt'),'test')
  const pointer=JSON.parse((await readFile(join(tools,'everything/current.json'),'utf8')).replace(/^\uFEFF/,''))
  const ini=join(root,'Everything.ini')
  await writeFile(ini,'\uFEFF[Everything]\r\nrun_as_admin=0\r\nshow_tray_icon=0\r\nrun_in_background=1\r\nntfs_auto_include=0\r\nfolders="'+root.replaceAll('\\','\\\\')+'"\r\nfolder_update_types=1\r\n')
  const child=spawn(join(tools,'everything',pointer.everything),['-instance',instance,'-config',ini,'-db',join(root,'Everything.db'),'-startup'],{windowsHide:true,stdio:'ignore'})
  const engine = new EverythingEngine(tools,join(root,'output'),instance)
  try {
   await new Promise(ok=>setTimeout(ok,1600))
   const result=await engine.query('会议 *.pdf',fixture)
   expect(result.items.map(r=>r.name)).toEqual(['2026会议 纪要.pdf'])
   expect((await engine.query('会议','')).items).toHaveLength(3)
   expect((await engine.query('-exit',fixture)).items[0]?.name).toBe('-exit.txt')
   expect((await engine.query('no-match',fixture)).items).toHaveLength(0)
   expect((await engine.status()).state).toBe('ready')
  } finally {child.kill();await new Promise(ok=>setTimeout(ok,150));await rm(root,{recursive:true,force:true})}
 },15000)
 it.skipIf(!process.env.DSH_SEARCH_TEST_TOOLS || !process.env.DSH_SEARCH_SYSTEM_TEST)('starts a private client against the installed system indexing service',async()=>{
  const root=await mkdtemp(join(tmpdir(),'dsh-search-system-')),keyword='DSHSearch'+randomUUID().replaceAll('-','')
  const engine=new EverythingEngine(resolve(process.env.DSH_SEARCH_TEST_TOOLS!),join(root,'engine'))
  try{
   await writeFile(join(root,keyword+'.txt'),'synthetic search fixture')
   const result=await engine.query(keyword,root)
   expect(result.items.map(item=>item.name)).toEqual([keyword+'.txt'])
  }finally{await engine.close();await rm(root,{recursive:true,force:true})}
 },30000)
})
