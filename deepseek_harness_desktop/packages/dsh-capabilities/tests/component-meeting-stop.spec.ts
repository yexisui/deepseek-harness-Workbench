import { it, expect, vi } from 'vitest'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { initialState } from '../src/core/model.ts'
import { MEETING_ROLE_ID } from '../src/core/default-roles.ts'
import { MeetingService } from '../src/host/meeting.ts'
it('cancels an in-flight minutes model call and protects existing jobs after re-enable',async()=>{
 const state=initialState(),directory=await mkdtemp(join(tmpdir(),'component-meeting-'));let signal:AbortSignal|undefined
 const service=new MeetingService(directory,async(_prompt,_model,provided)=>{signal=provided;return new Promise((_resolve,reject)=>provided!.addEventListener('abort',()=>reject(new Error('已取消')),{once:true}))},()=>state.roles.find(r=>r.id===MEETING_ROLE_ID),()=>state,()=>({endpoint:'http://127.0.0.1:9000/asr',model:'test'}))
 await service.init();const job=await service.create({fileName:'meeting.wav',mode:'guided'});job.status='transcribed';job.segments=[{id:'s1',text:'确认验收任务',speaker:'发言人',start:0,end:1000}];await writeFile(join(directory,job.id+'.json'),JSON.stringify(job))
 await service.generate(job.id);await vi.waitFor(()=>expect(signal).toBeDefined());expect((await service.componentActivities())[0].status).toBe('generating')
 state.componentRestrictions={'meeting-asr':{enabled:false,revokedAt:Date.now()}};await service.stopComponents(['meeting-asr']);expect(signal!.aborted).toBe(true)
 await vi.waitFor(async()=>expect((await service.get(job.id)).status).toBe('error'));expect((await service.get(job.id)).segments).toEqual(job.segments)
 state.componentRestrictions['meeting-asr'].enabled=true;await expect(service.generate(job.id)).rejects.toThrow('授权已撤销');await expect(service.create({fileName:'new.wav'})).resolves.toHaveProperty('id')
})
