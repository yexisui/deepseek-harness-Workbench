import {mkdir,open,link,unlink} from 'node:fs/promises'
import {spawn} from 'node:child_process'
import {join,resolve} from 'node:path'
import {randomUUID} from 'node:crypto'
import type {RequirementTask} from '../core/requirements-model.ts'
import type {TemplateVersion} from '../core/requirement-template.ts'

const safe=(s:string)=>s.replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/[. ]+$/g,'').slice(0,55)||'需求文档'
export function requirementOutputFolder(root:string,task:RequirementTask){
 const w=task.template!,name=w.versions[0]?.title||w.template?.name||task.title
 // IDs belong to persisted tasks/templates, never caller-supplied file paths.
 return resolve(root,`${safe(name).slice(0,28)}-${task.id}`,safe(w.template!.id).slice(0,8))
}
export async function saveRequirementOutput(root:string,task:RequirementTask,version:TemplateVersion,format:'docx'|'pdf',bytes:Buffer){
 const folder=requirementOutputFolder(root,task),file=join(folder,`V${version.number}_${safe(version.title||task.template!.product||task.title)}.${format}`)
 await mkdir(folder,{recursive:true})
 // A user may have edited an opened Word file. Do not replace it on a later export.
 const temporary=file+'.'+randomUUID()+'.tmp'
 try{
  const h=await open(temporary,'wx')
  try{await h.writeFile(bytes);await h.sync()}finally{await h.close()}
  await link(temporary,file).catch(e=>{if(e.code!=='EEXIST')throw e});return file
 }finally{await unlink(temporary).catch(()=>{})}
}
export async function openRequirementOutput(path:string){
 const program=process.platform==='win32'?'explorer.exe':process.platform==='darwin'?'open':'xdg-open'
 await new Promise<void>((resolve,reject)=>{const child=spawn(program,[path],{windowsHide:true,stdio:'ignore'});child.once('error',reject);child.once('spawn',()=>{child.unref();resolve()})})
}
