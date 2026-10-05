import React, { useEffect, useRef } from 'react'
import { latest, actionsOf, actionNames, type Capability, type Snapshot } from '../../../dsh-capabilities/src/core/model.ts'
import type { RequirementAvailability } from '../../../dsh-capabilities/src/core/requirements-model.ts'
import { ComponentRelations } from './ComponentComposition.tsx'
import { DeveloperProjectSettings } from './DeveloperProjectSettings.tsx'
import { MeetingAsrSettings } from './MeetingAsrSettings.tsx'
import { RequirementsSettings } from './RequirementsSettings.tsx'
import { CapabilityGlyph } from './ManagedWorkbench.tsx'
import { CapabilityActionIcon, capabilityImpact } from './ManagedCapabilityCards.tsx'
import { capabilityDisplayDefinition, capabilityHasUnpublishedChanges, capabilityManagement, capabilityPresentation } from './capability-presentation.ts'
import { openCapabilityLink } from './capability-client.ts'
import type { MeetingAvailability } from './meeting-capability-status.ts'
import s from './ManagedCapabilities.module.css'

export function capabilityDetailTab(tab: string, kind: ReturnType<typeof capabilityManagement>) {
  return tab==='roles'||tab==='usage'?'usage':tab==='components'||tab==='defaults'&&kind==='browser'?'components':'settings'
}
export function ManagedCapabilityDetail({item,data,tab,onTab,busy,meetingStatus,requirementsStatus,requirementsError,refreshMeeting,refreshRequirements,acceptRequirements,onEditing,onEdit,onRemove,onRestore,onCopy,onToggle,onCheck,onConfigure,onRole,compositionReturn,onReturnComposition}: {
 item:Capability;data:Snapshot;tab:string;onTab:(tab:string)=>void;busy:boolean;meetingStatus:MeetingAvailability|null;requirementsStatus:RequirementAvailability|null;requirementsError:string;refreshMeeting:()=>Promise<void>;refreshRequirements:()=>Promise<void>;acceptRequirements:(value:RequirementAvailability)=>void;onEditing:(value:boolean)=>void;onEdit:(composition?:boolean)=>void;onRemove:()=>void;onRestore:()=>void;onCopy:()=>void;onToggle:(enabled:boolean)=>void;onCheck:(start?:boolean)=>void;onConfigure:()=>void;onRole:(id:string)=>void;compositionReturn:boolean;onReturnComposition:()=>void
}) {
 const kind=capabilityManagement(data,item), current=capabilityDetailTab(tab,kind),version=latest(item.versions),definition=capabilityDisplayDefinition(item)
 const presentation=capabilityPresentation(data,item,version,meetingStatus,requirementsError?{error:requirementsError}:requirementsStatus)
 const changed=capabilityHasUnpublishedChanges(item), impact=capabilityImpact(data,item.id), disabled=busy||!!item.removedAt
 const target=useRef<HTMLDivElement>(null)
 useEffect(()=>{if(tab==='defaults'||tab==='instructions')target.current?.querySelector<HTMLElement>(tab==='instructions'?'[data-capability-instructions]':'[data-capability-config]')?.scrollIntoView?.({block:'nearest'})},[tab,item.id])
 return <div ref={target} data-meeting-capability-detail={kind==='meeting-asr'||undefined} data-workflow-capability-detail={kind!=='browser'?item.id:undefined}>
  <div className={s.heading}><div className={s.detailIdentity}><CapabilityGlyph kind={presentation.icon}/><div><h3>{definition.name}</h3><small className={s.muted}>{version?`已发布 v${version.version}`:'未发布草稿'}{changed?' · 有未发布修改':''}</small></div></div><div className={s.actions}>{item.removedAt?<button className={s.button} disabled={busy} onClick={onRestore}>恢复能力</button>:<><button className={s.button} onClick={()=>onEdit()}>编辑能力</button><button className={`${s.iconButton} ${s.removeAction}`} disabled={busy} aria-label={`移除能力：${definition.name}`} title={`移除能力：${definition.name}`} onClick={onRemove}><CapabilityActionIcon kind="remove"/></button></>}</div></div>
  <p className={s.detailDescription}>{definition.description}</p>
  {changed&&<p className={s.muted}>当前展示已发布版本。名称、说明和组件的草稿修改发布后才由新采用的岗位使用。</p>}
  {item.removedAt&&<p className={s.notice}>此能力已移除，配置与岗位引用已保留。恢复后可继续编辑，并按需手动启用。</p>}
  <div className={s.tabs} aria-label="能力详情">{[['settings','设置'],['components','组件'],['usage','使用情况']].map(([value,label])=><button key={value} aria-pressed={current===value} onClick={()=>onTab(value!)}>{label}</button>)}</div>
  {current==='settings'&&<>
   <div className={s.row}><div><strong>{presentation.label}</strong><small>{presentation.message}</small>{kind==='browser'&&<small>检测时间：{data.health.checkedAt?new Date(data.health.checkedAt).toLocaleString():'尚未检测'}</small>}</div><div className={s.actions}>{kind==='browser'?<><button className={`${s.button} ${data.health.state==='ready'?s.primary:''}`} disabled={disabled} onClick={()=>onCheck()}>检测连接</button><button className={`${s.button} ${data.health.state==='ready'?'':s.primary}`} disabled={disabled} onClick={()=>onCheck(true)}>启动本地连接</button></>:kind==='requirements'||kind==='meeting-asr'?<button className={s.button} disabled={busy} onClick={()=>void(kind==='requirements'?refreshRequirements():refreshMeeting())}>刷新状态</button>:null}</div></div>
   <label className={s.check}><input type="checkbox" checked={item.enabled} disabled={disabled} onChange={e=>onToggle(e.target.checked)}/>启用此能力</label>
   <p className={s.muted}>停用将阻止后续调用，保留配置、岗位引用与历史记录。影响范围：{impact.roles.length} 个岗位、{impact.tasks.length} 个活动会话。</p>
   {compositionReturn&&<button className={s.button} onClick={onReturnComposition}>← 返回组件组合</button>}
   <div data-capability-config>{kind==='developer'?<DeveloperProjectSettings disabled={!!item.removedAt} onEditingChange={onEditing}/>:kind==='requirements'?<>{requirementsError&&<p className={s.error} role="alert">{requirementsError}</p>}<RequirementsSettings status={requirementsStatus} onSaved={acceptRequirements} disabled={!!item.removedAt} onEditingChange={onEditing}/></>:kind==='meeting-asr'?<><MeetingAsrSettings status={meetingStatus} refresh={refreshMeeting} disabled={!!item.removedAt} onEditingChange={onEditing}/><p className={s.muted}>录音会发送至你配置的识别服务，纪要由工作台已配置的模型生成。接口已配置不代表转写已验证。</p></>:!kind?<p className={s.notice}>请在组件中检查各项配置与适配范围。</p>:null}</div>
   <details key={`instructions:${item.id}:${tab==='instructions'}`} open={tab==='instructions'||undefined} className={s.detailDisclosure} data-capability-instructions><summary>使用说明</summary><p className={s.versionValue}>{definition.instructions||'尚未填写使用说明。'}</p><button className={s.button} disabled={!!item.removedAt} onClick={()=>onEdit()}>编辑说明</button></details>
   <details className={s.detailDisclosure}><summary>技术信息与版本</summary><p>{item.source==='builtin'?'内置能力':'我的能力'} · {item.id}</p><p>{version?`当前发布 v${version.version}`:'尚未发布'} · {item.versions.length} 个历史版本</p><p className={s.muted}>恢复历史版本需先进入编辑能力，将历史内容恢复到草稿，再检查并发布。</p>{kind==='browser'&&!item.removedAt&&<button className={s.button} disabled={busy} onClick={onCopy}>复制为我的能力</button>}</details>
  </>}
  {current==='components'&&<>
   <details className={s.detailDisclosure}><summary>已发布动作</summary><p>{actionsOf(version).map(a=>actionNames[a]).join('、')||'无'}</p>{kind==='browser'&&<p>岗位可覆盖为更少的动作。点击、填写、提交和站点白名单尚未开放。</p>}</details>
   <ComponentRelations key={`relations:${item.id}`} data={data} capabilityId={item.id} meetingStatus={meetingStatus} requirementsStatus={requirementsStatus} onConfigure={onConfigure} onEdit={()=>onEdit(true)}/>
  </>}
  {current==='usage'&&<>{impact.roles.map(role=>{const binding=latest(role.versions)?.capabilities.find(b=>b.capabilityId===item.id),draft=role.draft.capabilities.find(b=>b.capabilityId===item.id);return <div className={s.row} key={role.id}><div><strong>{role.draft.name}</strong><small>{binding?`已发布岗位 v${latest(role.versions)!.version} · 采用能力 v${binding.version}`:'仅草稿关联'}{draft&&draft.version!==binding?.version?` · 草稿采用 v${draft.version}`:''} · {role.enabled?'启用':'停用'}</small></div><button className={s.button} onClick={()=>onRole(role.id)}>编辑岗位 →</button></div>})}{!impact.roles.length&&<div className={s.empty}><p>尚无岗位使用此能力。</p><button className={s.button} onClick={()=>openCapabilityLink({section:'agent-presets'})}>管理岗位助手 →</button></div>}</>}
 </div>
}
