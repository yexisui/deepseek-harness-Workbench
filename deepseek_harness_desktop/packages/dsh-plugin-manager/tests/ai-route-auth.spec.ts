import { afterEach, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { makeLocalManagementRoutes } from '../src/host/local-management-routes.ts'

const roots:string[]=[]
afterEach(()=>{for(const root of roots.splice(0))rmSync(root,{recursive:true,force:true})})
it('requires host authentication on all AI routes and fails closed without it',async()=>{
 const home=mkdtempSync(join(tmpdir(),'ai-route-'));roots.push(home)
 for(const rejection of [undefined,()=>401,()=>403]){
  const routes=makeLocalManagementRoutes({home,pending:()=>[]} as never,{} as never,()=>[],undefined,undefined,undefined,undefined,rejection)
  for(const route of routes.filter(r=>r.path.includes('/ai/'))){
   const writeHead=vi.fn(),end=vi.fn()
   await route.handler({method:route.path.endsWith('status')?'GET':'POST',socket:{remoteAddress:'127.0.0.1'},headers:{host:'127.0.0.1:3080','content-type':'application/json'}} as unknown as IncomingMessage,{writeHead,end} as unknown as ServerResponse)
   expect(writeHead.mock.calls[0]![0]).toBe(rejection?rejection():503)
  }
 }
})
