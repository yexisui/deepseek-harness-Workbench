import {afterEach,expect,it,vi} from 'vitest'
import {mkdtemp,rm} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {answerKnowledge} from '../src/host/knowledge-answer.ts'
import {KnowledgeAccess} from '../src/host/knowledge-access.ts'
import {KnowledgeService} from '../src/host/knowledge.ts'
import {initialState} from '../src/core/model.ts'
import type {KnowledgeEvidence} from '../src/core/knowledge.ts'
const sources:KnowledgeEvidence[]=[{id:'current',title:'当前配方',text:'v2每份26克，分两次各13克。',providerId:'test',documentId:'current',chunkId:'c1',collectionId:'guide',hash:'a'.repeat(64),retrievedAt:'2026-01-01'},{id:'old',title:'历史配方',text:'v1为31克，已停用。',providerId:'test',documentId:'old',chunkId:'c2',collectionId:'guide',hash:'b'.repeat(64),retrievedAt:'2026-01-01'}]
const signal=()=>new AbortController().signal
const answer={answer:'当前每份26克，两次各13克。[K1]',answerable:true,citations:[{reference:'K1',quote:'v2每份26克，分两次各13克。'}]}
it('uses real evidence labels and accepts a verbatim citation',async()=>{const generate=vi.fn(async()=>JSON.stringify(answer));const result=await answerKnowledge('当前用量？',sources,generate,signal());expect(result).toMatchObject({text:answer.answer,citations:[{sourceId:'current',reference:'K1',quote:answer.citations[0].quote}]});const input=JSON.parse(generate.mock.calls[0][0]);expect(input.sources.map((s:any)=>s.reference)).toEqual(['K1','K2']);expect(input.sources[1].text).toBe(sources[1].text)})
it('does not call the model when retrieval is empty',async()=>{const generate=vi.fn();expect(await answerKnowledge('q',[],generate,signal())).toMatchObject({answerable:false,citations:[]});expect(generate).not.toHaveBeenCalled()})
it.each([{...answer,citations:[]},{...answer,citations:[{reference:'K9',quote:'v2每份26克'}]},{...answer,citations:[{reference:'K1',quote:'每份99克'}]},{...answer,answer:'26克 [K2]'}])('rejects unsupported or mismatched citations',async output=>{await expect(answerKnowledge('q',sources,async()=>JSON.stringify(output),signal())).rejects.toThrow()})
it('allows insufficient evidence without invented citations',async()=>{expect(await answerKnowledge('售价？',sources,async()=>JSON.stringify({answer:'资料未提供售价。',answerable:false,citations:[]}),signal())).toMatchObject({answerable:false,text:'资料未提供售价。'})})
it('discards model output received after cancellation',async()=>{const c=new AbortController();await expect(answerKnowledge('q',sources,async()=>{c.abort();return JSON.stringify(answer)},c.signal)).rejects.toThrow()})
const roots:string[]=[],closers:(()=>Promise<void>)[]=[]
afterEach(async()=>{for(const close of closers.splice(0))await close();for(const root of roots.splice(0))await rm(root,{recursive:true,force:true})})
async function access(){const root=await mkdtemp(join(tmpdir(),'knowledge-answer-'));roots.push(root);const state=initialState(),service=new KnowledgeService(()=>({id:'test',status:async()=>({configured:true,verified:true,label:'test',message:'ok',collections:[{id:'guide',name:'guide'}]}),search:async()=>({sources})}));const value=new KnowledgeAccess(root,()=>state,service);closers.push(()=>value.close());return {state,value}}
it('preserves retrieved evidence when the model fails without leaking provider details',async()=>{const {value}=await access();const result=await value.trial('q',{collectionIds:['guide']},signal(),async()=>{throw Error('secret provider failure')});expect(result.sources).toHaveLength(2);expect(result.answer).toBeUndefined();expect(result.answerError).toContain('默认对话模型');expect(result.answerError).not.toContain('secret');expect(value.activities()).toEqual([])})
it.each(['cancel','disable'])('interrupts a trial answer on %s even when the model ignores abort',async action=>{const {value,state}=await access(),c=new AbortController();let started=false;const result=value.trial('q',{collectionIds:['guide']},c.signal,async()=>{started=true;return new Promise(()=>{})}).catch(e=>e);await vi.waitFor(()=>expect(started).toBe(true));if(action==='cancel')c.abort();else{state.capabilities.find(c=>c.id==='external-knowledge')!.enabled=false;value.reconcile()}expect(await result).toBeInstanceOf(Error);expect(value.activities()).toEqual([])})
