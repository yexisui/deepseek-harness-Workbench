import React, { useRef, useState } from 'react'
import type { RequirementMaterial } from '../../../dsh-capabilities/src/core/requirements-model.ts'
import s from './RequirementsAssistant.module.css'

export const REQUIREMENT_FILE_ACCEPT='.txt,.md,.markdown,.py,.ts,.tsx,.js,.jsx,.json,.yaml,.yml,.csv,.html,.css,.bat,.ps1'
export async function readRequirementFiles(files:File[],max:number):Promise<Pick<RequirementMaterial,'name'|'kind'|'text'>[]> {
  const materials:Pick<RequirementMaterial,'name'|'kind'|'text'>[]=[]
  for(const file of files){
    if(!REQUIREMENT_FILE_ACCEPT.split(',').some(ext=>file.name.toLowerCase().endsWith(ext)))throw Error(file.name+'：请选择文本或代码文件，其他文档可粘贴原文')
    if(file.size>max*4)throw Error(file.name+'：文件过大，每份资料最多 '+max.toLocaleString()+' 字符')
    const text=await file.text()
    if(text.includes('\0')||text.includes('\ufffd')||text.length>max||!text.trim())throw Error(file.name+'：请使用非空 UTF-8 文本，每份最多 '+max.toLocaleString()+' 字符')
    materials.push({name:file.webkitRelativePath||file.name,kind:/\.(md|markdown)$/i.test(file.name)?'markdown':'txt',text})
  }
  return materials
}

export function RequirementsFileDrop({busy,onFiles}:{busy:boolean;onFiles:(files:File[])=>Promise<void>}){
  const picker=useRef<HTMLInputElement>(null),[dragging,setDragging]=useState(false)
  return <div className={s.fileDrop} data-dragging={dragging} aria-label="拖入参考资料" aria-busy={busy}
    onDragOver={e=>{e.preventDefault();e.stopPropagation();if(!busy)setDragging(true)}}
    onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setDragging(false)}}
    onDrop={e=>{e.preventDefault();e.stopPropagation();setDragging(false);if(!busy)void onFiles(Array.from(e.dataTransfer.files))}}>
    <span>拖入文件作为参考资料，或</span> <button disabled={busy} onClick={()=>picker.current?.click()}>选择文件（可多选）</button>
    <small>支持文本和代码文件，不限制文件数量；单份最多 60,000 字符，总正文最多 180,000 字符。</small>
    <input ref={picker} type="file" aria-label="选择参考资料文件" hidden multiple accept={REQUIREMENT_FILE_ACCEPT} onChange={e=>{if(!busy)void onFiles(Array.from(e.target.files??[]));e.target.value=''}}/>
  </div>
}
