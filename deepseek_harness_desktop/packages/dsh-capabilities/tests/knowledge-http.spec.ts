import {afterEach, expect, it} from 'vitest'
import {createServer} from 'node:http'
import {HttpKnowledgeProvider, KnowledgeConnection, connectionUrl, emptyConnection} from '../src/host/knowledge-http.ts'
import {KnowledgeService} from '../src/host/knowledge.ts'

const closers:(()=>Promise<void>)[]=[]
afterEach(async()=>{for(const close of closers.splice(0))await close()})
async function server(handler:Parameters<typeof createServer>[0]) {
 const s=createServer(handler);await new Promise<void>(r=>s.listen(0,'127.0.0.1',r));closers.push(()=>new Promise<void>(r=>{s.closeAllConnections();s.close(()=>r())}));return `http://127.0.0.1:${(s.address() as any).port}`
}
function settingsFixture(){let config={...emptyConnection},revision=0;const settings={writable:true,describe:()=>[{ns:'external-knowledge',revision}],replace:async(_ns:string,value:any,rev:number)=>{if(rev!==revision)throw Error('配置已更新');config={...emptyConnection,...value};revision++}};return {manager:new KnowledgeConnection(()=>settings as never,()=>config),read:()=>config}}
it('keeps secrets server-side, preserves on same URL and never carries keys to a new destination',async()=>{
 const f=settingsFixture();await f.manager.save({revision:0,name:'one',baseUrl:'http://127.0.0.1:1234/',apiKey:'secret-test'})
 expect(f.manager.view()).toMatchObject({hasApiKey:true,revision:1});expect(JSON.stringify(f.manager.view())).not.toContain('secret-test')
 await f.manager.save({revision:1,name:'renamed',baseUrl:'http://127.0.0.1:1234'});expect(f.read().apiKey).toBe('secret-test')
 await expect(f.manager.save({revision:1,name:'stale',baseUrl:'http://127.0.0.1:1234'})).rejects.toThrow('已更新')
 await f.manager.save({revision:2,name:'new',baseUrl:'http://127.0.0.1:4321'});expect(f.read().apiKey).toBe('')
 await f.manager.save({revision:3,reset:true});expect(f.manager.provider()).toBeUndefined()
})
it.each(['file:///data','http://user:pass@localhost','https://example.test/?token=x','http://host/#x'])('rejects unsafe connection address %s',url=>expect(()=>connectionUrl(url)).toThrow())
it('performs real HTTP detection and retrieval with bounded scope, citations and no assistant metadata',async()=>{
 let sent:any,auth='';const url=await server(async(req:any,res:any)=>{res.setHeader('Content-Type','application/json');auth=req.headers.authorization;const chunks=[];for await(const chunk of req)chunks.push(chunk);if(req.url==='/v1/status')res.end(JSON.stringify({protocol:'workbench-knowledge-v1',collections:[{id:'current',name:'当前'}]}));else{sent=JSON.parse(Buffer.concat(chunks).toString());res.end(JSON.stringify({sources:[{id:'one',title:'配方',text:'海浪酱26克',documentId:'recipe',chunkId:'c1',collectionId:'current',version:'v2',locator:'配方.md 第3行'}]}))}})
 const provider=new HttpKnowledgeProvider({name:'test',baseUrl:url,apiKey:'only-server'}),service=new KnowledgeService(()=>provider)
 expect(await service.status()).toMatchObject({configured:true,verified:true});expect(auth).toBe('Bearer only-server')
 const result=await service.search({query:'配方',limit:3,scope:{providerId:provider.id,collectionIds:['current'],product:'蟹黄堡'},context:{taskId:'private-task',roleId:'private-role',roleVersion:1}},new AbortController().signal)
 expect(result.sources[0].hash).toHaveLength(64);expect(result.sources[0].version).toBe('v2');expect(sent).toEqual({query:'配方',limit:3,scope:{collectionIds:['current'],product:'蟹黄堡'}})
 await expect(service.search({query:'q',limit:3,scope:{providerId:'old-service',collectionIds:['current']}},new AbortController().signal)).rejects.toThrow('提供方已改变')
 const f=settingsFixture();const check=await f.manager.check({name:'draft',baseUrl:url});expect(check.verified).toBe(true);expect(f.manager.view().configured).toBe(false)
})
it('rejects incompatible protocol and sanitizes server errors',async()=>{
 const url=await server((req:any,res:any)=>{res.setHeader('Content-Type','application/json');if(req.url==='/v1/status')res.end(JSON.stringify({protocol:'not-supported',collections:[]}));else{res.statusCode=401;res.end('secret-test-leak')}})
 const p=new HttpKnowledgeProvider({name:'test',baseUrl:url,apiKey:'secret-test-leak'});expect(await p.status()).toMatchObject({configured:true,verified:false,collections:[]})
 await expect(p.search({query:'q',limit:2},new AbortController().signal)).rejects.toThrow('HTTP 401')
})
it('does not follow redirects or forward credentials, and cancels pending requests',async()=>{
 let hits=0;const target=await server((req:any,res:any)=>{hits++;res.end('{}')});const redirect=await server((req:any,res:any)=>{res.writeHead(302,{location:target});res.end()})
 expect((await new HttpKnowledgeProvider({name:'redirect',baseUrl:redirect,apiKey:'secret'}).status()).verified).toBe(false);expect(hits).toBe(0)
 const pending=await server(()=>{}),p=new HttpKnowledgeProvider({name:'pending',baseUrl:pending,apiKey:''});await expect(p.search({query:'q',limit:2},AbortSignal.timeout(30))).rejects.toThrow('取消')
})
