import type {LocalConversation} from './local-conversations.ts'
export type ArchiveEntry={id:string;title:string;role:string;archived:boolean;archivedAt:string;removed?:boolean;sourceKey?:string;localSnapshot?:LocalConversation}
type View={revision:number;entries:Record<string,ArchiveEntry>;ready:boolean;error:string}
export const LEGACY_ARCHIVES='workbench-special-archives-v1'
const endpoint='/api/capabilities/assistant-archives'
export function createAssistantArchives(request=async(body?:unknown)=>{const res=await fetch(endpoint,{credentials:'same-origin',...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});const value=await res.json();if(!res.ok)throw Error(value.error||'归档读取失败');return value as Pick<View,'revision'|'entries'>}){
 let state:View={revision:-1,entries:{},ready:false,error:''},pending=false
 const listeners=new Set<()=>void>(),emit=()=>listeners.forEach(fn=>fn())
 const accept=(value:Pick<View,'revision'|'entries'>)=>{if(value.revision>=state.revision){state={...value,ready:true,error:''};emit()}}
 const legacy=():Record<string,boolean>=>{try{return JSON.parse(localStorage.getItem(LEGACY_ARCHIVES)||'{}')}catch{return {}}}
 const entryFor=(id:string,row?:Pick<LocalConversation,'meeting'|'codeTaskId'>)=>{
  const job=(row?.meeting as {jobId?:string})?.jobId,key=row?.codeTaskId?'code:'+row.codeTaskId:job?'meeting:'+job:undefined
  return state.entries[id]??(key?Object.values(state.entries).find(entry=>entry.sourceKey===key):undefined)
 }
 const refresh=async()=>{try{accept(await request())}catch(e){state={...state,error:String(e)};emit()}}
 const change=async(entry:Partial<ArchiveEntry>&{id:string;archived:boolean},migrate=false)=>{const value=await request({...entry,migrate});accept(value);try{localStorage.setItem('workbench-archive-notify',String(Date.now())+Math.random())}catch{} }
 return {getSnapshot:()=>state,subscribe:(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn)}},refresh,change,entryFor,
  hidden:(id:string,row?:Pick<LocalConversation,'meeting'|'codeTaskId'>)=>entryFor(id,row)?.removed|| (entryFor(id,row)?.archived??Boolean(legacy()[id])),
  async migrate(rows:{id:string;title:string;role:string;localSnapshot?:LocalConversation}[]){if(pending||!state.ready)return;pending=true;try{for(const row of rows){if(!legacy()[row.id])continue;await change({id:row.id,title:row.title,role:row.role,localSnapshot:row.localSnapshot,archived:true},true);const remaining=legacy();delete remaining[row.id];localStorage.setItem(LEGACY_ARCHIVES,JSON.stringify(remaining))}}catch(e){state={...state,error:'旧归档记录尚未迁移：'+String(e)};emit()}finally{pending=false}},
  start(){void refresh();const update=()=>void refresh(),storage=(e:StorageEvent)=>{if(e.key===LEGACY_ARCHIVES||e.key==='workbench-archive-notify')update()};window.addEventListener('focus',update);window.addEventListener('storage',storage);const timer=setInterval(update,5000);return()=>{clearInterval(timer);window.removeEventListener('focus',update);window.removeEventListener('storage',storage)}}
 }
}
export type AssistantArchiveClient=ReturnType<typeof createAssistantArchives>
