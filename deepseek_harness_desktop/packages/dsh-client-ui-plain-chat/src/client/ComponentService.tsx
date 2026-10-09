import React from 'react'
import { actionNames, type Component, type Snapshot } from '../../../dsh-capabilities/src/core/model.ts'
import type { MeetingAvailability } from './meeting-capability-status.ts'
import s from './ManagedCapabilities.module.css'

import type { RequirementAvailability } from '../../../dsh-capabilities/src/core/requirements-model.ts'
type Context = { component?: Component; data: Snapshot; meetingStatus?: MeetingAvailability | null; requirementsStatus?: RequirementAvailability | null }
type Presentation = { description: string; summary?: string; status: string; title: string; name: string; detail: string; configuration?: string }
/** Module differences live here; shared composition views never assume a browser environment. */
const adapters: Record<Component['management'], (context: Context) => Presentation> = {
  package: ({data,component}) => ({description:'能力包自带的执行组件，动作使用当前设置运行。',status:data.packages?.find(h=>component?.capabilityIds?.includes(h.capabilityId))?.message??'正在读取能力包状态',title:'能力包执行器',name:'本机 Node.js 组件',detail:'构建文件随能力分发，工作台模型账号留在本机。可在设置页配置、运行或停止。',configuration:'能力设置',publishNotice:'草稿不影响现有任务；缩小动作范围或停用会撤销后续调用。已有岗位保持固定版本。'}),
  developer: () => ({ description: '在开发工作区读取项目、按任务授权编辑、查看真实 Git 差异并运行已确认的检查。', status: '项目和服务可用性在开发工作区实际检测', title: '开发工作区服务', name: '项目文件、共享 Git 服务与验证进程', detail: '模型沿用工作台账户。验证命令、编辑器在每个项目的“项目设置”统一保存；每个开发任务默认只读。' }),
  requirements: ({ requirementsStatus }) => ({
    description: '在需求工作区澄清问题、整理来源与条目、整理内容并生成需求文档。可由多个岗位引用同一能力；暂不支持复制或与浏览器执行能力混用。',
    status: requirementsStatus?.message ?? '正在读取需求分析配置…', title: '需求分析服务', name: '工作台模型与需求存储',
    detail: '整理深度、提问节奏和默认模型在同一配置入口保存。配置存在不代表模型实际调用已经通过。', configuration: '配置服务',
  }),
  browser: ({ data }) => ({
    description: '通过 BrowserSkill 在独立浏览器窗口中执行已授权的网页动作。',
    status: data.health.message, title: '浏览器环境', name: '本机 CLI 与浏览器扩展',
    detail: '浏览器连接由工作台统一管理。',
  }),
  'meeting-asr': ({ meetingStatus }) => ({
    description: '使用兼容音频转写接口识别录音。当前仅适配会议纪要助手流程；纪要模型在对话中选择。',
    status: meetingStatus?.ready ? '识别接口已配置 · 待实际调用验证' : meetingStatus?.message ?? '正在读取识别配置…',
    title: '语音识别服务', name: '兼容音频转写接口',
    detail: '从模型模块选择识别模型并检测，地址与凭据统一管理。保存选择后作用于新转写任务；凭据由模型设置统一管理。',
    configuration: '配置服务',
  }),
}
export function componentService(component: Component, context: Context): Presentation {
  const presentation = adapters[component.management]({...context,component})
  return { ...presentation, summary: component.actions.length ? component.actions.map(action => component.actionLabels?.[action] ?? actionNames[action] ?? action).join('、') : presentation.description }
}
export function ComponentEnvironment({ component, data, meetingStatus, requirementsStatus, onConfigure, disabled = false }: Context & { component: Component; onConfigure?: () => void; disabled?: boolean }) {
  const info = componentService(component, { data, meetingStatus, requirementsStatus })
  return <div data-component-environment={component.management}><h4>{info.title}</h4><div className={s.row}><div><strong>{info.name}</strong><small>{info.status}</small><small>{info.detail}</small></div>{info.configuration && onConfigure && <button className={s.button} disabled={disabled} onClick={onConfigure}>{info.configuration}</button>}</div></div>
}
