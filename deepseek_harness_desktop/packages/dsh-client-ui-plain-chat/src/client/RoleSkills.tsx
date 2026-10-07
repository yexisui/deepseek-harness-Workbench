import React,{useEffect,useState} from 'react'
import type {ManagedSkill} from '../../../dsh-skill-explorer/src/managed.ts'
import type {SkillBinding} from '../../../dsh-capabilities/src/core/model.ts'
import {EnableSwitch} from '../../../../shared/client/EnableSwitch.tsx'
import s from './ManagedCapabilities.module.css'

export function useRoleSkillCatalog(){
  const [skills,setSkills]=useState<ManagedSkill[]>([]),[error,setError]=useState('')
  useEffect(()=>{const controller=new AbortController();void fetch('/api/dsh-skill-explorer/manage/list',{signal:controller.signal}).then(async r=>{if(!r.ok)throw Error('无法读取 Skills 列表');return r.json()}).then(data=>setSkills(data.skills.filter((v:ManagedSkill)=>!v.removed))).catch(e=>{if(!controller.signal.aborted)setError('技能列表读取失败：'+String(e.message))});return()=>controller.abort()},[])
  return {skills,error}
}
export function RoleSkillInspector({binding,skill,onChange}:{binding?:SkillBinding;skill?:ManagedSkill;onChange:(value:SkillBinding)=>void}){
  return <><h3>{binding?.name??skill?.name}</h3>{skill&&<p>{skill.description}</p>}{binding?<>
    <label className={s.check}>在此岗位中启用 <EnableSwitch label={'在此岗位中启用 '+binding.name} checked={binding.enabled} onChange={enabled=>onChange({...binding,enabled})}/></label>
    <p>技能版本：{binding.hash.slice(0,12)}</p>
    {skill&&skill.hash!==binding.hash&&<button className={s.button} onClick={()=>onChange({...binding,hash:skill.hash})}>采用当前技能版本</button>}
    <p className={s.muted}>保存草稿保留编辑；发布后新对话使用所选技能版本。移除不删除技能文件。</p>
  </>:<p>添加到岗位后，可设置是否启用。</p>}{skill&&<p className={s.muted}>来源：{skill.scope==='global'?'工作台全局':skill.scope} · {skill.enabled?'已启用':'已停用'}</p>}</>
}
