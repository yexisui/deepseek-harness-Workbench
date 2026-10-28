import {it,expect} from 'vitest'
import {paginateRequirement,type FlowBlock} from '../src/client/requirement-pagination.ts'
const b=(height:number,options:Partial<FlowBlock>={}):FlowBlock=>({height,section:0,...options})
it('keeps fitting paragraphs whole, starts headings with their next paragraph, and respects forced breaks',()=>{
 const pages=paginateRequirement([b(70),b(20,{keepNext:true}),b(20),b(0,{after:true}),b(30),b(0,{after:true})],()=>100)
 expect(pages.map(p=>p.fragments.map(f=>f.index))).toEqual([[0],[1,2],[4]])
})
it('splits a long table at safe row boundaries and budgets repeated headings',()=>{
 const blocks=[b(25),b(160,{split:true,cuts:[20,55,90,125,160],repeat:20})],pages=paginateRequirement(blocks,()=>100)
 expect(pages.map(p=>p.fragments.map(f=>[f.index,f.start,f.height]))).toEqual([[[0,0,25],[1,0,55]],[[1,55,70]],[[1,125,35]]])
 for(const page of pages)expect(page.fragments.reduce((sum,f)=>sum+f.height+(f.start?blocks[f.index]!.repeat??0:0),0)).toBeLessThanOrEqual(100)
 expect(pages.flatMap(p=>p.fragments).filter(f=>f.index===1).reduce((sum,f)=>sum+f.height,0)).toBe(160)
})
it('continues oversized content without exceeding paper height or adding trailing blank pages',()=>{
 const pages=paginateRequirement([b(230,{after:true}),b(0,{after:true})],()=>100)
 expect(pages.map(p=>p.fragments[0]!.height)).toEqual([100,100,30])
})
it('starts new section geometry separately',()=>{
 const pages=paginateRequirement([b(60),b(70,{section:1}),b(70,{section:1})],s=>s?80:100)
 expect(pages.map(p=>p.section)).toEqual([0,1,1])
})
