import React, { useState, type CSSProperties } from 'react'
import type { RoleIconId, RoleIconSpec } from '../../../dsh-capabilities/src/core/appearance.ts'
import { roleCatalog, roleIds } from './role-catalog.ts'
import r from './Roles.module.css'

export const roleIconOptions: readonly { id: RoleIconId; name: string }[] = [
  { id: 'analyst', name: '需求清单' }, { id: 'chart', name: '数据分析' }, { id: 'marketing', name: '市场推广' },
  { id: 'manager', name: '项目计划' }, { id: 'developer', name: '开发编程' }, { id: 'browser', name: '网页浏览' },
  { id: 'book', name: '知识资料' }, { id: 'document', name: '文档写作' }, { id: 'search', name: '资料检索' },
  { id: 'support', name: '客户服务' }, { id: 'briefcase', name: '业务工作' }, { id: 'idea', name: '创意构思' },
  { id: 'chat', name: '自由交流' },
]
export function roleAppearanceDefaults(roleId?: string): { color: string; icon: RoleIconSpec } {
  const id = roleId === 'chat' ? 'chat' : roleIds.find(id => roleId === `builtin-${id}`) ?? 'analyst'
  return { color: id === 'chat' ? '#78869f' : roleCatalog[id].color, icon: { kind: 'builtin', id } }
}
export function roleAppearanceIconId(roleId?: string, icon?: RoleIconSpec): RoleIconId | 'png' {
  if (icon?.kind === 'png') return 'png'
  if (icon?.kind === 'builtin' && roleIconOptions.some(option => option.id === icon.id)) return icon.id
  return (roleAppearanceDefaults(roleId).icon as { kind: 'builtin'; id: RoleIconId }).id
}
export function appearanceStyle(color: string): CSSProperties {
  const rgb = /^#[0-9a-f]{6}$/i.test(color) ? [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4) : [0, 0, 0]
  const luminance = .2126 * rgb[0]! + .7152 * rgb[1]! + .0722 * rgb[2]!
  return { '--role-color': color, '--role-on-color': luminance > .179 ? '#111111' : '#ffffff' } as CSSProperties
}
function Glyph({ id }: { id: RoleIconId }) {
  const paths = {
    analyst: <><rect x="5" y="5" width="14" height="16" rx="2"/><path d="M9 5V3h6v2M9 10h6M9 14h6M9 18h3"/></>,
    marketing: <path d="M4 10h4l11-5v14L8 14H4zM8 14l2 6H6l-2-6M22 10v4"/>,
    manager: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M7 15l2 2 4-4M16 15h2"/></>,
    developer: <path d="m7 7-5 5 5 5M17 7l5 5-5 5M14 4l-4 16"/>,
    chat: <path d="M20 11.5a8 8 0 0 1-8 8H5l-3 2V11.5a9 9 0 0 1 18 0Z"/>,
    chart: <><path d="M3 3v18h18M8 16v-5M13 16V7M18 16v-8"/></>,
    book: <><path d="M12 5C9 3 6 3 3 4v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1ZM12 5v15"/></>,
    document: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9ZM14 3v6h6M8 13h8M8 17h5"/></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
    support: <><path d="M4 14v-3a8 8 0 0 1 16 0v6a4 4 0 0 1-4 4h-3"/><rect x="3" y="11" width="4" height="7" rx="2"/><rect x="17" y="11" width="4" height="7" rx="2"/></>,
    briefcase: <><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V3h8v4M8 7v14M16 7v14"/></>,
    idea: <><path d="M9 18v-2c0-2-4-3-4-7a7 7 0 0 1 14 0c0 4-4 5-4 7v2M9 18h6M10 22h4"/></>,
    browser: <><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/></>,
  }
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{paths[id]}</svg>
}

/** All role surfaces share the same fallback and never tint custom PNG pixels. */
export function RoleAppearanceIcon({ roleId, icon, color, className }: { roleId?: string; icon?: RoleIconSpec; color: string; className?: string }) {
  const [failedImage, setFailedImage] = useState<{ assetId: string; icon: RoleIconSpec | undefined } | null>(null)
  const asset = icon?.kind === 'png' && /^[a-f0-9]{64}$/.test(icon.assetId) ? icon.assetId : undefined
  const id = roleAppearanceIconId(roleId, icon)
  const fallback = (roleAppearanceDefaults(roleId).icon as { kind: 'builtin'; id: RoleIconId }).id
  // A saved/refreshed icon is a new snapshot, even when repairing the same content hash.
  // Keep failures scoped to that snapshot so unrelated renders do not retry indefinitely.
  const showImage = asset !== undefined && !(failedImage?.assetId === asset && failedImage.icon === icon)
  return <span className={`${r.icon} ${className ?? ''}`} style={appearanceStyle(color)} data-role-appearance-icon={showImage ? 'png' : id === 'png' ? fallback : id} aria-hidden="true">
    {showImage ? <img key={asset} src={`/api/capabilities/icons/${asset}`} alt="" onError={() => setFailedImage({ assetId: asset, icon })}/> : <Glyph id={id === 'png' ? fallback : id}/>}
  </span>
}
