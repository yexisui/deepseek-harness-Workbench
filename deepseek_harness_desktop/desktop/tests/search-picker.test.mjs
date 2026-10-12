import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
const require=createRequire(import.meta.url),{searchResultPath,searchDirectoryDefault}=require('../src/search-picker.cjs')
test('native search picker accepts directories and reveals only existing local paths',async()=>{
 const root=await mkdtemp(join(tmpdir(),'search-picker-'))
 try {
  const file=join(root,'会议 文件.txt');await writeFile(file,'keep')
  assert.equal(await searchDirectoryDefault(root),root);assert.equal(await searchDirectoryDefault(file),undefined)
  assert.equal(await searchResultPath(file),file)
  await assert.rejects(searchResultPath('https://example.com'));await assert.rejects(searchResultPath('\\\\server\\share\\file'))
  await assert.rejects(searchResultPath(join(root,'missing')));assert.equal(await searchDirectoryDefault(''),undefined)
 } finally {await rm(root,{recursive:true,force:true})}
})
