const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path')
const {createDocumentFiles}=require('../src/document-files.cjs')
test('native DOCX save protects concurrent external changes and canceled Save As',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'dsh-native-doc-')),target=path.join(root,'sample.docx'),bytes=Buffer.from([80,75,3,4,1,2,3])
 try{await fs.writeFile(target,bytes);const service=createDocumentFiles({dialog:{showOpenDialog:async()=>({filePaths:[target]}),showSaveDialog:async()=>({canceled:true})},window:()=>null,assertSender:event=>{if(event!=='trusted')throw Error('Invalid sender')}})
  await assert.rejects(service.open('other'),/sender/);const opened=await service.open('trusted');assert.equal(opened.name,'sample.docx');const next=Buffer.from([80,75,3,4,4,5,6]);await service.save('trusted',{handle:opened.handle,bytes:next});assert.deepEqual(await fs.readFile(target),next)
  await fs.writeFile(target,bytes);await assert.rejects(service.save('trusted',{handle:opened.handle,bytes:next}),/其他程序/);assert.deepEqual(await fs.readFile(target),bytes);assert.equal(await service.save('trusted',{bytes:next,saveAs:true}),null)
 }finally{await fs.rm(root,{recursive:true,force:true})}
})
