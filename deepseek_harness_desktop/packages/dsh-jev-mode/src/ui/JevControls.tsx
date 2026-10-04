import React, { useEffect, useState } from 'react'
import { descriptor, type JevConfig, type JevTrace } from '../core/contract.ts'
import { jevClient, useJev } from './client.ts'
import { openWorkbenchLink, pendingNavigation, returnNavigation, useLeaveGuard, useNavigationFrame } from '../../../dsh-plugin-manager/src/client/workbench-navigation.ts'
import s from '../../../dsh-client-ui-plain-chat/src/client/ManagedCapabilities.module.css'
import css from './JevControls.module.css'
const stageName={begin:'任务评估',action:'动作检查',review:'结果复核'}
const statusName={allowed:'通过',clarify:'待确认',blocked:'已阻止',error:'未完成'}
export function JevToggle(){
  const {data,error,busy}=useJev(),enabled=data?.config.value.enabled??false
  return <div className={css.control} data-jev-control>
    <button className={css.toggle} type="button" role="switch" aria-label="JEV 模式" aria-checked={enabled} data-unavailable={enabled&&data?.state==='unavailable'} disabled={!data||busy} title={data?.message??'正在加载 JEV 设置'} onClick={()=>{if(data)void jevClient.save({...data.config.value,enabled:!enabled}).catch(()=>{})}}><span className={css.track}/><span>JEV{enabled?(data?.state==='unavailable'?' · 待配置':' · 开启'):' · 关闭'}</span></button>
    <button type="button" className={css.settings} aria-label="JEV 设置" title="JEV 设置与运行轨迹" onClick={()=>openWorkbenchLink({section:'jev-mode'})}>⚙</button>
    {error&&<div className={css.error} role="alert">{error}<button type="button" onClick={()=>void jevClient.refresh()}>重新加载</button></div>}
  </div>
}
function Trace({trace}:{trace:JevTrace}){return <details className={css.trace}><summary>{stageName[trace.stage]} · {statusName[trace.status]} · {trace.summary}</summary><small>{new Date(trace.at).toLocaleString()} · {trace.elapsedMs} ms · 配置 v{trace.revision} · {trace.config.model} · {trace.scope}</small>{trace.decision?.checks.map((c,i)=><p key={i}>{c.criterion}：{({supported:'有依据',uncertain:'待核对',unsupported:'缺少依据'})[c.verdict]}。{c.evidence}</p>)}{trace.decision?.missing.map((m,i)=><p key={i}>待确认：{m}</p>)}</details>}
export function JevActivity({scope}:{scope?:string}){const {data}=useJev();const trace=scope?data?.traces.filter(t=>t.scope===scope).at(-1):undefined;if(!trace)return null;return <div className={css.compact}><Trace trace={trace}/></div>}
export function JevSettings(){
  const {data,error,busy}=useJev(),[draft,setDraft]=useState<JevConfig|null>(null),[revision,setRevision]=useState(0),[tab,setTab]=useState('configuration'),[accounts,setAccounts]=useState<{id:string;name:string;available:boolean;models:{id:string;name:string}[];message?:string}[]>([]),[message,setMessage]=useState(''),[checking,setChecking]=useState(false)
  const [origin]=useState(()=>pendingNavigation('jev-mode')?.origin)
  useLeaveGuard(draft!==null,()=>setDraft(null))
  useNavigationFrame('jev-mode',1,()=>({section:'jev-mode',label:'JEV 模式',origin}))
  useEffect(()=>{void jevClient.api<typeof accounts>('accounts').then(setAccounts).catch(()=>setMessage('模型列表暂时不可用，可填写已配置的提供方/模型标识'))},[])
  const models=accounts.filter(a=>a.available).flatMap(a=>a.models)
  const value=draft??data?.config.value
  const change=(patch:Partial<JevConfig>)=>{if(!value||!data)return;if(!draft)setRevision(data.config.revision);setDraft({...value,...patch});setMessage('')}
  const save=async()=>{if(!draft)return;try{await jevClient.save(draft,revision);setDraft(null);setMessage('已保存；所有岗位从下一轮采用此设置')}catch{}}
  const test=async()=>{setChecking(true);setMessage('正在检查所选内网决策模型…');try{await jevClient.api('check',{});setMessage('内网模型连接及决策格式检查通过')}catch(e){setMessage((e as Error).message)}finally{setChecking(false);void jevClient.refresh()}}
  return <section className={s.page} data-jev-settings>
    <div className={s.heading}><div><h2>JEV 模式</h2><span className={s.muted}>独立的全局附加功能 · {data?.state==='off'?'已关闭':data?.state==='ready'?'已配置':'待就绪'}</span></div>{origin&&<button className={s.button} onClick={()=>returnNavigation(origin)}>← 返回{origin.label}</button>}</div>
    <p className={s.notice}>{data?.message??'正在读取配置…'}。开关与决策模型由所有岗位共用；切换岗位、新建会话或重启后沿用已保存设置。进行中的轮次保留启动时配置。</p>
    <div className={s.tabs}>{[['configuration','配置与状态'],['traces','运行轨迹'],['about','模块与扩展']].map(([id,label])=><button key={id} aria-pressed={tab===id} onClick={()=>setTab(id!)}>{label}</button>)}</div>
    {tab==='configuration'&&value&&<><fieldset className={s.compositionFieldset} disabled={busy||checking}><div className={s.fields}>
      <label className={s.field}>全局开关<select value={String(value.enabled)} onChange={e=>change({enabled:e.target.value==='true'})}><option value="false">关闭</option><option value="true">开启</option></select></label>
      <label className={s.field}>执行后端<input value="自有内网模型" readOnly/><small>复用工作台已有模型账号。官方扩展接口预留，当前不启用。</small></label>
      <label className={s.field}>独立决策模型<input list="jev-models" value={value.model} maxLength={250} placeholder="提供方/模型标识" onChange={e=>change({model:e.target.value})}/><datalist id="jev-models">{models.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</datalist><small>可选择或填写已配置的内网模型。此选择独立于岗位对话模型。仅列出本地配置的模型，不联网发现；可用账号：{accounts.filter(a=>a.available).map(a=>a.id).join('、')||'暂无'}。</small></label>
      <label className={s.field}>决策模型思考强度<select value={value.reasoningEffort} onChange={e=>change({reasoningEffort:e.target.value as JevConfig['reasoningEffort']})}><option value="">模型默认</option><option value="low">低</option><option value="medium">中</option><option value="high">高</option></select><small>仅对支持 reasoning_effort 的内网接口设置；不改变岗位的思考强度。</small></label>
      <label className={s.field}>单次检查超时（秒）<input type="number" min={5} max={120} value={value.timeoutMs/1000} onChange={e=>change({timeoutMs:Number(e.target.value)*1000})}/></label>
      <label className={s.field}>每轮最多检查次数<input type="number" min={3} max={32} value={value.maxChecks} onChange={e=>change({maxChecks:Number(e.target.value)})}/></label>
      <label className={s.field}>检查上下文字符上限<input type="number" min={4000} max={64000} step={1000} value={value.maxContextChars} onChange={e=>change({maxContextChars:Number(e.target.value)})}/></label>
    </div><div className={s.confirmActions}>{draft&&<><button className={s.button} onClick={()=>setDraft(null)}>取消修改</button><button className={`${s.button} ${s.primary}`} disabled={revision!==data?.config.revision} onClick={()=>void save()}>保存配置</button></>}<button className={s.button} disabled={!!draft||!value.model||!value.enabled} onClick={()=>void test()}>检查内网模型</button><button className={s.button} onClick={()=>openWorkbenchLink({section:'models'})}>模型账号设置 ↗</button></div></fieldset>{draft&&revision!==data?.config.revision&&<p role="alert">设置已在其他位置更改，请取消修改后重新核对。当前输入仍保留。</p>}</>}
    {tab==='traces'&&<><p className={s.muted}>显示最近 60 项检查；本地最多保留 200 项。每项保留当轮配置、依据摘要、结果与耗时。模型判断不代表校准概率或测试通过。</p>{data?.traces.slice().reverse().map(trace=><Trace key={trace.id} trace={trace}/>)}{!data?.traces.length&&<p>尚无检查记录。开启并配置内网模型后，新一轮任务会产生记录。</p>}</>}
    {tab==='about'&&<><h3>独立管理</h3><p>{descriptor.provider} · {descriptor.version}</p><p>任务评估 → 关键动作检查 → 结果复核。通用岗位、自由聊天、需求分析、开发助手和会议纪要使用同一配置与决策服务。</p><p>岗位负责业务职责与权限。JEV 作为全局附加功能生效，无须逐个岗位绑定。</p><p>默认使用内网 Chat Completions 接口；账号凭据由现有工作台管理，不写入 JEV 配置或轨迹。新增官方后端时可实现统一的 JevBackend 接口，当前官方接口状态：尚未接入。</p></>}
    {(error||message)&&<p role={error?'alert':'status'}>{error||message}</p>}
  </section>
}
