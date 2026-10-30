// @vitest-environment jsdom
import React,{act} from 'react'
import {createRoot} from 'react-dom/client'
import {afterEach,expect,it,vi} from 'vitest'
import {createDocumentClient} from '../../../shared/client/documents-client.ts'
import {DocumentAssistant} from '../src/client/DocumentAssistant.tsx'
import {KnowledgeSources} from '../src/client/KnowledgeSources.tsx'
import {documentCapability,documentRole} from '../../dsh-capabilities/src/core/documents-model.ts'
import {initialState} from '../../dsh-capabilities/src/core/model.ts'
import {roleCapabilityModes} from '../src/client/role-capability-modes.ts'

afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllGlobals();document.body.innerHTML='';delete window.workbenchDocuments})
it('keeps the existing shared knowledge list append, remove and undo behavior',async()=>{
 const h=harness();(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true
 Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value(){this.setAttribute('open','')}})
 Object.defineProperty(HTMLDialogElement.prototype,'close',{configurable:true,value(){this.removeAttribute('open')}})
 function ExistingModule(){const [scope,setScope]=React.useState<any>({providerId:'test',collectionIds:['guide']});return <KnowledgeSources product="" scope={scope} allowed disabled={false} onChange={async value=>setScope(value)}/>}
 const root=createRoot(h.host);await act(async()=>root.render(<ExistingModule/>))
 await act(async()=>h.host.querySelector<HTMLButtonElement>('[aria-label="添加知识库"]')!.click())
 expect(document.querySelector<HTMLInputElement>('dialog input[type=checkbox]')!.disabled).toBe(true)
 await act(async()=>document.querySelectorAll<HTMLInputElement>('dialog input[type=checkbox]')[1]!.click())
 await act(async()=>Array.from(document.querySelectorAll<HTMLButtonElement>('dialog button')).find(b=>b.textContent==='确认加入')!.click())
 expect(h.host.querySelectorAll('[aria-label^="移除引用"]')).toHaveLength(2)
 await act(async()=>h.host.querySelector<HTMLButtonElement>('[aria-label="移除引用：审核规范"]')!.click())
 expect(h.host.querySelectorAll('[aria-label^="移除引用"]')).toHaveLength(1)
 await act(async()=>Array.from(h.host.querySelectorAll<HTMLButtonElement>('button')).find(b=>b.textContent==='撤销')!.click())
 expect(h.host.querySelectorAll('[aria-label^="移除引用"]')).toHaveLength(2)
 await act(async()=>root.unmount())
})
it('saves only confirmed knowledge choices, clears explicit selection and preserves the unsent question',async()=>{
 const h=harness();window.workbenchDocuments=h.client;(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true
 Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value(){this.setAttribute('open','')}})
 Object.defineProperty(HTMLDialogElement.prototype,'close',{configurable:true,value(){this.removeAttribute('open')}})
 await h.client.importBytes('范围.docx',new TextEncoder().encode('原文').buffer,'r1');h.client.updateDraft('doc-0',{question:'未发送内容'})
 const root=createRoot(h.host);await act(async()=>root.render(<DocumentAssistant roleId="r1" loadModels={async()=>[]}/>))
 const click=async(label:string,container:ParentNode=h.host)=>act(async()=>{Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(b=>b.textContent?.trim().replace(/\s*›$/,'')===label)!.click()})
 const checkbox=(name:string)=>document.querySelector<HTMLInputElement>('dialog input[aria-label="'+name+'"]')!
 await click('选择资料');await act(async()=>checkbox('验收材料').click());await click('取消',document)
 expect(h.rows[0].knowledgeScope).toBeUndefined()
 await click('选择资料');await act(async()=>checkbox('验收材料').click());await click('保存',document)
 expect(h.rows[0].knowledgeScope.collectionIds).toEqual(['guide','trial']);expect(h.client.draft('doc-0').question).toBe('未发送内容')
 await act(async()=>h.host.querySelector<HTMLInputElement>('[aria-label="结合外部知识库"]')!.click());expect(h.client.draft('doc-0').useKnowledge).toBe(true)
 await click('选择资料');await act(async()=>{checkbox('审核规范').click();checkbox('验收材料').click()});await click('保存',document)
 expect(h.rows[0].knowledgeScope).toBeNull();expect(h.client.draft('doc-0').useKnowledge).toBe(false);expect(h.host.querySelector<HTMLInputElement>('[aria-label="结合外部知识库"]')!.disabled).toBe(true)
 await act(async()=>root.unmount())
})
it('allows switching off knowledge after the source or permission becomes unavailable',async()=>{
 const h=harness();(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true
 const change=vi.fn(),root=createRoot(h.host)
 await act(async()=>root.render(<KnowledgeSources compact product="" allowed={false} disabled={false} enabled onEnabledChange={change} onChange={async()=>{}}/>))
 const toggle=h.host.querySelector<HTMLInputElement>('[aria-label="结合外部知识库"]')!;expect(toggle.disabled).toBe(false)
 await act(async()=>toggle.click());expect(change).toHaveBeenCalledWith(false)
 await act(async()=>root.unmount())
})
it('isolates document history in new conversations and restores the old conversation on reopen',async()=>{
 const h=harness(),bytes=new TextEncoder().encode('正文').buffer
 await h.client.importBytes('同一对话甲.docx',bytes,'r1');const first=h.client.getSnapshot().conversationId
 await h.client.importBytes('同一对话乙.docx',bytes,'r1')
 expect(h.rows[0].conversationId).toBe(first);expect(h.rows[1].conversationId).toBe(first)
 await h.client.newDocument();await h.client.activateRole('r1')
 expect(h.client.getSnapshot().active).toBeUndefined();expect(h.client.getSnapshot().conversationId).not.toBe(first)
 await h.client.importBytes('新对话.docx',bytes,'r1');expect(h.rows[2].conversationId).not.toBe(first)
 await h.client.open('doc-0');expect(h.client.getSnapshot().conversationId).toBe(first)
 window.workbenchDocuments=h.client;(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true
 const root=createRoot(h.host);await act(async()=>root.render(<DocumentAssistant roleId="r1" loadModels={async()=>[]}/>))
 await act(async()=>h.host.querySelector<HTMLButtonElement>('[aria-controls="document-history"]')!.click())
 expect(h.host.querySelector('#document-history')?.textContent).toContain('同一对话乙')
 expect(h.host.querySelector('#document-history')?.textContent).not.toContain('新对话.docx')
 await act(async()=>h.host.querySelector<HTMLButtonElement>('[aria-label="移除历史记录：同一对话甲.docx"]')!.click())
 expect(h.client.getSnapshot().active).toBeUndefined()
 expect(h.host.querySelector('#document-history')?.textContent).not.toContain('同一对话甲')
 expect(h.host.querySelector('#document-history')?.textContent).toContain('同一对话乙')
 await act(async()=>root.unmount())
})
it('opens history while a document is active and regenerates the chosen answer without clearing the draft',async()=>{
 const h=harness();window.workbenchDocuments=h.client;(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true
 await h.client.importBytes('历史文档.docx',new TextEncoder().encode('正文').buffer,'r1')
 h.rows[0].messages=[{id:'u1',role:'user',text:'第一个问题',createdAt:'2026-10-13T00:00:00Z'},{id:'a1',role:'assistant',text:'第一个回答',createdAt:'2026-10-13T00:00:01Z',status:'done'},{id:'u2',role:'user',text:'另一个问题',createdAt:'2026-10-13T00:00:02Z'}]
 await h.client.refresh();h.client.updateDraft('doc-0',{question:'未发送的草稿'})
 const ask=vi.spyOn(h.client,'ask').mockResolvedValue(undefined),root=createRoot(h.host)
 await act(async()=>root.render(<DocumentAssistant roleId="r1" loadModels={async()=>[]}/>))
 expect(h.host.textContent).not.toContain('重试上一问')
 const regenerate=h.host.querySelectorAll<HTMLButtonElement>('[aria-label="重新生成"]')
 expect(regenerate).toHaveLength(3)
 await act(async()=>regenerate[1]!.click())
 expect(ask).toHaveBeenCalledWith(expect.objectContaining({question:'第一个问题'}))
 expect(h.host.querySelector('textarea')?.value).toBe('未发送的草稿')
 await act(async()=>h.host.querySelector<HTMLButtonElement>('[aria-controls="document-history"]')!.click())
 expect(h.host.querySelector('#document-history')?.textContent).toContain('2 个问题')
 expect(h.host.querySelector('#document-history')?.textContent).toContain('历史文档.docx')
 const open=vi.spyOn(h.client,'open')
 await act(async()=>h.host.querySelector<HTMLButtonElement>('#document-history [aria-current=true]')!.click())
 expect(open).toHaveBeenCalledWith('doc-0');expect(h.host.querySelector('#document-history')).toBeNull()
 expect(h.host.textContent).toContain('第一个回答')
 await act(async()=>root.unmount())
})
it('keeps document content collapsed and switches reading tabs independently of the composer',async()=>{
 const h=harness();window.workbenchDocuments=h.client;(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true
 await h.client.importBytes('布局.docx',new TextEncoder().encode('实际导入的正文').buffer,'r1')
 const root=createRoot(h.host)
 await act(async()=>root.render(<DocumentAssistant roleId="r1" loadModels={async()=>[]}/>))
 expect(h.host.querySelector<HTMLElement>('#document-reading')!.hidden).toBe(true)
 await act(async()=>h.host.querySelector<HTMLButtonElement>('[aria-controls="document-reading"]')!.click())
 expect(h.host.querySelector<HTMLElement>('#document-reading')!.hidden).toBe(false)
 const pane=()=>h.host.querySelector('[role=tabpanel]')!
 expect(pane().textContent).toContain('实际导入的正文')
 const tab=(name:string)=>Array.from(h.host.querySelectorAll<HTMLButtonElement>('[role=tab]')).find(b=>b.textContent===name)!
 await act(async()=>tab('选区').click());expect(pane().textContent).toContain('在左侧文档中选择文字')
 await act(async()=>tab('大纲').click());expect(pane().textContent).toContain('暂无可识别的标题大纲')
 await act(async()=>tab('原文').click());expect(pane().textContent).toContain('实际导入的正文')
 expect(h.host.querySelector('[aria-label="文档问答"] textarea')).not.toBeNull()
 expect(h.host.querySelector('[role=tab][aria-selected=true]')?.textContent).toBe('原文')
 await act(async()=>root.unmount())
})
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
  else if(path.startsWith('knowledge')){const id=new URL(input,location.origin).searchParams.get('id'),row=rows.find(r=>r.id===id);data={configured:true,verified:false,label:'外部知识库',message:'连接待验证',allowed:true,scope:row?.knowledgeScope===undefined?{providerId:'test',collectionIds:['guide']}:row.knowledgeScope}}
  else if(input==='/api/capabilities/knowledge/status')data={available:true,configured:true,verified:false,moduleEnabled:true,providerId:'test',collections:[{id:'guide',name:'审核规范'},{id:'trial',name:'验收材料'}]}
  else if(path==='create'){const body=JSON.parse(init.body);data={...body,id:'doc-'+rows.length,title:body.filename,revision:0,messages:[],updatedAt:new Date().toISOString()};rows.push(data)}
  else if(path.startsWith('file/')){const row=rows.find(r=>path.includes(r.id));if(init?.method==='PUT'){if(hold){const wait=hold;hold=undefined;await wait}row.revision++;row.bytes=init.body;data=row}else return {ok:true,arrayBuffer:async()=>row.bytes}}
  else if(path==='ask'){data={id:'answer'}}
  else if(path==='command'){const body=JSON.parse(init.body),row=rows.find(r=>r.id===body.id);if(body.action==='knowledge-scope')row.knowledgeScope=body.value;else row.removedAt=new Date().toISOString();data=row}
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
