import React,{useEffect,useLayoutEffect,useRef,useState} from 'react'
import {candidates,connectionConfig,type JevAccount,type JevConfig,type JevConnection} from '../core/contract.ts'
import {jevClient,useJev} from './client.ts'
import {connectionName,emptyFilters,diagnosticMatches,fieldValue,sameField,fieldErrors,fieldName,modeLabel,type TraceFilters} from './view-model.ts'
import {JevTraces} from './JevTraces.tsx'
import {JevAbout} from './JevAbout.tsx'
import {JevAdvanced,JevModelFields} from './JevModelFields.tsx'
import {consumeNavigation,pendingNavigation,restoredFrame,returnNavigation,useLeaveGuard,useNavigationFrame,type WorkbenchLink} from '../../../dsh-plugin-manager/src/client/workbench-navigation.ts'
import s from '../../../dsh-client-ui-plain-chat/src/client/ManagedCapabilities.module.css'
import css from './JevControls.module.css'

type PageView={tab:string;advanced:boolean;technical:boolean;filters:TraceFilters;expanded:string[];scroll:number;scope?:string}
function initialView(link?:WorkbenchLink):PageView {const restored=restoredFrame(link?.restore,'jev-mode')?.view;return {tab:'configuration',advanced:false,technical:false,filters:{...emptyFilters},expanded:[],scroll:0,...restored,...(link?.tab?{tab:link.tab}:{}),...(link?.scope?{scope:link.scope}:{})}}
function scrollParent(node:HTMLElement|null){let p=node?.parentElement;while(p){if(/auto|scroll/.test(getComputedStyle(p).overflowY))return p;p=p.parentElement}return document.scrollingElement as HTMLElement|null}
export function JevSettings(){
  const {data,readError,saveError,checkError,busy,checkBusy}=useJev()
  const [entry]=useState(()=>pendingNavigation('jev-mode')),[origin,setOrigin]=useState(entry?.origin),[view,setView]=useState(()=>initialView(entry))
  const [draft,setDraft]=useState<JevConfig|null>(null),[base,setBase]=useState<{revision:number;value:JevConfig}|null>(null),[accounts,setAccounts]=useState<JevAccount[]>([]),[accountError,setAccountError]=useState(''),[loadingAccounts,setLoadingAccounts]=useState(true),[message,setMessage]=useState(''),[checked,setChecked]=useState<{key:string;connection:JevConnection}|null>(null)
  const root=useRef<HTMLElement>(null),scroll=useRef(view.scroll),pendingScroll=useRef<number|undefined>(view.scroll),accountSequence=useRef(0),accountRequest=useRef<Promise<void>|null>(null)
  const value=draft??data?.config.value,invalid=value?fieldErrors(value):{},valid=Object.keys(invalid).length===0,conflict=!!draft&&base?.revision!==data?.config.revision
  const diagnostic=data?.diagnostic,checking=diagnostic?.status==='checking',candidateKey=value?connectionConfig(value):''
  const connection=!draft?data?.connection:checked?.key===candidateKey?checked.connection:undefined,canEnable=connection?.state==='ready'&&!checking
  const patchView=(patch:Partial<PageView>)=>setView(v=>({...v,...patch}))
  useLeaveGuard(!!draft,()=>setDraft(null))
  useNavigationFrame('jev-mode',1,()=>({section:'jev-mode',label:'JEV 模式',origin,view:{...view,scroll:scroll.current}}))
  useLayoutEffect(()=>{consumeNavigation(entry);const host=scrollParent(root.current);const track=()=>{if(pendingScroll.current===undefined)scroll.current=host?.scrollTop??0};host?.addEventListener('scroll',track);return()=>host?.removeEventListener('scroll',track)},[])
  // Account rows arrive asynchronously; restoring before they render can clamp the saved position.
  useLayoutEffect(()=>{if(!data||loadingAccounts||pendingScroll.current===undefined)return;const host=scrollParent(root.current);if(host){host.scrollTop=pendingScroll.current;scroll.current=host.scrollTop}pendingScroll.current=undefined},[data,loadingAccounts,view])
  useEffect(()=>{const navigate=(event:Event)=>{const link=(event as CustomEvent<WorkbenchLink>).detail;if(link.section!=='jev-mode')return;consumeNavigation(link);setOrigin(link.origin);const next=initialView(link);pendingScroll.current=next.scroll;setView(next)};window.addEventListener('workbench-capability-link',navigate);return()=>window.removeEventListener('workbench-capability-link',navigate)},[])
  const refreshAccounts=()=>{
    if(accountRequest.current)return accountRequest.current
    const seq=++accountSequence.current;setLoadingAccounts(true);setAccountError('')
    const request=(async()=>{try{const list=await jevClient.api<JevAccount[]>('accounts');if(seq===accountSequence.current)setAccounts(list)}catch(e){if(seq===accountSequence.current)setAccountError((e as Error).message)}finally{if(seq===accountSequence.current){setLoadingAccounts(false);accountRequest.current=null}}})()
    accountRequest.current=request;return request
  }
  useEffect(()=>{void refreshAccounts();const focus=()=>void refreshAccounts();window.addEventListener('focus',focus);return()=>{accountSequence.current++;accountRequest.current=null;window.removeEventListener('focus',focus)}},[])
  useEffect(()=>{if(!value||!valid)return;let live=true;const timer=setTimeout(()=>{void jevClient.api<JevConnection>('connection',{value}).then(connection=>{if(live)setChecked({key:candidateKey,connection})}).catch(()=>{if(live)setChecked(null)})},150);return()=>{live=false;clearTimeout(timer)}},[candidateKey,valid,diagnostic?.status,accounts,data?.config.revision])
  const change=(patch:Partial<JevConfig>)=>{if(!value||!data)return;if(!draft)setBase({revision:data.config.revision,value:data.config.value});setDraft({...value,...patch});setMessage('');jevClient.clearSaveError()}
  const save=async()=>{if(!draft||!base||!valid)return;try{await jevClient.save(draft,base.revision);setDraft(null);setBase(null);setMessage('已保存；所有岗位从下一轮采用此设置')}catch{void jevClient.refresh()}}
  const test=(target=value)=>{if(target&&valid)void jevClient.check(target).then(()=>jevClient.refresh()).catch(()=>{})}
  const tabs=[['configuration','配置与状态'],['traces','运行轨迹'],['about','模块与扩展']]
  const tabKeys=(event:React.KeyboardEvent<HTMLDivElement>)=>{if(!(event.target instanceof HTMLElement)||event.target.getAttribute('role')!=='tab')return;const index=tabs.findIndex(([id])=>id===view.tab),next=event.key==='Home'?0:event.key==='End'?2:event.key==='ArrowRight'?(index+1)%3:event.key==='ArrowLeft'?(index+2)%3:-1;if(next<0)return;event.preventDefault();patchView({tab:tabs[next]![0]!});event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus()}
  return <section ref={root} className={`${s.page} ${css.page}`} data-jev-settings>
    <div className={s.heading}><div><h2>JEV 模式</h2><span className={s.muted}>独立的全局附加功能 · {modeLabel(data)}</span></div>{origin&&<button className={s.button} onClick={()=>returnNavigation(origin)}>← 返回{origin.label}</button>}</div>
    <p className={s.notice}>所有岗位共用开关和候选顺序，切换岗位或重启后保留。修改从下一轮生效。</p>
    {readError&&<div className={css.error} role="alert">状态读取失败：{readError} <button className={s.button} onClick={()=>void jevClient.refresh()}>重新读取</button></div>}
    <div className={s.tabs} role="tablist" aria-label="JEV 设置栏目" onKeyDown={tabKeys}>{tabs.map(([id,label])=><button key={id} id={'jev-tab-'+id} role="tab" aria-selected={view.tab===id} aria-controls={'jev-panel-'+id} tabIndex={view.tab===id?0:-1} onClick={()=>patchView({tab:id!})}>{label}</button>)}</div>
    <div id={'jev-panel-'+view.tab} role="tabpanel" aria-labelledby={'jev-tab-'+view.tab} tabIndex={0}>
    {view.tab==='configuration'&&(value?<>
      <div className={css.connectionSummary}><div><strong>模型连接 · {connection?connectionName[connection.state]:'正在读取'}</strong><small>{!candidates(value).length?'添加已有模型，并开启需要参与检查的候选项。':connection?.message??'正在核对当前配置的检查记录'}</small>{connection?.checkedAt&&<small>最近检查：{new Date(connection.checkedAt).toLocaleString()}</small>}</div><span className={s.badge}>{value.connectionMode==='account'?'复用模型账号':'严格内网'}</span></div>
      <fieldset className={s.compositionFieldset} disabled={busy}><div className={s.fields}>
        <label className={s.field}>模型连接方式<select aria-label="JEV 模型连接方式" value={value.connectionMode??'intranet'} disabled={!!checking||checkBusy} onChange={e=>{setChecked(null);change({connectionMode:e.target.value as JevConfig['connectionMode']})}}><option value="intranet">严格内网</option><option value="account">复用模型账号（可含公网）</option></select><small>{value.connectionMode==='account'?'使用模型设置中的地址、凭据与协议。检查和运行会将待审查内容发送给所选模型服务；不调用 Jev 官网。':'仅允许内网地址。公网 DeepSeek 账号请选“复用模型账号”，内网部署继续使用此项。'}</small></label>
        <JevModelFields value={value} accounts={value.connectionMode==='account'?accounts.map(a=>({...a,...(a.configured??{available:false,message:'请刷新模型列表以读取账号连接状态'})})):accounts} loading={loadingAccounts} refresh={()=>void refreshAccounts()} change={change} connection={connection} test={test} checking={!!checking||checkBusy} disabled={busy}/>
        {accountError&&<p className={css.error} role="alert">模型列表读取失败：{accountError}</p>}
        <div className={s.card} aria-label="模型连接检查"><div className={s.actions}><button className={s.button} disabled={!candidates(value).some(c=>c.enabled)||!valid||checking||checkBusy} onClick={()=>test()}>{checking?'正在检查…':'检查启用模型'}</button>{checking&&<button className={s.button} disabled={checkBusy} onClick={()=>void jevClient.cancel(diagnostic!.id).then(()=>jevClient.refresh()).catch(()=>{})}>取消检查</button>}</div><small className={s.muted}>关闭模式时也可检查，使用当前输入的配置；不会保存草稿或开启全局模式。</small>{diagnostic&&<div role={diagnostic.status==='failed'?'alert':'status'} className={diagnostic.status==='failed'?css.error:undefined}><p>{diagnostic.message} · {(diagnostic.elapsedMs/1000).toFixed(1)} 秒</p><details><summary>检查详情</summary><p>{new Date(diagnostic.startedAt).toLocaleString()}</p><ol className={css.attempts}>{diagnostic.attempts?.map((a,i)=><li key={i}>{a.position}. {a.model} · {a.summary} · {(a.elapsedMs/1000).toFixed(1)} 秒</li>)}</ol>{!diagnosticMatches(diagnostic.config,value)&&<p>检查项已被移除或参数已变化，请检查当前候选配置。</p>}{diagnostic.decision&&<p>{diagnostic.decision.summary}</p>}</details></div>}{checkError&&<p className={css.error} role="alert">{checkError}</p>}</div>
        <label className={s.field}>全局开关<select aria-label="JEV 全局开关" value={String(value.enabled)} onChange={e=>change({enabled:e.target.value==='true'})}><option value="false">关闭</option><option value="true" disabled={!canEnable&&!value.enabled}>开启</option></select><small>{canEnable?'连接检查已通过，可以开启并保存。':'至少一个已开启候选项检查通过后可开启全局模式；关闭候选项不影响岗位设置。'}</small></label>
        <JevAdvanced value={value} accounts={accounts} open={view.advanced} setOpen={advanced=>patchView({advanced})} change={change}/>
      </div></fieldset>
      {conflict&&data&&base&&draft&&<div className={s.notice} role="alert"><strong>其他位置已更新配置，当前草稿仍保留。</strong><p>核对下列差异后，以最新配置为基准继续编辑；相同字段仍保留你的输入，保存前请确认。</p><ul>{(Object.keys(fieldName) as (keyof JevConfig)[]).filter(key=>!sameField(base.value[key],data.config.value[key])||!sameField(base.value[key],draft[key])).map(key=><li key={key}>{fieldName[key]}：最新值 {fieldValue(data.config.value[key])}；草稿值 {fieldValue(draft[key])}</li>)}</ul><button className={s.button} onClick={()=>{const rebased={...data.config.value};for(const key of Object.keys(fieldName) as (keyof JevConfig)[])if(!sameField(draft[key],base.value[key]))Object.assign(rebased,{[key]:draft[key]});setDraft(rebased);setBase({revision:data.config.revision,value:data.config.value});jevClient.clearSaveError();setMessage('已加载最新基准并保留你的改动，请核对后保存')}}>保留草稿，加载最新基准</button></div>}
      {saveError&&<p className={css.error} role="alert">保存失败：{saveError}</p>}
      {draft&&<div className={css.footer}><button className={s.button} disabled={busy} onClick={()=>{setDraft(null);setBase(null);jevClient.clearSaveError();setMessage('已取消本页修改')}}>取消修改</button><button className={`${s.button} ${s.primary}`} disabled={busy||conflict||!valid||value.enabled&&!canEnable} onClick={()=>void save()}>保存配置</button>{value.enabled&&!canEnable&&<small>当前模型配置需要检查通过后才能保存为开启状态；也可以先关闭并保存。</small>}</div>}
      {message&&<p className={css.saveMessage} role="status">{message}</p>}
    </>:<p role="status">正在读取配置…</p>)}
    {view.tab==='traces'&&<>{view.scope&&<p className={s.notice}>仅显示当前会话 <button className={s.button} onClick={()=>patchView({scope:undefined})}>查看全部会话</button></p>}<JevTraces traces={(data?.traces??[]).filter(t=>!view.scope||t.scope===view.scope)} filters={view.filters} setFilters={filters=>patchView({filters})} expanded={view.expanded} setExpanded={expanded=>patchView({expanded})}/></>}
    {view.tab==='about'&&<JevAbout data={data} technical={view.technical} setTechnical={technical=>patchView({technical})} configure={()=>patchView({tab:'configuration'})}/>}
    </div>
  </section>
}
