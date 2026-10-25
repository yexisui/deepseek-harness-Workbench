import { afterEach, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import type { IncomingMessage } from 'node:http'
import { MeetingService } from '../src/host/meeting.ts'

const directories: string[] = []
afterEach(async () => { vi.unstubAllGlobals(); for (const path of directories.splice(0)) await rm(path, {recursive:true,force:true}) })
const minutes = JSON.stringify({title:'保留的纪要',overview:'项目验收',decisions:[],actions:[],unknown:[]})
const stream = (content = 'audio', complete = true) => Object.assign(Readable.from([content]), {complete}) as unknown as IncomingMessage
async function setup(model = vi.fn(async (_prompt: string, _model: string, _signal?: AbortSignal) => minutes)) {
 const directory = await mkdtemp(join(tmpdir(),'meeting-options-')); directories.push(directory)
 const service = new MeetingService(directory, model, undefined, undefined, () => ({endpoint:'http://127.0.0.1:9000/asr',model:'test'}))
 await service.init()
 const job = await service.create({fileName:'原会议.mp3',mode:'guided',audience:'领导汇报',focus:'完整讨论'})
 return {directory,service,job,model}
}
it('changes choices on the same job and reuses audio and corrected transcript for generation', async () => {
 const asr = vi.fn(async () => new Response(JSON.stringify({text:'周五提交。'}))); vi.stubGlobal('fetch',asr)
 const {directory,service,job,model} = await setup()
 await service.upload(job.id,stream()); await vi.waitFor(async () => expect((await service.get(job.id)).status).toBe('transcribed'))
 const saved = await service.get(job.id); saved.segments[0].text='王磊周五提交清单。'; await writeFile(join(directory,job.id+'.json'),JSON.stringify(saved))
 const next = await service.updateOptions(job.id,{mode:'quick',audience:'领导汇报',focus:'结论与待办',summaryModel:'selected/model'})
 expect(next.segments[0].text).toContain('王磊'); expect(next.id).toBe(job.id); expect(await readFile(join(directory,job.id+'.mp3'),'utf8')).toBe('audio')
 expect(asr).toHaveBeenCalledTimes(1); expect(model).not.toHaveBeenCalled()
 await service.generate(job.id); await vi.waitFor(async () => expect((await service.get(job.id)).status).toBe('ready'))
 expect(model.mock.calls[0][0]).toContain('用途：领导汇报；重点：结论与待办'); expect(model.mock.calls[0][0]).toContain('王磊周五提交清单。')
 expect(model.mock.calls[0][1]).toBe('selected/model'); expect(asr).toHaveBeenCalledTimes(1)
})
it('stops recognition, saves new choices and resumes with the existing uploaded recording', async () => {
 let requests=0
 vi.stubGlobal('fetch',vi.fn(async (_url:unknown,init:RequestInit) => {
  requests++; if(requests>1)return new Response(JSON.stringify({text:'恢复后的转写'}))
  return new Promise<Response>((_resolve,reject)=>init.signal!.addEventListener('abort',()=>reject(init.signal!.reason),{once:true}))
 }))
 const {service,job}=await setup();await service.upload(job.id,stream());await vi.waitFor(()=>expect(requests).toBe(1))
 await expect(service.updateOptions(job.id,{mode:'guided',audience:'团队同步',focus:'风险与问题'})).rejects.toThrow('停止')
 await service.stop(job.id)
 const changed=await service.updateOptions(job.id,{mode:'guided',audience:'团队同步',focus:'风险与问题'})
 expect(changed.size).toBe(5);expect(changed.status).toBe('error')
 await service.retry(job.id);await vi.waitFor(async()=>expect((await service.get(job.id)).status).toBe('transcribed'))
 expect((await service.get(job.id)).audience).toBe('团队同步');expect(requests).toBe(2)
})
it('keeps the previous minutes when options change and a new generation fails',async()=>{
 const {directory,service,job}=await setup(vi.fn(async()=>{throw new Error('模型暂不可用')}))
 const saved={...job,size:5,status:'ready',segments:[{id:'s1',start:0,end:1000,speaker:'王磊',text:'周五提交'}],minutes:JSON.parse(minutes)}
 await writeFile(join(directory,job.id+'.json'),JSON.stringify(saved))
 const changed=await service.updateOptions(job.id,{mode:'guided',audience:'领导汇报',focus:'风险与问题'})
 expect(changed).toMatchObject({status:'transcribed',needsRegeneration:true,minutes:saved.minutes})
 await service.generate(job.id);await vi.waitFor(async()=>expect((await service.get(job.id)).status).toBe('error'))
 expect((await service.get(job.id)).minutes).toEqual(saved.minutes)
})
it('replaces recording in the same conversation and preserves the previous file on incomplete upload',async()=>{
 const {directory,service,job}=await setup()
 const saved={...job,size:5,status:'ready',segments:[{id:'s1',start:0,end:1000,speaker:'王磊',text:'旧转写'}],minutes:JSON.parse(minutes)}
 await writeFile(join(directory,job.id+'.json'),JSON.stringify(saved));await writeFile(join(directory,job.id+'.mp3'),'audio')
 await expect(service.upload(job.id,stream('partial',false),'新会议.mp3',{audience:'团队同步',focus:'风险与问题'})).rejects.toThrow('中断')
 expect(await readFile(join(directory,job.id+'.mp3'),'utf8')).toBe('audio');expect(await service.get(job.id)).toEqual(JSON.parse(JSON.stringify(saved)))
 let release!:()=>void
 vi.stubGlobal('fetch',vi.fn(()=>new Promise<Response>(resolve=>{release=()=>resolve(new Response(JSON.stringify({text:'新转写'})))})))
 const replaced=await service.upload(job.id,stream('replacement'),'新会议.wav',{audience:'团队同步',focus:'风险与问题'})
 expect(replaced).toMatchObject({id:job.id,fileName:'新会议.wav',status:'transcribing',audience:'团队同步',focus:'风险与问题',segments:[]});expect(replaced.minutes).toBeUndefined()
 expect(await readFile(join(directory,job.id+'.wav'),'utf8')).toBe('replacement')
 await vi.waitFor(()=>expect(release).toBeDefined());release();await vi.waitFor(async()=>expect((await service.get(job.id)).status).toBe('transcribed'))
 expect((await service.get(job.id)).segments[0].text).toBe('新转写')
})
