// @vitest-environment jsdom
import React,{act} from 'react'
import {createRoot} from 'react-dom/client'
import {expect,it,vi} from 'vitest'
import {RequirementsFileDrop,readRequirementFiles} from '../src/client/RequirementsFileDrop.tsx'
import {RequirementsNotebook} from '../src/client/RequirementsNotebook.tsx'
import type {RequirementTask} from '../../dsh-capabilities/src/core/requirements-model.ts'
function file(name:string,text='print(1)'){return {name,size:text.length,text:async()=>text} as File}
it('reads a mixed batch of over 100 code and text files and reports bad files by name',async()=>{
 const files=Array.from({length:105},(_,i)=>file(`f${i}.py`))
 expect(await readRequirementFiles(files,60000)).toHaveLength(105)
 expect((await readRequirementFiles([file('README.md','# title'),file('requirements.txt','numpy')],60000)).map(x=>x.kind)).toEqual(['markdown','txt'])
 await expect(readRequirementFiles([file('weights.pkl')],60000)).rejects.toThrow('weights.pkl')
 await expect(readRequirementFiles([file('bad.txt','\0')],60000)).rejects.toThrow('bad.txt')
})
it('uses the same complete file batch for native multiple selection and dropping, and blocks input while busy',async()=>{
 const host=document.createElement('div'),root=createRoot(host),onFiles=vi.fn(async()=>{}),files=[file('a.py'),file('b.md')]
 try{
  await act(async()=>root.render(<RequirementsFileDrop busy={false} onFiles={onFiles}/>))
  const input=host.querySelector('input')!;expect(input.multiple).toBe(true)
  Object.defineProperty(input,'files',{value:files});await act(async()=>input.dispatchEvent(new Event('change',{bubbles:true})))
  expect(onFiles).toHaveBeenLastCalledWith(files)
  const drop=new Event('drop',{bubbles:true,cancelable:true});Object.defineProperty(drop,'dataTransfer',{value:{files}})
  await act(async()=>host.firstElementChild!.dispatchEvent(drop));expect(onFiles).toHaveBeenCalledTimes(2)
  await act(async()=>root.render(<RequirementsFileDrop busy={true} onFiles={onFiles}/>))
  await act(async()=>host.firstElementChild!.dispatchEvent(drop));expect(onFiles).toHaveBeenCalledTimes(2)
 }finally{await act(async()=>root.unmount())}
})
it('selects several project files and sends a single batch command',async()=>{
 const host=document.createElement('div'),root=createRoot(host),onCommand=vi.fn(async()=>undefined)
 const task={project:{path:'C:/demo',files:['a.py','b.py'],ledger:false},sections:[]} as unknown as RequirementTask
 try{
  await act(async()=>root.render(<RequirementsNotebook task={task} busy={false} mode="quick" view="setup" onCommand={onCommand} onGuide={()=>{}}/>))
  expect(host.querySelector('select')).toBeNull()
  const all=host.querySelector<HTMLInputElement>('[aria-label="选择全部项目文件"]')!
  await act(async()=>all.click())
  const button=Array.from(host.querySelectorAll('button')).find(b=>b.textContent==='读取选中文件（2）')!
  await act(async()=>button.click());expect(onCommand).toHaveBeenCalledWith({type:'project.importMany',paths:['a.py','b.py']})
 }finally{await act(async()=>root.unmount())}
})
