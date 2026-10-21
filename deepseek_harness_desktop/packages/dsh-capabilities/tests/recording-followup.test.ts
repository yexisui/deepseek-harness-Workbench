import {it,expect} from 'vitest'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {CapabilityStore} from '../src/host/store.ts'
import {RecordingFollowupService} from '../src/host/recording-followup.ts'
it('uses only the recording role; idempotently links one job; removal hides actions but retains results',async()=>{
 const root=await mkdtemp(join(tmpdir(),'followup-test-')),store=new CapabilityStore(root)
 try{await store.init();let state=store.snapshot();const role=state.roles.find(r=>r.id==='meeting-minutes-demo')!,cap=state.capabilities.find(c=>c.id==='recording-followup')!;expect(cap).toBeTruthy()
 const rows:any={a:{id:'a',roleId:role.id,title:'录音',audio:'recording.m4a'},b:{id:'b',roleId:'builtin-analyst',title:'其他岗位',audio:'recording.m4a'}}
 let created=0;const jobs:any={}
 const recording:any={get:(id:string)=>rows[id],audioFile:()=>'/saved/audio',linkFollowup:async(id:string,link:any)=>{rows[id].followup=link}}
 const meeting:any={create:async(input:any,sourceRecordingId:string)=>{created++;return jobs['j'+created]={id:'j'+created,size:0,...input,sourceRecordingId}},get:async(id:string)=>jobs[id],importSavedAudio:async(id:string)=>{jobs[id].size=10;return jobs[id]}}
 const service=new RecordingFollowupService(recording,meeting,()=>state)
 expect(service.options('a').choices).toHaveLength(3);expect(service.options('b').choices).toHaveLength(0)
 const pair:any=await Promise.all([service.start({id:'a',operation:'quick'}),service.start({id:'a',operation:'quick'})]);expect(created).toBe(1);expect(pair[0].job.id).toBe(pair[1].job.id);expect(jobs.j1.sourceRecordingId).toBe('a')
 await service.start({id:'a',operation:'guided'});expect(created).toBe(1)
 cap.enabled=false;expect(service.options('a').choices).toHaveLength(0);expect(service.options('a').link?.jobId).toBe('j1');await expect(service.start({id:'a',operation:'quick'})).rejects.toThrow('未启用')
 cap.enabled=true;role.versions.at(-1)!.capabilities=role.versions.at(-1)!.capabilities.filter(b=>b.capabilityId!==cap.id);expect(service.options('a').choices).toHaveLength(0)
 const revision=store.snapshot().revision;await store.close();await store.init();expect(store.snapshot().revision).toBe(revision)
 }finally{await store.close();await rm(root,{recursive:true,force:true})}
})
