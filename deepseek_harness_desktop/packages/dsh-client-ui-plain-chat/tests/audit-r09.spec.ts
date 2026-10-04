import { expect, it } from 'vitest'
import { initialState, components, type Snapshot } from '../../dsh-capabilities/src/core/model.ts'
import { capabilityPresentation } from '../src/client/capability-presentation.ts'
it('uses developer component descriptors for cloned identities without borrowing browser health',()=>{
 const data={state:initialState(),components,health:{state:'disconnected',message:'BrowserSkill 不可用'},tasks:[]} as unknown as Snapshot
 const dev=data.state.capabilities.find(c=>c.id==='developer-workspace')!
 const description=capabilityPresentation(data,{...dev,id:'any-local-id'})
 expect(description).toMatchObject({icon:'document',label:'项目内检测'})
 expect(description.message).toContain('绑定项目');expect(description.message).not.toContain('BrowserSkill')
 expect(capabilityPresentation(data,data.state.capabilities.find(c=>c.id==='browser')!)).toMatchObject({icon:'browser',label:'待连接',message:'BrowserSkill 不可用'})
 data.state.componentRestrictions={'developer-files':{enabled:false}}
 const part=dev.versions[0]!.components[0]!.componentId;data.state.componentRestrictions[part]={enabled:false}
 expect(capabilityPresentation(data,dev).label).toBe('组件已停用')
})
