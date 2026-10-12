import {it,expect} from 'vitest'
import {noDocumentKnowledge,knowledgeSources} from '../src/core/document-knowledge.ts'
it('keeps the knowledge extension unconfigured and validates future source contracts',()=>{
 expect(noDocumentKnowledge.configured).toBe(false);expect(noDocumentKnowledge.verified).toBe(false)
 expect(knowledgeSources([{id:'external',title:'资料',text:'来源',url:'https://example.org/a'}])[0]).toEqual({id:'K1',title:'资料',text:'来源',url:'https://example.org/a'})
 expect(()=>knowledgeSources([{id:'x',title:'恶意链接',text:'资料',url:'javascript:alert(1)'}])).toThrow('链接无效')
 expect(knowledgeSources(Array.from({length:12},()=>({id:'x',title:'资料',text:'x'.repeat(8000)})))).toHaveLength(8)
 expect(knowledgeSources([{id:'x',title:'资料',text:'x'.repeat(8000)}])[0]?.text).toHaveLength(6000)
})
