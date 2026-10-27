import type {TemplateSlot,TemplateVersion} from '../../../dsh-capabilities/src/core/requirement-template.ts'
import {templateEditions} from '../../../dsh-capabilities/src/core/requirement-versions.ts'

export type TextChange={id:string;before:string;after:string;kind:'added'|'modified'|'deleted'}
export type DocumentChange={id:string;changes:TextChange[]}
export type DocumentChanges={groups:DocumentChange[];byId:Map<string,{change:TextChange;group:DocumentChange}>}
export const NOTE_BLOCK='document-note'

/** Explicit ancestry wins over chronological ordering, including edits from old editions. */
export function comparisonBase(versions:TemplateVersion[],current:TemplateVersion|undefined,unsaved:boolean){
 if(!current)return {version:undefined,inferred:false}
 if(unsaved)return {version:current,inferred:false}
 const parentId=templateEditions(versions).get(current.id)?.parentId
 return {version:versions.find(v=>v.id===parentId&&v.id!==current.id),inferred:!!parentId&&!current.parentId}
}

export function documentChanges(slots:TemplateSlot[],values:Record<string,string>,note:string,baseValues:Record<string,string>,baseNote:string):DocumentChanges{
 const groups:DocumentChange[]=[],byId:DocumentChanges['byId']=new Map(),units=new Map<string,DocumentChange>()
 const add=(id:string,unit:string,before:string,after:string)=>{
  if(before===after)return
  const change:TextChange={id,before,after,kind:!before?'added':!after?'deleted':'modified'}
  let group=units.get(unit)
  if(!group){group={id,changes:[]};units.set(unit,group);groups.push(group)}
  group.changes.push(change);byId.set(id,{change,group})
 }
 // Reading order matches the preview: headers, body, note, footers.
 const rank=(s:TemplateSlot)=>s.part.includes('header')?0:s.part==='word/document.xml'?1:3
 for(const slot of slots.filter(s=>rank(s)<3))add(slot.id,slot.table!==undefined?`${slot.part}@${slot.table}:${slot.row}:${slot.cell}`:slot.id,baseValues[slot.id]??slot.text,values[slot.id]??slot.text)
 add(NOTE_BLOCK,NOTE_BLOCK,baseNote,note)
 for(const slot of slots.filter(s=>rank(s)===3))add(slot.id,slot.table!==undefined?`${slot.part}@${slot.table}:${slot.row}:${slot.cell}`:slot.id,baseValues[slot.id]??slot.text,values[slot.id]??slot.text)
 groups.sort((a,b)=>{
  const order=(id:string)=>id===NOTE_BLOCK?2:rank(slots.find(s=>s.id===id)!)
  return order(a.id)-order(b.id)
 })
 return {groups,byId}
}

/** A bounded, Unicode-safe changed span; no quadratic whole-document diff. */
export function textChangeSpan(before:string,after:string){
 const a=Array.from(before),b=Array.from(after);let start=0,end=0
 while(start<a.length&&start<b.length&&a[start]===b[start])start++
 while(end<a.length-start&&end<b.length-start&&a[a.length-1-end]===b[b.length-1-end])end++
 return {prefix:b.slice(0,start).join(''),removed:a.slice(start,a.length-end).join(''),added:b.slice(start,b.length-end).join(''),suffix:end?b.slice(-end).join(''):''}
}
