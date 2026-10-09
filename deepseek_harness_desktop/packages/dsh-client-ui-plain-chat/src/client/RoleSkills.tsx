import React,{useEffect,useState} from 'react'
import type {ManagedSkill} from '../../../dsh-skill-explorer/src/managed.ts'
import type {SkillBinding} from '../../../dsh-capabilities/src/core/model.ts'
import {RoleAccessoryInspector} from './RoleAccessoryInspector.tsx'
import s from './ManagedCapabilities.module.css'

export function useRoleSkillCatalog(){
  const [skills,setSkills]=useState<ManagedSkill[]>([]),[error,setError]=useState('')
  useEffect(()=>{const controller=new AbortController();void fetch('/api/dsh-skill-explorer/manage/list',{signal:controller.signal}).then(async r=>{if(!r.ok)throw Error('无法读取 Skills 列表');return r.json()}).then(data=>setSkills(data.skills.filter((v:ManagedSkill)=>!v.removed))).catch(e=>{if(!controller.signal.aborted)setError('技能列表读取失败：'+String(e.message))});return()=>controller.abort()},[])
  return {skills,error}
}
export function RoleSkillInspector({binding,skill,onChange}:{binding?:SkillBinding;skill?:ManagedSkill;onChange:(value:SkillBinding)=>void}){
  return <RoleAccessoryInspector name={binding?.name??skill?.name??'技能'} description={skill?.description} enabled={binding?.enabled} onEnabled={enabled=>{if(binding)onChange({...binding,enabled})}}
    note={binding?'保存后用于新对话。移除不删除技能文件。':undefined}
    source={skill?`${skill.scope==='global'?'技能库':skill.scope} · ${skill.enabled?'已启用':'已停用'}`:undefined}/>
}
