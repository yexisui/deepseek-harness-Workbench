// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { CodeAssistant } from '../../dsh-code-assistant/src/client/CodeAssistant.tsx'
vi.mock('../../dsh-code-assistant/src/client/Editor.tsx', () => ({ CodeEditor: (props: any) => <textarea aria-label="test editor" value={props.value} onInput={event => props.onChange(event.currentTarget.value)} onChange={() => {}} /> }))

it('preserves unsaved code across host navigation without applying it to disk', async () => {
  ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
  const saves: any[] = [], id = 'buffer-test-task'
  vi.stubGlobal('fetch', vi.fn(async (address: string, options: any) => {
    const route = new URL(address, 'http://localhost').pathname.split('/').at(-1)
    const values: any = { projects: [{ path: 'C:/example', name: 'example' }], health: { installed: true }, tasks: [], task: { id, cwd:'C:/example', title:'Editor test', model:'', mode:'read', status:'done', messages:[], permissions:[] }, files:{files:['add.js']}, state:{git:false,files:[]}, file:{path:'add.js',text:'original\n',version:'v1'} }
    if (route === 'save') { const data = JSON.parse(options.body); saves.push(data); return { ok:true,json:async()=>({path:'add.js',text:data.content,version:'v2'}) } }
    return {ok:true,json:async()=>values[route!]}
  }))
  const host = document.createElement('div'); document.body.append(host)
  const Toggle = () => <button role="switch" aria-checked="false" />
  const view = <CodeAssistant Toggle={Toggle} roleId="developer" draftKey="buffer-test" initialTaskId={id} loadModels={async()=>[]} />
  let root = createRoot(host)
  const settle = () => new Promise(resolve=>setTimeout(resolve,30))
  try {
    await act(async()=>{root.render(view);await settle()})
    await act(async()=>{Array.from(host.querySelectorAll('button')).find(button=>button.textContent==='add.js')!.click();await settle()})
    await act(async()=>{const editor=host.querySelector('textarea[aria-label="test editor"]') as HTMLTextAreaElement;editor.value='unsaved local edit\n';editor.dispatchEvent(new Event('input',{bubbles:true}));await settle()})
    await act(async()=>root.unmount())
    root=createRoot(host)
    await act(async()=>{root.render(view);await settle()})
    expect((host.querySelector('textarea[aria-label="test editor"]') as HTMLTextAreaElement).value).toBe('unsaved local edit\n')
    expect(saves).toHaveLength(0)
    await act(async()=>{Array.from(host.querySelectorAll('button')).find(button=>button.textContent==='保存')!.click();await settle()})
    expect(saves[0]).toMatchObject({content:'unsaved local edit\n',version:'v1'})
  } finally { await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals() }
})
