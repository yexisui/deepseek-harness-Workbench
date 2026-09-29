/** Offline preflight. This module only reads bytes; it never imports plugin code. */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, realpathSync } from 'node:fs'
import path from 'node:path'
import { isBuiltin } from 'node:module'
import { satisfies, valid } from 'semver'
import { parseDocument } from 'yaml'
import { readResourceManifest, validateLocalId } from '../../../dsh-market/src/core/local-import-manifest.ts'
import { listPlainFiles, safeLocalPath, isImportedRecord } from '../../../dsh-market/src/core/local-import-safety.ts'

export interface OfflinePreview {
 id:string;name:string;version:string;hash:string;fileCount:number;totalBytes:number
 entries:Array<{id:string;name:string}>;shared:Array<{name:string;version:string}>;bundled:string[]
 scriptsSkipped:string[];platform:string;currentVersion?:string;currentHash?:string
 disposition:'new'|'identical'|'upgrade'|'replace';requiresRestart:true
}
export interface CheckedPackage { preview:OfflinePreview;links:Map<string,string>;root:string }
const sharedName=(name:string)=>name.startsWith('@deepseek-ai/')||name==='react'||name==='react-dom'
export const json=(file:string)=>JSON.parse(readFileSync(file,'utf8').replace(/^\uFEFF/,''))
export function packagePatch(root:string):string {
 const manifest=json(path.join(root,'package.json'))
 return path.join(root,safeLocalPath((manifest.dsh?.bundle?.patch??'cordis.patch.yml').replace(/^\.\//,'')))
}
function exportFile(value:unknown):string|undefined {
 if(typeof value==='string')return value
 if(value&&typeof value==='object')for(const key of ['.','node','import','require','default']){const found=exportFile((value as Record<string,unknown>)[key]);if(found)return found}
 return undefined
}
function rangeOk(version:string,range:unknown):boolean {
 return typeof range==='string'&&satisfies(version,range,{includePrerelease:true})
}
function platformOk(values:unknown,current:string):boolean {
 if(values===undefined)return true
 if(!Array.isArray(values)||!values.every(v=>typeof v==='string'))return false
 return !values.includes('!'+current)&&(!values.some(v=>!v.startsWith('!'))||values.includes(current))
}
export function inspectOfflinePackage(root:string,sharedRoots:string[],occupied:Map<string,string>,current?:{version:string;hash?:string}):CheckedPackage {
 const files=listPlainFiles(root).filter(f=>!isImportedRecord(f.rel))
 const manifest=readResourceManifest(root,files,'plugin'),raw=json(path.join(root,'package.json'))
 if(!valid(raw.version))throw Error('插件需要有效的语义版本号，例如 1.0.0。')
 if(/^@deepseek(?:-ai)?\//.test(manifest.id)||['@linxin666/dsh-web-all','@linxin666/dsh-client-ui-plugin-manager'].includes(manifest.id))throw Error('此入口不能替换官方底座或插件管理器。')
 const hash=createHash('sha256');for(const file of [...files].sort((a,b)=>a.rel.localeCompare(b.rel))){hash.update(file.rel+'\0');hash.update(createHash('sha256').update(readFileSync(path.join(root,file.rel))).digest())}
 const digest=hash.digest('hex'),links=new Map<string,string>(),shared:OfflinePreview['shared']=[],bundled:string[]=[],visited=new Set<string>(),scriptsSkipped=new Set<string>()
 const sharedPackage=(name:string)=>{for(const base of sharedRoots){const dir=path.join(base,name);if(existsSync(path.join(dir,'package.json')))return realpathSync(dir)}return undefined}
 const resolveDependency=(from:string,name:string):string|undefined=>{let dir=from;while(true){const candidate=path.join(dir,'node_modules',name);if(existsSync(path.join(candidate,'package.json')))return candidate;if(dir===root)break;const parent=path.dirname(dir);if(!parent.startsWith(root+path.sep)&&parent!==root)break;dir=parent}return undefined}
 const check=(dir:string):void=>{
  if(visited.has(dir))return;visited.add(dir)
  const pkg=json(path.join(dir,'package.json'))
  if(!platformOk(pkg.os,process.platform)||!platformOk(pkg.cpu,process.arch))throw Error(`${pkg.name} 不支持当前平台 ${process.platform}/${process.arch}`)
  if(pkg.engines?.node&&!rangeOk(process.versions.node,pkg.engines.node))throw Error(`${pkg.name} 要求 Node ${pkg.engines.node}，当前为 ${process.versions.node}`)
  for(const key of ['preinstall','install','postinstall','prepare'])if(pkg.scripts?.[key])scriptsSkipped.add(`${pkg.name}: ${key}`)
  const declared={...pkg.dependencies,...pkg.optionalDependencies,...pkg.peerDependencies}
  for(const [name,range]of Object.entries(declared)){
   validateLocalId('plugin',name)
   if(isBuiltin(name))continue
   const optional=Object.hasOwn(pkg.optionalDependencies??{},name)||pkg.peerDependenciesMeta?.[name]?.optional===true
   if(sharedName(name)){
    if(resolveDependency(dir,name))throw Error(`请移除包内的共享底座依赖 ${name}，由当前 Harness 提供。`)
    const source=sharedPackage(name)
    if(!source){if(optional)continue;throw Error(`当前底座缺少共享依赖 ${name}`)}
    const version=json(path.join(source,'package.json')).version
    if(!rangeOk(version,range))throw Error(`共享依赖 ${name} 需要 ${range}，当前为 ${version}`)
    if(!links.has(name))shared.push({name,version});links.set(name,source);continue
   }
   const source=resolveDependency(dir,name)
   if(!source){if(optional)continue;throw Error(`离线包缺少依赖 ${name} (${range})。请提供含依赖的发布包，不会联网补装。`)}
   const dep=json(path.join(source,'package.json'))
   if(optional&&(!platformOk(dep.os,process.platform)||!platformOk(dep.cpu,process.arch)))continue
   if(dep.name!==name||!rangeOk(dep.version,range))throw Error(`包内依赖 ${name} 的名称或版本不符合 ${range}`)
   const entry=exportFile(dep.exports)??dep.main??'index.js'
   if(typeof entry==='string'&&!entry.includes('*')){const rel=safeLocalPath(entry.replace(/^\.\//,''));if(!existsSync(path.join(source,rel)))throw Error(`依赖 ${name} 缺少构建入口 ${rel}`)}
   bundled.push(`${name}@${dep.version}`);check(source)
  }
 }
 check(root)
 // Client inject modules are also shared capabilities, even when absent from dependencies.
 for(const name of raw.dsh?.client?.inject??[]){validateLocalId('plugin',name);if(!sharedPackage(name))throw Error(`当前底座缺少浏览器依赖 ${name}`)}
 if(raw.dsh?.engines?.dsh){const dsh=sharedPackage('@deepseek-ai/dsh');if(!dsh||!rangeOk(json(path.join(dsh,'package.json')).version,raw.dsh.engines.dsh))throw Error(`插件要求 Harness ${raw.dsh.engines.dsh}，与当前宿主不兼容或无法确认版本。`)}
 if(files.some(f=>/\.(node|dll|exe)$/i.test(f.rel))){const native=raw.dshOffline;if(native?.platform!==process.platform||native?.arch!==process.arch||String(native?.nodeAbi)!==process.versions.modules)throw Error('原生二进制插件必须声明并匹配 dshOffline.platform、arch 和 nodeAbi。')}
 const patch=readFileSync(packagePatch(root),'utf8')
 const doc=parseDocument(patch,{uniqueKeys:true})
 if(doc.errors.length||doc.warnings.length)throw Error('离线插件的安装清单必须使用普通 YAML，不支持动态表达式。')
 const operations=doc.toJS({maxAliasCount:30}),entries:OfflinePreview['entries']=[]
 if(!Array.isArray(operations))throw Error('无效的插件安装清单')
 for(const operation of operations){
  if(!operation||!Array.isArray(operation.insert)||Object.keys(operation).some(k=>!['insert','before','after'].includes(k)))throw Error('离线包只允许 insert 新插件条目，不能修改或删除其他模块。')
  for(const row of operation.insert){
   if(!row||typeof row.id!=='string'||!/^[a-zA-Z0-9_.:-]{1,150}$/.test(row.id)||typeof row.name!=='string'||row.group)throw Error('每个插件条目都必须包含稳定 id 和模块名称。')
   if(entries.some(e=>e.id===row.id)||occupied.has(row.id))throw Error(`插件条目 ${row.id} 与 ${occupied.get(row.id)??'包内其他条目'} 冲突。`)
   if(row.name!==manifest.id&&!row.name.startsWith(manifest.id+'/'))throw Error(`条目 ${row.id} 必须加载本插件的模块。`)
   entries.push({id:row.id,name:row.name})
  }
 }
 if(!entries.length)throw Error('离线包没有可安装的插件条目。')
 return {root,links,preview:{id:manifest.id,name:manifest.name,version:raw.version,hash:digest,fileCount:files.length,totalBytes:files.reduce((n,f)=>n+f.bytes,0),entries,shared,bundled:[...new Set(bundled)],scriptsSkipped:[...scriptsSkipped],platform:`${process.platform}/${process.arch}`,currentVersion:current?.version,currentHash:current?.hash,disposition:current?(current.hash===digest?'identical':current.version===raw.version?'replace':'upgrade'):'new',requiresRestart:true}}
}
