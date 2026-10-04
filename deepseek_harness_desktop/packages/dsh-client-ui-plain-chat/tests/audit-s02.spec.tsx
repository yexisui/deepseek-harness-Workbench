import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect,it } from 'vitest'
import { RoleVersionList,roleVersionChanges } from '../src/client/RoleVersions.tsx'
import { initialState, type Snapshot } from '../../dsh-capabilities/src/core/model.ts'
it('shows readable changes and the actual capability version of each historical role',()=>{
 const state=initialState(),role=state.roles.find(r=>r.id==='builtin-developer')!,old=structuredClone(role.versions[0]!)
 role.versions.push({...structuredClone(old),version:2,preset:'workbench-role-builtin-developer-v2',duties:'新版职责'})
 expect(roleVersionChanges(role.versions[1]!,old)).toEqual(['岗位职责'])
 const data={state,tasks:[],componentActivities:[{id:'dev1',roleId:role.id,roleVersion:1,name:'existing',kind:'developer',status:'running',componentIds:[]}]} as unknown as Snapshot
 const html=renderToStaticMarkup(<RoleVersionList data={data} role={role} onEdit={()=>{}}/>)
 expect(html).toContain('较 v1：');expect(html).toContain('1 个活动任务引用');expect(html).toContain('开发工作区');expect(html).toContain('从 v1 恢复到编辑草稿')
 expect(role.versions[0]).toEqual(old)
})
