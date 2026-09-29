import React, { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { ChatKey } from './locales.ts'
import type { AssistantRole } from './role-catalog.ts'
import { useCapabilityPanels, type PanelSide } from './useCapabilityPanels.ts'
import { useCapabilityDrag } from './useCapabilityDrag.ts'
import { catalog, initial, defaults, dragType, type Capability, type Category, type Options } from './capability-catalog.ts'
import { CapabilityCenter } from './CapabilityCenter.tsx'
import { CapabilityFields } from './CapabilityFields.tsx'
import { useCapabilityPreview } from './capability-preview.tsx'
import { Modal } from './PreviewModal.tsx'
import centerStyles from './CapabilityCenter.module.css'
import { Icon } from './CapabilityIcon.tsx'
import s from './Capabilities.module.css'

type Translate = (key: ChatKey) => string
export function CapabilityWorkbench({ t, mode, name, form, preview, onOpenRole }: { t: Translate; mode: AssistantRole | 'create'; name: string; form: ReactNode; preview: ReactNode; onOpenRole: (role: AssistantRole) => void }) {
  const { store, drafts } = useCapabilityPreview()
  const [center, setCenter] = useState<{ id: Capability | null } | null>(null)
  const [attached, setAttached] = useState<Capability[]>(() => [...initial[mode]])
  const [selected, setSelected] = useState<Capability | null>(() => initial[mode][0] ?? null)
  const [settings, setSettings] = useState<Partial<Record<Capability, Options>>>(() => Object.fromEntries(initial[mode].map(id => [id, { ...drafts[id].options }])))
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<Category>('all')
  const [view, setView] = useState<'settings' | 'preview'>('settings')
  const [over, setOver] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const panels = useCapabilityPanels(mode !== 'create')
  const cards = useRef(new Map<Capability, HTMLDivElement>())
  const [feedback, setFeedback] = useState<{ id: Capability; duplicate: boolean; sequence: number } | null>(null)
  const prefix = useId()
  const item = catalog.find(entry => entry.id === selected)
  const options = selected ? settings[selected] ?? drafts[selected].options : defaults()
  const added = selected !== null && attached.includes(selected)
  const visible = catalog.filter(entry => (category === 'all' || entry.category === category) && `${t(entry.name)} ${t(entry.description)} ${entry.provider}`.toLowerCase().includes(query.trim().toLowerCase()))
  const configure = (id: Capability) => { setSelected(id); setView('settings'); panels.open('right') }
  const collapse = (side: PanelSide) => {
    panels.root.current?.querySelector<HTMLElement>(`[aria-controls="${prefix}-${side}"]`)?.focus()
    panels.close(side)
  }
  const update = (patch: Partial<Options>) => { if (selected) setSettings(previous => ({ ...previous, [selected]: { ...(previous[selected] ?? drafts[selected].options), ...patch } })) }
  const add = (id: Capability) => {
    const duplicate = attached.includes(id)
    setSettings(previous => previous[id] ? previous : { ...previous, [id]: { ...drafts[id].options } })
    setAttached(previous => previous.includes(id) ? previous : [...previous, id])
    // Adding updates the selected item without overriding a deliberately hidden inspector.
    setSelected(id); setView('settings')
    setFeedback(previous => ({ id, duplicate, sequence: (previous?.sequence ?? 0) + 1 }))
    setAnnouncement(t(duplicate ? 'capAlreadyAdded' : 'capAddAnnouncement') + t(catalog.find(entry => entry.id === id)!.name))
  }
  const pointerDrag = useCapabilityDrag(add)
  useLayoutEffect(() => {
    if (!feedback) return
    const element = cards.current.get(feedback.id)
    if (!element) return
    element.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!element.animate) return
    const highlight = '0 0 0 3px color-mix(in srgb, var(--role-accent) 24%, transparent)'
    const animation = element.animate(reduced || feedback.duplicate
      ? [{ boxShadow: highlight }, { boxShadow: '0 0 0 0 transparent' }]
      : [{ transform: 'translateY(-4px) scale(.98)', boxShadow: highlight }, { transform: 'translateY(2px) scale(1.015)', offset: .38, boxShadow: highlight }, { transform: 'translateY(-1px) scale(.995)', offset: .7 }, { transform: 'translateY(0) scale(1)', boxShadow: '0 0 0 0 transparent' }],
    { duration: reduced ? 180 : feedback.duplicate ? 260 : 340, easing: 'ease-out' })
    return () => animation.cancel()
  }, [feedback])
  const remove = (id: Capability) => {
    setAttached(previous => previous.filter(entry => entry !== id))
    setAnnouncement(t('capRemoveAnnouncement') + t(catalog.find(entry => entry.id === id)!.name))
  }
  const switchControl = (label: ChatKey, hint: ChatKey, checked: boolean, onChange: (value: boolean) => void) => <label className={s.switchRow}><span><strong>{t(label)}</strong><small>{t(hint)}</small></span><input type="checkbox" role="switch" checked={checked} onChange={event => onChange(event.target.checked)} /><span className={s.switchTrack} aria-hidden="true" /></label>
  const rail = (side: PanelSide) => {
    const isOpen = side === 'left' ? panels.leftOpen : panels.rightOpen
    const label = t(side === 'left' ? (isOpen ? 'capHideLibrary' : 'capShowLibrary') : (isOpen ? 'capHideSettings' : 'capShowSettings'))
    return <div className={`${s.rail} ${side === 'left' ? s.leftRail : s.rightRail} ${!isOpen ? s.railCollapsed : ''} ${panels.resizing === side && panels.willCollapse ? s.collapseReady : ''}`}
      role="separator" tabIndex={0} aria-label={label} aria-orientation="vertical" aria-controls={`${prefix}-${side}`} aria-valuemin={0} aria-valuemax={side === 'left' ? 360 : 420}
      aria-valuenow={Math.round(isOpen ? (side === 'left' ? panels.leftWidth : panels.rightWidth) : 0)} aria-valuetext={isOpen ? t('capResizeHint') : t('capRestoreHint')}
      title={`${label} · ${t(isOpen ? 'capResizeHint' : 'capRestoreHint')}`} {...panels.railEvents(side)}>
      <span className={s.railHandle} aria-hidden="true"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="3" y="4" width="14" height="12" rx="2" /><path d={side === 'left' ? 'M8 4v12' : 'M12 4v12'} /></svg><span className={s.railArrow}>{(side === 'left') === isOpen ? '‹' : '›'}</span><span className={s.railGrip} /></span>
    </div>
  }
  return <>
    <div className={s.banner}><span className={s.bannerDot} /><span>{t('capBoundary')}</span></div>
    <div ref={panels.root} style={panels.style} className={`${s.workbench} ${panels.compact ? s.compact : ''} ${panels.resizing ? s.resizing : ''}`}>
      <section id={`${prefix}-left`} className={s.library} aria-label={t('capLibrary')} hidden={!panels.leftOpen}>
        <div className={s.columnHeading}><div><h3>{t('capLibrary')}</h3><button type="button" className={s.manageLink} onClick={() => setCenter({ id: null })}>{t('centerManage')} ↗</button></div><button type="button" className={s.collapseButton} aria-label={t('capHideLibrary')} title={t('capHideLibrary')} onClick={() => collapse('left')}>‹</button></div>
        <label className={s.search}><svg aria-hidden="true" viewBox="0 0 20 20" fill="none"><circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5" /><path d="m13 13 4 4" stroke="currentColor" strokeWidth="1.5" /></svg><input aria-label={t('capSearch')} placeholder={t('capSearch')} value={query} onChange={event => setQuery(event.target.value)} /></label>
        <div className={s.filters} aria-label={t('capLibrary')}>{([['all', 'capAll'], ['web', 'capWeb'], ['office', 'capOffice'], ['data', 'capData']] as const).map(([value, label]) => <button type="button" key={value} aria-pressed={category === value} onClick={() => setCategory(value)}>{t(label)}</button>)}</div>
        <div className={s.catalog}>{visible.map(entry => {
          const included = attached.includes(entry.id)
          return <article key={entry.id} className={`${s.catalogCard} ${selected === entry.id ? s.catalogSelected : ''}`} draggable data-capability={entry.id}
            onPointerDown={event => pointerDrag.start(entry.id, event)} onClickCapture={pointerDrag.click}
            onDragStart={event => event.preventDefault()}>
            <button type="button" className={s.catalogInspect} onClick={() => configure(entry.id)} title={t(entry.name) + ' · ' + t(entry.description)} aria-label={`${t('capInspect')}：${t(entry.name)}`}><Icon item={entry} /><span><strong>{t(entry.name)}</strong><small>{entry.provider}</small></span></button>
            <button type="button" data-capability-add className={s.quickAdd} disabled={included} onClick={() => add(entry.id)} title={t(included ? 'capAdded' : 'capAdd')} aria-label={`${t(included ? 'capAdded' : 'capAdd')}：${t(entry.name)}`}>{included ? '✓' : '＋'}</button><span className={s.grip} aria-hidden="true">⠿</span>
          </article>
        })}</div>
        {!visible.length && <div className={s.emptySearch}><p>{t('capNoResults')}</p><button type="button" onClick={() => { setQuery(''); setCategory('all') }}>{t('capClear')}</button></div>}
        <p className={s.libraryNote}>{catalog.length} {t('capCount')}</p>
      </section>
      {rail('left')}
      <section className={s.canvas} aria-label={t('capCanvas')}>
        <div className={s.columnHeading}><div><h3>{t('capIdentity')}</h3><p>{t('capFooter')}</p></div><span className={s.step}>01</span></div>
        {form}
        <div className={`${s.columnHeading} ${s.attachedHeading}`}><div><h3>{t('capAttached')} <span className={s.count}>{attached.length}</span></h3><p>{t('capAttachedHint')}</p></div><span className={s.step}>02</span></div>
        <div ref={pointerDrag.zone} className={`${s.dropZone} ${pointerDrag.drag ? s.dragReady : ''} ${over || pointerDrag.over ? s.dragOver : ''}`} aria-label={t('capDrop')}
          onDragOver={event => { if (Array.from(event.dataTransfer.types).includes(dragType)) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; setOver(true) } }}
          onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(false) }}
          onDrop={event => {
            const id = event.dataTransfer.getData(dragType)
            if (catalog.some(entry => entry.id === id)) { event.preventDefault(); add(id as Capability) }
            setOver(false)
          }}>
          {attached.map(id => {
            const entry = catalog.find(candidate => candidate.id === id)!
            const enabled = settings[id]?.enabled ?? true
            return <div key={id} ref={element => { if (element) cards.current.set(id, element); else cards.current.delete(id) }} className={`${s.attachedCard} ${selected === id ? s.attachedSelected : ''} ${!enabled ? s.disabledCard : ''}`} data-attached-capability={id}>
              <button type="button" className={s.attachedSelect} aria-pressed={selected === id} onClick={() => configure(id)} aria-label={`${t('capSettings')}：${t(entry.name)}`}><Icon item={entry} /><span><strong>{t(entry.name)}</strong><small><i className={enabled ? s.enabledDot : s.disabledDot} />{t(enabled ? 'capAdded' : 'capPaused')} · {entry.provider}</small></span></button>
              <button type="button" className={s.remove} aria-label={`${t('capRemove')}：${t(entry.name)}`} onClick={() => remove(id)}>×</button>
            </div>
          })}
          <div className={`${s.dropHint} ${attached.length ? s.dropCompact : ''}`}><span aria-hidden="true">＋</span><strong>{t(attached.length ? 'capDropMore' : 'capDrop')}</strong>{!attached.length && <p>{t('capDropHint')}</p>}</div>
        </div>
      </section>
      {rail('right')}
      <aside id={`${prefix}-right`} className={s.inspector} aria-label={t('capSettings')} hidden={!panels.rightOpen}>
        <div className={s.inspectorHeader}><div className={s.inspectorTabs}>{(['settings', 'preview'] as const).map(value => <button type="button" key={value} aria-pressed={view === value} onClick={() => setView(value)}>{t(value === 'settings' ? 'capSettings' : 'capOverview')}</button>)}</div><button type="button" className={s.collapseButton} aria-label={t('capHideSettings')} title={t('capHideSettings')} onClick={() => collapse('right')}>›</button></div>
        <div className={s.assistantName}>{name || t('rolesUnnamed')}</div>
        {view === 'preview' ? <div className={s.overview}>{preview}<h4>{t('capAbilitySummary')}</h4>{attached.length ? <div className={s.summaryCaps}>{attached.map(id => { const entry = catalog.find(candidate => candidate.id === id)!; return <span key={id}>{t(entry.name)} · {t((settings[id]?.enabled ?? true) ? 'capActive' : 'capPaused')}</span> })}</div> : <p className={s.muted}>{t('capEmpty')}</p>}</div>
          : item ? <>
            <div className={s.detailIdentity}><Icon item={item} /><div><h3>{t(item.name)}</h3><span>{item.provider}</span></div></div>
            <p className={s.detailDescription}>{t(item.description)}</p>
            <button type="button" className={s.manageLink} onClick={() => setCenter({ id: item.id })}>{t('centerOpen')} ↗</button>
            <div className={s.connection}><span className={s.statusDot} /><span>{t('capNotConnected')}</span></div>
            {!added ? <div className={s.notAdded}><p>{t('capNotAdded')}</p><button type="button" onClick={() => add(item.id)}>{t('capAdd')} · {t(item.name)}</button></div> : switchControl('capEnabled', 'capEnableHint', options.enabled, value => update({ enabled: value }))}
            <fieldset className={s.settingsFields} disabled={!added || !options.enabled}>
              <p className={s.muted}>{t('centerRoleSettingsHint')}</p>
              <CapabilityFields t={t} item={item} options={options} update={update} />
            </fieldset>
          </> : <div className={s.inspectorEmpty}><span aria-hidden="true">＋</span><h3>{t('capGuide')}</h3><p>{t('capGuideHint')}</p></div>}
      </aside>
    </div>
    {center && <Modal title={t('centerTitle')} closeLabel={t('centerBackRole')} onClose={() => setCenter(null)} className={centerStyles.overlayDialog}>
      <div className={centerStyles.overlayBody}><button type="button" className={centerStyles.overlayBack} onClick={() => setCenter(null)}>← {t('centerBackRole')}</button><CapabilityCenter embedded t={t} store={store} initialId={center.id} currentDraft={{ name, capabilities: attached, onReturn: () => setCenter(null) }} onOpenRole={role => { setCenter(null); onOpenRole(role) }} /></div>
    </Modal>}
    {pointerDrag.drag && <div className={s.dragGhost} aria-hidden="true" style={{ left: pointerDrag.drag.x + 12, top: pointerDrag.drag.y + 12 }}>{t(catalog.find(entry => entry.id === pointerDrag.drag!.id)!.name)}</div>}
    <span className={s.srOnly} role="status" aria-live="polite">{announcement}</span>
  </>
}
