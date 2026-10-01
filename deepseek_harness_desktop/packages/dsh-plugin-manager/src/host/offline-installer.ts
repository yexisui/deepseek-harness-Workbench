import { createHash, randomUUID } from 'node:crypto'
import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, renameSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { inspectOfflinePackage, json, type CheckedPackage, type OfflinePreview } from './offline-package.ts'
import { validateLocalId } from '../../../dsh-market/src/core/local-import-manifest.ts'
import { assertPlainPath, isImportedRecord, listPlainFiles } from '../../../dsh-market/src/core/local-import-safety.ts'
import { readLocalImportRecord } from '../../../dsh-market/src/core/local-import.ts'
import type { ProfileFacts } from './profile.ts'
import type { InventoryEntry } from '../core/classification.ts'
import type { GatewayJob } from './gateway.ts'
import type { InstalledPluginItem } from '../core/protocol.ts'
import { componentRollbackIssue } from '../core/component-compatibility.ts'

interface Version {path:string;version:string;hash:string;format:'zip'|'folder';entries:OfflinePreview['entries'];files:Record<string,string>}
interface Managed {current:Version;previous?:Version;installedAt:string}
interface Registry {version:1;plugins:Record<string,Managed>}
interface Journal {id:string;link:string;backup:string;hadLink:boolean;manifest:string;registry:string}
const hash=(text:string|Buffer)=>createHash('sha256').update(text).digest('hex')
const atomic=(file:string,text:string)=>{mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.'+randomUUID()+'.tmp';writeFileSync(tmp,text);renameSync(tmp,file)}
const encode=(value:unknown)=>JSON.stringify(value,null,2)+'\n'
const lexists=(file:string)=>{try{lstatSync(file);return true}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return false;throw e}}

/** Local copies and profile links only. No process spawning, package manager or network. */
export class OfflineInstaller {
 readonly home:string;readonly base:string;readonly registryFile:string;private readonly journalFile:string
 private jobs=new Map<string,GatewayJob>();private bootTargets=new Map<string,string>()
 constructor(readonly facts:ProfileFacts,private readonly inventory:()=>InventoryEntry[]=()=>[],private readonly sharedRoots:string[]=[path.join(facts.profileDir,'node_modules'),path.join(path.dirname(path.dirname(path.dirname(facts.profileDir))),'runtime','node_modules')],private readonly beforeManifest?:()=>void){
  this.home=path.dirname(path.dirname(facts.profileDir));this.base=path.join(this.home,'plugin-management')
  this.registryFile=path.join(this.base,'profiles',facts.profileName+'.json');this.journalFile=this.registryFile+'.transaction'
  this.recover()
  for(const [name,item]of Object.entries(this.registry().plugins))this.bootTargets.set(name,item.current.hash)
 }
 private registry():Registry{return existsSync(this.registryFile)?json(this.registryFile):{version:1,plugins:{}}}
 private inside(target:string,base=this.base):string{const full=path.resolve(target),rel=path.relative(path.resolve(base),full);if(!rel||rel.startsWith('..')||path.isAbsolute(rel))throw Error('无效的受管插件路径');return full}
 private link(name:string):string{validateLocalId('plugin',name);const result=path.join(this.facts.profileDir,'node_modules',name);assertPlainPath(path.dirname(result));return result}
 private recover():void{
  if(!existsSync(this.journalFile))return
  const j=json(this.journalFile) as Journal
  validateLocalId('plugin',j.id);if(j.link!==this.link(j.id))throw Error('插件事务记录路径无效')
  this.inside(j.backup)
  if(lexists(j.backup)){
   if(lexists(j.link)){if(!lstatSync(j.link).isSymbolicLink())throw Error('插件事务恢复遇到非链接路径，请检查备份。');unlinkSync(j.link)}
   mkdirSync(path.dirname(j.link),{recursive:true});renameSync(j.backup,j.link)
  }else if(!j.hadLink&&lexists(j.link)){if(!lstatSync(j.link).isSymbolicLink())throw Error('插件事务恢复遇到非链接路径');unlinkSync(j.link)}
  atomic(this.facts.packageJsonPath,j.manifest);atomic(this.registryFile,j.registry);unlinkSync(this.journalFile)
 }
 private current(name:string):{version:string;hash?:string}|undefined {
  const manifest=json(this.facts.packageJsonPath)
  if(!manifest.dependencies?.[name])return undefined
  const managed=this.registry().plugins[name]
  if(managed)return managed.current
  try{return {version:json(path.join(this.link(name),'package.json')).version??'unknown'}}catch{return {version:'unknown'}}
 }
 inspect(root:string):CheckedPackage {
  const name=json(path.join(root,'package.json')).name;validateLocalId('plugin',name)
  const registry=this.registry(),ownIds=new Set(registry.plugins[name]?.current.entries.map(e=>e.id)??[]),occupied=new Map<string,string>()
  for(const e of this.inventory()){const id=e.entryId.replace(/^include:/,'');if(!ownIds.has(id))occupied.set(id,e.moduleName)}
  for(const [owner,item]of Object.entries(registry.plugins))if(owner!==name)for(const e of item.current.entries)occupied.set(e.id,owner)
  const current=this.current(name)
  if(current&&!registry.plugins[name])throw Error('这是已有的非受管插件。为保留现有项目配置，请先迁移或卸载后再导入同名包。')
  return inspectOfflinePackage(root,this.sharedRoots,occupied,current)
 }
 private verifyVersion(v:Version):void{
  this.inside(v.path,path.join(this.base,'packages'));assertPlainPath(v.path)
  for(const [rel,digest]of Object.entries(v.files)){
   const file=this.inside(path.join(v.path,rel),v.path);assertPlainPath(file)
   if(hash(readFileSync(file))!==digest)throw Error('备份插件文件已变化，无法安全回退，请重新导入。')
  }
 }
 private transaction(name:string,next:Version|undefined,registry:Registry):void{
  const link=this.link(name),before=readFileSync(this.facts.packageJsonPath,'utf8'),manifest=JSON.parse(before.replace(/^\uFEFF/,'')),prior=encode(this.registry())
  const backup=path.join(this.base,'backups',randomUUID(),'package');mkdirSync(path.dirname(backup),{recursive:true})
  const journal:Journal={id:name,link,backup,hadLink:lexists(link),manifest:before,registry:prior}
  atomic(this.journalFile,encode(journal))
  try{
   if(journal.hadLink)renameSync(link,backup)
   if(next){mkdirSync(path.dirname(link),{recursive:true});symlinkSync(next.path,link,process.platform==='win32'?'junction':'dir')}
   manifest.dependencies??={};manifest.dsh??={};manifest.dsh.profile??={};const bundles:string[]=manifest.dsh.profile.bundles??=[]
   if(next){manifest.dependencies[name]='link:'+path.relative(this.facts.profileDir,next.path).replaceAll('\\','/');if(!bundles.includes(name))bundles.push(name)}
   else{delete manifest.dependencies[name];manifest.dsh.profile.bundles=bundles.filter(n=>n!==name)}
   this.beforeManifest?.();atomic(this.facts.packageJsonPath,encode(manifest));atomic(this.registryFile,encode(registry));unlinkSync(this.journalFile)
  }catch(error){this.recover();throw error}
 }
 install(root:string,format:'zip'|'folder',expectedHash?:string,replace=false,expectedCurrent?:string):InstalledPluginItem {
  const checked=this.inspect(root),p=checked.preview
  if(expectedHash&&expectedHash!==p.hash)throw Error('待安装的文件已变化，请重新检查。')
  if(expectedCurrent!==undefined&&expectedCurrent!==(p.currentHash??''))throw Error('插件已在另一个窗口变更，请重新检查。')
  if(p.disposition==='identical')return this.item(p.id)
  if(p.disposition!=='new'&&!replace)throw Error('同名插件已安装，请先确认版本替换。')
  const registry=this.registry(),parent=path.join(this.base,'packages',hash(p.id).slice(0,20)),destination=path.join(parent,p.hash.slice(0,20)+'-'+randomUUID().slice(0,8))
  assertPlainPath(destination);mkdirSync(destination,{recursive:true})
  // Copy the validated file list, avoiding platform-dependent recursive copy behaviour.
  for(const file of listPlainFiles(root)){
   const target=path.join(destination,file.rel);mkdirSync(path.dirname(target),{recursive:true});copyFileSync(path.join(root,file.rel),target)
  }
  // Recheck the copied bytes before adding only installer-owned SDK links.
  const copied=inspectOfflinePackage(destination,this.sharedRoots,new Map(),p.currentVersion?{version:p.currentVersion,hash:p.currentHash}:undefined)
  if(copied.preview.hash!==p.hash)throw Error('复制期间插件文件发生变化，请重新导入。')
  const files:Record<string,string>={};for(const f of listPlainFiles(destination))if(!isImportedRecord(f.rel))files[f.rel]=hash(readFileSync(path.join(destination,f.rel)))
  for(const [name,source]of checked.links){const target=path.join(destination,'node_modules',name);mkdirSync(path.dirname(target),{recursive:true});symlinkSync(source,target,process.platform==='win32'?'junction':'dir')}
  const version:Version={path:destination,version:p.version,hash:p.hash,format,entries:p.entries,files}
  registry.plugins[p.id]={current:version,previous:registry.plugins[p.id]?.current,installedAt:new Date().toISOString()}
  this.transaction(p.id,version,registry)
  return this.item(p.id)
 }
 installSpec(spec:string):InstalledPluginItem{
  if(!spec.startsWith('file:'))throw Error('已停用联网安装，请导入本地 ZIP 或文件夹。')
  const root=path.resolve(spec.slice(5)),bases=[path.join(this.home,'workshop','plugins'),path.join(this.home,'workshop','install-snapshots')]
  if(!bases.some(base=>{const rel=path.relative(base,root);return !!rel&&!rel.startsWith('..')&&!path.isAbsolute(rel)}))throw Error('只接受已导入创意工坊的受管本地文件。')
  const record=readLocalImportRecord(root,{verify:true});if(record?.kind!=='plugin')throw Error('本地插件来源记录缺失或文件已变化，请重新导入。')
  return this.install(root,'folder')
 }
 rollback(name:string):InstalledPluginItem {
  validateLocalId('plugin',name);const registry=this.registry(),item=registry.plugins[name]
  if(!item?.previous)throw Error('此插件没有可回退的受管版本。')
  this.verifyVersion(item.previous)
  const componentRegistry=path.join(this.home,'capabilities','component-registry.json')
  if(name==='@linxin666/dsh-capabilities'&&existsSync(componentRegistry)){
   const issue=componentRollbackIssue(name,json(path.join(item.previous.path,'package.json')),json(componentRegistry))
   if(issue)throw Error(issue)
  }
  const old=item.current;item.current=item.previous;item.previous=old;this.transaction(name,item.current,registry);return this.item(name)
 }
 remove(name:string):InstalledPluginItem {
  validateLocalId('plugin',name)
  if(name.startsWith('@deepseek-ai/')||['@linxin666/dsh-web-all','@linxin666/dsh-client-ui-plugin-manager'].includes(name))throw Error('底层工作台组件不能在此卸载。')
  if(!this.current(name))throw Error('插件尚未安装')
  const item=this.registry().plugins[name],row:InstalledPluginItem=item?this.item(name):{id:name,name,version:this.current(name)!.version,source:{kind:'local-link',spec:json(this.facts.packageJsonPath).dependencies[name]},installedAt:'',enabled:false}
  const registry=this.registry();delete registry.plugins[name];this.transaction(name,undefined,registry);return row
 }
 item(name:string):InstalledPluginItem {
  const item=this.registry().plugins[name];if(!item)throw Error('未找到受管插件')
  return {id:name,name,version:item.current.version,source:{kind:item.current.format==='zip'?'local-zip':'local-folder',spec:'受管本地副本'},enabled:true,installedAt:item.installedAt,managed:true,previousVersion:item.previous?.version,requiresRestart:this.bootTargets.get(name)!==item.current.hash}
 }
 decorate(rows:InstalledPluginItem[]):InstalledPluginItem[]{const r=this.registry();return rows.map(row=>r.plugins[row.id]?{...row,...this.item(row.id),enabled:row.enabled,children:row.children}:row)}
 pending():InventoryEntry[]{return Object.entries(this.registry().plugins).flatMap(([name,item])=>this.bootTargets.get(name)===item.current.hash?[]:item.current.entries.map(e=>({entryId:'include:'+e.id,moduleName:e.name,enabled:false,fiberPhase:'pending-restart'})))}
 origins():InventoryEntry[]{return Object.values(this.registry().plugins).flatMap(item=>item.current.entries.map(e=>({entryId:'include:'+e.id,moduleName:e.name,enabled:false,fiberPhase:null,origin:'本地导入'})))}
 job(action:GatewayJob['action'],spec:string,run:()=>InstalledPluginItem):{jobId:string}{
  const job:GatewayJob={id:randomUUID(),action,spec,phase:'running'};this.jobs.set(job.id,job)
  try{job.plugin=run();job.phase='done'}catch(e){job.phase='error';job.error=e instanceof Error?e.message:String(e)}
  while(this.jobs.size>100)this.jobs.delete(this.jobs.keys().next().value!)
  return {jobId:job.id}
 }
 status(id:string):GatewayJob|undefined{return this.jobs.get(id)}
}
