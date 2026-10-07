// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { MeetingDemo } from '../src/client/MeetingDemo.tsx'
it('shows original text instead of fake 00:00 links and confirms before reprocessing',async()=>{
 ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true
 const id='11111111-1111-4111-8111-111111111111'
 const job={id,status:'ready',segments:[{id:'s1',start:0,end:0,speaker:'人工校对',text:'保留的校对全文'}],minutes:{title:'保留纪要',overview:'摘要',decisions:[{text:'结论',sourceIds:['s1']}],actions:[],unknown:[]}}
 const calls:string[]=[];vi.stubGlobal('fetch',vi.fn(async(url:any)=>{calls.push(String(url));return new Response(JSON.stringify(String(url).endsWith('/config')?{ready:true,maxBytes:25e6}:job))}))
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host)
 const click=async(label:string)=>act(async()=>{Array.from(host.querySelectorAll('button')).find(b=>b.textContent===label)!.click()})
 try {
 await act(async()=>{root.render(<MeetingDemo initialState={{mode:'guided',phase:'ready',jobId:id,messages:[{id:1,kind:'transcript'},{id:2,kind:'minutes'}],trace:[],draft:'',showTranscript:false}}/>);await new Promise(r=>setTimeout(r,20))})
 expect(host.textContent).not.toContain('回听 00:00');expect(host.textContent).toContain('查看原文')
 const play=vi.spyOn(HTMLMediaElement.prototype,'play').mockResolvedValue()
 await click('查看原文');expect(play).not.toHaveBeenCalled();expect(host.querySelectorAll('audio')).toHaveLength(1);expect(host.textContent).toContain('未提供分段时间')
 await click('补全时间定位');expect(calls.some(c=>c.endsWith('/timing'))).toBe(false);expect(host.textContent).toContain('原纪要与人工校对内容保留');await click('取消');expect(calls.some(c=>c.endsWith('/timing'))).toBe(false)
 play.mockRestore()
 }finally{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals()}
})

