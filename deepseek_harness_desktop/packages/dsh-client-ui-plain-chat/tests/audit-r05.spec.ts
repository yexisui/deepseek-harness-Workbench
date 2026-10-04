import { expect, it } from 'vitest'
import { nativePresetHook } from '../src/client/native-preset-view.ts'
it('groups managed role versions outside native custom presets without changing source rows or native actions',()=>{
 const native={id:'my-real-custom',name:'开发助手'}, first={id:'workbench-role-builtin-developer-v1'}, second={id:'workbench-role-builtin-developer-v2'}
 let state={rows:[native,first,second],status:'ready',authorable:true}
 const hook=nativePresetHook<typeof state>((select)=>select(state))
 const view=hook(s=>s)
 expect(view.rows).toEqual([native]);expect(view.authorable).toBe(true)
 expect(hook(s=>s)).toBe(view)
 expect(state.rows).toEqual([native,first,second])
 state={...state,rows:[...state.rows,{id:'new-custom'}]}
 expect(hook(s=>s.rows.map(r=>r.id))).toEqual(['my-real-custom','new-custom'])
})
