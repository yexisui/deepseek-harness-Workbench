import {afterEach,expect,it,vi} from 'vitest'
import {WorkbenchEmbeddings,type EmbeddingProfile} from '../src/host/knowledge-embedding.ts'
const profile:EmbeddingProfile={ref:'p/embed',model:'embed',endpoint:'https://example.invalid/embeddings',key:'test-only',fingerprint:'model-one'}
const service=()=>new WorkbenchEmbeddings({} as never)
const signal=()=>new AbortController().signal
const response=(data:unknown)=>new Response(JSON.stringify({data}),{status:200})
afterEach(()=>vi.unstubAllGlobals())

it('splits duplicate gateway indexes without assigning a vector to the wrong text, then reuses the working batch size',async()=>{
 const calls:string[][]=[]
 vi.stubGlobal('fetch',vi.fn(async(_:string,init:RequestInit)=>{const input=JSON.parse(String(init.body)).input as string[];calls.push(input);return response(input.map((text,i)=>({index:i%8,embedding:[Number(text),1]})).reverse())}))
 const e=service(),texts=Array.from({length:24},(_,i)=>String(i+1));expect(await e.embed(profile,texts,signal())).toEqual(texts.map(t=>[Number(t),1]));expect(calls.map(c=>c.length)).toEqual([16,8,8,8]);
 calls.length=0;await e.embed(profile,texts.slice(0,16),signal());expect(calls.map(c=>c.length)).toEqual([8,8]);
 calls.length=0;await e.embed({...profile,fingerprint:'another-model'},texts.slice(0,16),signal());expect(calls[0]).toHaveLength(16);
})
it('keeps ordinary indexed batches in their original input order',async()=>{
 const fetcher=vi.fn(async(_:string,init:RequestInit)=>response(JSON.parse(String(init.body)).input.map((text:string,i:number)=>({index:i,embedding:[Number(text),1]})).reverse()));vi.stubGlobal('fetch',fetcher)
 const texts=Array.from({length:17},(_,i)=>String(i+1));expect(await service().embed(profile,texts,signal())).toEqual(texts.map(t=>[Number(t),1]));expect(fetcher).toHaveBeenCalledTimes(2)
})
it('stops at a malformed single response instead of guessing its index',async()=>{
 const fetcher=vi.fn(async()=>response([{index:5,embedding:[1,2]}]));vi.stubGlobal('fetch',fetcher);await expect(service().embed(profile,['one'],signal())).rejects.toThrow('单段重试后仍无法对应原文');expect(fetcher).toHaveBeenCalledTimes(1)
})
it('does not accept missing vectors or silently retry a dimension mismatch',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>response([{index:0,embedding:[1,2]}])));await expect(service().embed(profile,['one','two'],signal())).rejects.toThrow('请求2段，返回1段')
 const fetcher=vi.fn(async()=>response([{index:0,embedding:[1,2]},{index:1,embedding:[1,2,3]}]));vi.stubGlobal('fetch',fetcher);await expect(service().embed(profile,['one','two'],signal())).rejects.toThrow('2维与3维');expect(fetcher).toHaveBeenCalledTimes(1)
})
it('rejects zero or non-numeric vectors',async()=>{
 for(const embedding of [[0,0],[1,'bad'],[],[null,1]]){vi.stubGlobal('fetch',vi.fn(async()=>response([{index:0,embedding}])));await expect(service().embed(profile,['one'],signal())).rejects.toThrow('向量无效')}
})
it('checks dimension consistency across requests and respects cancellation during batch splitting',async()=>{
 vi.stubGlobal('fetch',vi.fn(async(_:string,init:RequestInit)=>{const input=JSON.parse(String(init.body)).input;return response(input.map((_:string,i:number)=>({index:i,embedding:input.length===16?[1,2]:[1,2,3]})))}));await expect(service().embed(profile,Array(17).fill('one'),signal())).rejects.toThrow('预期2维')
 const controller=new AbortController(),fetcher=vi.fn(async()=>{controller.abort();return response([{index:0,embedding:[1,2]},{index:0,embedding:[2,3]}])});vi.stubGlobal('fetch',fetcher);await expect(service().embed(profile,['one','two'],controller.signal)).rejects.toThrow('向量化已取消');expect(fetcher).toHaveBeenCalledTimes(1)
})
