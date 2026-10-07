import fs from 'node:fs'
import path from 'node:path'
import {createHash, randomUUID} from 'node:crypto'
import {isMap,parseDocument} from 'yaml'
import {assertPlainPath, FilePaths, listPlainFiles, plainMkdir, safeLocalPath} from '../../dsh-market/src/core/local-import-safety.ts'
import {extractLocalZip} from '../../dsh-market/src/core/local-import-zip.ts'
import {packageZip} from '../../dsh-capabilities/src/host/package-archive.ts'

const LIMIT=32*1024*1024, NAME=/^[a-z0-9][a-z0-9-]{0,63}$/
const digest=(data:Buffer|string)=>createHash('sha256').update(data).digest('hex')
type Files=Map<string,Buffer>
export interface ManagedSkill {id:string;name:string;description:string;root:string;scope:string;hash:string;enabled:boolean;auto:boolean;manual:boolean;category:string;warnings:string[];previous?:string;removed?:boolean;updatedAt:string}
interface Database {revision:number;skills:ManagedSkill[]}
interface Candidate {key:string;name:string;description:string;hash:string;warnings:string[];error?:string;files:Files}
interface Preview {id:string;root:string;scope:string;expires:number;revision:number;candidates:Candidate[]}
function frontmatter(text:string){
 const match=/^---\r?\n([\s\S]*?)\r?\n---([\s\S]*)$/.exec(text.replace(/^\uFEFF/,''));if(!match)throw Error('SKILL.md 缺少有效的 YAML 头部')
 const doc=parseDocument(match[1],{uniqueKeys:true});if(doc.errors.length||doc.warnings.length||!isMap(doc.contents))throw Error('SKILL.md 的 YAML 头部无效或含重复字段')
 for(const key of ['name','description'])if(typeof doc.get(key)!=='string')throw Error('name 和 description 必须为文本')
 for(const key of ['disable-model-invocation','user-invocable'])if(doc.has(key)&&typeof doc.get(key)!=='boolean')throw Error(key+' 必须为布尔值')
 return {doc,body:match[2]}
}
function parseFrontmatter(text:string){const {doc}=frontmatter(text);return {name:doc.get('name') as string,description:doc.get('description') as string,disableModelInvocation:doc.get('disable-model-invocation') as boolean|undefined,userInvocable:doc.get('user-invocable') as boolean|undefined}}
function rewrite(text:string, fields:Record<string,string|boolean>):string {
 const {doc,body}=frontmatter(text);for(const [key,value]of Object.entries(fields))doc.set(key,value)
 return '---\n'+doc.toString()+'---'+body
}
function filesAt(root:string):Files {assertPlainPath(root);const list=listPlainFiles(root);if(list.length>500||list.reduce((s,f)=>s+f.bytes,0)>LIMIT)throw Error('每次最多 500 个文件、32 MiB');return new Map(list.map(f=>[f.rel,fs.readFileSync(path.join(root,f.rel))]))}
function hashFiles(files:Files){return digest(Buffer.concat([...files].sort(([a],[b])=>a.localeCompare(b)).flatMap(([name,b])=>[Buffer.from(name+'\0'+b.length+'\0'),b])))}
function writeFiles(root:string,files:Files){plainMkdir(root);for(const [name,bytes]of files){const target=path.join(root,safeLocalPath(name));plainMkdir(path.dirname(target));fs.writeFileSync(target,bytes,{flag:'wx',mode:0o600})}}

/** Owns copied skill packages only; never edits original Codex directories. */
export class ManagedSkills {
 readonly root:string
 private previews=new Map<string,Preview>()
 constructor(readonly home:string,readonly projects:()=>string[]){this.root=path.join(home,'skill-management')}
 private file(){return path.join(this.root,'state.json')}
 read():Database {if(!fs.existsSync(this.file()))return {revision:0,skills:[]};assertPlainPath(this.file());return JSON.parse(fs.readFileSync(this.file(),'utf8'))}
 private save(db:Database){plainMkdir(this.root);const tmp=this.file()+'.'+randomUUID()+'.tmp';fs.writeFileSync(tmp,JSON.stringify({...db,revision:db.revision+1},null,2),{flag:'wx',mode:0o600});fs.renameSync(tmp,this.file())}
 private target(scope:string){if(scope==='global')return path.join(this.home,'skills');const project=this.projects().find(p=>path.resolve(p)===path.resolve(scope));if(!project)throw Error('请选择当前工作台中的项目');return path.join(project,'.dsh','skills')}
 private asset(hash:string){if(!/^[a-f0-9]{64}$/.test(hash))throw Error('无效版本');return path.join(this.root,'versions',hash)}
 private archive(files:Files){const hash=hashFiles(files),dest=this.asset(hash);if(!fs.existsSync(dest)){const staging=path.join(this.root,'versions','.stage-'+randomUUID());try{writeFiles(staging,files);fs.renameSync(staging,dest)}finally{if(fs.existsSync(staging))this.erase(staging,path.join(this.root,'versions'))}}else if(hashFiles(filesAt(dest))!==hash)throw Error('已有版本资产校验失败');return hash}
 private activate(row:ManagedSkill){
  const target=path.join(row.root,row.name);assertPlainPath(target)
  const source=filesAt(this.asset(row.hash));const text=source.get('SKILL.md')?.toString('utf8');if(!text)throw Error('技能版本缺失')
  source.set('SKILL.md',Buffer.from(rewrite(text,{name:row.name,'disable-model-invocation':!row.enabled||!row.auto,'user-invocable':row.enabled&&row.manual})))
  const temp=path.join(row.root,'.stage-'+randomUUID()),old=path.join(row.root,'.old-'+randomUUID());writeFiles(temp,source)
  let moved=false
  try{if(fs.existsSync(target)){fs.renameSync(target,old);moved=true}fs.renameSync(temp,target)}catch(e){if(moved)fs.renameSync(old,target);throw e}
  if(moved)this.erase(old,row.root)
 }
 private erase(target:string,root:string){const relative=path.relative(root,target);if(!relative||relative.startsWith('..')||path.isAbsolute(relative))throw Error('目录越界');assertPlainPath(target);fs.rmSync(target,{recursive:true,force:true})}
 private verifyCurrent(row:ManagedSkill){
  const target=path.join(row.root,row.name);if(row.removed){if(fs.existsSync(target))throw Error('目标目录已被其他技能占用');return}
  if(!fs.existsSync(target))throw Error('技能目录已改变，请刷新后检查')
  const actual=filesAt(target),expected=filesAt(this.asset(row.hash)),text=expected.get('SKILL.md')!.toString('utf8')
  expected.set('SKILL.md',Buffer.from(rewrite(text,{name:row.name,'disable-model-invocation':!row.enabled||!row.auto,'user-invocable':row.enabled&&row.manual})))
  if(hashFiles(actual)!==hashFiles(expected))throw Error('技能文件在外部被修改，已保留；请先导出或另存后再更新')
 }
 inspect(input:{files:{path:string;data:string}[];scope:string;zip?:boolean}) {
  this.expire();if(this.previews.size>=4)throw Error('请先完成或取消已有导入')
  const root=this.target(input.scope);if(!Array.isArray(input.files)||!input.files.length||input.files.length>500)throw Error('请选择 1–500 个文件')
  const uploaded=new Map<string,Buffer>(),paths=new FilePaths();let bytes=0
  for(const f of input.files){const name=safeLocalPath(f.path);paths.add(name);if(typeof f.data!=='string'||!/^[A-Za-z0-9+/]*={0,2}$/.test(f.data))throw Error('文件编码无效');const data=Buffer.from(f.data,'base64');bytes+=data.length;if(bytes>LIMIT)throw Error('导入包超过 32 MiB');uploaded.set(name,data)}
  let files=uploaded
  if(input.zip){if(uploaded.size!==1)throw Error('请选择一个 ZIP');const stage=path.join(this.root,'staging',randomUUID());plainMkdir(stage);try{const zip=path.join(stage,'input.zip'),out=path.join(stage,'out');fs.writeFileSync(zip,[...uploaded.values()][0]);extractLocalZip(zip,out);files=filesAt(out)}finally{this.erase(stage,path.join(this.root,'staging'))}}
  const skillPaths=[...files.keys()].filter(n=>path.posix.basename(n)==='SKILL.md')
  if(!skillPaths.length)throw Error('没有找到 SKILL.md，请选择技能文件或包含技能的目录')
  const candidates:Candidate[]=skillPaths.map(key=>{
   const prefix=key.slice(0,-8),text=files.get(key)!.toString('utf8').replace(/^\uFEFF/,''),own=new Map([...files].filter(([n])=>n.startsWith(prefix)).map(([n,b])=>[n.slice(prefix.length),b]));own.set('SKILL.md',Buffer.from(text))
   const warnings:string[]=[];let error:string|undefined
   let fm:ReturnType<typeof parseFrontmatter>={name:'',description:'',disableModelInvocation:undefined,userInvocable:undefined};try{fm=parseFrontmatter(text)}catch(e){error=e instanceof Error?e.message:String(e)}const name=fm.name
   if(!error&&(!NAME.test(name)||!fm.description.trim()))error='需要有效 name（小写英文/数字/连字符）和 description'
   if(skillPaths.some(p=>p!==key&&p.startsWith(prefix)))error='技能目录嵌套，请拆分为独立技能'
   if([...own.keys()].some(n=>/\.(py|[cm]?js|sh|ps1|cmd|exe)$/i.test(n)))warnings.push('含脚本：需要对应运行环境，导入不会执行脚本')
   if(/\b(codex|functions\.|mcp__|plugin:\/\/|skill:\/\/)|[A-Z]:\\/i.test(text))warnings.push('可能依赖专用工具或本机路径，需要适配核对')
   for(const match of text.matchAll(/\]\(([^)]+)\)/g)){const ref=match[1].replace(/^<|>$/g,'').split('#')[0];if(ref&&!/^(?:[a-z]+:|#)/i.test(ref)&&!own.has(ref.replace(/^\.\//,'')))warnings.push('引用资源待核对：'+ref)}
   return {key,name,description:fm.description??'',hash:hashFiles(own),files:own,warnings:[...new Set(warnings)],error}
  })
  const id=randomUUID(),preview={id,root,scope:input.scope,expires:Date.now()+30*60*1000,revision:this.read().revision,candidates};this.previews.set(id,preview)
  return {id,scope:input.scope,candidates:candidates.map(({files,...c})=>({...c,fileCount:files.size,existing:this.read().skills.filter(s=>s.root===root&&s.name===c.name).map(s=>({id:s.id,hash:s.hash,removed:s.removed}))}))}
 }
 discard(id:string){this.previews.delete(id)}
 private expire(){for(const [id,p]of this.previews)if(p.expires<Date.now())this.previews.delete(id)}
 commit(id:string,choices:{key:string;mode:'update'|'copy';name?:string}[],enabled:boolean){
  this.expire();const p=this.previews.get(id);if(!p)throw Error('导入预览已过期');if(this.target(p.scope)!==p.root)throw Error('项目已改变')
  if(!Array.isArray(choices)||!choices.length)throw Error('请至少选择一个技能');const db=this.read(),before=structuredClone(db),changed:ManagedSkill[]=[];if(db.revision!==p.revision)throw Error('技能状态在预览后已改变，请取消后重新导入');const selected=new Set<string>()
  const planned=choices.map(choice=>{
   const c=p.candidates.find(c=>c.key===choice.key);if(!c||c.error||selected.has(choice.key))throw Error(c?.error??'无效或重复技能');selected.add(choice.key)
   const name=choice.mode==='copy'?choice.name:c.name;if(!name||!NAME.test(name))throw Error('副本需要有效且唯一的名称')
   const old=db.skills.find(s=>s.root===p.root&&s.name===name);if(choice.mode==='copy'&&old)throw Error('副本名称已存在')
   if(old)this.verifyCurrent(old);else if(fs.existsSync(path.join(p.root,name)))throw Error('目标存在非本模块管理的技能，请另存副本')
   const files=new Map(c.files);files.set('SKILL.md',Buffer.from(rewrite(files.get('SKILL.md')!.toString('utf8'),{name})));const hash=this.archive(files),fm=parseFrontmatter(files.get('SKILL.md')!.toString())
   const row:ManagedSkill={id:old?.id??randomUUID(),name,description:c.description,root:p.root,scope:p.scope,hash,enabled:old?.enabled??enabled,auto:old?.auto??fm.disableModelInvocation!==true,manual:old?.manual??fm.userInvocable!==false,category:old?.category??'未分类',warnings:c.warnings,previous:old&&old.hash!==hash?old.hash:old?.previous,updatedAt:new Date().toISOString()}
   return {old,row}
  })
  if(new Set(planned.map(p=>p.row.name)).size!==planned.length)throw Error('选择项名称重复')
  let unchanged=0
  try{for(const {old,row}of planned){if(old&&!old.removed&&old.hash===row.hash){unchanged++;continue}changed.push(row);this.activate(row);if(old)db.skills[db.skills.indexOf(old)]=row;else db.skills.push(row)}if(changed.length)this.save(db)}catch(error){for(const row of changed.reverse()){const old=before.skills.find(s=>s.id===row.id);if(old&&!old.removed)this.activate(old);else this.erase(path.join(row.root,row.name),row.root)}throw error}
  this.previews.delete(id);return {ok:true,count:planned.length-unchanged,unchanged}
 }
 change(id:string,revision:number,action:string,value?:unknown){
  const db=this.read();if(db.revision!==revision)throw Error('列表已改变，请刷新后重试');const row=db.skills.find(s=>s.id===id);if(!row)throw Error('技能不存在');this.verifyCurrent(row);const old=structuredClone(row)
  if(action==='enabled'){if(typeof value!=='boolean')throw Error('无效开关');row.enabled=value}
  else if(action==='auto'){if(typeof value!=='boolean')throw Error('无效开关');row.auto=value}
  else if(action==='category'){if(typeof value!=='string'||!value.trim()||value.length>40)throw Error('分类需为 1–40 个字符');row.category=value.trim()}
  else if(action==='rollback'){if(!row.previous)throw Error('没有可回退版本');[row.hash,row.previous]=[row.previous,row.hash];row.enabled=false}
  else if(action==='remove'){row.removed=true;row.enabled=false}
  else if(action==='restore'){row.removed=false;row.enabled=false}
  else throw Error('不支持的操作')
  if(row.removed&&action!=='remove')throw Error('请先从回收站恢复技能')
  try{if(row.removed)this.erase(path.join(row.root,row.name),row.root);else this.activate(row);this.save(db)}catch(error){if(!old.removed)this.activate(old);else this.erase(path.join(row.root,row.name),row.root);throw error}
  return {ok:true}
 }
 detail(id:string){const row=this.read().skills.find(s=>s.id===id);if(!row)throw Error('技能不存在');const files=filesAt(this.asset(row.hash));return {content:files.get('SKILL.md')!.toString('utf8'),files:[...files.keys()]}}
 export(id:string){const row=this.read().skills.find(s=>s.id===id);if(!row)throw Error('技能不存在');let files=filesAt(this.asset(row.hash));if(!row.removed){try{this.verifyCurrent(row)}catch{files=filesAt(path.join(row.root,row.name))}}return {name:row.name+'.zip',bytes:packageZip(files)}}
}
