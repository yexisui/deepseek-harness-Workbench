import React from 'react'
import type {Definition,Snapshot} from '../../../dsh-capabilities/src/core/model.ts'
import {MEETING_CAPABILITY_ID} from '../../../dsh-capabilities/src/core/default-roles.ts'
import s from './ManagedCapabilities.module.css'
export function RecordingFollowupFields({definition,data,onChange}:{definition:Definition;data:Snapshot;onChange:(value:Definition)=>void}){
 const targets=data.state.capabilities.filter(c=>c.id===MEETING_CAPABILITY_ID&&!c.removedAt)
 return <div><label>后续处理目标<select className={s.input} aria-label="后续处理目标" value={definition.followupTarget??''} onChange={e=>onChange({...definition,followupTarget:e.target.value})}><option value="">请选择</option>{targets.map(c=><option key={c.id} value={c.id}>{c.draft.name} · 转写与纪要</option>)}</select></label><p className={s.muted}>目标能力与本能力需绑定同一岗位。下方选择录音保存后显示的操作，沿用目标能力的模型设置。</p></div>
}
