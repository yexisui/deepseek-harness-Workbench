import type {DocumentContext,DocumentRecord} from '../../packages/dsh-capabilities/src/core/documents-model.ts'
export type {DocumentContext,DocumentRecord}
const base='/api/capabilities/documents/'
export async function documentApi<T>(path:string,body?:unknown):Promise<T>{
 const res=await fetch(base+path,{credentials:'same-origin',...(body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})}),data=await res.json()
 if(!res.ok)throw Error(data.error||'文档服务不可用');return data
}
type NativeFile={handle:string;name:string;bytes:Uint8Array}
type Desktop={openDocument(path?:string):Promise<NativeFile|null>;saveDocument(input:{handle?:string;name:string;bytes:ArrayBuffer;saveAs:boolean}):Promise<{handle:string;name:string}|null>;getPathForFile?(file:File):string}
export const documentDesktop=()=>(window as Window&{desktop?:Partial<Desktop>}).desktop
export type DocumentDraft={question:string;model:string;scope:string;chapter:number;mode:'ask'|'revise';useKnowledge:boolean}
const emptyDraft:DocumentDraft={question:'',model:'',scope:'auto',chapter:-1,mode:'ask',useKnowledge:false}
type Snapshot={conversationId:string;rows:DocumentRecord[];active?:DocumentRecord;context?:DocumentContext;error:string;busy:boolean;saving:boolean;dirty:boolean;draftSaved:boolean;ready:boolean}
export function createDocumentClient(){
 let state:Snapshot={conversationId:crypto.randomUUID(),rows:[],error:'',busy:false,saving:false,dirty:false,draftSaved:false,ready:false},frame:HTMLIFrameElement|undefined,holder:HTMLDivElement|undefined,ready:Promise<void>|undefined,seq=0,loading=false,timer:ReturnType<typeof setTimeout>|undefined,saveQueue=Promise.resolve(),bytes:ArrayBuffer|undefined
 let operations=Promise.resolve()
 const roleDocuments=new Map<string,string>(),drafts=new Map<string,DocumentDraft>()
 function sequence<T>(work:()=>Promise<T>){const result=operations.then(work);operations=result.then(()=>{},()=>{});return result}
 const channel=crypto.randomUUID(),listeners=new Set<()=>void>(),pending=new Map<number,{resolve:(v:any)=>void;reject:(e:Error)=>void;timer:ReturnType<typeof setTimeout>}>(),handles=new Map<string,string>()
 const emit=(patch:Partial<Snapshot>)=>{state={...state,...patch};listeners.forEach(fn=>fn())}
 const upsert=(row:DocumentRecord)=>emit({rows:[row,...state.rows.filter(r=>r.id!==row.id)].filter(r=>!r.removedAt).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))})
 function ensureFrame(){
  if(frame)return
  holder=document.createElement('div');holder.hidden=true;document.body.appendChild(holder)
  frame=document.createElement('iframe');frame.title='Word 文档编辑器';frame.src=base+'editor/index.html?channel='+channel;frame.style.cssText='width:100%;height:100%;border:0;display:block';holder.appendChild(frame)
  ready=new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('文档引擎加载超时，请重新打开智能文档助手')),60000)
   window.addEventListener('message',event=>{
    if(event.source!==frame!.contentWindow||event.origin!==location.origin||event.data?.source!=='workbench-document'||event.data.channel!==channel)return
    const {type,value}=event.data
    if(type==='ready'){clearTimeout(timeout);emit({ready:true});resolve()}
    else if(type==='result'){const task=pending.get(value.id);if(task){clearTimeout(task.timer);pending.delete(value.id);value.ok?task.resolve(value.result):task.reject(Error(value.error))}}
    else if(type==='selection')emit({context:value})
    else if(type==='change'&&!loading&&state.active){emit({dirty:true,draftSaved:false});clearTimeout(timer);timer=setTimeout(()=>void flush().catch(fail),500)}
    else if(type==='save-request')void save(false).catch(fail)
    else if(type==='error'){emit({error:String(value)});if(!state.ready){clearTimeout(timeout);reject(Error(String(value)))}}
    else if(type==='font-error')emit({error:'字体显示可能有差异：'+value})
   })
  });ready.catch(fail)
 }
 async function rpc<T=any>(op:string,args:unknown={}):Promise<T>{ensureFrame();await ready;return new Promise((resolve,reject)=>{const id=++seq,timeout=setTimeout(()=>{pending.delete(id);reject(Error('编辑器响应超时，请保留页面并重试'))},60000);pending.set(id,{resolve,reject,timer:timeout});frame!.contentWindow!.postMessage({source:'workbench-document-host',channel,id,op,args},location.origin)})}
 const fail=(e:unknown)=>emit({error:e instanceof Error?e.message:String(e)})
 async function refresh(){try{const rows=await documentApi<DocumentRecord[]>('list'),current=rows.find(r=>r.id===state.active?.id);emit({rows,...(current&&current.revision>=(state.active?.revision??0)?{active:current}:{})})}catch(e){fail(e)}}
 async function flush(){
  clearTimeout(timer)
  const work=async()=>{
   if(!state.active||loading||state.draftSaved)return
   const row=state.active,capture=await rpc<{bytes:ArrayBuffer;revision:number}>('save');bytes=capture.bytes;emit({saving:true})
   try{const res=await fetch(base+'file/'+row.id+'?revision='+row.revision,{method:'PUT',headers:{'Content-Type':'application/octet-stream'},body:capture.bytes}),result=await res.json();if(!res.ok)throw Error(result.error||'工作副本保存失败')
    upsert(result);if(state.active?.id===row.id){const current=await rpc<DocumentContext>('context');emit({active:result,context:current,draftSaved:current.revision===capture.revision})}
   }finally{emit({saving:false})}
  }
  const result=saveQueue.then(work);saveQueue=result.catch(()=>{});return result
 }
 async function load(row:DocumentRecord,data:ArrayBuffer){
  loading=true;emit({busy:true,error:''})
  try{const context=await rpc<DocumentContext>('load',{bytes:data});if(context.parseError||!context.editable)throw Error(context.parseError||'文档不能编辑')
   bytes=data;roleDocuments.set(row.roleId,row.id);emit({conversationId:row.conversationId||row.id,active:row,context,dirty:false,draftSaved:row.revision>0});upsert(row)
  }finally{loading=false;emit({busy:false})}
 }
 async function open(id:string){if(state.active?.id===id)return;await flush();const row=state.rows.find(r=>r.id===id);if(!row)throw Error('文档会话不存在');const res=await fetch(base+'file/'+id);if(!res.ok)throw Error('文档工作副本读取失败');const previous=state.active,previousBytes=bytes;try{await load(row,await res.arrayBuffer())}catch(error){if(previous&&previousBytes)await load(previous,previousBytes);throw error}}
 async function importBytes(name:string,data:ArrayBuffer,roleId:string,handle?:string){
  if(data.byteLength>40*1024*1024)throw Error('文档超过 40 MB');await flush();const row=await documentApi<DocumentRecord>('create',{filename:name,roleId,conversationId:state.conversationId}),previous=state.active,previousBytes=bytes
  try{await load(row,data);if(handle)handles.set(row.id,handle);await flush();window.dispatchEvent(new CustomEvent('workbench-document-open',{detail:row.id}))}catch(error){if(previous&&previousBytes)await load(previous,previousBytes);await command(row.id,'remove');throw error}
 }
 async function openNative(roleId:string,path?:string){const value=await documentDesktop()?.openDocument?.(path);if(value)await importBytes(value.name,new Uint8Array(value.bytes).buffer,roleId,value.handle)}
 async function save(saveAs:boolean){
  const row=state.active;if(!row)return;await flush();const data=await rpc<{bytes:ArrayBuffer;revision:number}>('save'),native=documentDesktop()
  if(native?.saveDocument){const result=await native.saveDocument({handle:handles.get(row.id),name:row.filename,bytes:data.bytes,saveAs});if(!result)return;handles.set(row.id,result.handle)}
  else{const url=URL.createObjectURL(new Blob([data.bytes],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'})),a=document.createElement('a');a.href=url;a.download=row.filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000)}
  const current=await rpc<DocumentContext>('context');emit({dirty:current.revision!==data.revision,error:''})
 }
 async function command(id:string,action:string,value?:unknown){if(id===state.active?.id)await flush();const row=await documentApi<DocumentRecord>('command',{id,action,value});upsert(row);if(row.removedAt)roleDocuments.delete(row.roleId);if(id===state.active?.id)emit({active:row.removedAt?undefined:row,...(row.removedAt?{context:undefined}:{})})}
 window.addEventListener('beforeunload',event=>{if(state.active&&!state.draftSaved){event.preventDefault();event.returnValue=''}})
 setInterval(()=>{if(state.rows.some(r=>r.messages.some(m=>m.status==='running')))void refresh()},700)
 return {getSnapshot:()=>state,subscribe:(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn)}},refresh,rpc,flush,open:(id:string)=>sequence(()=>open(id)),importBytes:(name:string,data:ArrayBuffer,roleId:string)=>sequence(()=>importBytes(name,data,roleId)),openNative:(roleId:string,path?:string)=>sequence(()=>openNative(roleId,path)),save:(saveAs:boolean)=>sequence(()=>save(saveAs)),command:(id:string,action:string,value?:unknown)=>sequence(()=>command(id,action,value)),fail,
  draft:(key:string)=>drafts.get(key)??emptyDraft,updateDraft:(key:string,patch:Partial<DocumentDraft>)=>{drafts.set(key,{...(drafts.get(key)??emptyDraft),...patch});emit({})},
  activateRole:(roleId:string)=>sequence(async()=>{if(state.active?.roleId===roleId)return;await flush();const id=roleDocuments.get(roleId);if(id&&state.rows.some(row=>row.id===id))await open(id);else emit({active:undefined,context:undefined,dirty:false,draftSaved:false,error:''})}),
  newDocument:()=>sequence(async()=>{await flush();roleDocuments.clear();emit({conversationId:crypto.randomUUID(),active:undefined,context:undefined,dirty:false,draftSaved:false,error:''})}),
  ask:(input:{question:string;model:string;scope:string;chapter?:number;mode?:'ask'|'revise';useKnowledge?:boolean})=>sequence(async()=>{await flush();const active=state.active;if(!active)throw Error('请先打开文档');const context=await rpc<DocumentContext>('context');await documentApi('ask',{...input,id:active.id,context,storageRevision:active.revision});await refresh()}),
  adopt:(proposalId:string)=>sequence(async()=>{await flush();const active=state.active;if(!active)throw Error('请先打开文档');const proposal=await documentApi<import('../../packages/dsh-capabilities/src/core/documents-model.ts').DocumentProposal>('adopt-check',{id:active.id,proposalId});await rpc('replace',{before:proposal.before,after:proposal.after,paraId:proposal.paraId,revision:proposal.editorRevision});await flush();await documentApi('adopted',{id:active.id,proposalId});await refresh()}),
  undoAI:()=>sequence(async()=>{await rpc('undo-ai');await flush()}),
  async stop(){if(state.active){await documentApi('stop',{id:state.active.id});await refresh()}},
  mount(node:HTMLElement){ensureFrame();node.appendChild(frame!);return()=>{holder!.appendChild(frame!)}},
  clearError:()=>emit({error:''}),notify:()=>refresh(),hasNative:(id:string)=>handles.has(id),
 }
}
declare global{interface Window{workbenchDocuments?:ReturnType<typeof createDocumentClient>}}
export const documentsClient=()=>window.workbenchDocuments??=createDocumentClient()
