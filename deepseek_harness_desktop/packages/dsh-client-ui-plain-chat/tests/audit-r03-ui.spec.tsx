// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { PresetRepairNotice } from '../src/client/ManagedRoles.tsx'
import { capabilityClient } from '../src/client/capability-client.ts'
let root: Root, host: HTMLDivElement
beforeEach(()=>{ (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;host=document.createElement('div');document.body.append(host);root=createRoot(host) })
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks()})
const issues=['workbench-role-builtin-developer-v1/agent.cordis.yml 存在外部修改']
it('requires confirmation, prevents repeated clicks while repairing and shows honest completion',async()=>{
 let done!:()=>void
 const repair=vi.spyOn(capabilityClient,'repairPresets').mockImplementation(()=>new Promise(resolve=>{done=resolve})),confirm=vi.spyOn(window,'confirm').mockReturnValue(false)
 await act(async()=>root.render(<PresetRepairNotice issues={issues}/>))
 await act(async()=>host.querySelector('button')!.click());expect(repair).not.toHaveBeenCalled()
 confirm.mockReturnValue(true);await act(async()=>host.querySelector('button')!.click())
 expect(host.querySelector('button')!.disabled).toBe(true);expect(repair).toHaveBeenCalledOnce()
 await act(async()=>done());await act(async()=>root.render(<PresetRepairNotice issues={[]}/>))
 expect(host.querySelector('[role=status]')?.textContent).toContain('原文件已备份');expect(host.querySelector('button')).toBeNull()
})
it('keeps unresolved issues visible and does not claim success on failure',async()=>{
 vi.spyOn(window,'confirm').mockReturnValue(true);vi.spyOn(capabilityClient,'repairPresets').mockRejectedValue(Error('备份目录无法写入'))
 await act(async()=>root.render(<PresetRepairNotice issues={issues}/>));await act(async()=>host.querySelector('button')!.click())
 expect(host.querySelector('[role=alert]')?.textContent).toContain('备份目录无法写入');expect(host.querySelector('[role=status]')).toBeNull();expect(host.querySelector('button')!.disabled).toBe(false)
})
