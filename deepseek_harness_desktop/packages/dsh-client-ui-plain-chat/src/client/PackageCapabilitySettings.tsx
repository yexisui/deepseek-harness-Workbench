import { PillCheckbox } from '../../../../shared/client/PillCheckbox.tsx'
import React, { useEffect, useState } from 'react'
import { latest, type Capability, type Snapshot } from '../../../dsh-capabilities/src/core/model.ts'
import type { PackageJob } from '../../../dsh-capabilities/src/host/package-runner.ts'
import { packageActionId } from '../../../dsh-capabilities/src/core/distribution.ts'
import { useLeaveGuard } from '../../../dsh-plugin-manager/src/client/workbench-navigation.ts'
import { packageRequest } from './CapabilityDistribution.tsx'
import { capabilityClient } from './capability-client.ts'
import s from './ManagedCapabilities.module.css'

const jobNames={running:'执行中',stopping:'正在停止',stopped:'已停止',done:'执行成功',error:'执行失败'}
export function PackageCapabilitySettings({item,data}:{item:Capability;data:Snapshot}){
  const version=latest(item.versions),release=version?.packageHash?data.state.packageReleases?.[version.packageHash]:undefined
  const health=data.packages?.find(h=>h.capabilityId===item.id)
  const actions=release?.manifest.components.flatMap(c=>c.actions.filter(a=>version?.components.some(p=>p.actions.includes(packageActionId(release.manifest.id,c.id,a.id)))).map(a=>({...a,key:packageActionId(release.manifest.id,c.id,a.id)})))??[]
  const [model,setModel]=useState(data.state.packageModels?.[item.id]??''),[configRevision,setConfigRevision]=useState<number|null>(null)
  const [action,setAction]=useState(actions[0]?.key??''),[input,setInput]=useState(''),[jsonInput,setJsonInput]=useState(false)
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('')
  const [jobs,setJobs]=useState<PackageJob[]>([]),[job,setJob]=useState<PackageJob|null>(null)
  useLeaveGuard(configRevision!==null,()=>{setModel(data.state.packageModels?.[item.id]??'');setConfigRevision(null)})
  useEffect(()=>{if(configRevision===null)setModel(data.state.packageModels?.[item.id]??'')},[data.state.revision,configRevision,item.id])
  useEffect(()=>{if(!actions.some(a=>a.key===action))setAction(actions[0]?.key??'')},[version?.version])
  useEffect(()=>{let alive=true;void packageRequest<PackageJob[]>(`tasks?id=${encodeURIComponent(item.id)}`).then(v=>{if(alive)setJobs(v)}).catch(e=>{if(alive)setError(e.message)});return()=>{alive=false}},[item.id,job?.status,data.state.revision])
  useEffect(()=>{
    const running=job&&['running','stopping'].includes(job.status)?job.id:jobs.find(j=>['running','stopping'].includes(j.status))?.id
    if(!running)return
    let alive=true
    const timer=setInterval(()=>{void packageRequest<PackageJob>(`task/${running}`).then(value=>{if(alive)setJob(value)}).catch(e=>{if(alive)setError(e.message)})},700)
    return()=>{alive=false;clearInterval(timer)}
  },[job?.id,job?.status,jobs.find(j=>['running','stopping'].includes(j.status))?.id])
  const run=async(work:()=>Promise<void>)=>{setBusy(true);setError('');setMessage('');try{await work()}catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}}
  const disabled=busy||!!item.removedAt,running=job&&['running','stopping'].includes(job.status)
  return <section aria-label="外部能力设置">
    {release?.manifest.permissions.includes('model')&&<><p className={s.muted}>模型账号复用工作台配置，模型选择只在本机保存。</p><label className={s.field}>工作台模型<input value={model} disabled={disabled} placeholder="留空使用工作台默认模型" maxLength={240} onChange={e=>{setModel(e.target.value);setConfigRevision(configRevision??data.state.revision)}}/><small>填写已配置的“提供方/模型”；账号和密钥在工作台模型设置中管理。</small></label>
      {(configRevision!==null||health?.needsModel)&&<div className={s.actions}><button className={s.button} disabled={disabled} onClick={()=>{setModel(data.state.packageModels?.[item.id]??'');setConfigRevision(null)}}>取消修改</button><button className={s.button} disabled={disabled} onClick={()=>void run(async()=>{await packageRequest('configure',{id:item.id,model,revision:configRevision??data.state.revision,enable:true});setConfigRevision(null);await capabilityClient.refresh(true);setMessage('配置已保存并启用；实际调用结果见任务记录。')})}>保存并启用</button></div>}
      {configRevision!==null&&configRevision!==data.state.revision&&<p className={s.notice}>能力清单已更新，当前输入保留；请取消修改后重新核对。</p>}
    </>}
    <div className={s.fields}><label className={s.field}>运行的动作<select value={action} disabled={disabled||!!running} onChange={e=>setAction(e.target.value as typeof action)}>{actions.map(a=><option key={a.key} value={a.key}>{a.name}</option>)}</select><small>{actions.find(a=>a.key===action)?.description}</small></label>
      <label className={s.field}>输入内容<textarea rows={5} disabled={disabled||!!running} value={input} maxLength={256000} onChange={e=>setInput(e.target.value)} placeholder="按动作说明填写要处理的内容"/></label></div>
    <details className={s.detailDisclosure}><summary>输入格式</summary><label className={s.check}><PillCheckbox type="checkbox" checked={jsonInput} disabled={disabled||!!running} onChange={e=>setJsonInput(e.target.checked)}/>按 JSON 对象或数组解析输入</label><p className={s.muted}>默认将输入作为文本传给动作；仅在能力说明要求时切换。</p></details>
    <div className={s.actions}><button className={`${s.button} ${s.primary}`} disabled={disabled||!item.enabled||!health?.ready||!action||!!running||configRevision!==null} onClick={()=>void run(async()=>{let value:unknown=input;if(jsonInput){try{value=JSON.parse(input)}catch{throw new Error('JSON 输入格式不正确')}};setJob(await packageRequest<PackageJob>('run',{id:item.id,version:version?.version,action,input:value}))})}>运行动作</button>{running&&<button className={s.button} disabled={busy} onClick={()=>void run(async()=>{setJob(await packageRequest<PackageJob>('stop',{id:job.id}))})}>停止任务</button>}</div>
    {job&&<div aria-live="polite"><p><strong>{jobNames[job.status]}</strong>{job.finishedAt?` · ${new Date(job.finishedAt).toLocaleString()}`:''}</p>{job.error&&<p className={s.error}>{job.error}</p>}{job.status==='done'&&<pre className={s.versionValue} style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',maxHeight:360,overflow:'auto'}}>{typeof job.output==='string'?job.output:JSON.stringify(job.output,null,2)}</pre>}</div>}
    <details className={s.detailDisclosure}><summary>最近任务（{jobs.length}）</summary>{jobs.map(j=><div key={j.id} className={s.row}><div><strong>{jobNames[j.status]}</strong><small>{new Date(j.createdAt).toLocaleString()}</small></div><button className={s.button} disabled={busy} onClick={()=>void run(async()=>setJob(await packageRequest<PackageJob>(`task/${j.id}`)))}>查看结果</button></div>)}{!jobs.length&&<p>尚未运行。安装就绪不代表任务已验证。</p>}</details>
    {message&&<p role="status">{message}</p>}{error&&<p className={s.error} role="alert">{error}</p>}
  </section>
}
