import { expect, it, vi } from 'vitest'
import { workbenchText } from '../src/host/model-text.ts'
function setup(chunks: unknown[]) {
 const stream=vi.fn(async function* (_options: unknown) { yield* chunks })
 return { stream,ctx:{get:()=>({stream})} as never }
}
it('omits the workflow override so the model service resolves its current default, preserving thinking',async()=>{
 const {ctx,stream}=setup([{type:'text-delta',text:'{}'},{type:'finish',reason:{kind:'stop'}}])
 expect(await workbenchText(ctx,'p','provider/model','s',undefined)).toBe('{}')
 expect(stream.mock.calls[0][0]).not.toHaveProperty('maxTokens')
 expect(stream.mock.calls[0][0]).not.toHaveProperty('reasoningEffort')
})
it('preserves explicit limits used by other workflows',async()=>{
 const {ctx,stream}=setup([{type:'text-delta',text:'ok'}])
 await workbenchText(ctx,'p','provider/model','s',8192)
 expect(stream.mock.calls[0][0]).toHaveProperty('maxTokens',8192)
})
it.each(['','{"partial":'])('reports exhausted output budget instead of accepting empty or partial text: %s',async(text)=>{
 const {ctx}=setup([{type:'text-delta',text},{type:'finish',reason:{kind:'max-tokens'}}])
 await expect(workbenchText(ctx,'p','provider/model','s',undefined)).rejects.toThrow('token 上限')
})
it('retains upstream errors',async()=>{
 const {ctx}=setup([{type:'finish',reason:{kind:'error',failure:{message:'unavailable'}}}])
 await expect(workbenchText(ctx,'p','provider/model','s',undefined)).rejects.toThrow('unavailable')
})
it('allows a requirement response beyond three minutes without creating a deadline',async()=>{
 vi.useFakeTimers()
 const timeout=vi.spyOn(AbortSignal,'timeout'),controller=new AbortController()
 const stream=vi.fn(async function* (options:{signal:AbortSignal}){await new Promise(r=>setTimeout(r,600_000));expect(options.signal.aborted).toBe(false);yield {type:'text-delta',text:'complete'}})
 try {
  const result=workbenchText({get:()=>({stream})} as never,'p','provider/model','s',undefined,controller.signal,null)
  await vi.advanceTimersByTimeAsync(600_000)
  expect(await result).toBe('complete');expect(timeout).not.toHaveBeenCalled();expect(stream.mock.calls[0][0].signal).toBe(controller.signal)
 } finally {timeout.mockRestore();vi.useRealTimers()}
})
it('retains user cancellation with no workflow deadline',async()=>{
 const controller=new AbortController()
 const stream=async function*(){controller.abort();yield {type:'text-delta',text:'partial'}}
 await expect(workbenchText({get:()=>({stream})} as never,'p','provider/model','s',undefined,controller.signal,null)).rejects.toThrow('已停止')
})
it('keeps the existing deadline for other workflows',async()=>{
 const timeout=vi.spyOn(AbortSignal,'timeout')
 try {const {ctx}=setup([{type:'text-delta',text:'ok'}]);await workbenchText(ctx,'p','provider/model','s',undefined);expect(timeout).toHaveBeenCalledWith(180_000)} finally {timeout.mockRestore()}
})
