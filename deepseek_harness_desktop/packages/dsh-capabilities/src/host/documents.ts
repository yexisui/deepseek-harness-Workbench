import { forkIdentity } from './conversation-fork.ts'
import {noDocumentKnowledge,type DocumentKnowledgeAdapter} from '../core/document-knowledge.ts'
import {DocumentAI,type DocumentModel} from './document-ai.ts'
import {randomUUID} from 'node:crypto'
import {mkdir,readFile,writeFile,rename,unlink} from 'node:fs/promises'
import {join} from 'node:path'
import type {IncomingMessage,ServerResponse} from 'node:http'
import type {State,Action} from '../core/model.ts'
import type {DocumentRecord} from '../core/documents-model.ts'
import {allowedActions} from '../core/policy.ts'
import {InputError,text} from '../core/validation.ts'
import {json,readBody} from './http.ts'
import {documentAssets} from './document-assets.ts'
import {parseKnowledgeScope,KNOWLEDGE_CAPABILITY_ID} from '../core/knowledge-module.ts'
export const MAX_DOCUMENT_BYTES=40*1024*1024
const uuid=/^[0-9a-f-]{36}$/i
export class DocumentsService {
 private tail:Promise<unknown>=Promise.resolve()
 private rows:DocumentRecord[]=[]
 readonly ai:DocumentAI
 constructor(readonly root:string,readonly state:()=>State,model:DocumentModel=async()=>{throw Error('模型服务尚未就绪')},readonly knowledge:()=>DocumentKnowledgeAdapter|undefined=()=>undefined){this.ai=new DocumentAI(root,id=>this.get(id),()=>this.exclusive(()=>this.persist()),(row,revise,knowledge)=>{this.authorize(row.roleId,row.roleVersion,revise?'revise-document':'ask-document');if(knowledge){this.authorize(row.roleId,row.roleVersion,'search-knowledge');const gateway=this.knowledge() as import('./knowledge-access.ts').KnowledgeAccess|undefined;gateway?.assert?.({taskId:row.id,roleId:row.roleId,roleVersion:row.roleVersion,authorityAt:Date.parse(row.createdAt)})}},model,(id,revision)=>this.exclusive(async()=>{if(this.get(id).revision!==revision)throw new InputError('工作副本已更新，请重新生成建议',409);return this.bytes(id)}),knowledge)}
 async fork(id:string,target:string){return this.exclusive(async()=>{
   const row=forkIdentity(this.get(id),target),existing=this.rows.find(r=>r.id===target) as (DocumentRecord&{forkedFrom?:string})|undefined
   if(existing){if(existing.forkedFrom!==id)throw new InputError('分叉标识已占用');return structuredClone(existing)}
   row.conversationId=target;for(const m of row.messages)if(m.status==='running')m.status='stopped'
   const bytes=await this.bytes(id);const directory=join(this.root,target)
   try{await mkdir(directory);await writeFile(join(directory,'revision-'+row.revision+'.docx'),bytes);this.rows.push(row);await this.persist()}catch(e){this.rows=this.rows.filter(r=>r.id!==target);await import('node:fs/promises').then(fs=>fs.rm(directory,{recursive:true,force:true}));throw e}return structuredClone(row)
 })}

 async init(){await mkdir(this.root,{recursive:true});try{this.rows=JSON.parse(await readFile(join(this.root,'index.json'),'utf8'))}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e}await this.ai.init(this.rows)}
 list(){return structuredClone(this.rows.filter(r=>!r.removedAt))}
 get(id:string){const row=this.rows.find(r=>r.id===id&&!r.removedAt);if(!row||!uuid.test(id))throw new InputError('文档会话不存在',404);return row}
 authorize(roleId:string,roleVersion:number,action:Action){const state=this.state(),role=state.roles.find(r=>r.id===roleId),version=role?.versions.find(v=>v.version===roleVersion);if(!version||role?.removedAt||role?.archivedAt||!allowedActions(state,roleId,version).includes(action))throw new InputError('当前岗位未启用此文档动作，请到岗位与能力中心检查关联组件',403)}
 private async persist(){const target=join(this.root,'index.json'),temp=target+'.tmp';await writeFile(temp,JSON.stringify(this.rows));await rename(temp,target)}
 exclusive<T>(fn:()=>Promise<T>){const p=this.tail.then(fn);this.tail=p.catch(()=>{});return p}
 async create(body:Record<string,unknown>){return this.exclusive(async()=>{
  const roleId=text(body.roleId,'岗位',120,true),role=this.state().roles.find(r=>r.id===roleId),roleVersion=role?.versions.at(-1)?.version
  if(!roleVersion)throw new InputError('岗位不存在');this.authorize(roleId,roleVersion,'edit-document')
  const filename=text(body.filename,'文档名称',240,true);if(!filename.toLowerCase().endsWith('.docx'))throw new InputError('请打开 .docx 文件；旧版 .doc 需先另存为 .docx')
  const now=new Date().toISOString(),row:DocumentRecord={id:randomUUID(),conversationId:typeof body.conversationId==='string'?text(body.conversationId,'对话',120,true):randomUUID(),title:filename.replace(/\.docx$/i,''),filename,roleId,roleVersion,createdAt:now,updatedAt:now,revision:0,messages:[]}
  await mkdir(join(this.root,row.id));this.rows.push(row);try{await this.persist()}catch(e){this.rows.pop();throw e}return structuredClone(row)
 })}
 async bytes(id:string){const row=this.get(id);try{return await readFile(join(this.root,id,`revision-${row.revision}.docx`))}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;return readFile(join(this.root,id,'current.docx'))}}
 async close(){await this.ai.close();await this.tail}
 async upload(id:string,expected:number,req:IncomingMessage){
  const chunks:Buffer[]=[];let size=0
  for await(const chunk of req){size+=chunk.length;if(size>MAX_DOCUMENT_BYTES)throw new InputError('文档超过 40 MB，请先精简图片',413);chunks.push(Buffer.from(chunk))}
  const bytes=Buffer.concat(chunks);if(bytes.length<4||bytes.readUInt32LE(0)!==0x04034b50)throw new InputError('文档不是有效的 DOCX 文件')
  return this.exclusive(async()=>{const row=this.get(id);if(expected!==row.revision)throw new InputError('文档工作副本已更新，请重新打开后再保存',409)
   const previous=row.revision,updatedAt=row.updatedAt,next=previous+1,target=join(this.root,id,`revision-${next}.docx`),temp=target+'.tmp';await writeFile(temp,bytes);await rename(temp,target);row.revision=next;row.updatedAt=new Date().toISOString();try{await this.persist()}catch(e){row.revision=previous;row.updatedAt=updatedAt;throw e}await unlink(join(this.root,id,`revision-${previous}.docx`)).catch(()=>{});return structuredClone(row)
  })
 }
 knowledgeScope(row:DocumentRecord){return row.knowledgeScope===undefined?this.state().roles.find(r=>r.id===row.roleId)?.versions.find(v=>v.version===row.roleVersion)?.capabilities.find(b=>b.capabilityId===KNOWLEDGE_CAPABILITY_ID)?.knowledgeScope:row.knowledgeScope}
 async knowledgeStatus(id?:string){
  const status=await this.knowledge()?.status()??noDocumentKnowledge
  if(!id)return status
  const row=this.get(id);let allowed=true
  try{this.authorize(row.roleId,row.roleVersion,'search-knowledge');(this.knowledge() as import('./knowledge-access.ts').KnowledgeAccess|undefined)?.assert?.({taskId:row.id,roleId:row.roleId,roleVersion:row.roleVersion,authorityAt:Date.parse(row.createdAt)})}catch{allowed=false}
  return {...status,allowed,scope:this.knowledgeScope(row)??null}
 }
 async command(id:string,action:string,value:unknown){return this.exclusive(async()=>{const row=this.get(id);
  if(action==='knowledge-scope'){
   this.authorize(row.roleId,row.roleVersion,'edit-document')
   if(this.ai.activities().some(item=>item.id===id))throw new InputError('请等待当前回答完成后调整资料范围',409)
   const scope=value==null?null:parseKnowledgeScope(value)
   if(scope){this.authorize(row.roleId,row.roleVersion,'search-knowledge');(this.knowledge() as import('./knowledge-access.ts').KnowledgeAccess|undefined)?.assert?.({taskId:row.id,roleId:row.roleId,roleVersion:row.roleVersion,authorityAt:Date.parse(row.createdAt)})}
   const previous=row.knowledgeScope,updatedAt=row.updatedAt;row.knowledgeScope=scope;row.updatedAt=new Date().toISOString()
   try{await this.persist()}catch(error){row.knowledgeScope=previous;row.updatedAt=updatedAt;throw error}return structuredClone(row)
  }
  if(action==='rename')row.title=text(value,'名称',120,true);else if(action==='remove'){this.ai.stop(id);row.removedAt=new Date().toISOString();}else throw new InputError('未知文档操作');row.updatedAt=new Date().toISOString();await this.persist();return structuredClone(row)})}
 async routes(req:IncomingMessage,res:ServerResponse){
  const url=new URL(req.url!,'http://localhost'),route=url.pathname,base='/api/capabilities/documents/'
  if(await documentAssets(req,res,route))return
  const op=route.slice(base.length)
  if(op==='knowledge'&&req.method==='GET')return json(res,200,await this.knowledgeStatus(url.searchParams.get('id')||undefined))
  if(op==='list'&&req.method==='GET')return json(res,200,this.list())
  if(op.startsWith('file/')&&req.method==='GET'){const bytes=await this.bytes(op.slice(5));res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.wordprocessingml.document');res.setHeader('Cache-Control','no-store');res.end(bytes);return}
  if(op.startsWith('file/')&&req.method==='PUT')return json(res,200,await this.upload(op.slice(5),Number(url.searchParams.get('revision')),req))
  if(req.method!=='POST')throw new InputError('文档接口不存在',404)
  const body=await readBody(req)
  if(op==='ask')return json(res,202,await this.ai.ask(body))
  if(op==='adopt-check'||op==='adopted')return json(res,200,await this.exclusive(async()=>{const row=this.get(text(body.id,'文档',36,true));this.authorize(row.roleId,row.roleVersion,'revise-document');const proposal=row.messages.find(m=>m.proposal?.id===body.proposalId)?.proposal;if(!proposal||proposal.status!=='ready')throw new InputError('修改建议不存在或已经采用');if(op==='adopt-check'){if(proposal.storageRevision!==row.revision)throw new InputError('生成建议后文档已改变，请重新生成',409);return proposal}proposal.status='adopted';await this.persist();return proposal}))
  if(op==='stop')return json(res,200,this.ai.stop(text(body.id,'文档',36,true)))
  if(op==='create')return json(res,201,await this.create(body))
  if(op==='command')return json(res,200,await this.command(text(body.id,'文档',36,true),text(body.action,'动作',20,true),body.value))
  throw new InputError('文档接口不存在',404)
 }
}
