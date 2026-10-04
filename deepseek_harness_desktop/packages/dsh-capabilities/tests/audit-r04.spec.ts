import { expect, it } from 'vitest'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { initialState } from '../src/core/model.ts'
import { MEETING_ROLE_ID, MEETING_CAPABILITY_ID } from '../src/core/default-roles.ts'
import { MeetingService } from '../src/host/meeting.ts'
async function setup() {
 const root=await mkdtemp(join(tmpdir(),'audit-r04-')), state=initialState(), role=state.roles.find(r=>r.id===MEETING_ROLE_ID)!
 const service=new MeetingService(root,async()=>'{}',()=>role,()=>state,()=>({endpoint:'http://127.0.0.1:9000/asr',model:'test'}))
 await service.init(); const job=await service.create({fileName:'old.wav'})
 job.createdAt='2025-01-01T00:00:00.000Z';await writeFile(join(root,job.id+'.json'),JSON.stringify(job))
 return {state,role,service,job}
}
it.each(['role','capability','component'])('keeps old meetings revoked after %s is disabled and re-enabled',async(kind)=>{
 const {state,role,service,job}=await setup()
 const revokedAt=Date.parse('2025-02-01T00:00:00.000Z')
 if(kind==='component')state.componentRestrictions={'meeting-asr':{enabled:true,revokedAt}}
 else state.revokedAt={[kind+':'+(kind==='role'?role.id:MEETING_CAPABILITY_ID)]:revokedAt}
 await expect(service.generate(job.id)).rejects.toThrow('授权已撤销')
 await expect(service.retry(job.id)).rejects.toThrow('授权已撤销')
 await expect(service.create({fileName:'new.wav'})).resolves.toHaveProperty('id')
 expect((await service.get(job.id)).createdAt).toBe(job.createdAt)
})
it('never restores old meeting permissions when a later role version re-grants transcription',async()=>{
 const {role,service,job}=await setup(), original=role.versions[0]!
 role.versions.push({...structuredClone(original),version:2,preset:'workbench-role-'+role.id+'-v2',capabilities:original.capabilities.map(b=>({...b,enabled:false}))})
 role.versions.push({...structuredClone(original),version:3,preset:'workbench-role-'+role.id+'-v3'})
 await expect(service.generate(job.id)).rejects.toThrow('转写权限已撤销')
 await expect(service.create({fileName:'new.wav'})).resolves.toHaveProperty('role.version',3)
})
it('does not grant transcription to a historical snapshot that had no binding',async()=>{
 const {role,service}=await setup()
 role.versions.push({...structuredClone(role.versions[0]!),version:2,preset:'workbench-role-'+role.id+'-v2'})
 role.versions[0]!.capabilities=[]
 await expect(service.create({fileName:'old.wav',roleVersion:1})).rejects.toThrow('未获授权')
})
