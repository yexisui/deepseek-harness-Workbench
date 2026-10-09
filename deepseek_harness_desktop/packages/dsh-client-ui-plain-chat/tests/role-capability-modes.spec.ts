import {it,expect} from 'vitest'
import {initialState} from '../../dsh-capabilities/src/core/model.ts'
import {roleCapabilityModes,defaultCapabilityMode} from '../src/client/role-capability-modes.ts'
it('exposes all assembled workflow entries together for any role and follows published action scopes',()=>{
 const state=initialState(),version=structuredClone(state.roles[0]!.versions[0]!)
 version.capabilities=state.capabilities.map(c=>({capabilityId:c.id,version:1,enabled:true}))
 const modes=roleCapabilityModes(state,version)
 expect(modes.map(m=>m.mode).sort()).toEqual(['chat','developer','meeting','requirements'])
 expect(defaultCapabilityMode(modes)).toBe('chat')
 version.capabilities.forEach(b=>b.actions=[])
 expect(roleCapabilityModes(state,version)).toEqual([{mode:'chat',label:'对话与工具'}])
})
