// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { printDocument } from '../src/client/print-document.ts'
afterEach(()=>{document.body.innerHTML='';vi.restoreAllMocks()})
it('prints an isolated frame without opening a blocked popup and cleans it after print',()=>{
 const popup=vi.spyOn(window,'open')
 printDocument('<!doctype html><html><body>会议纪要</body></html>')
 const frame=document.querySelector('iframe')!
 expect(frame.srcdoc).toContain('会议纪要')
 const print=vi.spyOn(frame.contentWindow!,'print').mockImplementation(()=>{})
 vi.spyOn(frame.contentWindow!,'focus').mockImplementation(()=>{})
 frame.onload!(new Event('load'))
 expect(print).toHaveBeenCalledOnce()
 expect(popup).not.toHaveBeenCalled()
 frame.contentWindow!.dispatchEvent(new Event('afterprint'))
 expect(document.querySelector('iframe')).toBeNull()
})
