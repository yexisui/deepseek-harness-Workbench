import type { IncomingMessage, ServerResponse } from 'node:http'
import { integer, object, text, InputError } from '../core/validation.ts'
import type { Action } from '../core/model.ts'
import { json, readBody } from './http.ts'
import type { CapabilityPackages } from './packages.ts'
import type { PackageRunner } from './package-runner.ts'

/** Called only after the shared loopback/origin and Connection authentication checks. */
export async function packageRoutes(packages:CapabilityPackages,runner:PackageRunner,req:IncomingMessage,res:ServerResponse){
  const url=new URL(req.url??'/','http://localhost'),route=url.pathname.slice('/api/capabilities/packages/'.length)
  if(req.method==='PUT'&&route.startsWith('upload/'))return json(res,200,await packages.put(route.slice(7),url.searchParams.get('path')??'',req))
  if(req.method==='DELETE'&&route.startsWith('upload/')){await packages.discard(route.slice(7));return json(res,200,{ok:true})}
  if(route.startsWith('download/')){
    const id=route.slice(9)
    if(req.method==='DELETE'){await packages.discardDownload(id);return json(res,200,{ok:true})}
    if(req.method==='GET'){const result=await packages.download(id);res.writeHead(200,{'content-type':'application/zip','content-disposition':`attachment; filename="${result.name}"`,'content-length':result.bytes.length,'cache-control':'no-store','x-content-type-options':'nosniff'});res.end(result.bytes);return}
  }
  if(req.method==='GET'&&route==='config')return json(res,200,{model:packages.store.snapshot().packageModels?.[url.searchParams.get('id')??'']??''})
  if(req.method==='GET'&&route==='tasks')return json(res,200,runner.list(url.searchParams.get('id')??undefined))
  if(req.method==='GET'&&route.startsWith('task/'))return json(res,200,runner.get(route.slice(5)))
  if(req.method!=='POST')throw new InputError('不支持此操作',405)
  const body=object(await readBody(req))
  if(route==='export-link')return json(res,200,await packages.prepareDownload(body))
  if(route==='start')return json(res,201,await packages.start(body.kind))
  if(route==='inspect')return json(res,200,await packages.inspect(text(body.token,'上传标识',40,true)))
  if(route==='install')return json(res,200,await packages.install(text(body.token,'上传标识',40,true),body.hash,body.revision,body))
  if(route==='configure')return json(res,200,await packages.configure(text(body.id,'能力标识',90,true),body.model,body.revision,body.enable))
  if(route==='restore-draft')return json(res,200,await packages.restoreDraft(text(body.id,'能力标识',90,true),body.index,body.revision))
  if(route==='rollback')return json(res,200,await packages.rollback(text(body.id,'能力标识',90,true),body.version,body.revision))
  if(route==='run'){const run=await runner.start(text(body.id,'能力标识',90,true),integer(body.version),text(body.action,'动作标识',220,true) as Action,body.input);return json(res,202,run.job)}
  if(route==='stop')return json(res,200,await runner.stop(text(body.id,'任务标识',40,true)))
  if(route==='export'){
    const result=body.token?await packages.exportPrepared(text(body.token,'上传标识',40,true),body.hash):await packages.exportInstalled(text(body.id,'能力标识',90,true),body.version)
    res.writeHead(200,{'content-type':'application/zip','content-disposition':`attachment; filename="${result.name}"`,'content-length':result.bytes.length,'cache-control':'no-store','x-content-type-options':'nosniff'});res.end(result.bytes);return
  }
  throw new InputError('未知的能力包操作',404)
}
