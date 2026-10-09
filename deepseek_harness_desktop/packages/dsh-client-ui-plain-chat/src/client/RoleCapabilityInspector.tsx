import React from 'react'
import { actionsOf,actionNames,type Capability,type RoleDefinition,type Version } from '../../../dsh-capabilities/src/core/model.ts'
import { EnableSwitch } from '../../../../shared/client/EnableSwitch.tsx'
import { RoleAccessoryInspector } from './RoleAccessoryInspector.tsx'
import { ActionFields } from './ManagedCenter.tsx'
import s from './ManagedCapabilities.module.css'

type Binding=RoleDefinition['capabilities'][number]
export function RoleCapabilityInspector({capability,binding,version,allowActionScope,message,manageLabel,onChange,onManage}:{
  capability:Capability;binding?:Binding;version?:Version;allowActionScope:boolean;message?:string;manageLabel:string;
  onChange:(patch:Partial<Binding>)=>void;onManage:()=>void;
}) {
  return <RoleAccessoryInspector name={capability.draft.name} description={capability.draft.description}
    enabled={binding?.enabled} onEnabled={enabled=>onChange({enabled})}
    note={binding?'保存后用于新对话。移除不会卸载共享能力。':undefined}
    source={`${capability.source==='builtin'?'工作台内置':'工作台自建'} · ${capability.removedAt?'已移除':capability.enabled?'已启用':'已停用'}`}>
    {capability.removedAt&&<p className={s.muted}>此能力已移除，当前不可执行。可从岗位中移除此配件，或在能力中心恢复。</p>}
    {binding&&allowActionScope&&<>
      <label className={s.check}>为此岗位缩小动作范围 <EnableSwitch label="为此岗位缩小动作范围" checked={binding.actions!==undefined} onChange={enabled=>onChange({actions:enabled?actionsOf(version):undefined})}/></label>
      {binding.actions!==undefined?<ActionFields value={binding.actions} available={actionsOf(version)} onChange={actions=>onChange({actions})}/>:<p className={s.muted}>使用能力默认动作：{actionsOf(version).map(a=>actionNames[a]).join('、')}</p>}
    </>}
    {message&&<p className={s.muted}>{message}</p>}
    <button className={s.button} onClick={onManage}>{manageLabel} ↗</button>
  </RoleAccessoryInspector>
}
