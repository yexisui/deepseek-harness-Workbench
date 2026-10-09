import { it, expect, vi } from 'vitest'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Readable } from 'node:stream'
import { CapabilityStore } from '../src/host/store.ts'
import { CapabilityPackages } from '../src/host/packages.ts'
import { PackageRunner } from '../src/host/package-runner.ts'
import { PackageMeetingSegmenter } from '../src/host/meeting-segments.ts'
import { MeetingService } from '../src/host/meeting.ts'
import { MEETING_ROLE_ID } from '../src/core/default-roles.ts'
import { latest } from '../src/core/model.ts'

it.skipIf(!process.env.DSH_SEGMENT_TEST_ROOT)('runs real FFmpeg and an imported worker through quick, guided, timing repair and removal fallback',async()=>{
 const formal=process.env.DSH_SEGMENT_TEST_ROOT!,root=await mkdtemp(join(tmpdir(),'meeting-chain-'))
 const store=new CapabilityStore(join(root,'capabilities'));await store.init()
 const packs=new CapabilityPackages(store);await packs.init();const runner=new PackageRunner(packs,async()=>{throw Error('unused')});await runner.init()
 const segmenter=new PackageMeetingSegmenter(runner,join(formal,'external-tools'))
 let count=0
 const fetchMock=vi.fn(async()=>new Response(JSON.stringify({text:`这是第${++count}段会议内容，请周五完成测试。`})))
 const originalFetch=globalThis.fetch;globalThis.fetch=fetchMock as any
 const ask=async(prompt:string)=>prompt.includes('只为现有纪要')?JSON.stringify({links:[{index:0,sources:[{id:'t1',quote:'会议内容，请周五完成测试'}]}]}):JSON.stringify({title:'测试纪要',overview:'测试内容',decisions:[{text:'周五完成测试',sourceIds:['s2']}],actions:[],unknown:[]})
 const meeting=new MeetingService(join(root,'meetings'),ask,()=>store.snapshot().roles.find(r=>r.id===MEETING_ROLE_ID),()=>store.snapshot(),()=>({endpoint:'http://127.0.0.1:9999/v1/audio/transcriptions',model:'test',format:'json'}),undefined,undefined,undefined,segmenter)
 await meeting.init()
 try {
  const template=store.snapshot().roles.find(r=>r.id===MEETING_ROLE_ID)!
  const created=await store.command(store.snapshot().revision,{type:'role.save',definition:{...template.draft,name:'测试自由组合岗位',capabilities:store.snapshot().capabilities.map(c=>({capabilityId:c.id,version:latest(c.versions)!.version,enabled:true}))},publish:true})
  const role=store.snapshot().roles.find(r=>r.id===created.id)!,oldVersion=latest(role.versions)!.version
  await store.command(store.snapshot().revision,{type:'role.toggle',id:MEETING_ROLE_ID,enabled:false})
  const zip=await readFile(join(formal,'capability-packages/audio-segment-location/dist/audio-segment-location-latest.zip'))
  const {token}=await packs.start('zip');await packs.put(token,'ability.zip',(async function*(){yield zip})());const preview=await packs.inspect(token);const installed=await packs.install(token,preview.hash,preview.revision,{trusted:true})
  await store.command(store.snapshot().revision,{type:'role.save',id:role.id,definition:{...role.draft,capabilities:[...role.draft.capabilities,{capabilityId:installed.id,version:1,enabled:true}]},publish:true})
  const current=store.snapshot().roles.find(r=>r.id===role.id)!,published=structuredClone(current.versions)
  await store.command(store.snapshot().revision,{type:'role.save',id:role.id,definition:{...current.draft,capabilities:current.draft.capabilities.filter(b=>b.capabilityId!==installed.id)},publish:false})
  expect(store.snapshot().roles.find(r=>r.id===role.id)!.versions).toEqual(published)
  const without=store.snapshot().roles.find(r=>r.id===role.id)!
  await store.command(store.snapshot().revision,{type:'role.save',id:role.id,definition:{...without.draft,capabilities:[...without.draft.capabilities,{capabilityId:installed.id,version:1,enabled:true}]},publish:true})
  await expect(store.command(store.snapshot().revision,{type:'role.save',id:role.id,definition:{...without.draft,capabilities:[...without.draft.capabilities.filter(b=>b.capabilityId!=='browser'),{capabilityId:'browser',version:1,enabled:true}]},publish:false})).resolves.toBeDefined()
  const audio=await readFile((process.env.DSH_SEGMENT_TEST_AUDIO ?? join(formal,'..','meeting-test-3min.mp3')))
  const wait=async(id:string,status:string)=>{for(let i=0;i<600;i++){const j=await meeting.get(id);if(j.status==='error')throw Error(j.error);if(j.status===status)return j;await new Promise(r=>setTimeout(r,20))}throw Error('timeout')}
  const upload=async(mode:string,roleVersion?:number)=>{const j=await meeting.create({fileName:'test.mp3',mode,roleVersion,roleId:role.id});const req=Readable.from([audio]);Object.defineProperty(req,'complete',{value:true});await meeting.upload(j.id,req as any);return j.id}
  const quick=await wait(await upload('quick'),'ready')
  expect(quick.role?.id).toBe(role.id);expect((await meeting.list()).items.find(j=>j.id===quick.id)?.roleId).toBe(role.id);expect(quick.segments.length).toBeGreaterThan(2);expect(quick.segments.every(s=>s.timingKind==='chunk')).toBe(true)
  expect(quick.segments[1].start).toBeGreaterThan(0);expect(quick.minutes!.decisions[0].sourceIds).toEqual(['s2'])
  const guided=await wait(await upload('guided'),'transcribed');guided.segments[0].text='人工校对内容'
  await meeting.generate(guided.id,guided.segments);expect((await wait(guided.id,'ready')).segments[0].text).toBe('人工校对内容')
  const old=await wait(await upload('quick',oldVersion),'ready');expect(old.segments).toHaveLength(1);expect(old.segments[0].start).toBeNull()
  await meeting.repairTiming(old.id)
  for(let i=0;i<600;i++){const j=await meeting.get(old.id);if(j.timingStatus==='error')throw Error(j.timingError);if(j.timingStatus==='ready')break;await new Promise(r=>setTimeout(r,20))}
  const repaired=await meeting.get(old.id);expect(repaired.timingStatus).toBe('ready');expect(repaired.minutes).toEqual(old.minutes);expect(repaired.segments).toEqual(old.segments);expect(repaired.timing!.segments[0].timingKind).toBe('chunk')
  await store.command(store.snapshot().revision,{type:'capability.remove',id:installed.id})
  const fallback=await wait(await upload('quick'),'ready');expect(fallback.segments).toHaveLength(1);expect(fallback.segments[0].start).toBeNull()
  await meeting.generate(guided.id);await wait(guided.id,'ready')
  await store.command(store.snapshot().revision,{type:'capability.restore',id:installed.id})
  await store.command(store.snapshot().revision,{type:'capability.toggle',id:installed.id,enabled:true})
  await new Promise(r=>setTimeout(r,5))
  const cancelled=await meeting.create({fileName:'cancel.mp3',mode:'guided',roleId:role.id})
  const pending=segmenter.transcribe(cancelled,(process.env.DSH_SEGMENT_TEST_AUDIO ?? join(formal,'..','meeting-test-3min.mp3')),new AbortController().signal,async(_path,_name,signal)=>{
    await store.command(store.snapshot().revision,{type:'capability.toggle',id:installed.id,enabled:false})
    signal.throwIfAborted();return []
  })
  await expect(pending).rejects.toThrow();expect(segmenter.components(cancelled.id)).toEqual([])
  const savedRole=store.snapshot().roles.find(r=>r.id===role.id)!
  await store.command(store.snapshot().revision,{type:'role.save',id:role.id,definition:{...savedRole.draft,capabilities:[]},publish:true,directSave:true})
  await meeting.generate(guided.id);expect((await wait(guided.id,'ready')).role?.id).toBe(role.id)
  await expect(meeting.create({fileName:'new.mp3',mode:'quick',roleId:role.id})).rejects.toThrow('未启用')
 }finally{globalThis.fetch=originalFetch;await runner.close();await packs.close();await store.close();await rm(root,{recursive:true,force:true,maxRetries:5,retryDelay:100})}
},60000)
