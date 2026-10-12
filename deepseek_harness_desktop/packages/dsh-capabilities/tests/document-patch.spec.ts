import {describe,it,expect} from 'vitest'
import {mkdtemp,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createRequire} from 'node:module'
import {parseDocumentProposal,documentCandidate} from '../src/host/document-patch.ts'
import type {DocumentContext} from '../src/core/documents-model.ts'
const require=createRequire(import.meta.url),Zip=require('pizzip')
const context:DocumentContext={revision:7,selection:'金额为 100 元',paragraphs:[{paraId:'00000001',text:'金额为 100 元'}],outline:[],editable:true,parseError:null,fontFailures:[]}
describe('AI document edits',()=>{
 it('refuses repeated text, invented originals, multiline rewrites and no-op suggestions',()=>{
  const valid={before:'100',after:'200',reason:'更正金额'}
  expect(parseDocumentProposal(JSON.stringify(valid),context,[context.selection]).paraId).toBe('00000001')
  expect(()=>parseDocumentProposal(JSON.stringify(valid),{...context,paragraphs:[...context.paragraphs,{paraId:'00000002',text:'100'}]},[context.selection])).toThrow('重复')
  expect(()=>parseDocumentProposal(JSON.stringify({...valid,before:'不存在'}),context,[context.selection])).toThrow('超出')
  expect(()=>parseDocumentProposal(JSON.stringify({...valid,after:'200\n300'}),context,[context.selection])).toThrow('段落内')
  expect(()=>parseDocumentProposal(JSON.stringify({...valid,after:'100'}),context,[context.selection])).toThrow('未提出')
 })
 it('uses the public toolkit on a copy and preserves every non-body ZIP part',async()=>{
  const root=await mkdtemp(join(tmpdir(),'dsh-doc-patch-')),zip=new Zip()
  zip.file('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>')
  zip.file('word/document.xml','<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>金额为 1</w:t></w:r><w:r><w:t>00 元</w:t></w:r></w:p></w:body></w:document>')
  zip.file('word/header1.xml','header retained');zip.file('word/media/image.png',Buffer.from([1,2,3]));zip.file('customXml/item1.xml','<test>retained</test>')
  const original=zip.generate({type:'nodebuffer'}),proposal=parseDocumentProposal(JSON.stringify({before:'100',after:'200',reason:'更正'}),context,[context.selection])
  try{expect(await documentCandidate(root,original,proposal)).toMatch(/^[a-f0-9]{64}$/);const candidate=new Zip(await readFile(join(root,'proposal-'+proposal.id+'.docx')));expect(candidate.file('word/document.xml').asText()).toContain('200');expect(candidate.file('word/header1.xml').asText()).toBe('header retained');expect(candidate.file('word/media/image.png').asNodeBuffer()).toEqual(Buffer.from([1,2,3]));expect(new Zip(original).file('word/document.xml').asText()).toContain('00 元')}
  finally{await rm(root,{recursive:true,force:true})}
 })
})
