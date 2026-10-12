const fs=require('node:fs/promises')
const path=require('node:path')
const {randomUUID,createHash}=require('node:crypto')
const digest=bytes=>createHash('sha256').update(bytes).digest('hex')
const limit=40*1024*1024
function createDocumentFiles({dialog,window,assertSender}){
 const handles=new Map()
 async function open(event,value){
  assertSender(event)
  let filename=typeof value==='string'?value:''
  if(!filename){const result=await dialog.showOpenDialog(window(),{title:'打开 Word 文档',properties:['openFile'],filters:[{name:'Word 文档',extensions:['docx']}]});assertSender(event);if(result.canceled)return null;filename=result.filePaths[0]}
  if(path.extname(filename).toLowerCase()!=='.docx')throw Error('请选择 .docx 文件')
  const info=await fs.stat(filename);if(!info.isFile()||info.size>limit)throw Error('只支持 40 MB 以内的 DOCX 文档')
  const bytes=await fs.readFile(filename),handle=randomUUID();handles.set(handle,{path:filename,hash:digest(bytes)})
  return {handle,name:path.basename(filename),bytes}
 }
 async function save(event,input){
  assertSender(event)
  const bytes=Buffer.from(input.bytes);if(bytes.length>limit||bytes.length<4||bytes.readUInt32LE(0)!==0x04034b50)throw Error('文档数据无效')
  const original=handles.get(input.handle);let target=original?.path,expected=original?.hash
  if(input.saveAs||!target){const result=await dialog.showSaveDialog(window(),{title:'保存 Word 文档',defaultPath:target||path.basename(input.name||'文档.docx'),filters:[{name:'Word 文档',extensions:['docx']}]});assertSender(event);if(result.canceled||!result.filePath)return null;target=result.filePath;if(!target.toLowerCase().endsWith('.docx'))target+='.docx';expected=await fs.readFile(target).then(digest,e=>{if(e.code==='ENOENT')return null;throw e})}
  const current=await fs.readFile(target).then(digest,e=>{if(e.code==='ENOENT')return null;throw e});if(current!==expected)throw Error('文件已在其他程序中改变。请另存为，避免覆盖外部修改。')
  const temp=path.join(path.dirname(target),'.'+path.basename(target)+'.'+randomUUID()+'.tmp')
  try{await fs.writeFile(temp,bytes,{flag:'wx'});const latest=await fs.readFile(target).then(digest,e=>{if(e.code==='ENOENT')return null;throw e});if(latest!==expected)throw Error('文件在保存期间改变，请另存为');await fs.rename(temp,target)}finally{await fs.unlink(temp).catch(()=>{})}
  const handle=input.handle||randomUUID();handles.set(handle,{path:target,hash:digest(bytes)});return {handle,name:path.basename(target)}
 }
 return {open,save}
}
module.exports={createDocumentFiles}
