import React, { useEffect, useState } from 'react'
import { consumeNavigation, openWorkbenchLink, pendingNavigation, restoredFrame, returnNavigation, useNavigationFrame, type WorkbenchLink } from '../../../dsh-plugin-manager/src/client/workbench-navigation.ts'
import { ManagedCenter } from './ManagedCenter.tsx'
import { ComponentCenter } from './ComponentCenter.tsx'
import { ExistingPluginSettings } from './SettingsSectionContent.tsx'
import s from './ManagedCapabilities.module.css'
import css from './UnifiedCenter.module.css'

type Area = 'capabilities' | 'components' | 'plugins'

/** Keep legacy component links working after removing their standalone section. */
export function centerArea(link?: WorkbenchLink): Area {
  const restored = restoredFrame(link?.restore, 'unified-center')?.view?.area
  if (restored === 'components' || restored === 'plugins' || restored === 'capabilities') return restored
  if (link?.section === 'component-center') return 'components'
  if (link?.section === 'plugins') return 'plugins'
  return 'capabilities'
}

export function settingsSectionForLink(link: WorkbenchLink): string {
  if (link.section === 'component-center') return 'capability-center'
  if (link.section === 'plugins' && link.origin?.section === 'capability-center') return 'capability-center'
  return link.section
}

export function UnifiedCenter() {
  const [entry, setEntry] = useState(() => {
    const pending = pendingNavigation()
    return pending && settingsSectionForLink(pending) === 'capability-center' ? pending : undefined
  })
  const area = centerArea(entry)
  // This outer frame keeps all internal pages under the same settings section.
  useNavigationFrame('unified-center', -10, () => ({ section: 'capability-center', label: area === 'components' ? '组件库' : area === 'plugins' ? '插件管理' : '能力中心', view: { area } }))
  useEffect(() => {
    const open = (event: Event) => {
      const link = (event as CustomEvent<WorkbenchLink>).detail
      if (settingsSectionForLink(link) === 'capability-center') setEntry(link)
    }
    window.addEventListener('workbench-capability-link', open)
    return () => window.removeEventListener('workbench-capability-link', open)
  }, [])
  // Child pages consume requests after restoring their own state. A restored
  // plugin tab might not mount the inventory, so retire that request here too.
  useEffect(() => { consumeNavigation(entry) }, [entry])
  if (area === 'components') return <ComponentCenter key={entry?.requestId ?? 'components'} integrated restore={entry?.restore} initialId={entry?.componentId}/>
  if (area === 'plugins') return <section className={`${s.page} ${css.plugins}`} data-center-plugins>
    <div className={s.heading}><h2>插件管理</h2><button className={s.button} onClick={() => entry?.origin ? returnNavigation(entry.origin) : openWorkbenchLink({ section: 'capability-center' })}>← 返回{entry?.origin?.frames.at(-1)?.label ?? '能力中心'}</button></div>
    <ExistingPluginSettings/>
  </section>
  return <ManagedCenter restore={entry?.restore} managementEntries/>
}
