import { describe, it, expect } from 'vitest'
import { CapabilityRuntime } from '../src/host/runtime.ts'
import { initialState } from '../src/core/model.ts'
import { packageComponents, relatedComponents } from '../src/core/component-registry.ts'
describe('package changes and component activity',()=>{
 it('treats explicit child exports as package members without using string prefix matching',()=>{expect(packageComponents('@linxin666/dsh-capabilities').map(c=>c.id)).toContain('browserskill');expect(relatedComponents('@linxin666/dsh-capabilities').map(c=>c.id)).not.toContain('browserskill');expect(packageComponents('@linxin666/dsh-capabilities-unknown')).toEqual([])})
 it('protects actual non-browser tasks and leaves unrelated exports operable',async()=>{const runtime=new CapabilityRuntime({} as never,{snapshot:()=>initialState()} as never,{bskPath:'',bskHome:'',port:0});runtime.componentActivities=async()=>[{id:'req',name:'资料梳理',status:'running',kind:'requirements',componentIds:['requirements-service']}];await expect(runtime.assertPluginChange('@linxin666/dsh-capabilities')).rejects.toThrow('1 个活动任务');await expect(runtime.assertPluginChange('@linxin666/dsh-capabilities/browser')).resolves.toBeUndefined();await expect(runtime.assertPluginChange('@linxin666/dsh-capabilities-unknown')).resolves.toBeUndefined()})
})
