import React from 'react'
import {SkillRoleAssignments} from './SkillRoleAssignments.tsx'
import type {ManagedSkill} from '../managed.ts'
import {EnableSwitch} from '../../../../shared/client/EnableSwitch.tsx'
import s from '../../../dsh-client-ui-plain-chat/src/client/ManagedCapabilities.module.css'
type Props={row:ManagedSkill;busy:boolean;change:(row:ManagedSkill,action:string,value?:unknown)=>void}
export function SkillSettings({row,busy,change}:Props){
 return <>
 <label className={s.check}>启用此技能 <EnableSwitch label={'启用技能 '+row.name} checked={row.enabled} busy={busy} onChange={v=>change(row,'enabled',v)}/></label>
 <p className={s.muted}>启用后，助手可在所选范围内，根据当前任务需要使用此技能。</p>
 <label className={s.field}>使用范围<select aria-label="技能使用范围" value={row.usage??'legacy'} disabled={busy} onChange={e=>change(row,'usage',e.target.value)}>{!row.usage&&<option value="legacy">保留原有范围</option>}<option value="all" disabled={row.scope!=='global'}>全部对话</option><option value="roles">指定岗位</option></select></label>
 {!row.usage&&<p className={s.muted}>旧技能保留原有对话可见性及岗位绑定；选择新范围后才调整。</p>}
 {row.usage==='all'&&<p className={s.muted}>用于新建的普通对话和岗位对话；在岗位中单独停用的技能不会使用。</p>}
 {row.scope!=='global'&&<p className={s.muted}>此旧技能还限定于原项目：{row.scope}。如需跨项目使用，请另存导入。</p>}
 <div hidden={row.usage!=='roles'}><SkillRoleAssignments key={row.id} skillId={row.id} busy={busy}/></div>
 <details className={s.detailDisclosure}><summary>高级设置 · 调用方式</summary><p>按任务需要选用不代表后台自动运行，也不代表每次强制调用。关闭自动选用后保留原有手动调用限制；专用岗位流程按保存的岗位设置执行。</p><label className={s.check}>允许按任务需要自动选用<EnableSwitch label={'允许 AI 自动选用 '+row.name} checked={row.auto} busy={busy} onChange={v=>change(row,'auto',v)}/></label>{!row.manual&&<p>技能包不允许普通对话手动调用。</p>}</details>
 </>
}
