import type {IncomingMessage,ServerResponse} from 'node:http'
import {json,readBody} from './http.ts'
import {InputError,text} from '../core/validation.ts'
import type {KnowledgeLibraries} from './knowledge-libraries.ts'
import type {Embeddings} from './knowledge-embedding.ts'

async function dispatchLibraryRoute(libraries:KnowledgeLibraries,embeddings:Embeddings,req:IncomingMessage,res:ServerResponse){
 const url=new URL(req.url!,'http://localhost'),action=url.pathname.slice('/api/capabilities/knowledge/libraries'.length)
 if(req.method==='GET'&&action==='')return json(res,200,{...libraries.view(),models:await embeddings.choices()})
 if(req.method==='GET'&&action==='/document')return json(res,200,await libraries.previewDocument(url.searchParams.get('id'),url.searchParams.get('documentId'),Number(url.searchParams.get('offset')||0)))
 if(req.method==='PUT'&&action==='/upload'){
  const chunks:Buffer[]=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>40*1024*1024)throw new InputError('资料超过40 MB',413);chunks.push(Buffer.from(chunk))}
  const id=url.searchParams.get('id'),name=text(url.searchParams.get('name'),'文件名',500,true),bytes=Buffer.concat(chunks)
  return json(res,200,url.searchParams.get('format')==='vectors'?await libraries.importVectors(id,name,bytes):await libraries.upload(id,name,bytes))
 }
 if(req.method!=='POST')throw new InputError('接口不存在',404)
 const body=await readBody(req)
 if(action==='/create')return json(res,200,await libraries.create(body))
 if(action==='/edit')return json(res,200,await libraries.edit(body))
 if(action==='/directory')return json(res,200,await libraries.directory(body.id,body.path))
 if(action==='/build')return json(res,202,await libraries.start(body.id))
 if(action==='/cancel')return json(res,200,libraries.cancel(body.id))
 if(action==='/remove-document')return json(res,200,await libraries.removeDocument(body.id,body.documentId))
 if(action==='/remove')return json(res,200,await libraries.remove(body.id))
 if(action==='/remote-check'){const result=await libraries.remoteCheck(body);return json(res,200,{collections:result.collections})}
 if(action==='/remote-create')return json(res,200,await libraries.remoteCreate(body))
 if(action==='/embedding-check'){const p=await embeddings.profile(body.modelRef),[v]=await embeddings.embed(p,['知识库模型测试'],AbortSignal.timeout(60_000));return json(res,200,{dimension:v!.length,model:p.model})}
 if(action==='/export')return json(res,200,await libraries.exportVectors(body.id))
 throw new InputError('接口不存在',404)
}

// Serialize mutations from multiple windows; cancellation remains immediate.
const mutations=new WeakMap<KnowledgeLibraries,Promise<unknown>>()
export async function libraryRoutes(libraries:KnowledgeLibraries,embeddings:Embeddings,req:IncomingMessage,res:ServerResponse){
 if(req.method==='GET'||new URL(req.url!,'http://localhost').pathname.endsWith('/cancel'))return dispatchLibraryRoute(libraries,embeddings,req,res)
 const next=(mutations.get(libraries)||Promise.resolve()).then(()=>dispatchLibraryRoute(libraries,embeddings,req,res))
 mutations.set(libraries,next.catch(()=>{}));return next
}
