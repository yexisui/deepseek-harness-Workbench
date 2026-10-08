// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { MeetingDemo } from '../src/client/MeetingDemo.tsx'
it('preserves saved message times and labels unavailable historical times honestly', async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ready: false, maxBytes: 100 })) ))
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host)
  let snapshot:any
  try {
    await act(async()=>root.render(<MeetingDemo initialState={{phase:'start',mode:null,audience:'',focus:'',summaryModel:'',draft:'',trace:[],jobId:null,showTranscript:false,messages:[{id:0,kind:'assistant',text:'历史回复'},{id:1,kind:'user',text:'已记录',createdAt:'2026-10-07T12:00:00Z'}]}} onSnapshot={s=>snapshot=s}/>))
    expect(host.textContent).toContain('时间未记录')
    expect(host.querySelector('time')?.dateTime).toBe('2026-10-07T12:00:00.000Z')
    expect(snapshot.messages[0].createdAt).toBeUndefined()
    expect(snapshot.messages[1].createdAt).toBe('2026-10-07T12:00:00Z')
  } finally {await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals()}
})
