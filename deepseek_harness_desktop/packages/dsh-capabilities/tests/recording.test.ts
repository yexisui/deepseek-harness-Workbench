import {describe,it,expect} from 'vitest'
import {mkdtemp,rm,readFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {randomUUID} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {RecordingService} from '../src/host/recording.ts'
import {CapabilityStore} from '../src/host/store.ts'
describe('recording lifecycle',()=>{
 it.skipIf(!process.env.DSH_TEST_TOOLS)('migrates binding once; saves/retries chunks, pauses one session, freezes role, cancels, recovers persisted audio',async()=>{
  const root=await mkdtemp(join(tmpdir(),'dsh-recorder-test-')),store=new CapabilityStore(join(root,'capabilities'))
  try{
   await store.init();expect(store.snapshot().capabilities.some(c=>c.id==='audio-recording')).toBe(true)
   const tools=process.env.DSH_TEST_TOOLS!,pointer=JSON.parse((await readFile(join(tools,'ffmpeg/current.json'),'utf8')).replace(/^\uFEFF/,'')),ffmpeg=join(tools,'ffmpeg',pointer.ffmpeg),ffprobe=join(tools,'ffmpeg',pointer.ffprobe)
   const audio=execFileSync(ffmpeg,['-v','error','-f','lavfi','-i','sine=frequency=440:duration=2','-c:a','libopus','-f','webm','pipe:1'],{windowsHide:true})
   const service=new RecordingService(join(root,'recordings'),()=>store.snapshot(),tools);await service.init()
   const first=await service.start(randomUUID(),'audio/webm');expect(first.roleId).toBe('meeting-minutes-demo')
   await expect(service.start(randomUUID(),'audio/webm')).rejects.toThrow('已有录音')
   async function* data(){yield audio}
   await service.chunk(first.id,0,data());await service.chunk(first.id,0,data());expect(first.nextChunk).toBe(1)
   await service.command(first.id,{action:'pause',durationMs:2000});expect(service.get(first.id).status).toBe('paused')
   await service.command(first.id,{action:'resume'});expect(service.list()).toHaveLength(1)
   const analyst=store.snapshot().roles.find(r=>r.id==='builtin-analyst')!
   await store.command(store.snapshot().revision,{type:'role.save',id:analyst.id,definition:{...analyst.draft,capabilities:[...analyst.draft.capabilities,{capabilityId:'audio-recording',version:1,enabled:true}]},publish:true,directSave:true})
   await service.configure(analyst.id);expect(first.roleId).toBe('meeting-minutes-demo')
   await service.command(first.id,{action:'finish'});expect(first.audio).toBe('recording.m4a')
   const duration=Number(execFileSync(ffprobe,['-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',join(root,'recordings',first.id,first.audio!)],{encoding:'utf8',windowsHide:true}));expect(duration).toBeGreaterThan(1.8);expect(duration).toBeLessThan(2.4)
   const cancel=await service.start(randomUUID(),'audio/webm');expect(cancel.roleId).toBe('builtin-analyst');await service.command(cancel.id,{action:'cancel'});expect(service.list()).toHaveLength(1)
   const note=await service.start(randomUUID(),'audio/webm');await service.command(note.id,{action:'note',text:'保留这条备注'});await service.command(note.id,{action:'cancel'});expect(service.get(note.id).notes[0]!.text).toBe('保留这条备注');expect(service.get(note.id).audio).toBeUndefined()
   const recovery=await service.start(randomUUID(),'audio/webm');await service.chunk(recovery.id,0,data())
   const restarted=new RecordingService(join(root,'recordings'),()=>store.snapshot(),tools);await restarted.init();expect(restarted.get(recovery.id).status).toBe('interrupted');expect(restarted.get(recovery.id).audio).toBe('recording.m4a')
   await restarted.command(recovery.id,{action:'delete'});expect(restarted.list()).toHaveLength(2)
   const rev=store.snapshot().revision;await store.close();await store.init();expect(store.snapshot().revision).toBe(rev)
  }finally{await store.close();await rm(root,{recursive:true,force:true})}
 },30000)
})
