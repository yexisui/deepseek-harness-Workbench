import React from 'react'
import type { ChatKey } from './locales.ts'
import type { Item, Options } from './capability-catalog.ts'
import s from './Capabilities.module.css'

export function CapabilityFields({ t, item, options, update }: { t: (key: ChatKey) => string; item: Item; options: Options; update: (patch: Partial<Options>) => void }) {
  const toggle = (label: ChatKey, hint: ChatKey, checked: boolean, change: (value: boolean) => void) => <label className={s.switchRow}><span><strong>{t(label)}</strong><small>{t(hint)}</small></span><input type="checkbox" role="switch" checked={checked} onChange={event => change(event.target.checked)} /><span className={s.switchTrack} aria-hidden="true" /></label>
  return item.id === 'browser' ? <>
    <label className={s.field}>{t('capBrowserChoice')}<select value={options.browser} onChange={event => update({ browser: event.target.value })}><option value="Edge">Microsoft Edge</option><option value="Chrome">Google Chrome</option></select></label>
    <label className={s.field}>{t('capAccess')}<select value={options.access} onChange={event => update({ access: event.target.value })}><option value="specific">{t('capSpecificSite')}</option><option value="all">{t('capAnySite')}</option></select></label>
    {options.access === 'specific' && <label className={s.field}>{t('capSites')}<textarea rows={3} maxLength={2000} value={options.sites} placeholder={t('capSitesPlaceholder')} onChange={event => update({ sites: event.target.value })} /></label>}
    <fieldset className={s.actionsGroup}><legend>{t('capActions')}</legend>{([['read', 'capRead'], ['fill', 'capFill'], ['submit', 'capSubmit']] as const).map(([key, label]) => <label key={key}><input type="checkbox" checked={options[key]} onChange={event => update({ [key]: event.target.checked })} />{t(label)}</label>)}</fieldset>
    {toggle('capConfirm', 'capConfirmHint', options.confirm, value => update({ confirm: value }))}
  </> : <>
    <label className={s.field}>{t(item.id === 'knowledge' ? 'capSource' : 'capFolder')}<input value={options.location} placeholder={t(item.id === 'knowledge' ? 'capSourcePlaceholder' : 'capFolderPlaceholder')} onChange={event => update({ location: event.target.value })} maxLength={300} /></label>
    {['documents', 'sheets', 'mail'].includes(item.id) && <div className={s.output}><span>{t('capOutput')}</span><strong>{t(item.id === 'documents' ? 'capDocOutput' : item.id === 'sheets' ? 'capSheetOutput' : 'capMailOutput')}</strong></div>}
    {toggle('capReview', 'capReviewHint', options.confirm, value => update({ confirm: value }))}
  </>
}
