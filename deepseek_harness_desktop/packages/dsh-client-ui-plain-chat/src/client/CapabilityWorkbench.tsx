import React, { useId, useState, type CSSProperties, type ReactNode } from 'react'
import type { ChatKey } from './locales.ts'
import type { AssistantRole } from './role-catalog.ts'
import s from './Capabilities.module.css'

type Translate = (key: ChatKey) => string
type Capability = 'browser' | 'documents' | 'sheets' | 'knowledge' | 'files' | 'mail'
type Category = 'all' | 'web' | 'office' | 'data'
type Item = { id: Capability; name: ChatKey; description: ChatKey; category: Category; provider: string; color: string }
// Demonstration data only. This editor intentionally has no host, storage or tool API dependency.
const catalog: Item[] = [
  { id: 'browser', name: 'capBrowser', description: 'capBrowserDesc', category: 'web', provider: 'BrowserSkill', color: '#5275df' },
  { id: 'documents', name: 'capDocuments', description: 'capDocumentsDesc', category: 'office', provider: 'Documents', color: '#9870d4' },
  { id: 'sheets', name: 'capSheets', description: 'capSheetsDesc', category: 'office', provider: 'Spreadsheets', color: '#299c80' },
  { id: 'knowledge', name: 'capKnowledge', description: 'capKnowledgeDesc', category: 'data', provider: 'Knowledge', color: '#cc9439' },
  { id: 'files', name: 'capFiles', description: 'capFilesDesc', category: 'data', provider: 'Files', color: '#c27955' },
  { id: 'mail', name: 'capMail', description: 'capMailDesc', category: 'office', provider: 'Mail', color: '#ca698b' },
]
const initial: Record<AssistantRole | 'create', Capability[]> = {
  create: [], analyst: ['documents', 'knowledge'], marketing: ['browser', 'documents'], manager: ['documents', 'sheets'], developer: ['browser', 'files'],
}
const dragType = 'application/x-dsh-capability-preview'
type Options = { enabled: boolean; browser: string; access: string; sites: string; read: boolean; fill: boolean; submit: boolean; confirm: boolean; location: string }
const defaults = (): Options => ({ enabled: true, browser: 'Edge', access: 'specific', sites: '', read: true, fill: true, submit: false, confirm: true, location: '' })

function Icon({ item }: { item: Item }) {
  return <span className={s.icon} style={{ '--cap-color': item.color } as CSSProperties} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    {item.id === 'browser' ? <><circle cx="12" cy="12" r="9" /><ellipse cx="12" cy="12" rx="4" ry="9" /><path d="M3 12h18" /></>
      : item.id === 'documents' ? <><path d="M14 3H6v18h12V7zM14 3v5h4M9 12h6M9 16h6" /></>
      : item.id === 'sheets' ? <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M9 10v10M15 10v10M3 15h18" /></>
      : item.id === 'knowledge' ? <><path d="M12 6c-3-3-7-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V5c-2-1-6-2-9 1ZM12 6v15" /></>
      : item.id === 'files' ? <path d="M3 7V5h7l2 3h9v12H3z" />
      : <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 6 9 7 9-7" /></>}
  </svg></span>
}

export function CapabilityWorkbench({ t, mode, name, form, preview }: { t: Translate; mode: AssistantRole | 'create'; name: string; form: ReactNode; preview: ReactNode }) {
  const [attached, setAttached] = useState<Capability[]>(() => [...initial[mode]])
  const [selected, setSelected] = useState<Capability | null>(() => initial[mode][0] ?? null)
  const [settings, setSettings] = useState<Partial<Record<Capability, Options>>>({})
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<Category>('all')
  const [view, setView] = useState<'settings' | 'preview'>('settings')
  const [dragging, setDragging] = useState(false)
  const [over, setOver] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const prefix = useId()
  const item = catalog.find(entry => entry.id === selected)
  const options = selected ? settings[selected] ?? defaults() : defaults()
  const added = selected !== null && attached.includes(selected)
  const visible = catalog.filter(entry => (category === 'all' || entry.category === category) && `${t(entry.name)} ${t(entry.description)} ${entry.provider}`.toLowerCase().includes(query.trim().toLowerCase()))
  const configure = (id: Capability) => { setSelected(id); setView('settings') }
  const update = (patch: Partial<Options>) => { if (selected) setSettings(previous => ({ ...previous, [selected]: { ...(previous[selected] ?? defaults()), ...patch } })) }
  const add = (id: Capability) => {
    setAttached(previous => previous.includes(id) ? previous : [...previous, id])
    configure(id)
    setAnnouncement(t('capAddAnnouncement') + t(catalog.find(entry => entry.id === id)!.name))
  }
  const remove = (id: Capability) => {
    setAttached(previous => previous.filter(entry => entry !== id))
    setAnnouncement(t('capRemoveAnnouncement') + t(catalog.find(entry => entry.id === id)!.name))
  }
  const switchControl = (label: ChatKey, hint: ChatKey, checked: boolean, onChange: (value: boolean) => void) => <label className={s.switchRow}><span><strong>{t(label)}</strong><small>{t(hint)}</small></span><input type="checkbox" role="switch" checked={checked} onChange={event => onChange(event.target.checked)} /><span className={s.switchTrack} aria-hidden="true" /></label>
  return <>
    <div className={s.banner}><span className={s.bannerDot} /><span>{t('capBoundary')}</span></div>
    <div className={s.workbench}>
      <section className={s.library} aria-label={t('capLibrary')}>
        <div className={s.columnHeading}><div><h3>{t('capLibrary')}</h3><p>{t('capLibraryHint')}</p></div><span className={s.libraryMark} aria-hidden="true">＋</span></div>
        <label className={s.search}><svg aria-hidden="true" viewBox="0 0 20 20" fill="none"><circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5" /><path d="m13 13 4 4" stroke="currentColor" strokeWidth="1.5" /></svg><input aria-label={t('capSearch')} placeholder={t('capSearch')} value={query} onChange={event => setQuery(event.target.value)} /></label>
        <div className={s.filters} aria-label={t('capLibrary')}>{([['all', 'capAll'], ['web', 'capWeb'], ['office', 'capOffice'], ['data', 'capData']] as const).map(([value, label]) => <button type="button" key={value} aria-pressed={category === value} onClick={() => setCategory(value)}>{t(label)}</button>)}</div>
        <div className={s.catalog}>{visible.map(entry => {
          const included = attached.includes(entry.id)
          return <article key={entry.id} className={`${s.catalogCard} ${selected === entry.id ? s.catalogSelected : ''}`} draggable={!included} data-capability={entry.id}
            onDragStart={event => { event.dataTransfer.setData(dragType, entry.id); event.dataTransfer.effectAllowed = 'copy'; setDragging(true) }}
            onDragEnd={() => { setDragging(false); setOver(false) }}>
            <button type="button" className={s.catalogInspect} onClick={() => configure(entry.id)} aria-label={`${t('capInspect')}：${t(entry.name)}`}><Icon item={entry} /><span><strong>{t(entry.name)}</strong><small>{entry.provider}</small></span><span className={s.grip} aria-hidden="true">⠿</span></button>
            <p>{t(entry.description)}</p><div className={s.catalogBottom}><span>{t('capExample')}</span><button type="button" disabled={included} onClick={() => add(entry.id)} aria-label={`${included ? t('capAdded') : t('capAdd')}：${t(entry.name)}`}>{included ? '✓ ' + t('capAdded') : '＋ ' + t('capAdd')}</button></div>
          </article>
        })}</div>
        {!visible.length && <div className={s.emptySearch}><p>{t('capNoResults')}</p><button type="button" onClick={() => { setQuery(''); setCategory('all') }}>{t('capClear')}</button></div>}
        <p className={s.libraryNote}>{catalog.length} {t('capCount')}<br />{t('capDemoNote')}</p>
      </section>
      <section className={s.canvas} aria-label={t('capCanvas')}>
        <div className={s.columnHeading}><div><h3>{t('capIdentity')}</h3><p>{t('capFooter')}</p></div><span className={s.step}>01</span></div>
        {form}
        <div className={`${s.columnHeading} ${s.attachedHeading}`}><div><h3>{t('capAttached')} <span className={s.count}>{attached.length}</span></h3><p>{t('capAttachedHint')}</p></div><span className={s.step}>02</span></div>
        <div className={`${s.dropZone} ${dragging ? s.dragReady : ''} ${over ? s.dragOver : ''}`} aria-label={t('capDrop')}
          onDragOver={event => { if (Array.from(event.dataTransfer.types).includes(dragType)) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; setOver(true) } }}
          onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(false) }}
          onDrop={event => {
            const id = event.dataTransfer.getData(dragType)
            if (catalog.some(entry => entry.id === id)) { event.preventDefault(); add(id as Capability) }
            setDragging(false); setOver(false)
          }}>
          {attached.map(id => {
            const entry = catalog.find(candidate => candidate.id === id)!
            const enabled = settings[id]?.enabled ?? true
            return <div key={id} className={`${s.attachedCard} ${selected === id ? s.attachedSelected : ''} ${!enabled ? s.disabledCard : ''}`} data-attached-capability={id}>
              <button type="button" className={s.attachedSelect} aria-pressed={selected === id} onClick={() => configure(id)} aria-label={`${t('capSettings')}：${t(entry.name)}`}><Icon item={entry} /><span><strong>{t(entry.name)}</strong><small><i className={enabled ? s.enabledDot : s.disabledDot} />{t(enabled ? 'capActive' : 'capPaused')} · {entry.provider}</small></span></button>
              <button type="button" className={s.remove} aria-label={`${t('capRemove')}：${t(entry.name)}`} onClick={() => remove(id)}>×</button>
            </div>
          })}
          <div className={`${s.dropHint} ${attached.length ? s.dropCompact : ''}`}><span aria-hidden="true">＋</span><strong>{t(attached.length ? 'capDropMore' : 'capDrop')}</strong>{!attached.length && <p>{t('capDropHint')}</p>}</div>
        </div>
      </section>
      <aside className={s.inspector} aria-label={t('capSettings')}>
        <div className={s.inspectorTabs}>{(['settings', 'preview'] as const).map(value => <button type="button" key={value} aria-pressed={view === value} onClick={() => setView(value)}>{t(value === 'settings' ? 'capSettings' : 'capOverview')}</button>)}</div>
        <div className={s.assistantName}>{name || t('rolesUnnamed')}</div>
        {view === 'preview' ? <div className={s.overview}>{preview}<h4>{t('capAbilitySummary')}</h4>{attached.length ? <div className={s.summaryCaps}>{attached.map(id => { const entry = catalog.find(candidate => candidate.id === id)!; return <span key={id}>{t(entry.name)} · {t((settings[id]?.enabled ?? true) ? 'capActive' : 'capPaused')}</span> })}</div> : <p className={s.muted}>{t('capEmpty')}</p>}</div>
          : item ? <>
            <div className={s.detailIdentity}><Icon item={item} /><div><h3>{t(item.name)}</h3><span>{item.provider}</span></div></div>
            <p className={s.detailDescription}>{t(item.description)}</p>
            <div className={s.connection}><span className={s.statusDot} /><span>{t('capNotConnected')}</span></div>
            {!added ? <div className={s.notAdded}><p>{t('capNotAdded')}</p><button type="button" onClick={() => add(item.id)}>{t('capAdd')} · {t(item.name)}</button></div> : switchControl('capEnabled', 'capEnableHint', options.enabled, value => update({ enabled: value }))}
            <fieldset className={s.settingsFields} disabled={!added || !options.enabled}>
              {item.id === 'browser' ? <>
                <label className={s.field}>{t('capBrowserChoice')}<select value={options.browser} onChange={event => update({ browser: event.target.value })}><option value="Edge">Microsoft Edge</option><option value="Chrome">Google Chrome</option></select></label>
                <label className={s.field}>{t('capAccess')}<select value={options.access} onChange={event => update({ access: event.target.value })}><option value="specific">{t('capSpecificSite')}</option><option value="all">{t('capAnySite')}</option></select></label>
                {options.access === 'specific' && <label className={s.field}>{t('capSites')}<textarea rows={3} maxLength={2000} value={options.sites} placeholder={t('capSitesPlaceholder')} onChange={event => update({ sites: event.target.value })} /></label>}
                <fieldset className={s.actionsGroup}><legend>{t('capActions')}</legend>{([['read', 'capRead'], ['fill', 'capFill'], ['submit', 'capSubmit']] as const).map(([key, label]) => <label key={key}><input type="checkbox" checked={options[key]} onChange={event => update({ [key]: event.target.checked })} />{t(label)}</label>)}</fieldset>
                {switchControl('capConfirm', 'capConfirmHint', options.confirm, value => update({ confirm: value }))}
              </> : <>
                <label className={s.field} htmlFor={`${prefix}-location`}>{t(item.id === 'knowledge' ? 'capSource' : 'capFolder')}<input id={`${prefix}-location`} value={options.location} placeholder={t(item.id === 'knowledge' ? 'capSourcePlaceholder' : 'capFolderPlaceholder')} onChange={event => update({ location: event.target.value })} maxLength={300} /></label>
                {['documents', 'sheets', 'mail'].includes(item.id) && <div className={s.output}><span>{t('capOutput')}</span><strong>{t(item.id === 'documents' ? 'capDocOutput' : item.id === 'sheets' ? 'capSheetOutput' : 'capMailOutput')}</strong></div>}
                {switchControl('capReview', 'capReviewHint', options.confirm, value => update({ confirm: value }))}
              </>}
            </fieldset>
          </> : <div className={s.inspectorEmpty}><span aria-hidden="true">＋</span><h3>{t('capGuide')}</h3><p>{t('capGuideHint')}</p></div>}
      </aside>
    </div>
    <span className={s.srOnly} role="status" aria-live="polite">{announcement}</span>
  </>
}
