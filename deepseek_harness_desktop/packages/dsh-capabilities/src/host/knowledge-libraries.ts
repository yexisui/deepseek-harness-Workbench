import {createHash,randomUUID} from 'node:crypto'
import {mkdir,readFile,writeFile,readdir,realpath,stat,lstat,unlink} from 'node:fs/promises'
import {join,extname,relative,isAbsolute,basename} from 'node:path'
import type {KnowledgeProvider,KnowledgeRequest} from '../core/knowledge.ts'
import type {Library,LibraryDocument,RemoteConnection,DocumentPreview} from '../core/knowledge-library.ts'
import type {EmbeddingProfile,Embeddings} from './knowledge-embedding.ts'
import type {VectorEngine} from './knowledge-milvus.ts'
import {inspectDocx} from './requirement-docx.ts'
import {InputError,text} from '../core/validation.ts'
import {replaceFile} from './replace-file.ts'

type Chunk={text:string;locator:string}
type Registry={id:string;legacyId?:string;revision:number;libraries:Library[]}
const digest=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex')
const now=()=>new Date().toISOString()
const supported=new Set(['.md','.txt','.docx','.pdf'])
export function splitKnowledge(parts:Chunk[],size=900,overlap=100):Chunk[]{
 const chunks:Chunk[]=[]
 for(const part of parts){const value=part.text.trim();let heading=part.locator
  for(const block of value.split(/\n(?=#{1,6}\s)/)){const title=block.match(/^#{1,6}\s+([^\n]+)/)?.[1];if(title)heading=title.trim().slice(0,240)
   for(let i=0;i<block.length;i+=size-overlap){const text=block.slice(i,i+size).trim();if(text)chunks.push({text,locator:heading});if(i+size>=block.length)break}
  }
 }return chunks
}
/** Stable public library IDs. All consumers retain the existing knowledge boundary. */
export class KnowledgeLibraries implements KnowledgeProvider {
 private state:Registry={id:'workbench-knowledge',revision:0,libraries:[]}
 private running=new Map<string,{controller:AbortController;promise:Promise<void>}>()
 private tail:Promise<unknown>=Promise.resolve()
 private shutting=false
 constructor(private root:string,private engine:VectorEngine,private embeddings:Embeddings,private legacy:()=>KnowledgeProvider|undefined,private secrets:()=>RemoteConnection[],private saveSecrets:(connections:RemoteConnection[])=>Promise<void>){}
 get id(){return this.state.id}
 get hasLibraries(){return this.state.libraries.length>0}
 cancelAll(){for(const r of this.running.values())r.controller.abort()}
 async init(){await mkdir(this.root,{recursive:true});try{this.state=JSON.parse(await readFile(join(this.root,'libraries.json'),'utf8'))}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;const legacy=this.legacy();this.state={id:legacy?.id||'workbench-knowledge',legacyId:legacy?.id,revision:0,libraries:[]};await this.persist()}
  let changed=false;for(const l of this.state.libraries)if(l.job?.state==='running'){l.job.state='interrupted';l.job.message='上次处理已中断，点击更新索引继续；已完成结果保留。';changed=true}if(changed)await this.persist()
 }
 private persist(){const snapshot=JSON.stringify(this.state),target=join(this.root,'libraries.json');const run=this.tail.then(async()=>{const temp=target+'.'+randomUUID()+'.tmp';await writeFile(temp,snapshot,'utf8');try{await replaceFile(temp,target)}finally{await unlink(temp).catch(()=>{})}});this.tail=run.catch(()=>{});return run}
 private async changed(){this.state.revision++;await this.persist()}
 view(){const value=structuredClone({revision:this.state.revision,libraries:this.state.libraries});for(const l of value.libraries)if(this.running.has(l.id)&&l.job)l.job.state='running';return value}
 async wait(id:string){await this.running.get(id)?.promise}
 library(id:unknown){const l=this.state.libraries.find(v=>v.id===id);if(!l)throw new InputError('知识库不存在',404);return l}
 private idle(l:Library){if(this.running.has(l.id))throw new InputError('此知识库正在处理，请先取消或等待完成',409)}
 private connection(){return {uri:join(this.root,'vectors.db')}}
 private async parse(name:string,bytes:Buffer):Promise<Chunk[]>{
  const ext=extname(name).toLowerCase();if(!supported.has(ext))throw new InputError('请选择MD、TXT、DOCX或含文本PDF文件')
  if(bytes.length>40*1024*1024)throw new InputError('单个资料超过40 MB，请拆分后导入',413)
  if(ext==='.docx'){
   const slots=inspectDocx(bytes).filter(s=>s.text.trim()),parts:Chunk[]=[],rows=new Map<string,{cells:Map<number,string[]>;table:string;locator:string}>();let heading='Word正文'
   for(const s of slots){
    if(s.heading)heading=s.text.trim().slice(0,200)
    const part=s.part==='word/document.xml'?'正文':/header/.test(s.part)?'页眉':'页脚'
    if(s.table){const table=s.part+':'+s.table,key=table+':'+s.row;let row=rows.get(key);if(!row){row={cells:new Map(),table,locator:`${heading} · ${part}表${s.table}第${s.row}行`};rows.set(key,row)}const cell=row.cells.get(s.cell!)||[];cell.push(s.text);row.cells.set(s.cell!,cell)}
    else parts.push({text:s.text,locator:`${heading} · ${part}第${s.index+1}段`})
   }
   const headers=new Map<string,string>()
   for(const row of rows.values()){const body=[...row.cells.values()].map(lines=>lines.join('；')).join(' | '),header=headers.get(row.table);if(!header)headers.set(row.table,body);parts.push({text:header?'表格首行：'+header+'\n本行：'+body:body,locator:row.locator})}
   return parts
  }
  if(ext==='.pdf')return this.engine.call<Chunk[]>({op:'pdf',data:bytes.toString('base64')})
  const value=new TextDecoder('utf-8',{fatal:true}).decode(bytes).replace(/^\uFEFF/,'');if(value.includes('\0'))throw new InputError('文件不是有效的文本资料');return [{text:value,locator:name}]
 }
 async create(body:Record<string,unknown>){
  const name=text(body.name,'知识库名称',120,true).trim(),modelRef=text(body.modelRef,'向量模型',300,true)
  await this.embeddings.profile(modelRef)
  const chunkSize=Number(body.chunkSize??900),overlap=Number(body.overlap??100)
  if(!Number.isInteger(chunkSize)||chunkSize<200||chunkSize>2000||!Number.isInteger(overlap)||overlap<0||overlap>=chunkSize/2)throw new InputError('分段设置无效：长度200—2000，重叠小于一半')
  const l:Library={id:'lib-'+randomUUID(),name,kind:'local',modelRef,documents:[],directories:[],chunkSize,overlap,createdAt:now(),updatedAt:now()}
  this.state.libraries.push(l);await this.changed();return structuredClone(l)
 }
 async previewDocument(id:unknown,documentId:unknown,start=0):Promise<DocumentPreview>{
  const l=this.library(id),d=l.documents.find(v=>v.id===documentId)
  if(!d||l.kind!=='local')throw new InputError('本地资料不存在',404)
  const offset=Number(start);if(!Number.isInteger(offset)||offset<0)throw new InputError('内容页码无效')
  const parts:Chunk[]=JSON.parse(await readFile(join(this.root,'texts',d.hash+'.json'),'utf8'))
  return {name:d.name,status:d.status,storedVectors:d.revision?d.chunks:0,dimension:l.dimension,pendingUpdate:d.hash!==d.activeHash,total:parts.length,offset,parts:parts.slice(offset,offset+20).map(p=>({locator:p.locator,text:p.text.slice(0,8000),truncated:p.text.length>8000}))}
 }
 async edit(body:Record<string,unknown>){const l=this.library(body.id);this.idle(l);if(body.revision!==this.state.revision)throw new InputError('知识库已更新，请刷新后重试',409);const modelRef=text(body.modelRef??l.modelRef,'向量模型',300,true);await this.embeddings.profile(modelRef);l.modelRef=modelRef;l.name=text(body.name??l.name,'名称',120,true);l.updatedAt=now();await this.changed();return this.view()}
 async upload(id:unknown,name:string,bytes:Buffer,folder?:string){
  const l=this.library(id);this.idle(l);if(l.kind!=='local')throw new InputError('接入的远端知识库为只读，请在原服务中添加资料')
  name=text(name.replace(/\\/g,'/'),'文件名',500,true);if(name.split('/').some(p=>!p||p==='.'||p==='..')||isAbsolute(name))throw new InputError('文件名无效')
  const hash=digest(bytes),existing=l.documents.find(d=>d.name===name&&d.folder===folder);if(existing?.hash===hash)return {skipped:true,document:existing}
  let parts:Chunk[];try{parts=await this.parse(name,bytes)}catch(e){if(e instanceof InputError)throw e;throw new InputError('文件解析失败，请检查文件格式或使用UTF-8文本')}
  if(!parts.some(p=>p.text.trim()))throw new InputError('文件没有可读取的正文；扫描件请先识别为文字')
  if(parts.reduce((n,p)=>n+p.text.length,0)>10_000_000)throw new InputError('文档正文过大，请拆分后导入')
  const doc:LibraryDocument={id:existing?.id||randomUUID(),name,hash,status:'pending',chunks:existing?.chunks||0,...(folder?{folder}:{}),...(existing?.revision?{revision:existing.revision,activeHash:existing.activeHash}:{})}
  await mkdir(join(this.root,'texts'),{recursive:true});await writeFile(join(this.root,'texts',hash+'.json'),JSON.stringify(parts),'utf8')
  if(existing)l.documents.splice(l.documents.indexOf(existing),1,doc);else l.documents.push(doc)
  l.updatedAt=now();await this.changed();return {skipped:false,document:doc}
 }
 async directory(id:unknown,path:string,remember=true){
  const l=this.library(id);this.idle(l);if(l.kind!=='local')throw new InputError('远端知识库不支持导入目录')
  const dir=await realpath(text(path,'资料目录',2000,true));if(!(await stat(dir)).isDirectory())throw new InputError('请选择有效文件夹')
  const files:string[]=[],skipped:string[]=[],failed:{name:string;error:string}[]=[]
  const walk=async(current:string)=>{for(const entry of await readdir(current,{withFileTypes:true})){if(entry.isSymbolicLink()||entry.name.startsWith('.')||['node_modules','runtime','external-tools'].includes(entry.name)){skipped.push(relative(dir,join(current,entry.name)));continue}const p=join(current,entry.name);if(entry.isDirectory())await walk(p);else if(supported.has(extname(p).toLowerCase()))files.push(p);else skipped.push(relative(dir,p));if(files.length>5000)throw new InputError('目录超过5000份资料，请分批选择子目录')}}
  await walk(dir);const seen=new Set<string>();let added=0,unchanged=0
  for(const p of files){const real=await realpath(p),rel=relative(dir,real);if(rel.startsWith('..')||isAbsolute(rel)||(await lstat(p)).isSymbolicLink())continue;const name=relative(dir,p).replace(/\\/g,'/');seen.add(name);try{if((await stat(real)).size>40*1024*1024)throw new InputError('文件超过40 MB');const result=await this.upload(id,name,await readFile(real),dir);result.skipped?unchanged++:added++}catch(e){failed.push({name,error:e instanceof InputError?e.message:'无法读取资料'})}}
  // A full successful scan defines deletions; parse failures keep the last indexed version.
  const removed=l.documents.filter(d=>d.folder===dir&&!seen.has(d.name));for(const d of removed)await this.removeDocument(id,d.id)
  if(remember&&!l.directories.includes(dir))l.directories.push(dir);await this.changed();return {added,unchanged,removed:removed.length,skipped:skipped.length,failed}
 }
 async removeDocument(id:unknown,documentId:unknown){const l=this.library(id);this.idle(l);const d=l.documents.find(v=>v.id===documentId);if(!d)throw new InputError('资料不存在',404);l.documents=l.documents.filter(v=>v!==d);l.updatedAt=now();await this.changed();if(l.collection)await this.engine.call({op:'delete',connection:this.connection(),collection:l.collection,filter:'document == '+JSON.stringify(d.id)}).catch(()=>{});return this.view()}
 async remove(id:unknown){const l=this.library(id);this.idle(l);this.state.libraries=this.state.libraries.filter(v=>v!==l);await this.changed();if(l.kind==='local'&&l.collection)await this.engine.call({op:'drop',connection:this.connection(),collection:l.collection}).catch(()=>{});if(l.kind==='milvus')await this.saveSecrets(this.secrets().filter(v=>v.id!==l.id));return this.view()}
 async start(id:unknown){const l=this.library(id);this.idle(l);if(l.kind!=='local')throw new InputError('远端库在原服务更新，此处只读引用');if(this.shutting)throw new InputError('工作台正在关闭',503)
  // Directory scans are explicit, never triggered by merely opening the page.
  const scans=[];for(const dir of [...l.directories])scans.push(await this.directory(id,dir,false))
  const profile=await this.embeddings.profile(l.modelRef);if(!l.documents.length)throw new InputError('请先添加资料')
  const controller=new AbortController();l.job={state:'running',total:l.documents.length,completed:0,message:'正在准备向量索引…',startedAt:now()};await this.changed()
  const promise=Promise.resolve().then(()=>this.build(l,profile,controller.signal)).finally(()=>this.running.delete(l.id));this.running.set(l.id,{controller,promise});return {...this.view(),scans}
 }
 cancel(id:unknown){const l=this.library(id);this.running.get(l.id)?.controller.abort();return {cancelled:l.id}}
 private async build(l:Library,profile:EmbeddingProfile,signal:AbortSignal){
  const rebuild=l.fingerprint!==profile.fingerprint,collection='kb_'+l.id.slice(4).replace(/-/g,'')+'_'+profile.fingerprint.slice(0,12),staged:LibraryDocument[]=[],oldCollection=l.collection;let failures=0
  try{
   for(const d of l.documents){signal.throwIfAborted();if(!rebuild&&d.hash===d.activeHash&&d.status==='ready'){l.job!.completed++;continue}
    l.job!.message='正在分段并向量化：'+d.name;await this.changed()
    try{const parts:Chunk[]=JSON.parse(await readFile(join(this.root,'texts',d.hash+'.json'),'utf8')),chunks=splitKnowledge(parts,l.chunkSize,l.overlap),vectors:number[][]=[]
     await mkdir(join(this.root,'embedding-cache'),{recursive:true})
     const pending:{index:number;key:string}[]=[]
     for(let i=0;i<chunks.length;i++){const key=digest(profile.fingerprint+'\n'+chunks[i]!.text);try{vectors[i]=JSON.parse(await readFile(join(this.root,'embedding-cache',key+'.json'),'utf8'))}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;pending.push({index:i,key})}}
     for(let start=0;start<pending.length;start+=16){signal.throwIfAborted();const batch=pending.slice(start,start+16),found=await this.embeddings.embed(profile,batch.map(x=>chunks[x.index]!.text),signal);for(let i=0;i<batch.length;i++){vectors[batch[i]!.index]=found[i]!;await writeFile(join(this.root,'embedding-cache',batch[i]!.key+'.json'),JSON.stringify(found[i]),'utf8')}}
     signal.throwIfAborted();const dimension=vectors[0]?.length;if(!dimension||vectors.some(v=>v.length!==dimension)||(!rebuild&&l.dimension&&dimension!==l.dimension))throw new InputError('模型向量维度发生变化，请更换配置后重新建立索引')
     l.job!.message='正在存入Milvus：'+d.name;await this.changed()
     await this.engine.call({op:'ensure',connection:this.connection(),collection,dimension},signal)
     const revision=randomUUID(),rows=chunks.map((c,i)=>({id:digest(revision+':'+i),document:d.id,revision,text:c.text,locator:c.locator,vector:vectors[i]}))
     for(let i=0;i<rows.length;i+=64)await this.engine.call({op:'insert',connection:this.connection(),collection,rows:rows.slice(i,i+64)},signal)
     signal.throwIfAborted();const next={...d,revision,activeHash:d.hash,chunks:chunks.length,status:'ready' as const,error:undefined}
     if(rebuild){staged.push(next)}else{const previous=d.revision;Object.assign(d,next);await this.changed();if(previous)await this.engine.call({op:'delete',connection:this.connection(),collection,filter:'revision == '+JSON.stringify(previous)},signal).catch(()=>{})}
     if(!l.dimension||rebuild)l.job!.message='已向量化：'+d.name
     if(rebuild)(next as LibraryDocument&{dimension?:number}).dimension=dimension
    }catch(e){if(signal.aborted)throw e;failures++;d.status='failed';d.error=e instanceof InputError?e.message:'此资料索引失败，请重试'}
    l.job!.completed++;await this.changed()
   }
   signal.throwIfAborted()
   if(rebuild&&failures===0){const dimension=(staged[0] as LibraryDocument&{dimension?:number})?.dimension;if(!dimension||staged.some(d=>(d as any).dimension!==dimension))throw new InputError('向量维度不一致，新索引未采用');l.documents=staged.map(({...d})=>{delete (d as any).dimension;return d});l.collection=collection;l.dimension=dimension;l.activeModel=profile.ref;l.fingerprint=profile.fingerprint;await this.changed();if(oldCollection&&oldCollection!==collection)await this.engine.call({op:'drop',connection:this.connection(),collection:oldCollection}).catch(()=>{})}
   l.job!.state=failures?'failed':'done';l.job!.message=failures?`${failures} 份资料处理失败，可重试；旧索引保留。`:'索引已更新，可以检索并关联助手。';l.updatedAt=now()
  }catch(e){l.job!.state=signal.aborted?'cancelled':'failed';l.job!.message=signal.aborted?'处理已取消，已完成的向量化缓存保留，可继续更新。':e instanceof InputError?e.message:'索引处理失败，已有资料保留'}finally{await this.changed()}
 }
 private publicLegacyId(provider:KnowledgeProvider,id:string){return provider.id===this.state.legacyId?id:'remote:'+digest(provider.id).slice(0,16)+':'+id}
 async status(){const legacy=this.legacy();let external:Awaited<ReturnType<KnowledgeProvider['status']>>|undefined;try{external=await legacy?.status()}catch{}
  const libraries=this.state.libraries.map(l=>({id:l.id,name:l.name+(!l.collection&&l.kind==='local'?'（待建立索引）':'')})),collections=[...libraries,...(external?.collections||[]).map(c=>({id:this.publicLegacyId(legacy!,c.id),name:c.name}))]
  return {configured:collections.length>0,verified:this.state.libraries.some(l=>!!l.collection||l.kind==='milvus')||external?.verified===true,label:'外部知识库',message:collections.length?`已管理 ${collections.length} 个知识库／资料集。`:'新建知识库并添加资料，或接入已有服务。',collections}
 }
 async search(request:KnowledgeRequest,signal:AbortSignal){
  const ids=request.scope?.collectionIds||[],sources:any[]=[],errors:string[]=[]
  for(const id of ids){signal.throwIfAborted();const l=this.state.libraries.find(v=>v.id===id);if(!l)continue
   try{if(request.scope?.product||request.scope?.project)throw new InputError('此知识库尚未配置产品／项目标签，请使用知识库范围选择，避免错误扩大引用范围')
    if(l.kind==='local'&&!l.collection)throw new InputError(l.name+'尚未完成索引')
    const profile=await this.embeddings.profile(l.activeModel||l.modelRef);if(l.fingerprint&&profile.fingerprint!==l.fingerprint)throw new InputError(l.name+'的模型配置已改变，请更新索引或恢复原模型配置')
    const [vector]=await this.embeddings.embed(profile,[request.query],signal);if(l.dimension&&vector!.length!==l.dimension)throw new InputError('查询向量维度与已有知识库不一致')
    const active=l.documents.filter(d=>d.revision),remote=l.remote,connection=l.kind==='milvus'?this.secrets().find(v=>v.id===l.id):this.connection();if(!connection)throw new InputError('远端库连接已移除')
    if(l.kind==='local'&&!active.length)continue
    const rows=await this.engine.call<any[]>({op:'search',connection,collection:remote?.collection||l.collection,vector,field:remote?.vector||'vector',metric:remote?.metric||'COSINE',limit:request.limit,filter:remote?'':'revision in '+JSON.stringify(active.map(d=>d.revision)),fields:remote?[remote.text,...(remote.source?[remote.source]:[])]:['document','revision','text','locator']},signal)
    rows.forEach((r,index)=>{const e=r.entity||{},doc=active.find(d=>d.id===e.document),content=e[remote?.text||'text'];if(typeof content!=='string'||!content.trim())return;sources.push({id:String(r.id),documentId:doc?.id||String(r.id),chunkId:String(r.id),collectionId:l.id,title:doc?.name||String(e[remote?.source||'']||l.name),text:content,locator:remote?String(e[remote.source]||''):e.locator,version:doc?.activeHash?.slice(0,12),rank:index})})
   }catch(e){if(signal.aborted)throw e;errors.push(e instanceof InputError?e.message:'知识库检索失败')}
  }
  const externalIds=ids.filter(id=>!this.state.libraries.some(l=>l.id===id)),legacy=this.legacy()
  if(externalIds.length&&legacy){const status=await legacy.status(),selected=status.collections.filter(c=>externalIds.includes(this.publicLegacyId(legacy,c.id)));if(selected.length!==externalIds.length)throw new InputError('部分资料范围已失效，请重新选择',409);const result=await legacy.search({...request,scope:{...request.scope!,providerId:legacy.id,collectionIds:selected.map(c=>c.id)}},signal);sources.push(...result.sources.map((s,i)=>({...s,collectionId:this.publicLegacyId(legacy,s.collectionId!),rank:i})))}
  if(errors.length)throw new InputError(errors.join('；'),409)
  return {sources:sources.sort((a,b)=>a.rank-b.rank).slice(0,request.limit).map(({rank,...s})=>s)}
 }
 async remoteCheck(body:Record<string,unknown>){const uri=text(body.uri,'Milvus地址',2000,true);let url:URL;try{url=new URL(uri)}catch{throw new InputError('请输入完整的Milvus HTTP/HTTPS地址')}if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash)throw new InputError('Milvus地址无效，请将凭据填在专用输入框');return {connection:{uri:url.href.replace(/\/+$/,''),token:text(body.token??'','凭据',4096),database:text(body.database??'default','数据库',128,true)},collections:await this.engine.call<any[]>({op:'collections',connection:{uri:url.href.replace(/\/+$/,''),token:body.token||'',database:body.database||'default'}})}}
 async remoteCreate(body:Record<string,unknown>){const checked=await this.remoteCheck(body),collection=text(body.collection,'集合',200,true),schema=checked.collections.find(c=>c.name===collection)?.schema;if(!schema)throw new InputError('请选择已存在的集合');const vector=text(body.vector,'向量字段',128,true),content=text(body.text,'正文字段',128,true),source=text(body.source??'','来源字段',128),field=schema.fields.find((f:any)=>f.name===vector);if(!field||Number(field.type)!==101||!schema.fields.some((f:any)=>f.name===content)||(source&&!schema.fields.some((f:any)=>f.name===source)))throw new InputError('请选择有效的浮点向量、正文与来源字段');const modelRef=text(body.modelRef,'原Embedding模型',300,true),p=await this.embeddings.profile(modelRef),[probe]=await this.embeddings.embed(p,['知识库连接验证'],AbortSignal.timeout(60_000)),dimension=Number(field.params?.dim);if(dimension!==probe!.length)throw new InputError('所选模型维度与已有集合不一致');const l:Library={id:'lib-'+randomUUID(),name:text(body.name,'知识库名称',120,true),kind:'milvus',modelRef,activeModel:modelRef,fingerprint:p.fingerprint,dimension,documents:[],directories:[],chunkSize:900,overlap:100,createdAt:now(),updatedAt:now(),remote:{collection,vector,text:content,source,metric:text(body.metric??'COSINE','距离算法',20,true)}};if(!['COSINE','L2','IP'].includes(l.remote!.metric))throw new InputError('距离算法无效');await this.saveSecrets([...this.secrets(),{id:l.id,...checked.connection}]);this.state.libraries.push(l);await this.changed();return structuredClone(l)}
 async importVectors(id:unknown,name:string,bytes:Buffer){
  const l=this.library(id);this.idle(l);if(l.kind!=='local'||l.documents.length)throw new InputError('向量资料包请导入到新建的空知识库')
  let bundle:any;try{bundle=extname(name).toLowerCase()==='.parquet'?{rows:await this.engine.call({op:'parquet',data:bytes.toString('base64')})}:JSON.parse(bytes.toString('utf8'))}catch{throw new InputError('无法读取向量资料包，请选择JSON或Parquet')}
  const rows:any[]=Array.isArray(bundle)?bundle:bundle.rows,modelRef=bundle.modelRef||rows?.[0]?.modelRef
  if(!Array.isArray(rows)||!rows.length||rows.length>10000||modelRef!==l.modelRef)throw new InputError('资料包需包含rows、原modelRef及向量/正文/来源；请选择与原库一致的模型')
  const p=await this.embeddings.profile(l.modelRef);if(bundle.fingerprint&&bundle.fingerprint!==p.fingerprint)throw new InputError('资料包的Embedding配置与当前模型不一致，请使用原配置')
  const [probe]=await this.embeddings.embed(p,['知识库向量维度验证'],AbortSignal.timeout(60_000)),dimension=probe!.length
  for(const row of rows)if(!Array.isArray(row.vector)||row.vector.length!==dimension||row.vector.some((v:unknown)=>typeof v!=='number'||!Number.isFinite(v))||!row.vector.some((v:number)=>v!==0)||typeof row.text!=='string'||!row.text.trim()||Buffer.byteLength(row.text)>60000||typeof row.source!=='string'||!row.source.trim())throw new InputError('向量资料需包含同维度有效vector、text正文及source出处')
  const collection='kb_'+l.id.slice(4).replace(/-/g,'')+'_'+p.fingerprint.slice(0,12),documents:LibraryDocument[]=[],records:any[]=[]
  for(const source of [...new Set(rows.map(r=>r.source))]){const group=rows.filter(r=>r.source===source),document=randomUUID(),revision=randomUUID(),parts=group.map(r=>({text:r.text,locator:String(r.locator||source)})),hash=digest(JSON.stringify(parts));await mkdir(join(this.root,'texts'),{recursive:true});await writeFile(join(this.root,'texts',hash+'.json'),JSON.stringify(parts),'utf8');documents.push({id:document,name:text(source,'来源',500,true),hash,activeHash:hash,revision,status:'ready',chunks:group.length});group.forEach((r,i)=>records.push({id:digest(revision+':'+i),document,revision,text:r.text,locator:String(r.locator||source).slice(0,500),vector:r.vector}))}
  await this.engine.call({op:'ensure',connection:this.connection(),collection,dimension});for(let i=0;i<records.length;i+=64)await this.engine.call({op:'insert',connection:this.connection(),collection,rows:records.slice(i,i+64)})
  l.documents=documents;l.collection=collection;l.fingerprint=p.fingerprint;l.activeModel=p.ref;l.dimension=dimension;l.updatedAt=now();await this.changed();return {imported:records.length,documents:documents.length}
 }
 async exportVectors(id:unknown){const l=this.library(id);this.idle(l);if(l.kind!=='local'||!l.collection)throw new InputError('请先完成本地知识库索引');const rows=await this.engine.call<any[]>({op:'export',connection:this.connection(),collection:l.collection,filter:'revision in '+JSON.stringify(l.documents.filter(d=>d.revision).map(d=>d.revision))});return {format:'workbench-knowledge-v1',modelRef:l.activeModel,fingerprint:l.fingerprint,dimension:l.dimension,rows:rows.map(r=>({vector:r.vector,text:r.text,source:l.documents.find(d=>d.id===r.document)?.name||l.name,locator:r.locator}))}}
 async close(){this.shutting=true;for(const r of this.running.values())r.controller.abort();await Promise.allSettled([...this.running.values()].map(v=>v.promise));await this.tail;await this.engine.close()}
}
