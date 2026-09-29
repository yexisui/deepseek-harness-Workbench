import React, { useState } from 'react'
import type { ChatKey } from './locales.ts'
import { catalog, initial, type Capability } from './capability-catalog.ts'
import { roleCatalog, roleIds, type AssistantRole } from './role-catalog.ts'
import { useCapabilityPreview, type CapabilityPreviewStore } from './capability-preview.tsx'
import { Icon } from './CapabilityIcon.tsx'
import { CapabilityFields } from './CapabilityFields.tsx'
import s from './CapabilityCenter.module.css'
import c from './Capabilities.module.css'

type DetailTab = 'overview' | 'instructions' | 'defaults' | 'roles'
type Filter = 'all' | 'pinned' | 'pending' | 'unused'
type CurrentDraft = { name: string; capabilities: Capability[]; onReturn: () => void }
const tabs = [['overview', 'centerOverview'], ['instructions', 'centerInstructions'], ['defaults', 'centerDefaults'], ['roles', 'centerRoles']] as const

export function CapabilityCenter({ t, initialId = null, store: supplied, onOpenRole, currentDraft, embedded = false }: {
  t: (key: ChatKey) => string; initialId?: Capability | null; store?: CapabilityPreviewStore;
  onOpenRole: (role: AssistantRole) => void; currentDraft?: CurrentDraft; embedded?: boolean;
}) {
  const { store, drafts } = useCapabilityPreview(supplied)
  const [selected, setSelected] = useState<Capability | null>(initialId)
  const [tab, setTab] = useState<DetailTab>('overview')
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const item = catalog.find(entry => entry.id === selected)
  const linkedRoles = (id: Capability) => roleIds.filter(role => initial[role].includes(id))
  const open = (id: Capability, next: DetailTab) => { setSelected(id); setTab(next) }
  const visible = catalog.filter(entry => (filter !== 'pinned' || drafts[entry.id].pinned)
    && (filter !== 'unused' || linkedRoles(entry.id).length === 0)
    && `${t(entry.name)} ${entry.provider} ${t(entry.description)}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => Number(drafts[b.id].pinned) - Number(drafts[a.id].pinned))
  // Every catalog entry is an unconnected example; none claim to be ready for execution.
  const filters = [['all', 'centerAll'], ['pinned', 'centerPinned'], ['pending', 'centerPending'], ['unused', 'centerUnused']] as const
  return <section className={s.center} aria-label={t('centerTitle')} data-capability-center>
    {!embedded && <div className={s.heading}><div><h2>{t('centerTitle')} <span>{t('rolesPreview')}</span></h2><p>{t('centerSubtitle')}</p></div><span className={s.mark} aria-hidden="true">◇</span></div>}
    <p className={s.notice}>{t('centerBoundary')}</p>
    {item ? <>
      <button type="button" className={s.back} onClick={() => setSelected(null)}>← {t('centerBack')}</button>
      <div className={s.detailHeader}><Icon item={item} /><div><h3>{t(item.name)}</h3><p>{item.provider}</p></div><button className={s.pin} type="button" aria-pressed={drafts[item.id].pinned} aria-label={t(drafts[item.id].pinned ? 'centerUnpin' : 'centerPin')} title={t(drafts[item.id].pinned ? 'centerUnpin' : 'centerPin')} onClick={() => store.update(item.id, { pinned: !drafts[item.id].pinned })}>{drafts[item.id].pinned ? '★' : '☆'}</button></div>
      <p className={s.description}>{t(item.description)}</p>
      <div className={s.tabs} aria-label={t('centerConfigure')}>{tabs.map(([value, label]) => <button type="button" key={value} aria-pressed={tab === value} onClick={() => setTab(value)}>{t(label)}</button>)}</div>
      <div className={s.detailBody}>
        {tab === 'overview' && <>
          <div className={s.connection}><span className={s.statusDot} /><div><strong>{t('centerConnection')}</strong><p>{t('centerConnectionHint')}</p></div><button type="button" disabled>{t('centerConnect')}</button></div>
          <div className={s.overviewActions}><button type="button" onClick={() => setTab('defaults')}>{t('centerDefaults')} <span>→</span></button><button type="button" onClick={() => setTab('roles')}>{linkedRoles(item.id).length} {t('centerExampleRoles')} <span>→</span></button></div>
          <details className={s.technical}><summary>{t('centerTechnical')}</summary><dl><dt>{t('centerIdentity')}</dt><dd>{item.id}</dd><dt>{t('centerImplementation')}</dt><dd>{item.provider}</dd><dt>{t('capStatus')}</dt><dd>{t('centerVersion')}</dd></dl></details>
        </>}
        {tab === 'instructions' && <><label className={c.field}>{t('centerGuide')}<textarea rows={9} maxLength={8000} value={drafts[item.id].instructions ?? `${t(item.description)}。\n${t('centerGuideExample')}`} onChange={event => store.update(item.id, { instructions: event.target.value })} /></label><p className={s.hint}>{t('centerGuideHint')}</p><p className={s.draftNote} role="status">{t('centerDraftHint')}</p></>}
        {tab === 'defaults' && <><p className={s.hint}>{t('centerDefaultsHint')}</p><CapabilityFields t={t} item={item} options={drafts[item.id].options} update={patch => store.update(item.id, { options: { ...drafts[item.id].options, ...patch } })} /><p className={s.draftNote} role="status">{t('centerDraftHint')}</p></>}
        {tab === 'roles' && <>
          {currentDraft?.capabilities.includes(item.id) && <div className={`${s.roleRow} ${s.currentRole}`}><div><strong>{currentDraft.name || t('rolesUnnamed')}</strong><small>{t('centerCurrentRole')}</small></div><button type="button" onClick={currentDraft.onReturn}>{t('centerReturnCurrent')} →</button></div>}
          <p className={s.hint}>{t('centerRoleHint')}</p>
          {linkedRoles(item.id).map(role => <div className={s.roleRow} key={role}><div><strong>{t(roleCatalog[role].name)}</strong><small>{t(roleCatalog[role].summary)}</small></div><button type="button" onClick={() => onOpenRole(role)}>{t('centerPreviewRole')} →</button></div>)}
          {linkedRoles(item.id).length === 0 && <div className={s.empty}><strong>{t('centerNoRoles')}</strong><p>{t('centerNoRolesHint')}</p></div>}
        </>}
      </div>
    </> : <>
      <label className={s.search}><svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="5.5" /><path d="m12 12 5 5" /></svg><input aria-label={t('centerSearch')} placeholder={t('centerSearch')} value={query} onChange={event => setQuery(event.target.value)} /></label>
      <div className={s.filters}>{filters.map(([value, label]) => <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{t(label)} <span>{catalog.filter(entry => value === 'pinned' ? drafts[entry.id].pinned : value === 'unused' ? linkedRoles(entry.id).length === 0 : true).length}</span></button>)}</div>
      <div className={s.grid}>{visible.map(entry => <article className={s.card} key={entry.id} data-center-capability={entry.id}>
        <div className={s.cardHeading}><Icon item={entry} /><div><h3>{t(entry.name)}</h3><small>{entry.provider}</small></div><button type="button" className={s.pin} title={t(drafts[entry.id].pinned ? 'centerUnpin' : 'centerPin')} aria-label={`${t(drafts[entry.id].pinned ? 'centerUnpin' : 'centerPin')}：${t(entry.name)}`} aria-pressed={drafts[entry.id].pinned} onClick={() => store.update(entry.id, { pinned: !drafts[entry.id].pinned })}>{drafts[entry.id].pinned ? '★' : '☆'}</button></div>
        <p className={s.description}>{t(entry.description)}</p><div className={s.cardStatus}><span><i className={s.statusDot} />{t('centerConnection')}</span><button type="button" onClick={() => open(entry.id, 'roles')} aria-label={`${t('centerViewRoles')}：${t(entry.name)}`}>{linkedRoles(entry.id).length} {t('centerExampleRoles')} ↗</button></div>
        <button type="button" className={s.configure} onClick={() => open(entry.id, 'overview')} aria-label={`${t('centerConfigure')}：${t(entry.name)}`}>{t('centerConfigure')} <span>→</span></button>
      </article>)}</div>
      {!visible.length && <div className={s.empty}><strong>{t('centerEmpty')}</strong><p>{t('centerEmptyHint')}</p><button type="button" onClick={() => { setQuery(''); setFilter('all') }}>{t('capClear')}</button></div>}
    </>}
  </section>
}
