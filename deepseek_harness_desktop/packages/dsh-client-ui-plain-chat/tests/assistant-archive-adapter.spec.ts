import {it,expect,vi} from 'vitest'
import {createAssistantArchiveApi,adaptAssistantArchiveController} from '../src/client/assistant-archive-adapter.ts'
import {createAssistantArchives} from '../src/client/assistant-archive-client.ts'

function setup(){
  const row={id:'local-a',title:'助手对话',role:'role',kind:'draft' as const,draft:'已保存的输入',updatedAt:123}
  let revision=0,entries:any={}
  const archives=createAssistantArchives(async(body:any)=>{if(body){entries={...entries,[body.id]:{...entries[body.id],...body,archivedAt:'2026-10-25T00:00:00Z'}};revision++}return {revision,entries}})
  const inventory={generatedAt:1,rows:[{id:'native-a',title:'原有对话',archived:true,workspaceIds:[],lastActivityReliable:true,running:false,blank:false,childIds:[],childCount:0,issues:[]}],workspaces:[],archivedSessionIds:['native-a'],auto:{cycleRunning:false}}
  const native:any={inventory:vi.fn(async()=>inventory),preview:vi.fn(async id=>({id,messageCount:0,excerpt:[]})),archive:vi.fn(async ids=>({results:ids.map((id:string)=>({id,status:'ok'})),freedBytes:0})),unarchive:vi.fn(async ids=>({results:ids.map((id:string)=>({id,status:'ok'})),freedBytes:0})),deleteSessions:vi.fn(async ids=>({results:ids.map((id:string)=>({id,status:'ok'})),freedBytes:50})),autoPreview:vi.fn(),autoRun:vi.fn()}
  const ports={archives,rows:()=>[row],current:()=>undefined as string|undefined,archive:vi.fn(async r=>archives.change({...r,archived:true})),restore:vi.fn(async e=>archives.change({id:e.id,archived:false})),remove:vi.fn(async()=>{}),preview:vi.fn(async id=>({id,messageCount:1,excerpt:[{role:'user',text:row.draft}]}))}
  return {row,ports,native,inventory,api:createAssistantArchiveApi(ports,native)}
}
it('merges assistant records into the existing inventory without changing native records or policies',async()=>{
  const {api,ports,inventory,native}=setup();await ports.archives.change({id:'local-a',title:'助手对话',role:'role',archived:true})
  const result=await api.inventory();expect(result.rows[0]).toEqual(inventory.rows[0]);expect(result.rows[1]).toMatchObject({id:'local-a',archived:true,lastActivityAt:123});expect(result.archivedSessionIds).toEqual(['native-a','local-a']);expect(api.autoRun).toBe(native.autoRun);expect(api.autoPreview).toBe(native.autoPreview)
})
it('routes mixed restore and delete batches to their sources and preserves native delete totals',async()=>{
  const {api,ports,native}=setup();await ports.archives.change({id:'local-a',title:'助手对话',role:'role',archived:true})
  await api.unarchive(['native-a','local-a']);expect(native.unarchive).toHaveBeenCalledWith(['native-a']);expect(ports.archives.hidden('local-a')).toBe(false)
  const result=await api.deleteSessions(['local-a','native-a'],undefined,2);expect(native.deleteSessions).toHaveBeenCalledWith(['native-a'],undefined,1);expect(result.results.map(r=>r.id)).toEqual(['local-a','native-a']);expect(result.freedBytes).toBe(50);expect(ports.archives.getSnapshot().entries['local-a'].removed).toBe(true);expect((await api.inventory()).rows).toHaveLength(1)
})
it('retains failed records, protects the current conversation and still processes other selections',async()=>{
  const {api,ports}=setup();ports.remove.mockRejectedValueOnce(Error('保存失败'))
  const result=await api.deleteSessions(['local-a','native-a'],undefined,2);expect(result.results.map(r=>r.status)).toEqual(['failed','ok']);expect(ports.archives.hidden('local-a')).toBe(false)
  ports.current=()=> 'local-a';expect((await api.deleteSessions(['local-a'],undefined,1)).results).toEqual([{id:'local-a',status:'skipped',reason:'current'}]);expect(ports.remove).toHaveBeenCalledTimes(1)
})
it('uses source previews and the existing native preview route',async()=>{
  const {api,ports,native}=setup();expect((await api.preview('local-a')).excerpt[0].text).toBe('已保存的输入');await api.preview('native-a');expect(native.preview).toHaveBeenCalledWith('native-a');expect(ports.preview).toHaveBeenCalledTimes(1)
})
it('restores archived snapshots when the originating browser has no local row',async()=>{
  const {api,ports,row}=setup();ports.rows=()=>[];await ports.archives.change({...row,archived:true,localSnapshot:row});expect((await api.inventory()).rows).toHaveLength(2);await api.unarchive([row.id]);expect(ports.restore).toHaveBeenCalledWith(expect.objectContaining({localSnapshot:row}))
})
it('reuses the registered controller and its original store and state',()=>{
  class Controller {store:any;constructor(public deps:any){this.store=deps.store}getCurrentSessionId(){return 'native-a'}}
  const {ports}=setup(),store={selection:['native-a'],filter:'archived'},original=new Controller({store}),adapted=adaptAssistantArchiveController(original as any,ports,async()=>{});
  expect(adapted).toBeInstanceOf(Controller);expect(adapted.store).toBe(store);expect((adapted as any).deps.sessions.list.getSnapshot().current).toBe('native-a')
})
