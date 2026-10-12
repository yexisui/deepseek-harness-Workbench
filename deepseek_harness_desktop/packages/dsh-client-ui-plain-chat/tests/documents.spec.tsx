// @vitest-environment jsdom
import React,{act} from 'react'
import {createRoot} from 'react-dom/client'
import {afterEach,expect,it,vi} from 'vitest'
import {createDocumentClient} from '../../../shared/client/documents-client.ts'
import {DocumentAssistant} from '../src/client/DocumentAssistant.tsx'
import {documentCapability,documentRole} from '../../dsh-capabilities/src/core/documents-model.ts'
import {initialState} from '../../dsh-capabilities/src/core/model.ts'
import {roleCapabilityModes} from '../src/client/role-capability-modes.ts'

afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllGlobals();document.body.innerHTML='';delete window.workbenchDocuments})
function harness(){
 vi.useFakeTimers()
 const client=createDocumentClient(),host=document.createElement('div');document.body.append(host);client.mount(host)
 const frame=host.querySelector('iframe')!,channel=new URL(frame.src).searchParams.get('channel'),rows:any[]=[],calls:any[]=[]
 let revision=0,hold:Promise<void>|undefined,loaded=''
 const message=(type:string,value:unknown)=>window.dispatchEvent(new MessageEvent('message',{source:frame.contentWindow,origin:location.origin,data:{source:'workbench-document',channel,type,value}}))
 const context=()=>({revision,selection:'',paragraphs:[{paraId:'p1',text:loaded}],outline:[],editable:true,parseError:null,fontFailures:[]})
 vi.spyOn(frame.contentWindow!,'postMessage').mockImplementation((request:any)=>{calls.push(request);let result:any
  if(request.op==='load'){loaded=new TextDecoder().decode(request.args.bytes);revision=0;result=context()}
  else if(request.op==='save')result={bytes:new TextEncoder().encode(loaded).buffer,revision}
  else result=context()
  queueMicrotask(()=>message('result',{id:request.id,ok:true,result}))
 })
 vi.stubGlobal('fetch',vi.fn(async(input:string,init?:any)=>{
  const path=input.replace('/api/capabilities/documents/','');let data:any
  if(path==='list')data=rows
  else if(path==='knowledge')data={configured:false,verified:false,label:'外部资料库',message:'接口已预留，暂未接入服务。'}
  else if(path==='create'){const body=JSON.parse(init.body);data={...body,id:'doc-'+rows.length,title:body.filename,revision:0,messages:[],updatedAt:new Date().toISOString()};rows.push(data)}
  else if(path.startsWith('file/')){const row=rows.find(r=>path.includes(r.id));if(init?.method==='PUT'){if(hold){const wait=hold;hold=undefined;await wait}row.revision++;row.bytes=init.body;data=row}else return {ok:true,arrayBuffer:async()=>row.bytes}}
  else if(path==='ask'){data={id:'answer'}}
  else throw Error('Unexpected API '+path)
  return {ok:true,json:async()=>structuredClone(data)}
 }))
 message('ready',context())
 return {client,host,calls,rows,message,hold:(p:Promise<void>)=>hold=p,edit:(text:string)=>{loaded=text;revision++;message('change',{revision})}}
}
it('retains separate role documents and unsent questions across navigation; new-document preserves the saved history',async()=>{
 const h=harness(),bytes=(s:string)=>new TextEncoder().encode(s).buffer
 await h.client.importBytes('甲.docx',bytes('甲的原文'),'r1');h.client.updateDraft('doc-0',{question:'未发送的问题',mode:'revise'})
 await h.client.activateRole('r2');expect(h.client.getSnapshot().active).toBeUndefined()
 await h.client.importBytes('乙.docx',bytes('乙的原文'),'r2')
 await h.client.activateRole('r1');expect(h.client.getSnapshot().context?.paragraphs[0]?.text).toBe('甲的原文');expect(h.client.draft('doc-0').question).toBe('未发送的问题');expect(h.client.draft('doc-1').question).toBe('')
 await h.client.newDocument();expect(h.client.getSnapshot().active).toBeUndefined();expect(h.client.getSnapshot().rows).toHaveLength(2)
 await h.client.open('doc-0');expect(h.client.getSnapshot().active?.filename).toBe('甲.docx')
})
it('does not mark edits made during an in-flight save as saved and queues the next open after they are retained',async()=>{
 const h=harness();await h.client.importBytes('甲.docx',new TextEncoder().encode('原文').buffer,'r1')
 let release!:()=>void;h.hold(new Promise(resolve=>release=resolve));h.edit('第一处编辑');const saving=h.client.flush()
 await vi.advanceTimersByTimeAsync(0);h.edit('保存过程中又输入');release();await saving
 expect(h.client.getSnapshot().draftSaved).toBe(false)
 await h.client.newDocument();expect(new TextDecoder().decode(h.rows[0].bytes)).toBe('保存过程中又输入')
})
it('uses the shared role catalog and keeps its working draft when the assistant view unmounts',async()=>{
 const h=harness();window.workbenchDocuments=h.client;(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true
 const state=initialState();state.capabilities.push(documentCapability('now'));const role=documentRole('now');state.roles.push(role)
 expect(roleCapabilityModes(state,role.versions[0]!).map(v=>v.mode)).toContain('document')
 h.client.updateDraft('role:'+role.id,{question:'保留此问题',model:'my-model'})
 const root=createRoot(h.host)
 await act(async()=>root.render(<DocumentAssistant roleId={role.id} loadModels={async()=>[{id:'my-model',name:'已有模型'}]}/>))
 expect(h.host.querySelector('textarea')?.value).toBe('保留此问题');expect(h.host.textContent).toContain('打开 Word');expect(h.host.querySelector('[role=separator]')).not.toBeNull()
 await act(async()=>root.unmount());expect(h.client.draft('role:'+role.id).question).toBe('保留此问题')
})
