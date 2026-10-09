// @vitest-environment jsdom
import React,{act} from 'react'
import {createRoot} from 'react-dom/client'
import {afterEach,expect,it,vi} from 'vitest'
import {ExecutionHistory,ExecutionProcessCard} from '../src/client/ExecutionProcess.tsx'
import type {ExecutionRecord} from '../../../shared/types/execution.ts'
const run:ExecutionRecord={schema:1,id:'run-1',taskId:'task-1',operation:'生成纪要',input:'测试要求',inputKind:'user',startedAt:'2026-10-09T02:00:00Z',finishedAt:'2026-10-09T02:00:05Z',status:'review',summary:'本轮未通过；上一版纪要保留',seq:1,events:[{id:'e1',seq:1,key:'jev',title:'JEV结果复核',status:'review',detail:'负责人缺少依据',startedAt:'2026-10-09T02:00:03Z',updatedAt:'2026-10-09T02:00:05Z'}]}
let host:HTMLDivElement,root:ReturnType<typeof createRoot>
function setup(){(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;host=document.createElement('div');document.body.append(host);root=createRoot(host);sessionStorage.clear()}
afterEach(async()=>{await act(async()=>root?.unmount());host?.remove();vi.unstubAllGlobals();vi.useRealTimers()})
it('defaults to collapsed, exposes failure outside, and preserves expansion over updates and remount',async()=>{
 setup();await act(async()=>root.render(<ExecutionProcessCard run={run} showInput/>));const details=host.querySelector('details')!
 expect(details.open).toBe(false);expect(host.querySelector('[role=status]')?.textContent).toContain('上一版纪要保留');expect(host.textContent).toContain('5秒')
 await act(async()=>{details.open=true;details.dispatchEvent(new Event('toggle'))});await act(async()=>root.render(<ExecutionProcessCard run={{...run,summary:'结果仍然保留'}} showInput/>));expect(details.open).toBe(true)
 await act(async()=>root.unmount());root=createRoot(host);await act(async()=>root.render(<ExecutionProcessCard run={run}/>));expect(host.querySelector('details')!.open).toBe(true);expect(host.querySelector('time')?.dateTime).toBe('2026-10-09T02:00:05.000Z')
})
it('pages beyond fifty rounds with stable identities',async()=>{
 setup();const rows=Array.from({length:65},(_,i)=>({...run,id:'run-'+i,status:'done',input:'输入 '+i}))
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>{const q=new URL(url,'http://fixture').searchParams,one=q.get('runId');if(one)return new Response(JSON.stringify(rows.find(r=>r.id===one)));const offset=Number(q.get('offset')??0),limit=Number(q.get('limit')??10);return new Response(JSON.stringify({items:rows.slice(offset,offset+limit).map(({events,...r})=>r),total:65,...(offset+limit<65?{nextOffset:offset+limit}:{})}))}))
 await act(async()=>root.render(<ExecutionHistory kind="meeting" id="task-1"/>))
 for(let i=0;i<6;i++)await act(async()=>host.querySelector('button')!.click())
 expect(host.querySelectorAll('[data-execution-run]')).toHaveLength(65);expect(host.querySelector('button')).toBeNull();expect(new Set(Array.from(host.querySelectorAll('[data-execution-run]')).map(e=>e.getAttribute('data-execution-run'))).size).toBe(65)
})
it('fetches deltas for active rounds and retains the same event instead of appending duplicates',async()=>{
 setup();vi.useFakeTimers();let version=1;const queries:string[]=[]
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>{queries.push(url);const q=new URL(url,'http://fixture').searchParams,updated={...run,status:version===1?'running':'done',finishedAt:version===1?undefined:run.finishedAt,seq:version,events:[{...run.events[0],seq:version,status:version===1?'running':'done'}]};return new Response(JSON.stringify(q.has('runId')?updated:{items:[{...updated,events:undefined}],total:1}))}))
 await act(async()=>root.render(<ExecutionHistory kind="meeting" id="task-1" active/>));version=2;await act(async()=>{await vi.advanceTimersByTimeAsync(2000)})
 expect(queries.some(q=>q.includes('afterSeq=1'))).toBe(true);expect(host.querySelectorAll('li')).toHaveLength(1);expect(host.querySelectorAll('[data-execution-run]')).toHaveLength(1)
})

