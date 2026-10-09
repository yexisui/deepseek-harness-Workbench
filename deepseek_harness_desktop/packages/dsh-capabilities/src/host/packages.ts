import { exportWorkbench, exportName, readWorkbench, workbenchHash, type WorkbenchPackage } from './workbench-package.ts'
import { adaptExternal, type ImportModel } from './external-package.ts'
import { applyCapabilitySettings } from '../core/current-settings.ts'
import { loadPackageProvider } from './package-provider.ts'
import { randomUUID } from 'node:crypto'
import { mkdir, readdir, open, readFile, rename, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { catalogFor, definitionChanged, digestPattern, packageDefinition, packageTrust, type PackageHealth, type PackagePreview } from '../core/distribution.ts'
import { latest, type State, type Version } from '../core/model.ts'
import { InputError, integer, list, text } from '../core/validation.ts'
import { CapabilityStore } from './store.ts'
import { canonical, checkPackage, extractLocalZip, FilePaths, packageLimit, packageZip, plainMkdir, safeLocalPath, sha256, writePackage, type CheckedPackage } from './package-archive.ts'

export type ImportProgress = { status:'running'|'done'|'error'; message:string; preview?:PackagePreview }
type Upload = { workbench?:WorkbenchPackage; processing?:Promise<void>; controller?:AbortController; progress?:ImportProgress; root?:string; preparedAI?:boolean; directory: string; kind: 'folder' | 'zip'; paths: FilePaths; bytes: number; count: number; expires: number; busy: boolean; checked?: CheckedPackage }
export class CapabilityPackages {
  private uploads = new Map<string,Upload>()
  private downloads = new Map<string,{name:string;expires:number}>()
  private pendingDownloads = 0
  private verified = new Map<string,string | null>()
  private timer?: ReturnType<typeof setInterval>
  constructor(readonly store: CapabilityStore, private resolveModel: (route: string) => string = route => route, private importModel?:ImportModel) {}
  get root() { return join(this.store.directory, 'packages') }
  async init() {
    plainMkdir(this.root); plainMkdir(join(this.root, 'uploads')); plainMkdir(join(this.root, 'releases')); plainMkdir(join(this.root,'exports'))
    // Uploads carry no authority and are not resumed across host restarts.
    const { readdir } = await import('node:fs/promises')
    for (const name of await readdir(join(this.root,'uploads'))) if (/^[a-f0-9-]{36}$/.test(name)) await rm(join(this.root,'uploads',name), { recursive:true, force:true })
    for (const name of await readdir(join(this.root,'exports'))) if (/^[a-f0-9-]{36}\.zip$/.test(name)) await rm(join(this.root,'exports',name), {force:true})
    for (const hash of Object.keys(this.store.snapshot().packageReleases ?? {})) await this.verify(hash)
    this.store.enableIssues = id => { const health = this.health().find(h => h.capabilityId === id); return health && !health.ready ? [health.message] : [] }
    this.timer = setInterval(() => { void this.expire() }, 60_000); this.timer.unref()
  }
  async close() { clearInterval(this.timer); for(const u of this.uploads.values())u.controller?.abort();await Promise.all([...this.uploads.values()].map(u=>u.processing)); for (const token of [...this.uploads.keys()]) await this.discard(token); for(const id of [...this.downloads.keys()])await this.discardDownload(id) }
  private async expire() { for (const [token,u] of this.uploads) if (u.expires < Date.now() && !u.busy) await this.discard(token); for(const [id,d] of this.downloads)if(d.expires<Date.now())await this.discardDownload(id) }
  async prepareDownload(body:Record<string,unknown>) {
    await this.expire()
    if(this.downloads.size+this.pendingDownloads>=4)throw new InputError('请先关闭不用的导出窗口，最多同时保留 4 个待保存文件',409)
    this.pendingDownloads++
    const id=randomUUID(),target=join(this.root,'exports',id+'.zip')
    try {
      const result=body.token?await this.exportPrepared(text(body.token,'上传标识',40,true),body.hash):await this.exportInstalled(text(body.id,'能力标识',90,true),body.version)
      const file=await open(target,'wx',0o600)
      try{await file.writeFile(result.bytes);await file.sync()}finally{await file.close()}
      this.downloads.set(id,{name:result.name,expires:Date.now()+30*60_000})
      return {id,name:result.name,url:`/api/capabilities/packages/download/${id}`}
    } catch(error) { await rm(target,{force:true}); throw error }
    finally { this.pendingDownloads-- }
  }
  async download(id:string){const d=this.downloads.get(id);if(!d||d.expires<Date.now())throw new InputError('导出文件已过期，请重新导出',410);return{name:d.name,bytes:await readFile(join(this.root,'exports',id+'.zip'))}}
  async discardDownload(id:string){if(!this.downloads.has(id))return;this.downloads.delete(id);await rm(join(this.root,'exports',id+'.zip'),{force:true})}
  async start(kind: unknown) {
    if (kind !== 'folder' && kind !== 'zip') throw new InputError('请选择能力 ZIP 或开发交付目录')
    await this.expire()
    if (this.uploads.size >= 4) throw new InputError('最多同时准备 4 个能力包，请关闭不用的窗口', 409)
    const token = randomUUID(), directory = join(this.root,'uploads',token)
    plainMkdir(directory)
    this.uploads.set(token, { directory, kind, paths:new FilePaths(), bytes:0, count:0, expires:Date.now()+30*60_000, busy:false })
    return { token }
  }
  private upload(token: string) {
    const u = this.uploads.get(token)
    if (!u || u.expires < Date.now()) throw new InputError('预览已过期，请重新选择能力包', 410)
    if (u.busy) throw new InputError('能力包正在处理，请稍后重试', 409)
    return u
  }
  async put(token: string, path: string, source: AsyncIterable<Uint8Array>) {
    const u = this.upload(token)
    if (u.checked) throw new InputError('已完成预览，不能继续改写文件', 409)
    safeLocalPath(path)
    if (u.kind === 'zip' && (path !== 'ability.zip' || u.count > 0)) throw new InputError('不是能力包交付文件')
    if (u.count >= 501) throw new InputError('能力包文件数量超过限制', 413)
    u.paths.add(path); u.busy = true
    try {
      const target = join(u.directory,path); plainMkdir(join(target,'..')); const file = await open(target,'wx',0o600)
      try { for await (const chunk of source) { u.bytes += chunk.length; if (u.bytes > packageLimit) throw new InputError('能力包超过 64 MiB',413); await file.writeFile(chunk) }; await file.sync() } finally { await file.close() }
      u.count++; return { received: u.count }
    } catch (error) { u.busy = false; await this.discard(token); throw error }
    finally { u.busy = false }
  }
  async discard(token: string) { const u = this.uploads.get(token); if (!u || u.busy) return; this.uploads.delete(token); await rm(u.directory,{recursive:true,force:true}) }
  processStatus(token:string):ImportProgress { const u=this.uploads.get(token);if(!u)throw new InputError('导入文件已释放，请重新选择',410);return u.progress??{status:'error',message:'尚未开始处理'} }
  async cancelProcessing(token:string){const u=this.uploads.get(token);u?.controller?.abort(new Error('已停止处理，原包已保留'));await u?.processing;return this.processStatus(token)}
  async processImport(token:string,useAI:boolean,label:string):Promise<ImportProgress>{
    const u=this.upload(token)
    if(u.workbench){u.progress={status:'done',message:'已准备',preview:this.workbenchPreview(token,u.workbench)};return u.progress}
    if(u.checked&&u.preparedAI===useAI){u.progress={status:'done',message:'已准备',preview:this.preview(token,u.checked)};return u.progress}
    u.controller=new AbortController();u.busy=true;u.expires=Date.now()+30*60_000
    u.progress={status:'running',message:'正在整理本地包…'}
    u.processing=(async()=>{
      try{
        if(!u.root){let root=u.directory;if(u.kind==='zip'){root=join(u.directory,'unpacked');await rm(root,{recursive:true,force:true});plainMkdir(root);extractLocalZip(join(u.directory,'ability.zip'),root)}
          for(;;){const entries=await readdir(root,{withFileTypes:true});if(entries.length!==1||!entries[0]!.isDirectory())break;root=join(root,entries[0]!.name)}u.root=root}
        u.workbench=await readWorkbench(u.root,this.store.snapshot());if(u.workbench){u.progress={status:'done',message:'已准备',preview:this.workbenchPreview(token,u.workbench)};return}
        // Existing standard packages remain unchanged; external formats are handled by the adapter.
        try{u.checked=await checkPackage(u.root,true)}catch{u.checked=await adaptExternal(u.root,label,useAI,this.importModel,u.controller!.signal,message=>{u.progress={status:'running',message}})}
        u.controller!.signal.throwIfAborted();u.preparedAI=useAI;u.progress={status:'done',message:'整理完成',preview:this.preview(token,u.checked)}
      }catch(error){u.progress={status:'error',message:error instanceof Error?error.message:String(error)}}
      finally{u.busy=false;u.expires=Date.now()+30*60_000}
    })()
    return u.progress
  }
  async inspect(token: string): Promise<PackagePreview> {
    const u = this.upload(token); u.busy = true
    try {
      if (!u.checked) {
        let root = u.directory
        if (u.kind === 'zip') { root = join(u.directory,'unpacked'); plainMkdir(root); extractLocalZip(join(u.directory,'ability.zip'),root) }
        // Accept the single enclosing folder created by common ZIP tools.
        if (u.kind === 'zip') {
          for (;;) {
            const entries = await readdir(root, { withFileTypes: true })
            if (entries.some(e => e.name === 'capability.json')) break
            if (entries.length !== 1 || !entries[0]!.isDirectory()) break
            root = join(root, entries[0]!.name)
          }
        }
        u.checked = await checkPackage(root, u.kind === 'folder')
      }
      return this.preview(token, u.checked)
    } finally { u.busy = false }
  }
  private workbenchPreview(token:string,pack:WorkbenchPackage):PackagePreview {
    const state=this.store.snapshot(),existing=state.capabilities.find(c=>c.id===pack.id),v=latest(existing?.versions??[]),value=pack.definition
    return {token,hash:workbenchHash(pack),revision:state.revision,bytes:Buffer.byteLength(canonical(pack)),fileCount:1,needsModel:false,trust:'导入能力配置，复用工作台已有服务。',manifest:{schema:1,protocol:pack.protocol,id:pack.id,version:'1.0.0',...value,author:'工作台',license:'随工作台',permissions:[],components:[],files:{}},...(existing?{existing:{id:existing.id,name:existing.draft.name,duplicate:!!v&&!definitionChanged(value,v),removed:!!existing.removedAt,draftChanged:false,version:'',changes:[]}}:{})}
  }
  private async installWorkbench(pack:WorkbenchPackage,hash:unknown,revision:unknown){
    if(hash!==workbenchHash(pack))throw new InputError('导入内容已更新，请重试')
    return this.store.transaction(revision,next=>{
      const value=pack.definition;let cap=next.capabilities.find(c=>c.id===pack.id)
      if(cap?.packageOrigin)throw new InputError('同名标识属于另一能力，请勿覆盖')
      if(cap?.removedAt||cap?.purgedAt)throw new InputError('能力已移除，请先恢复或使用新标识')
      if(cap&&latest(cap.versions)&&!definitionChanged(value,latest(cap.versions)))return{id:cap.id,duplicate:true,needsModel:false}
      if(!cap){cap={id:pack.id,source:'local',enabled:true,pinned:false,draft:value,versions:[]};next.capabilities.push(cap)}
      const now=new Date().toISOString(),version=(latest(cap.versions)?.version??0)+1
      cap.draft=structuredClone(value);cap.versions.push({...structuredClone(value),version,createdAt:now,directSave:true});applyCapabilitySettings(next,cap.id,version,now)
      return{id:cap.id,duplicate:false,needsModel:false}
    })
  }
  private preview(token: string, pack: CheckedPackage): PackagePreview {
    const state = this.store.snapshot(), m = pack.manifest, existing = state.capabilities.find(c => c.packageOrigin?.id === m.id), previous = existing && latest(existing.versions), release = previous?.packageHash && state.packageReleases?.[previous.packageHash]
    const changes: string[] = []
    if (previous) {
      if (previous.name !== m.name) changes.push(`名称：${previous.name} → ${m.name}`)
      const before = new Set(previous.components.flatMap(c=>c.actions)), after = packageDefinition(m).components.flatMap(c=>c.actions)
      changes.push(`新增 ${after.filter(a=>!before.has(a)).length} 个动作，移除 ${[...before].filter(a=>!after.includes(a)).length} 个动作`)
      if (release && JSON.stringify(release.manifest.permissions) !== JSON.stringify(m.permissions)) changes.push('运行权限声明发生变化，请核对')
      if (previous.description !== m.description || previous.instructions !== m.instructions) changes.push('用途或使用说明已更新')
    }
    return { token, hash: pack.hash, manifest: m, bytes:pack.bytes, fileCount:pack.files.size, revision:state.revision, needsModel:m.permissions.includes('model') && !this.model(existing?.id ?? ''), trust:packageTrust,
      ...(existing ? { existing: { id:existing.id, name:existing.draft.name, duplicate:previous?.packageHash===pack.hash, removed:!!existing.removedAt, draftChanged:definitionChanged(existing.draft,previous), version:release ? release.manifest.version : '', changes } } : {}) }
  }
  model(capabilityId: string, state = this.store.snapshot()) { try { return this.resolveModel(state.packageModels?.[capabilityId] ?? '') } catch { return '' } }
  directory(hash: string) { if (!digestPattern.test(hash)) throw new InputError('能力内容摘要无效'); return join(this.root,'releases',hash) }
  async verify(hash: string): Promise<boolean> {
    try { const checked = await checkPackage(this.directory(hash)); if (checked.hash !== hash) throw new InputError('能力构建产物已改变'); this.verified.set(hash,null); return true }
    catch (error) { this.verified.set(hash,error instanceof Error ? error.message : String(error)); return false }
  }
  health(state = this.store.snapshot()): PackageHealth[] {
    return state.capabilities.filter(c=>c.packageOrigin).map(cap=>{
      const hash = latest(cap.versions)?.packageHash, release = hash && state.packageReleases?.[hash], installed = !!release && this.verified.has(hash!), loaded = installed && this.verified.get(hash!) === null
      const needsModel = !!release && release.manifest.permissions.includes('model') && !this.model(cap.id,state)
      const restricted = latest(cap.versions)?.components.some(p=>this.store.componentRestrictions()[p.componentId]?.enabled===false)
      return { capabilityId:cap.id,installed,loaded,ready:loaded&&!needsModel&&!restricted,needsModel,message:!loaded ? `构建产物未就绪：${hash ? this.verified.get(hash) ?? '尚未核对' : '缺少版本'}` : restricted ? '关联组件已全局停用，请在组件库启用后重试' : needsModel ? '请选择工作台已有模型后启用' : '执行适配器已就绪；连接与执行结果以实际任务为准' }
    })
  }
  async install(token: string, expectedHash: unknown, revision: unknown, options: { trusted?: unknown; draft?: unknown; applyToRoles?: unknown } = {}) {
    const u = this.upload(token);if(u.workbench)return this.installWorkbench(u.workbench,expectedHash,revision);const pack = u.checked
    if (!pack || expectedHash !== pack.hash) throw new InputError('请先完整预览能力包',409)
    if (options.trusted !== true) throw new InputError('请确认信任此能力的本机代码')
    const preview = this.preview(token,pack)
    if (preview.existing?.duplicate) return { id:preview.existing.id, duplicate:true, needsModel:preview.needsModel }
    if (preview.existing?.removed) throw new InputError('此能力在回收站中，请先恢复，再导入更新')
    // Imported content becomes the current configuration in one operation.
    const roles = list(options.applyToRoles ?? []).map(r=>text(r,'岗位标识',90,true))
    if (new Set(roles).size !== roles.length) throw new InputError('岗位范围重复')
    u.busy = true; let created = false
    try {
      const result = await this.store.transaction(revision, async next=>{
        const target = this.directory(pack.hash)
        try { await stat(target); const existing = await checkPackage(target); if (existing.hash !== pack.hash) throw new InputError('已有构建目录内容不一致，请先修复受管文件') }
        catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
          const staging = join(u.directory,'prepared'); await rm(staging,{recursive:true,force:true}); await writePackage(staging,pack); const recheck = await checkPackage(staging); if (recheck.hash !== pack.hash) throw new InputError('能力准备校验失败')
          await rename(staging,target); created = true
        }
        await loadPackageProvider(target,pack.manifest)
        this.verified.set(pack.hash,null)
        const now = new Date().toISOString(), value = packageDefinition(pack.manifest)
        let cap = next.capabilities.find(c=>c.packageOrigin?.id===pack.manifest.id)
        const keepEnabled = cap ? cap.enabled : true
        if (!cap) { cap = {id:`local-${randomUUID()}`,source:'local',enabled:false,pinned:false,draft:value,versions:[],packageOrigin:{id:pack.manifest.id,draftBackups:[]}}; next.capabilities.push(cap) }
        cap.draft = structuredClone(value)
        ;(next.packageReleases ??= {})[pack.hash] = { hash:pack.hash, manifest:pack.manifest, installedAt:now }
        const version = (latest(cap.versions)?.version ?? 0)+1
        cap.versions.push({...structuredClone(value),version,createdAt:now,packageHash:pack.hash,directSave:true})
        cap.enabled = keepEnabled && this.health(next).find(h=>h.capabilityId===cap!.id)!.ready
        applyCapabilitySettings(next, cap.id, version, now)
        return {id:cap.id,duplicate:false,needsModel:preview.needsModel}
      }, async()=>{
        // Roll back before releasing the writer queue; a concurrent installer cannot lose its assets.
        if(created&&!this.store.snapshot().packageReleases?.[pack.hash]){await rm(this.directory(pack.hash),{recursive:true,force:true});this.verified.delete(pack.hash)}
      })
      return result
    } catch(error) { u.preparedAI=undefined; throw error }
    finally { u.busy = false }
  }
  async configure(id: string, model: unknown, revision: unknown, enable: unknown) {
    const route = text(model,'工作台模型',240).trim()
    if (route && !/^[^/\s]+\/.+$/.test(route)) throw new InputError('模型标识须为“提供方/模型”')
    return this.store.transaction(revision,next=>{
      const cap = next.capabilities.find(c=>c.id===id)
      if (!cap?.packageOrigin || cap.removedAt) throw new InputError('能力不存在或已移除')
      ;(next.packageModels ??= {})[id]=route
      const health = this.health(next).find(h=>h.capabilityId===id)!
      if (enable === true && !health.ready) throw new InputError(health.message)
      if (enable === true) cap.enabled=true
      if (!health.ready) { cap.enabled=false; (next.revokedAt ??= {})[`capability:${id}`]=Date.now() }
      return health
    })
  }
  async exportPrepared(token: string, hash: unknown) {
    const u = this.upload(token)
    if (!u.checked || hash !== u.checked.hash) throw new InputError('请重新预览后导出',409)
    return { bytes:packageZip(u.checked.files), name:`${u.checked.manifest.id}-${u.checked.manifest.version}.zip` }
  }
  async exportInstalled(id: string, number: unknown) {
    const state = this.store.snapshot(), cap = state.capabilities.find(c=>c.id===id), version = number === undefined ? cap?.versions.at(-1) : cap?.versions.find(v=>v.version===integer(number))
    if (!cap || cap.removedAt || cap.purgedAt) throw new InputError('能力不存在或已移除')
    if(!version?.packageHash)return exportWorkbench(cap.id,version??cap.draft)
    const pack = await checkPackage(this.directory(version.packageHash))
    if (pack.hash !== version.packageHash) throw new InputError('已安装文件改变，不能导出')
    if (definitionChanged(version,packageDefinition(pack.manifest))) {
      const m = structuredClone(pack.manifest), original = {id:m.id,version:m.version,hash:pack.hash}
      m.id = `${m.id.slice(0,48)}.local-${sha256(canonical(version)).slice(0,12)}`; m.derivedFrom=original
      m.name=version.name; m.description=version.description; m.instructions=version.instructions; m.author=`${m.author}（本地派生修改）`.slice(0,120)
      m.components=m.components.flatMap(c=>{const part=version.components.find(p=>p.componentId===`pkg:${original.id}:${c.id}`); return part ? [{...c,actions:c.actions.filter(a=>part.actions.includes(`pack:${original.id}:${c.id}:${a.id}`))}] : []})
      pack.files.set('capability.json',Buffer.from(canonical(m)))
      return {bytes:packageZip(pack.files),name:exportName(m.name)}
    }
    return {bytes:packageZip(pack.files),name:exportName(pack.manifest.name)}
  }
}
