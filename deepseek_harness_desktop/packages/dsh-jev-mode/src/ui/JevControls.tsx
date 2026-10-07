import React,{useEffect,useState} from 'react'
import {jevClient,useJev,useJevScope} from './client.ts'
import {connectionName,modelSummary,modeLabel,stageName} from './view-model.ts'
import {JevTraceDetail} from './JevTraces.tsx'
import {consumeNavigation,openWorkbenchLink,pendingNavigation,returnNavigation,type WorkbenchLink} from '../../../dsh-plugin-manager/src/client/workbench-navigation.ts'
import {CapabilityActionIcon} from '../../../dsh-client-ui-plain-chat/src/client/ManagedCapabilityCards.tsx'
import s from '../../../dsh-client-ui-plain-chat/src/client/ManagedCapabilities.module.css'
import css from './JevControls.module.css'
export {JevSettings} from './JevSettings.tsx'

export function JevToggle(){
  const {data,error,busy}=useJev(),[notice,setNotice]=useState(''),enabled=data?.config.value.enabled??false
  const toggle=()=>{if(!data)return;if(!enabled&&data.connection?.state!=='ready'){openWorkbenchLink({section:'jev-mode',tab:'configuration'});return}void jevClient.save({...data.config.value,enabled:!enabled}).then(()=>setNotice('已保存，从下一轮生效')).catch(()=>{})}
  useEffect(()=>{if(!notice)return;const t=setTimeout(()=>setNotice(''),6000);return()=>clearTimeout(t)},[notice])
  return <div className={`${s.page} ${css.control}`} data-jev-control>
    <button className={`${s.button} ${css.toggle}`} type="button" role="switch" aria-label="JEV 模式" aria-checked={enabled} data-unavailable={enabled&&data?.state==='unavailable'} disabled={!data||busy} title={!enabled&&data?.connection?.state!=='ready'?'先选择并检查模型':data?.message??'正在加载 JEV 设置'} onClick={toggle}><span className={css.track}/><span>JEV · {modeLabel(data)}</span></button>
    <button type="button" className={s.iconButton} aria-label="JEV 设置" title="JEV 设置与运行轨迹" onClick={()=>openWorkbenchLink({section:'jev-mode'})}><CapabilityActionIcon kind="settings"/></button>
    {(error||notice)&&<div className={error?css.error:css.feedback} role={error?'alert':'status'}>{error||notice}{error&&<button className={s.button} onClick={()=>openWorkbenchLink({section:'jev-mode'})}>查看设置</button>}</div>}
  </div>
}
export function JevActivity({scope}:{scope?:string}){
  const {data,error}=useJevScope(scope),active=data?.active?.at(-1),trace=data?.traces.at(-1)
  if(!scope||!active&&!trace&&!error)return null
  return <div className={`${s.page} ${css.compact}`}>
    {error&&<p role="alert">本轮 JEV 状态暂时无法读取：{error}</p>}
    {active&&<p role="status">本轮 JEV {active.enabled?'开启':'关闭'} · 配置 v{active.revision}{active.enabled?' · '+(active.phase==='checking'?`正在${stageName[active.stage!]}（${Math.max(0,Math.floor((Date.now()-Date.parse(active.checkingSince!))/1000))} 秒）`:'等待业务步骤，检查结果见下方'):''}{active.phase==='checking'&&active.candidatePosition?' · 第 '+active.candidatePosition+'/'+active.candidateTotal+' 项 · '+active.model:''}{data&&active.revision!==data.config.revision?'；全局设置已变化，下一轮生效。':''}{active.enabled&&<> <button className={s.button} onClick={()=>openWorkbenchLink({section:'jev-mode',tab:'traces',scope})}>查看轨迹</button></>}</p>}
    {active?.phase==='checking'&&<small>立即停止请使用当前任务的“停止”按钮；全局开关不取消正在运行的轮次。</small>}
    {trace&&<><small className={s.muted}>{trace.runId===active?.id?'本轮最近结果':'历史检查结果（不是当前运行状态）'}</small><JevTraceDetail trace={trace}/></>}
  </div>
}
export function JevOverview(){const {data,readError}=useJev();return <div className={s.row}><div><strong>JEV 模式 · 全局{modeLabel(data)}</strong><small>{data?modelSummary(data.config.value):'正在读取候选模型'} · {data?.connection?connectionName[data.connection.state]:'正在读取状态'}</small><small>{readError||'所有岗位共用，无须逐个绑定组件。'}</small></div><button className={s.button} onClick={()=>openWorkbenchLink({section:'jev-mode'})}>配置与运行轨迹 ↗</button></div>}

/** Reuses the existing model settings; only adds a return path for a JEV-origin visit. */
export function JevModelReturn({children}:{children:React.ReactNode}){
  const [origin,setOrigin]=useState(()=>{const link=pendingNavigation('models');return link?.origin?.section==='jev-mode'?link.origin:undefined})
  useEffect(()=>{const initial=pendingNavigation('models');if(initial?.origin?.section==='jev-mode')consumeNavigation(initial);const open=(event:Event)=>{const link=(event as CustomEvent<WorkbenchLink>).detail;if(link.section==='models'){setOrigin(link.origin?.section==='jev-mode'?link.origin:undefined);if(link.origin?.section==='jev-mode')consumeNavigation(link)}};window.addEventListener('workbench-capability-link',open);return()=>window.removeEventListener('workbench-capability-link',open)},[])
  return <>{origin&&<div className={`${s.page} ${css.returnBar}`}><button className={s.button} onClick={()=>returnNavigation(origin)}>← 返回 JEV 模式</button><span className={s.muted}>返回后刷新本地模型列表。</span></div>}{children}</>
}
