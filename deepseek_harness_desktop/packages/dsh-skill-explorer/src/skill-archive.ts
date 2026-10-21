import path from 'node:path'
import {spawnSync} from 'node:child_process'
import {FilePaths,safeLocalPath} from '../../dsh-market/src/core/local-import-safety.ts'

// Convert archive entries to a bounded in-memory stream; never extract untrusted paths to disk.
export function readSkillArchive(file:string):Map<string,Buffer>{
 const executable=process.platform==='win32'?path.join(process.env.SystemRoot||'C:\\Windows','System32','tar.exe'):'bsdtar'
 const result=spawnSync(executable,['-cf','-','--format=ustar','--options','hdrcharset=UTF-8','@'+file],{windowsHide:true,timeout:30000,maxBuffer:34*1024*1024,stdio:['ignore','pipe','pipe']})
 if(result.error||result.status!==0)throw Error('无法读取压缩包：请确认文件完整、未加密且不是分卷；系统需要支持该格式的 bsdtar（Windows 自带 tar）。')
 return readSkillTar(result.stdout)
}
export function readSkillTar(data:Buffer):Map<string,Buffer>{
 const files=new Map<string,Buffer>(),paths=new FilePaths();let total=0,count=0
 const text=(b:Buffer)=>new TextDecoder('utf-8',{fatal:true}).decode(b.subarray(0,b.indexOf(0)<0?b.length:b.indexOf(0)))
 for(let offset=0;offset+512<=data.length;){
  const h=data.subarray(offset,offset+512);if(h.every(v=>v===0))break
  if(++count>1500)throw Error('压缩包条目过多')
  const sizeText=text(h.subarray(124,136)).trim();if(!/^[0-7]+$/.test(sizeText))throw Error('压缩包大小字段无效')
  const size=parseInt(sizeText,8),kind=h[156],prefix=text(h.subarray(345,500)),name=text(h.subarray(0,100))
  const rel=(prefix?prefix+'/':'')+name
  if(kind!==0&&kind!==48&&kind!==53)throw Error('技能压缩包不能包含链接或特殊文件')
  const clean=rel.replace(/^\.\//,'').replace(/\/$/,'')
  if(clean){safeLocalPath(clean);paths.add(clean,kind===53)}
  if(!clean&&kind!==53)throw Error('压缩包文件名无效')
  offset+=512
  if(size>32*1024*1024||offset+size>data.length)throw Error('压缩包文件过大或已损坏')
  if(kind!==53){total+=size;if(total>32*1024*1024||files.size>=500)throw Error('每次最多 500 个文件、32 MiB');files.set(clean,Buffer.from(data.subarray(offset,offset+size)))}
  offset+=Math.ceil(size/512)*512
 }
 return files
}
