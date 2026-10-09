// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { MeetingDemo } from '../src/client/MeetingDemo.tsx'

let root: Root | undefined
let host: HTMLDivElement | undefined
afterEach(async () => { if (root) await act(async () => root?.unmount()); host?.remove(); root = undefined; host = undefined; vi.unstubAllGlobals() })

it('keeps guided upload, editable transcript, real minutes, and print action in chat', async () => {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  const id = '11111111-1111-4111-8111-111111111111'
  const segments = [{ id: 's1', start: 2000, end: 6000, speaker: '发言人 1', text: '周五提交清单。' }]
  const minutes = { title: '周例会纪要', overview: '确认任务清单。', decisions: [], actions: [{ text: '提交清单', owner: '发言人 1', deadline: '周五', sourceIds: ['s1'] }], unknown: [] }
  let generated = false
  let sentSegments: typeof segments | undefined
  let selectedModel = ''
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
    if (url.endsWith('/config')) return json({ ready: true, message: '语音识别接口已配置', maxBytes: 25_000_000, provider: '自定义语音识别接口' })
    if (url.endsWith('/create')) { selectedModel = (JSON.parse(String(init?.body)) as { summaryModel: string }).summaryModel; return json({ id, status: 'uploading', segments: [] }) }
    if (url.endsWith(`/upload/${id}`)) return json({ id, status: 'transcribing', segments: [] })
    if (url.endsWith(`/job/${id}`)) return json({ id, status: generated ? 'ready' : 'transcribed', segments, ...(generated ? { minutes } : {}) })
    if (url.endsWith('/generate')) { sentSegments = (JSON.parse(String(init?.body)) as { segments: typeof segments }).segments; generated = true; return json({ id, status: 'generating', segments }) }
    throw new Error(`Unexpected request: ${url}`)
  }))
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  await act(async () => { root!.render(<MeetingDemo loadModels={async () => [{ id: 'chosen/minutes', name: '我的纪要模型' }]}/>); await Promise.resolve() })
  const click = async (label: string) => act(async () => { Array.from(host!.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent?.includes(label))!.click() })
  await click('引导整理'); await click('团队同步'); await click('结论与待办')
  const select = host.querySelector<HTMLSelectElement>('select[aria-label="纪要模型"]')!
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(select, 'chosen/minutes'); select.dispatchEvent(new Event('change', { bubbles: true })) })
  const fileInput = host.querySelector<HTMLInputElement>('input[type=file]')!
  Object.defineProperty(fileInput, 'files', { configurable: true, value: [new File(['audio-content'], 'meeting.mp3', { type: 'audio/mpeg' })] })
  await act(async () => { fileInput.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(resolve => setTimeout(resolve, 40)) })
  expect(host.textContent).toContain('请先核对原文')
  const transcript = host.querySelector<HTMLTextAreaElement>('textarea[aria-label="00:02 转写文字"]')!
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(transcript, '王磊周五提交清单。'); transcript.dispatchEvent(new Event('input', { bubbles: true })) })
  await click('确认转写，生成纪要')
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 40)) })
  expect(host.textContent).toContain('周例会纪要')
  expect(host.textContent).toContain('提交清单')
  expect(sentSegments?.[0].text).toBe('王磊周五提交清单。')
  expect(selectedModel).toBe('chosen/minutes')
  expect(host.textContent).toContain('打印 / 保存 PDF')
  expect(host.querySelector('[data-meeting-demo="true"]')).not.toBeNull()
})

it('uses the saved meeting role appearance and records its published version', async () => {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ready: false, message: '待配置', maxBytes: 25_000_000, provider: '自定义语音识别接口' }), { headers: { 'content-type': 'application/json' } })))
  const onSnapshot = vi.fn()
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  await act(async () => { root!.render(<MeetingDemo assistant={{ name: '项目例会助手', color: '#123456', icon: { kind: 'builtin', id: 'manager' } }} roleVersion={2} onSnapshot={onSnapshot}/>); await Promise.resolve() })
  expect(host.textContent).toContain('你好，我是项目例会助手。')
  expect(host.querySelector('[data-role-appearance-icon="manager"]')).not.toBeNull()
  expect(onSnapshot).toHaveBeenCalledWith(expect.objectContaining({ roleVersion: 2 }))
})

it('keeps a rejected revision request in the composer instead of losing its text',async()=>{
 (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true
 const id='11111111-1111-4111-8111-111111111111',minutes={title:'旧纪要',overview:'保留',decisions:[],actions:[],unknown:[]}
 vi.stubGlobal('fetch',vi.fn(async(input:string)=>{const url=String(input);return new Response(JSON.stringify(url.endsWith('/generate')?{error:'当前任务忙碌'}:url.includes('/executions?')?{items:[],total:0}:url.includes('/job/')?{id,status:'ready',segments:[],minutes}:{ready:true,maxBytes:25000000}),{status:url.endsWith('/generate')?409:200})}))
 host=document.createElement('div');document.body.append(host);root=createRoot(host)
 await act(async()=>root!.render(<MeetingDemo initialState={{phase:'ready',mode:'quick',audience:'',focus:'',summaryModel:'',messages:[],trace:[],draft:'请突出负责人',jobId:id,showTranscript:false}}/>))
 await act(async()=>host!.querySelector<HTMLButtonElement>('button[aria-label="发送消息"]')!.click())
 expect(host.querySelector('textarea')?.value).toBe('请突出负责人');expect(host.textContent).toContain('当前任务忙碌');expect(host.textContent).toContain('旧纪要')
})
