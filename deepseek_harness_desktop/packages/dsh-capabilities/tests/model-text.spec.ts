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
