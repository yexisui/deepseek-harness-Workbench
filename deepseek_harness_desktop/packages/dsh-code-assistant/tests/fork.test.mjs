import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,mkdir,rm,readFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {randomUUID} from 'node:crypto'
import {CodeAssistantService} from '../src/host/service.mjs'

test('code fork copies engine history, clears pending actions and is idempotent',async()=>{
 const root=await mkdtemp(join(tmpdir(),'dsh-code-fork-unit-')),service=new CodeAssistantService({root}),calls=[]
 try{await mkdir(join(root,'tasks'));const source={id:randomUUID(),title:'代码',cwd:root,status:'running',sessionId:'original',messages:[{text:'source'}],permissions:[{id:'approval'}],requests:['old'],authorityAt:10};service.tasks.set(source.id,source)
 service.engine={url:'test',start:async()=>{},request:async(path)=>{calls.push(path);if(path.endsWith('/fork'))return{id:'child'};if(path.endsWith('/message'))return[{text:'copied'}];if(path==='/permission')return[];throw Error(path)}}
 const target=randomUUID(),fork=await service.fork(source.id,target);assert.equal(fork.sessionId,'child');assert.deepEqual(fork.messages,[{text:'copied'}]);assert.deepEqual(fork.permissions,[]);assert.deepEqual(fork.requests,[]);assert.equal(fork.status,'idle');assert.equal(fork.authorityAt,10);assert.equal(fork.cwd,root);assert.equal((await service.fork(source.id,target)).sessionId,'child');assert.equal(calls.filter(p=>p.endsWith('/fork')).length,1);assert.equal(source.status,'running');assert.equal(source.sessionId,'original');assert.equal(JSON.parse(await readFile(join(root,'tasks',target+'.json'),'utf8')).id,target)
 }finally{await rm(root,{recursive:true,force:true})}
})
test('code fork removes its engine child if copying messages fails',async()=>{
 const root=await mkdtemp(join(tmpdir(),'dsh-code-fork-unit-')),service=new CodeAssistantService({root}),calls=[]
 try{await mkdir(join(root,'tasks'));const id=randomUUID(),target=randomUUID();service.tasks.set(id,{id,title:'代码',cwd:root,sessionId:'original'});service.engine={url:'test',start:async()=>{},request:async(path,body,cwd,start,options)=>{calls.push([path,options?.method]);if(path.endsWith('/fork'))return{id:'child'};if(options?.method==='DELETE')return true;throw Error('copy failed')}};await assert.rejects(service.fork(id,target),/copy failed/);assert.equal(service.tasks.has(target),false);assert(calls.some(([path,method])=>path==='/session/child'&&method==='DELETE'))
 }finally{await rm(root,{recursive:true,force:true})}
})
