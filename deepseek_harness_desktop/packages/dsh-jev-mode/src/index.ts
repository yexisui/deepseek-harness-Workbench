export { descriptor, defaults, JevError, config, decision } from './core/contract.ts'
export type { JevConfig, JevStatus, JevTrace, Decision, JevBackend } from './core/contract.ts'
export { JevStore } from './host/store.ts'
export { JevService, JevRun } from './host/service.ts'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-client-connection'
import { join } from 'node:path'
import { dshHome } from '../../../shared/host/dsh-home.ts'
import { JevStore } from './host/store.ts'
import { JevService } from './host/service.ts'
import { SelfOwnedBackend, accountCatalog } from './host/backend.ts'
import { installNative } from './host/native.ts'
import { fence, json, readBody } from './host/http.ts'
import { config, JevError } from './core/contract.ts'
export const name='workbench-jev-mode'
export const inject=['webServer','connection','agents','tools']
declare module '@deepseek-ai/cordis' {interface Context {workbenchJev:JevService}}
/** Workbench aggregate mounts this module; its logic and data stay independent. */
export async function apply(ctx:Context){
  const store=new JevStore(join(dshHome(),'jev-mode'));await store.init()
  const backend=new SelfOwnedBackend(ctx),service=new JevService(store,backend,cfg=>backend.ready(cfg),cfg=>backend.identity(cfg))
  ctx.provide('workbenchJev',service)
  ctx.effect(()=>installNative(ctx,service),'JEV: native turn adapter')
  ctx.effect(()=>()=>service.close(),'JEV: durable write drain')
  ctx.effect(()=>ctx.webServer.register({kind:'prefix',path:'/api/jev-mode',handler:async(req,res)=>{
    try{
      fence(req);const rejection=ctx.connection.requestRejection(req);if(rejection!==undefined)return json(res,rejection,{error:'请从工作台入口重新连接后重试'})
      const url=new URL(req.url??'/','http://localhost')
      if(req.method==='GET'&&url.pathname==='/api/jev-mode/state'){await backend.refreshIdentity(store.snapshot().value);return json(res,200,service.status(url.searchParams.get('scope')??undefined))}
      if(req.method==='GET'&&url.pathname==='/api/jev-mode/accounts'){
        return json(res,200,await accountCatalog(ctx))
      }
      if(req.method==='POST'&&url.pathname==='/api/jev-mode/config'){const body=await readBody(req);await backend.refreshIdentity(config(body.value));await service.update(body.revision,body.value);return json(res,200,service.status())}
      if(req.method==='POST'&&url.pathname==='/api/jev-mode/check'){const body=await readBody(req);const value=config(body.value??store.snapshot().value);await backend.refreshIdentity(value);return json(res,202,service.startDiagnostic(value))}
      if(req.method==='POST'&&url.pathname==='/api/jev-mode/check/cancel'){const body=await readBody(req);return json(res,200,await service.cancelDiagnostic(body.id))}
      if(req.method==='POST'&&url.pathname==='/api/jev-mode/connection'){const body=await readBody(req);const value=config(body.value);await backend.refreshIdentity(value);return json(res,200,service.connection(value))}
      throw new JevError('不支持此 JEV 操作',405)
    }catch(e){return json(res,e instanceof JevError?e.status:500,{error:e instanceof JevError?e.message:'JEV 服务操作失败；未确认保存成功'})}
  }}),'JEV: authenticated settings and trace API')
  return service
}
