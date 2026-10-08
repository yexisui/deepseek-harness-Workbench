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
it('shows imported materials as removable tags without a project file selector',async()=>{
 const host=document.createElement('div'),root=createRoot(host),onCommand=vi.fn(async()=>undefined)
 const task={project:{path:'C:/demo',files:['unselected.py'],ledger:false},sections:[],materials:[{id:'a',name:'a.py'},{id:'b',name:'removed.md',removed:true}]} as unknown as RequirementTask
 try{
  await act(async()=>root.render(<RequirementsNotebook task={task} busy={false} mode="quick" view="setup" onCommand={onCommand} onGuide={()=>{}}/>))
  expect(host.querySelector('select')).toBeNull();expect(host.textContent).not.toContain('项目资料');expect(host.textContent).not.toContain('unselected.py');expect(host.textContent).not.toContain('removed.md')
  expect(host.querySelectorAll('[aria-label="已选参考资料"] li')).toHaveLength(1)
  const remove=host.querySelector<HTMLButtonElement>('[aria-label="移除资料 a.py"]')!
  await act(async()=>remove.click());expect(onCommand).toHaveBeenCalledWith({type:'material.remove',id:'a',removed:true})
  await act(async()=>root.render(<RequirementsNotebook task={task} busy={true} mode="guided" view="setup" onCommand={onCommand} onGuide={()=>{}}/>))
  expect(remove.disabled).toBe(true)
  await act(async()=>root.render(<RequirementsNotebook task={{...task,materials:task.materials.map(m=>({...m,removed:true}))}} busy={false} mode="guided" view="setup" onCommand={onCommand} onGuide={()=>{}}/>))
  expect(host.querySelector('[aria-label="已选参考资料"]')).toBeNull()
 }finally{await act(async()=>root.unmount())}
})
