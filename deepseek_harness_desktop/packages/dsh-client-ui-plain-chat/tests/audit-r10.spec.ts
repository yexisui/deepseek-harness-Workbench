import { expect, it } from 'vitest'
import { roleActivities } from '../src/client/RoleImpactDialog.tsx'
import { initialState, type Snapshot } from '../../dsh-capabilities/src/core/model.ts'
it('counts and deduplicates browser, meeting, requirements and developer activities by actual role identity',()=>{
 const tasks=[{sessionId:'web',roleId:'role',roleVersion:1,name:'browser',status:'running',browserSessions:[]},{sessionId:'idle',roleId:'role',roleVersion:1,name:'idle',status:'idle',browserSessions:[]}]
 const componentActivities=['browser','meeting','requirements','developer'].map(kind=>({id:kind==='browser'?'web':kind,roleId:'role',name:kind,status:'running',kind,componentIds:[]}))
 const data={state:initialState(),tasks,componentActivities} as unknown as Snapshot
 expect(roleActivities(data,'role').map(x=>x.name)).toEqual(['browser','meeting','requirements','developer'])
 expect(roleActivities(data,'other')).toEqual([])
})
