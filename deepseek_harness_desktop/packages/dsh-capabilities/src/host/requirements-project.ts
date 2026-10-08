import { readFile, readdir, realpath, stat, lstat, open, rename, unlink } from 'node:fs/promises'
import { join, isAbsolute, relative, basename } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { RequirementProject, RequirementTask } from '../core/requirements-model.ts'
import { requirementSectionContent } from '../core/requirements-model.ts'

const omitted=new Set(['node_modules','.git','.venv','venv','dist','lib','build','runtime','dsh-data','_backup_perf','tmp','.codex','.aws'])
const allowed=(name:string)=>/\.(md|markdown|txt|ts|tsx|js|py|yaml|yml|json)$/i.test(name)&&!/(^\.|secret|credential|token|password|ai_key|package-lock|pnpm-lock)/i.test(name)
export async function projectFile(project:RequirementProject,name:string) {
  if(isAbsolute(name))throw Error('请选择项目内的相对文件路径')
  const file=await realpath(join(project.path,name)),rel=relative(project.path,file)
  if(rel==='..'||rel.startsWith('..\\')||rel.startsWith('../')||isAbsolute(rel)||!allowed(basename(file)))throw Error('文件不在可读取的项目范围内')
  if((await stat(file)).size>240000)throw Error('文件过大，请选择相关片段作为资料')
  const value=await readFile(file,'utf8');if(value.includes('\0'))throw Error('请选择文本资料')
  return value
}
export async function projectFiles(root:string) {
  const files:string[]=[]
  async function visit(dir:string,depth:number){
    for(const entry of await readdir(dir,{withFileTypes:true})){
      if(entry.isSymbolicLink()||omitted.has(entry.name)||entry.name.startsWith('.'))continue
      const file=join(dir,entry.name)
      if(entry.isDirectory()&&depth<3)await visit(file,depth+1)
      else if(entry.isFile()&&allowed(entry.name))files.push(relative(root,file).replaceAll('\\','/'))
    }
  }
  await visit(root,0);return files
}
export async function attachRequirementProject(path:string,ledger:boolean):Promise<RequirementProject>{
  if(!isAbsolute(path))throw Error('请输入项目文件夹的绝对路径')
  const root=await realpath(path);if(!(await stat(root)).isDirectory())throw Error('请选择项目文件夹')
  const names=await readdir(root),ledgerName=names.find(n=>n.toLowerCase()==='perf_plan.md')??'PERF_PLAN.md'
  return {path:root,ledger,ledgerName,files:await projectFiles(root)}
}
// The caller serializes project writes. Only this task's marked block is replaced.
export async function syncRequirementLedger(task:RequirementTask){
  const project=task.project;if(!project?.ledger)return
  const file=join(project.path,project.ledgerName)
  let before=''
  try{const info=await lstat(file);if(info.isSymbolicLink()||!info.isFile())throw Error('台账不是普通文件，已保留原文件');before=await readFile(file,'utf8')}
  catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error}
  const start='<!-- requirements:'+task.id+':start -->',end='<!-- requirements:'+task.id+':end -->'
  const summary=(task.sections??[]).filter(s=>s.enabled).map(s=>'### '+s.title+'\n'+(requirementSectionContent(s,task).slice(0,700)||'待补充')).join('\n\n')
  const block=[start,'## '+task.title+' · '+task.id.slice(0,8),'更新时间：'+task.updatedAt,'记录状态：需求工作草稿；实现与验收以实际证据为准。完整需求与历史保存在工作台对应需求主题中。',summary,end].join('\n\n')
  const a=before.indexOf(start),b=before.indexOf(end)
  if((a>=0)!==(b>=0)||b>=0&&b<a)throw Error('台账记录边界不完整，原文已保留')
  const next=a>=0?before.slice(0,a)+block+before.slice(b+end.length):(before||'# 项目需求台账\n')+'\n\n'+block+'\n'
  const tmp=file+'.'+randomUUID()+'.tmp',handle=await open(tmp,'wx')
  try{await handle.writeFile(next);await handle.sync()}finally{await handle.close()}
  try{const latest=await readFile(file,'utf8').catch(e=>{if(e.code==='ENOENT')return '';throw e});if(latest!==before)throw Error('台账刚被其他程序更新，本次需求已保存，请重试同步');await rename(tmp,file)}catch(error){await unlink(tmp).catch(()=>{});throw error}
}
