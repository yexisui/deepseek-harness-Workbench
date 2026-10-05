import type { IncomingMessage } from 'node:http'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import type { InventoryEntry } from '../core/classification.ts'
import type { CliGateway } from './gateway.ts'
import { ClassificationStore } from './classification-store.ts'
import { OfflineInstaller } from './offline-installer.ts'
import { LocalWorkshopService, LocalImportError } from '../../../dsh-market/src/core/local-import.ts'
import { readJsonBody, writeJson } from './http.ts'
import { AiClassificationService, type AiClassificationAdapter } from './ai-classification.ts'
import { entryKey } from '../core/classification.ts'
import { isLoopbackRequest } from './loopback.ts'

export function makeLocalManagementRoutes(installer:OfflineInstaller,gateway:CliGateway,inventory:()=>InventoryEntry[],beforeCapabilityChange?:(name:string)=>Promise<void>,presetInventory?:()=>Promise<unknown[]>,aiAdapter?:AiClassificationAdapter,onDispose?:(dispose:()=>void)=>void,requestRejection?:(req:IncomingMessage)=>number|undefined):WebRoute[]{
 const library=new LocalWorkshopService({dshHome:installer.home}),classification=new ClassificationStore(installer.home)
 const allEntries=()=>[...new Map([...installer.pending(),...inventory()].map(e=>[entryKey(e),e])).values()]
 const ai=aiAdapter?new AiClassificationService(classification,allEntries,aiAdapter):undefined
 if(ai)onDispose?.(()=>ai.close())
 const classifier=()=>{if(!ai)throw Error('AI 分类服务未就绪，请重启工作台');return ai}
 const formats=new Map<string,'zip'|'folder'>()
 const body=async(req:IncomingMessage)=>(await readJsonBody(req,{maxBytes:2*1024*1024,objectOnly:true})??{}) as Record<string,unknown>
 const route=(suffix:string,methods:string[],action:(req:IncomingMessage)=>Promise<unknown>):WebRoute=>({kind:'exact',path:'/api/plugin-manager/'+suffix,handler:async(req,res)=>{
  if(!isLoopbackRequest(req)){writeJson(res,403,{error:'loopback-only'});return}
  if(suffix.startsWith('ai/')){
   const rejection=requestRejection?requestRejection(req):503
   if(rejection!==undefined){writeJson(res,rejection,{error:rejection===401?'请从工作台入口重新连接后重试':'AI 分类接口暂不可访问'});return}
   if(req.method==='POST'&&!String(req.headers['content-type']??'').toLowerCase().startsWith('application/json')){writeJson(res,415,{error:'请使用 JSON 请求'});return}
  }
  if(!methods.includes(req.method??'')){writeJson(res,405,{error:'method-not-allowed'});return}
  try{writeJson(res,200,await action(req))}catch(e){writeJson(res,e instanceof LocalImportError?e.status:400,{error:e instanceof Error?e.message:String(e)})}
 }})
 return [
  route('inventory',['GET'],async()=>({entries:inventory(),agentPresets:await presetInventory?.()??[]})),
  route('classification',['GET','POST'],async req=>({classification:req.method==='GET'?classification.read(inventory()):classification.save(await body(req),inventory())})),
  route('ai/status',['GET'],async()=>classifier().status()),
  route('ai/start',['POST'],async req=>classifier().start(String((await body(req)).id??''))),
  route('ai/cancel',['POST'],async req=>classifier().cancel(String((await body(req)).id??''))),
  route('ai/undo',['POST'],async req=>classifier().undo(String((await body(req)).id??''))),
  route('pending',['GET'],async()=>({entries:installer.pending(),origins:installer.origins()})),
  route('import/start',['POST'],async req=>{const b=await body(req),format=b.format as 'zip'|'folder',id=library.start('plugin',format);if(formats.size>100)formats.clear();formats.set(id,format);return {uploadId:id}}),
  route('import/file',['PUT'],async req=>{const url=new URL(req.url??'','http://localhost');req.setTimeout(120000,()=>req.destroy());try{await library.uploadFile(url.searchParams.get('uploadId'),url.searchParams.get('path'),req)}finally{req.setTimeout(0)}return {ok:true}}),
  route('import/inspect',['POST'],async req=>{const b=await body(req);library.inspect(b.uploadId);return {preview:installer.inspect(library.inspectedRoot(b.uploadId)).preview}}),
  route('import/commit',['POST'],async req=>{const b=await body(req);if(b.confirm!==true||typeof b.hash!=='string'||typeof b.currentHash!=='string')throw Error('请先检查并确认待安装的插件。');return gateway.withMutationLock(async()=>{
   library.inspect(b.uploadId);const root=library.inspectedRoot(b.uploadId),format=formats.get(String(b.uploadId));if(!format)throw Error('导入会话已失效')
   await beforeCapabilityChange?.(installer.inspect(root).preview.id)
   const result=installer.job('install',String(b.uploadId),()=>installer.install(root,format,b.hash as string,b.replace===true,b.currentHash as string))
   if(installer.status(result.jobId)?.phase==='done'){library.discard(b.uploadId);formats.delete(String(b.uploadId))}
   return result
  })}),
  route('import/discard',['POST'],async req=>{const b=await body(req);library.discard(b.uploadId);formats.delete(String(b.uploadId));return {ok:true}}),
  route('rollback',['POST'],async req=>{const b=await body(req);if(b.confirm!==true||typeof b.id!=='string')throw Error('请确认回退版本');return gateway.withMutationLock(async()=>{await beforeCapabilityChange?.(b.id as string);return installer.job('update',b.id as string,()=>installer.rollback(b.id as string))})}),
 ]
}
