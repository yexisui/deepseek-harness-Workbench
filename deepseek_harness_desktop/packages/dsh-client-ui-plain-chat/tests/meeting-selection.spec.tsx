// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { MeetingDemo } from '../src/client/MeetingDemo.tsx'

let root:Root,host:HTMLDivElement
const id='11111111-1111-4111-8111-111111111111'
const transcript=[{id:'s1',start:0,end:1000,speaker:'王磊',text:'周五提交清单'}]
const state={mode:'guided',phase:'upload',audience:'领导汇报',focus:'完整讨论',summaryModel:'',messages:[{id:0,kind:'intro'},{id:1,kind:'assistant',text:'准备好了，请上传录音。'}],trace:[],draft:'保留输入',jobId:null,showTranscript:false}
const calls:Array<{path:string;body:any}>=[]
let job:any
function mockFetch(){vi.stubGlobal('fetch',vi.fn(async(input:unknown,init?:RequestInit)=>{
 const path=String(input);const body=typeof init?.body==='string'?JSON.parse(init.body):undefined;calls.push({path,body})
 let result:any={}
 if(path.endsWith('/config'))result={ready:true,maxBytes:25000000}
 else if(path.includes('/executions?'))result={items:[],total:0}
 else if(path.includes('/job/'))result=job
 else if(path.endsWith('/stop')){job={...job,status:'error',error:'用户停止本轮'};result=job}
 else if(path.endsWith('/options')){job={...job,...body,status:job.segments.length?'transcribed':job.status};result=job}
 else if(path.endsWith('/retry')){job={...job,status:'transcribing'};result=job}
 else if(path.endsWith('/generate')){job={...job,status:'generating'};result=job}
 else if(path.includes('/upload/')){job={...job,fileName:'替换会议.mp3',status:'transcribing',segments:[],minutes:undefined};result=job}
 else throw Error('Unexpected request '+path)
 return new Response(JSON.stringify(result),{status:200})
}))}
async function mount(initialState:any=state,onSnapshot=vi.fn()){
 (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true
 host=document.createElement('div');document.body.append(host);root=createRoot(host)
 await act(async()=>{root.render(<MeetingDemo initialState={initialState} onSnapshot={onSnapshot}/>);await new Promise(r=>setTimeout(r,20))})
 return onSnapshot
}
async function click(label:string){await act(async()=>{const button=Array.from(host.querySelectorAll('button')).find(b=>b.getAttribute('aria-label')===label||b.textContent===label);expect(button,label).toBeDefined();button!.click();await new Promise(r=>setTimeout(r,15))})}
afterEach(async()=>{if(root)await act(async()=>root.unmount());host?.remove();calls.splice(0);vi.unstubAllGlobals()})
it('reselects an earlier choice before upload and cancels edits without resetting other steps',async()=>{
 mockFetch();const snapshot=await mount()
 await click('修改整理重点');await click('结论与待办');await click('保存并继续')
 expect(snapshot.mock.lastCall?.[0]).toMatchObject({audience:'领导汇报',focus:'结论与待办',phase:'upload',draft:'保留输入'})
 await click('修改纪要用途');await click('客户沟通');await click('取消修改')
 expect(snapshot.mock.lastCall?.[0]).toMatchObject({audience:'领导汇报',focus:'结论与待办'})
 expect(calls.filter(c=>/create|upload|options|generate|retry/.test(c.path))).toHaveLength(0)
 expect(Array.from(host.querySelectorAll('button')).filter(b=>b.textContent==='选择录音')).toHaveLength(1)
})
it('stops and returns to choices, then resumes with the same uploaded recording',async()=>{
 job={id,fileName:'原录音.mp3',size:5,status:'transcribing',segments:[]};mockFetch()
 await mount({...state,jobId:id,phase:'processing'})
 await click('停止本轮');expect(host.querySelector('[aria-label="重新选择当前步骤"]')).not.toBeNull()
 await click('修改整理重点');await click('风险与问题');await click('保存并继续')
 expect(calls.find(c=>c.path.endsWith('/options'))?.body).toMatchObject({id,audience:'领导汇报',focus:'风险与问题'})
 expect(calls.some(c=>c.path.endsWith('/retry'))).toBe(true)
 expect(calls.some(c=>c.path.endsWith('/create')||c.path.includes('/upload/'))).toBe(false)
})
it('preserves transcript edits across reselecting the mode and generates without another ASR request',async()=>{
 job={id,fileName:'原录音.mp3',size:5,status:'transcribed',segments:transcript};mockFetch()
 const corrected=[{...transcript[0],text:'人工核对后的负责人和期限'}]
 await mount({...state,jobId:id,phase:'transcript',transcriptDraft:corrected})
 await click('修改生成方式');await click('快速生成');await click('保存并继续')
 expect(calls.find(c=>c.path.endsWith('/generate'))?.body.segments).toEqual(corrected)
 expect(calls.some(c=>c.path.endsWith('/create')||c.path.includes('/upload/')||c.path.endsWith('/retry'))).toBe(false)
})
it('keeps the job identity and existing choices when replacing the recording',async()=>{
 job={id,fileName:'原录音.mp3',size:5,status:'error',error:'用户停止本轮',segments:[]};mockFetch()
 const snapshot=await mount({...state,jobId:id,phase:'processing'})
 await click('修改录音')
 const input=host.querySelector<HTMLInputElement>('input[type="file"]')!
 Object.defineProperty(input,'files',{configurable:true,value:[new File(['replacement'],'替换会议.mp3')]})
 await act(async()=>{input.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,20))})
 expect(calls.some(c=>c.path.includes('/upload/'+id+'?replace='))).toBe(true)
 expect(calls.some(c=>c.path.endsWith('/create'))).toBe(false)
 expect(snapshot.mock.lastCall?.[0]).toMatchObject({jobId:id,audience:'领导汇报',focus:'完整讨论',selectionEdit:null})
})
it('restores an unfinished choice edit and corrected transcript after reopening',async()=>{
 job={id,fileName:'原录音.mp3',size:5,status:'transcribed',segments:transcript};mockFetch()
 const initial={...state,jobId:id,phase:'transcript',transcriptDraft:[{...transcript[0],text:'待保存校对'}],selectionEdit:{step:'focus',mode:'guided',audience:'领导汇报',focus:'风险与问题'}}
 const snapshot=await mount(initial)
 expect(host.querySelector<HTMLInputElement>('[aria-label="新的整理重点"]')?.value).toBe('风险与问题')
 await click('取消修改')
 expect(snapshot.mock.lastCall?.[0]).toMatchObject({focus:'完整讨论',transcriptDraft:initial.transcriptDraft})
 expect(host.querySelector<HTMLTextAreaElement>('[aria-label="00:00 转写文字"]')?.value).toBe('待保存校对')
})
it('keeps the previous recording and minutes visible when replacement upload fails',async()=>{
 job={id,fileName:'原录音.mp3',size:5,status:'ready',segments:transcript,minutes:{title:'原会议纪要',overview:'保留原内容',decisions:[],actions:[],unknown:[]}};mockFetch()
 const original=globalThis.fetch
 vi.stubGlobal('fetch',vi.fn(async(input:unknown,init?:RequestInit)=>String(input).includes('/upload/')?new Response(JSON.stringify({error:'上传中断'}),{status:400}):original(input as RequestInfo,init)))
 const snapshot=await mount({...state,jobId:id,phase:'ready'})
 await click('修改录音')
 const input=host.querySelector<HTMLInputElement>('input[type="file"]')!
 Object.defineProperty(input,'files',{configurable:true,value:[new File(['partial'],'替换会议.mp3')]})
 await act(async()=>{input.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,20))})
 expect(host.textContent).toContain('上传中断');expect(host.textContent).toContain('原会议纪要');expect(host.textContent).toContain('当前录音：原录音.mp3')
 await click('取消修改');expect(snapshot.mock.lastCall?.[0]).toMatchObject({jobId:id,phase:'ready',audience:'领导汇报',focus:'完整讨论'})
})
