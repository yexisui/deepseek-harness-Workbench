import React from 'react'
import {descriptor,type JevStatus} from '../core/contract.ts'
import {connectionName,modelSummary,modeLabel} from './view-model.ts'
import {openWorkbenchLink} from '../../../dsh-plugin-manager/src/client/workbench-navigation.ts'
import s from '../../../dsh-client-ui-plain-chat/src/client/ManagedCapabilities.module.css'
import css from './JevControls.module.css'
export function JevAbout({data,technical,setTechnical,configure}:{data:JevStatus|null;technical:boolean;setTechnical:(open:boolean)=>void;configure:()=>void}){return <>
  <div className={s.row}><div><strong>全局{modeLabel(data)} · {data?.connection?connectionName[data.connection.state]:'正在加载'}</strong><small>{data?modelSummary(data.config.value):'正在读取候选模型'}</small></div><button className={s.button} onClick={configure}>配置与检查</button></div>
  <h3>开启后如何工作</h3><ol className={css.workflow}><li><strong>任务评估</strong><p>梳理目标、依据与缺失信息。</p></li><li><strong>关键动作检查</strong><p>执行前核对目标、权限和证据。</p></li><li><strong>结果复核</strong><p>检查结果与完成声明是否有依据。</p></li></ol>
  <h3>岗位覆盖</h3><div className={s.grid}>{[['自由聊天与通用岗位','开始评估、工具动作检查、结束复核。'],['需求分析','评估任务，复核通过后采用候选内容。'],['开发助手','写入前检查；仍须满足原岗位权限和文件版本要求。'],['会议纪要','依据转写内容复核，通过后保存新纪要。']].map(([title,text])=><article className={s.card} key={title}><strong>{title}</strong><p>{text}</p><small className={s.muted}>已接入 · 使用全局设置</small></article>)}</div><p>无需逐个岗位绑定。JEV 不授予额外权限；检查失败会停止相关自动步骤，已经完成的操作不自动撤销。</p>
  <h3>模型接入与后续扩展</h3><div className={s.row}><div><strong>工作台模型 · 当前接入方式</strong><small>支持严格内网或显式复用模型账号，独立维护候选顺序，技术失败时依序切换。</small></div><button className={s.button} onClick={()=>openWorkbenchLink({section:'models'})}>管理模型账号 ↗</button></div><div className={s.row}><div><strong>Jev 官方服务 · 尚未接入</strong><small>已预留扩展接口，当前没有官网请求或官网 KEY 配置。后续接入需实现适配器。</small></div><span className={s.badge}>预留</span></div>
  <details className={s.compositionInfo} open={technical} onToggle={e=>setTechnical(e.currentTarget.open)}><summary>技术信息与能力边界</summary><p>{descriptor.provider} · {descriptor.version}</p><p>代码、配置与轨迹独立管理。严格内网传输拒绝公网目标和重定向；复用账号时使用现有模型适配器，目标与模型设置一致。模型判断不等同于官方 Jev 能力或实际测试通过；不保存完整思维过程。原生流式回答可能先于结束复核显示。</p></details>
</>}
