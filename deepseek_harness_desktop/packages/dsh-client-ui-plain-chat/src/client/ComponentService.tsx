import React from 'react'
import { type Component, type Snapshot } from '../../../dsh-capabilities/src/core/model.ts'
import type { MeetingAvailability } from './meeting-capability-status.ts'
import s from './ManagedCapabilities.module.css'

import type { RequirementAvailability } from '../../../dsh-capabilities/src/core/requirements-model.ts'
type Context = { data: Snapshot; meetingStatus?: MeetingAvailability | null; requirementsStatus?: RequirementAvailability | null }
type Presentation = { description: string; status: string; title: string; name: string; detail: string; configuration?: string; publishNotice: string }
/** Module differences live here; shared composition views never assume a browser environment. */
const adapters: Record<Component['management'], (context: Context) => Presentation> = {
  requirements: ({ requirementsStatus }) => ({
    description: '在需求工作区澄清问题、整理来源与条目、确认版本并生成需求文档。可由多个岗位引用同一能力；暂不支持复制或与浏览器执行能力混用。',
    status: requirementsStatus?.message ?? '正在读取需求分析配置…', title: '需求分析服务', name: '工作台模型与需求存储',
    detail: '整理深度、提问节奏和默认模型在同一配置入口保存。配置存在不代表模型实际调用已经通过。', configuration: '配置服务',
    publishNotice: '必须保留需求分析服务和动作才可发布。已保存任务与确认版本保留；岗位引用更新后新分析采用新版本。',
  }),
  browser: ({ data }) => ({
    description: '通过 BrowserSkill 在独立浏览器窗口中执行已授权的网页动作。',
    status: data.health.message, title: '浏览器环境', name: '本机 CLI 与浏览器扩展',
    detail: `${data.health.cliVersion ?? 'CLI 版本待检测'} · 环境连接单独管理，不作为可拆卸的组件关联。`,
    publishNotice: '新增动作仅由新版本采用。移除动作会立即限制引用此能力的旧会话，并停止正在使用它的浏览器任务。',
  }),
  'meeting-asr': ({ meetingStatus }) => ({
    description: '使用兼容音频转写接口识别录音。当前仅适配会议纪要助手流程；纪要模型在对话中选择。',
    status: meetingStatus?.ready ? '识别接口已配置 · 待实际调用验证' : meetingStatus?.message ?? '正在读取识别配置…',
    title: '语音识别服务', name: '兼容音频转写接口',
    detail: '接口配置独立保存，作用于新转写任务。工作台提供设置存储与纪要模型；凭据不会写入能力版本。',
    configuration: '配置服务',
    publishNotice: '当前会议流程必须保留转写组件和动作。发布新的能力版本不会清除录音、转写、纪要或服务配置；岗位是否采用新版本由下方选择决定。',
  }),
}
export function componentService(component: Component, context: Context): Presentation { return adapters[component.management](context) }
export function ComponentEnvironment({ component, data, meetingStatus, requirementsStatus, onConfigure, disabled = false }: Context & { component: Component; onConfigure?: () => void; disabled?: boolean }) {
  const info = componentService(component, { data, meetingStatus, requirementsStatus })
  return <div data-component-environment={component.management}><h4>{info.title}</h4><div className={s.row}><div><strong>{info.name}</strong><small>{info.status}</small><small>{info.detail}</small></div>{info.configuration && onConfigure && <button className={s.button} disabled={disabled} onClick={onConfigure}>{info.configuration}</button>}</div></div>
}
