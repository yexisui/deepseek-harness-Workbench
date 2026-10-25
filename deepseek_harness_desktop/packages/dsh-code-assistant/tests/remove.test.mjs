import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {CodeAssistantService} from '../src/host/service.mjs'

test('deletes only the conversation, preserves project files and is retryable',async()=>{
 const root=await mkdtemp(join(tmpdir(),'code-remove-')),id='11111111-1111-4111-8111-111111111111';
 try{
  await mkdir(join(root,'tasks'));await mkdir(join(root,'project'));await writeFile(join(root,'project','source.txt'),'keep');
  const service=new CodeAssistantService({root}),task={id,cwd:join(root,'project'),sessionId:'engine-session',status:'done'};service.tasks.set(id,task);await writeFile(join(root,'tasks',id+'.json'),JSON.stringify(task));
  let fail=true,calls=0;service.engine={start:async()=>{},request:async(path,body,cwd,start,options)=>{calls++;assert.equal(path,'/session/engine-session');assert.equal(options.method,'DELETE');if(fail)throw Error('temporarily unavailable')}};
  await assert.rejects(service.remove(id),/temporarily unavailable/);assert(service.tasks.has(id));assert(await readFile(join(root,'tasks',id+'.json')));
  fail=false;await service.remove(id);assert(!service.tasks.has(id));await assert.rejects(readFile(join(root,'tasks',id+'.json')),/ENOENT/);assert.equal(await readFile(join(root,'project','source.txt'),'utf8'),'keep');await service.remove(id);assert.equal(calls,2);
 }finally{await rm(root,{recursive:true,force:true})}
});
test('does not delete running code conversations',async()=>{
 const id='11111111-1111-4111-8111-111111111111',service=new CodeAssistantService({root:'unused'});service.tasks.set(id,{id,status:'running'});await assert.rejects(service.remove(id),/正在运行/);assert(service.tasks.has(id));
});
