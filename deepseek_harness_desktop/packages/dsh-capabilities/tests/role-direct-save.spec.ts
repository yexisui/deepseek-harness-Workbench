import {it,expect} from 'vitest'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {CapabilityStore} from '../src/host/store.ts'
import {emptyRole,latest} from '../src/core/model.ts'
import {allowedActions,wasRevoked,roleForPreset} from '../src/core/policy.ts'

it('saves once without readiness gates, keeps task authority stable and honors global stop',async()=>{
 const root=await mkdtemp(join(tmpdir(),'role-direct-save-')),store=new CapabilityStore(root);await store.init()
 try{
  store.publishIssues=()=>['浏览器未连接']
  const definition={...emptyRole(),name:'测试直接保存',capabilities:[{capabilityId:'browser',version:1,enabled:true}]}
  const {id}=await store.command(store.snapshot().revision,{type:'role.save',definition,publish:true,directSave:true})
  const old=latest(store.snapshot().roles.find(r=>r.id===id)!.versions)!
  expect(old.directSave).toBe(true);expect(allowedActions(store.snapshot(),id,old)).toContain('read')
  await store.command(store.snapshot().revision,{type:'role.save',id,definition,publish:true,directSave:true})
  expect(store.snapshot().roles.find(r=>r.id===id)!.versions).toHaveLength(1)
  await store.command(store.snapshot().revision,{type:'role.save',id,definition:{...definition,name:'当前岗位',capabilities:[]},publish:true,directSave:true})
  const current=latest(store.snapshot().roles.find(r=>r.id===id)!.versions)!
  expect(allowedActions(store.snapshot(),id,current)).toEqual([])
  expect(allowedActions(store.snapshot(),id,old)).toContain('read')
  expect(roleForPreset(store.snapshot(),old.preset)!.version.name).toBe('测试直接保存')
  await store.close();await store.init()
  expect(allowedActions(store.snapshot(),id,old)).toContain('read')
  await store.command(store.snapshot().revision,{type:'capability.toggle',id:'browser',enabled:false})
  expect(allowedActions(store.snapshot(),id,old)).toEqual([])
  expect(wasRevoked(store.snapshot(),id,old,Date.now()-1000)).toBe(true)
 }finally{await store.close();await rm(root,{recursive:true,force:true,maxRetries:5})}
})

it('retains an existing unfinished draft until explicit save and preserves its original task record',async()=>{
 const root=await mkdtemp(join(tmpdir(),'role-direct-save-')),store=new CapabilityStore(root);await store.init()
 try{
  const role=store.snapshot().roles[0]!,old=structuredClone(role.versions)
  await store.command(store.snapshot().revision,{type:'role.save',id:role.id,definition:{...role.draft,name:'之前未完成的修改'},publish:false})
  await store.close();await store.init()
  const retained=store.snapshot().roles.find(r=>r.id===role.id)!
  expect(retained.versions).toEqual(old);expect(retained.draft.name).toBe('之前未完成的修改')
  await store.command(store.snapshot().revision,{type:'role.save',id:role.id,definition:retained.draft,publish:true,directSave:true})
  const saved=store.snapshot().roles.find(r=>r.id===role.id)!
  expect(latest(saved.versions)!.name).toBe(retained.draft.name);expect(saved.versions.slice(0,-1)).toEqual(old)
 }finally{await store.close();await rm(root,{recursive:true,force:true,maxRetries:5})}
})
