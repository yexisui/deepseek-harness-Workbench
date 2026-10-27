import type {TemplateVersion} from './requirement-template.ts'

export type TemplateEdition = {major:number;minor:number;parentId?:string}
const integer=(n:unknown):n is number=>Number.isSafeInteger(n)&&Number(n)>=0
const label=(v:TemplateEdition)=>`V${v.major}${v.minor?'.'+v.minor:''}`

/** Keep immutable IDs and chronological numbers; infer only known legacy operation labels. */
export function templateEditions(versions:TemplateVersion[]){
 const editions=new Map<string,TemplateEdition>()
 for(const [index,v] of versions.entries()){
  if(integer(v.major)&&integer(v.minor)){editions.set(v.id,{major:v.major,minor:v.minor,parentId:v.parentId});continue}
  if(index===0&&v.number===0){editions.set(v.id,{major:0,minor:0});continue}
  const restore=/^从 V(\d+) 恢复$/.exec(v.label)
  const parent=restore?versions.slice(0,index).find(p=>p.number===Number(restore[1])):versions[index-1]
  if(v.label==='生成初稿')editions.set(v.id,{major:Math.max(0,...[...editions.values()].map(e=>e.major))+1,minor:0,parentId:parent?.id})
  else if(restore||['按要求修改','手动修改','保存文档','保存版本'].includes(v.label)){
   const major=(parent&&editions.get(parent.id)?.major)??0
   editions.set(v.id,{major,minor:Math.max(0,...[...editions.values()].filter(e=>e.major===major).map(e=>e.minor))+1,parentId:parent?.id})
  }else editions.set(v.id,{major:v.number,minor:0})
 }
 return editions
}
export function templateVersionLabel(versions:TemplateVersion[],version:TemplateVersion){
 return label(templateEditions(versions).get(version.id)??{major:version.major??version.number,minor:version.minor??0})
}
export function nextTemplateEdition(versions:TemplateVersion[],action:'generate'|'revise'='revise',baseId?:string):TemplateEdition{
 if(!versions.length)return {major:0,minor:0}
 const editions=templateEditions(versions),parent=versions.find(v=>v.id===baseId)??versions.at(-1)!,values=[...editions.values()]
 if(action==='generate')return {major:Math.max(...values.map(e=>e.major))+1,minor:0,parentId:parent.id}
 const major=editions.get(parent.id)!.major
 return {major,minor:Math.max(...values.filter(e=>e.major===major).map(e=>e.minor))+1,parentId:parent.id}
}
