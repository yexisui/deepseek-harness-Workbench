import test from 'node:test'
import assert from 'node:assert/strict'
import {CodeAssistantService} from '../src/host/service.mjs'

for(const failed of [false,true])test('host guidance receives request and abort signal; cleanup on '+(failed?'failure':'success'),async()=>{
 const calls=[],controller=new AbortController(),task={id:'test',cwd:'test',sessionId:'engine-session',mode:'read',status:'running',permissions:[],error:''}
 const service=new CodeAssistantService({root:'test',guidance:async(value,request)=>{assert.equal(value,task);assert.equal(request.message,'查产品B');assert.equal(request.signal,controller.signal);if(failed)throw Error('retrieval failed');return '[K1] 产品B支持离线盘点'},releaseGuidance:value=>calls.push(['release',value.id])})
 service.engine={request:async(path,body)=>{calls.push(['message',body.system]);return {}}}
 service.refresh=async()=>{};service.save=async()=>{};service.serialize=async fn=>fn()
 const active={task,controller,release:()=>calls.push(['unlock'])};service.active=active
 await service.run(active,'查产品B')
 assert.equal(task.status,failed?'failed':'done');assert.equal(service.active,null)
 assert.equal(calls.filter(c=>c[0]==='release').length,1);assert.equal(calls.filter(c=>c[0]==='unlock').length,1)
 if(failed)assert.equal(calls.some(c=>c[0]==='message'),false)
 else assert.match(calls.find(c=>c[0]==='message')[1],/\[K1\]/)
})
