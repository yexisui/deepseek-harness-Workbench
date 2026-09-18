import React, { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { ChatKey } from './locales.ts'
import { roleCatalog, roleIds, type AssistantRole, type PreviewRole } from './role-catalog.ts'
export type { PreviewRole } from './role-catalog.ts'
import s from './Roles.module.css'

type Translate = (key: ChatKey) => string
type EditorMode = 'create' | AssistantRole
const palette = ['#4F73E8', '#22A58B', '#E58A32', '#9A62D8', '#E35E8D', '#E06453', '#21A0C5', '#788647']
const colorStyle = (color: string): CSSProperties => ({ '--role-color': color } as CSSProperties)

function RoleIcon({ role = 'analyst', color }: { role?: PreviewRole; color?: string }) {
  return <span className={s.icon} style={colorStyle(color ?? (role === 'chat' ? palette[0]! : roleCatalog[role].color))} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    {role === 'chat' ? <path d="M20 11.5a8 8 0 0 1-8 8H5l-3 2V11.5a9 9 0 0 1 18 0Z" />
      : role === 'marketing' ? <><path d="M4 10h4l11-5v14L8 14H4zM8 14l2 6H6l-2-6M22 10v4" /></>
      : role === 'manager' ? <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18M7 15l2 2 4-4M16 15h2" /></>
      : role === 'developer' ? <><path d="m7 7-5 5 5 5M17 7l5 5-5 5M14 4l-4 16" /></>
      : <><rect x="5" y="5" width="14" height="16" rx="2" /><path d="M9 5V3h6v2M9 10h6M9 14h6M9 18h3" /></>}
  </svg></span>
}

function Modal({ title, onClose, children, wide = false, closeLabel }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean; closeLabel: string }) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const dialog = ref.current!
    dialog.showModal()
    return () => { dialog.close(); if (previous?.isConnected) previous.focus() }
  }, [])
  return createPortal(<dialog ref={ref} className={`${s.dialog} ${wide ? s.wide : ''}`} aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); onClose() }}>
    <div className={s.dialogHeader}><h2 id={titleId}>{title}</h2><button type="button" autoFocus className={s.close} onClick={onClose} aria-label={closeLabel}>×</button></div>
    {children}
  </dialog>, document.body)
}

function RoleEditor({ t, mode, onClose }: { t: Translate; mode: EditorMode; onClose: () => void }) {
  const [color, setColor] = useState(mode === 'create' ? palette[0]! : roleCatalog[mode].color)
  const [fields, setFields] = useState(() => {
    if (mode === 'create') return { name: '', duties: '', requirements: '', format: '' }
    const example = roleCatalog[mode]
    return { name: t(example.name), duties: t(example.duties), requirements: t(example.requirements), format: t(example.format) }
  })
  const id = useId()
  const definitions = [
    ['duties', 'rolesDuties', 'rolesDutiesPlaceholder'],
    ['requirements', 'rolesRequirements', 'rolesRequirementsPlaceholder'],
    ['format', 'rolesFormat', 'rolesFormatPlaceholder'],
  ] as const
  return <>
    <div className={s.editorScroll}>
      <p className={s.intro}>{t('rolesEditHint')}</p>
      <div className={s.notice}><span className={s.previewBadge}>{t('rolesPreview')}</span>{t('rolesNotice')}</div>
      <div className={s.editorGrid}>
        <div className={s.fields}>
          <label className={s.field} htmlFor={`${id}-name`}><span>{t('rolesName')}</span>
            <input id={`${id}-name`} maxLength={60} value={fields.name} placeholder={t('rolesNamePlaceholder')} onChange={event => setFields({ ...fields, name: event.target.value })} />
          </label>
          <fieldset className={s.colorField}>
            <legend>{t('rolesColor')}</legend>
            <div className={s.palette}>{palette.map(value => <button type="button" key={value} className={s.swatch} style={{ backgroundColor: value }} aria-label={`${t('rolesColor')} ${value}`} aria-pressed={color.toLowerCase() === value.toLowerCase()} onClick={() => setColor(value)}>
              {color.toLowerCase() === value.toLowerCase() && <span aria-hidden="true">✓</span>}
            </button>)}</div>
            <div className={s.customColor}>
              <label htmlFor={`${id}-color`}>{t('rolesCustomColor')}</label>
              <input id={`${id}-color`} type="color" value={color} onInput={event => setColor(event.currentTarget.value)} onChange={event => setColor(event.target.value)} />
              <code>{color.toUpperCase()}</code>
            </div>
            <p className={s.caption}>{t('rolesColorHint')}</p>
          </fieldset>
          {definitions.map(([key, label, placeholder]) => <label key={key} className={s.field} htmlFor={`${id}-${key}`}><span>{t(label)}</span>
            <textarea id={`${id}-${key}`} rows={key === 'format' ? 4 : 3} maxLength={4000} value={fields[key]} placeholder={t(placeholder)} onChange={event => setFields({ ...fields, [key]: event.target.value })} />
          </label>)}
        </div>
        <aside className={s.livePreview} style={colorStyle(color)} aria-label={t('rolesLivePreview')}>
          <div className={s.previewHeading}><span>{t('rolesLivePreview')}</span><span className={s.dot} /></div>
          <p className={s.caption}>{t('rolesLiveHint')}</p>
          <div className={s.previewIdentity}><RoleIcon role={mode === 'create' ? 'analyst' : mode} color={color} /><h3>{fields.name.trim() || t('rolesUnnamed')}</h3></div>
          {definitions.map(([key, label]) => <section key={key} className={s.previewSection}><h4>{t(label)}</h4><p className={!fields[key].trim() ? s.empty : undefined}>{fields[key].trim() || t('rolesEmpty')}</p></section>)}
          <p className={s.sessionHint}>{t('rolesNewSessionHint')}</p>
        </aside>
      </div>
    </div>
    <div className={s.footer}><p id={`${id}-save-hint`}>{t('rolesSaveHint')}</p><div className={s.actions}>
      <button type="button" className={s.secondary} onClick={onClose}>{t('rolesDone')}</button>
      <button type="button" className={s.primary} disabled aria-describedby={`${id}-save-hint`}>{t('rolesSave')}</button>
    </div></div>
  </>
}

export function RoleAssistantsSection({ t, selected = 'chat', onSelect }: { t: Translate; selected?: PreviewRole; onSelect?: (role: PreviewRole) => void }) {
  const [editor, setEditor] = useState<EditorMode | null>(null)
  return <section className={s.section} data-dsh-plugin="plain-chat" data-dsh-part="role-assistants">
    <div className={s.sectionHeader}><div><div className={s.titleRow}><h2>{t('rolesTitle')}</h2><span className={s.previewBadge}>{t('rolesPreview')}</span></div><p>{t('rolesDescription')}</p></div>
      <button type="button" className={s.primary} onClick={() => setEditor('create')}><span aria-hidden="true">＋</span> {t('rolesCreate')}</button>
    </div>
    <div className={s.selectionStatus}><span role="status">{selected === 'chat' ? t('rolesNoSelection') : `${t('rolesSelectionDone')}${t(roleCatalog[selected].name)} · ${t('rolesPreview')}`}</span>{selected !== 'chat' && <button type="button" className={s.textButton} onClick={() => onSelect?.('chat')}>{t('rolesReset')}</button>}</div>
    <div className={s.cards}>
      {roleIds.map(role => {
        const example = roleCatalog[role]
        return <article key={role} className={`${s.roleCard} ${selected === role ? s.selectedCard : ''}`} style={colorStyle(example.color)} aria-label={t(example.name)}>
          <button type="button" className={s.cardSelect} aria-label={`${t('rolesPick')}：${t(example.name)}`} aria-pressed={selected === role} onClick={() => onSelect?.(role)} />
          <div className={s.cardTop}><RoleIcon role={role} /><span className={`${s.exampleBadge} ${selected === role ? s.selectedBadge : ''}`}>{selected === role ? `✓ ${t('rolesChosen')}` : t('rolesExample')}</span></div>
          <h3>{t(example.name)}</h3><p>{t(example.summary)}</p>
          <div className={s.tags}>{example.tags.map(key => <span key={key}>{t(key)}</span>)}</div>
          <button type="button" className={s.cardAction} onClick={() => setEditor(role)}>{t('rolesConfigure')}<span aria-hidden="true">↗</span></button>
        </article>
      })}
    </div>
    <button type="button" className={s.createCard} onClick={() => setEditor('create')}><span className={s.plus} aria-hidden="true">＋</span><strong>{t('rolesCreate')}</strong><span>{t('rolesEditHint')}</span></button>
    <p className={s.sectionNote}>{t('rolesNotice')}</p>
    {editor && <Modal title={t(editor === 'create' ? 'rolesCreate' : 'rolesEdit')} onClose={() => setEditor(null)} closeLabel={t('rolesClose')} wide><RoleEditor t={t} mode={editor} onClose={() => setEditor(null)} /></Modal>}
  </section>
}

export function CurrentAssistant({ t, selected, onOpen }: { t: Translate; selected: PreviewRole; onOpen: () => void }) {
  const name = t(selected === 'chat' ? 'mode' : roleCatalog[selected].name)
  return <button type="button" className={s.currentAssistant} style={colorStyle(selected === 'chat' ? '#78869f' : roleCatalog[selected].color)} aria-label={`${t('rolesManage')}：${name}`} title={`${t(selected === 'chat' ? 'rolesNoSelection' : 'rolesSelectionHint')} · ${t('rolesManage')}`} onClick={onOpen}>
    <RoleIcon role={selected} /><span className={s.currentText}>{name}</span>
    {selected !== 'chat' && <span className={s.currentHint}>{t('rolesPreview')}</span>}
    <svg className={s.currentArrow} aria-hidden="true" viewBox="0 0 16 16" fill="none"><path d="m6 4 4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
  </button>
}

/** Keep the original roster mounted so collapsing does not discard its state. */
export function AgentPresetDisclosure({ t, children }: { t: Translate; children: ReactNode }) {
  return <details className={s.presetDisclosure}>
    <summary>{t('rolesExisting')}<svg className={s.disclosureChevron} aria-hidden="true" viewBox="0 0 16 16" fill="none"><path d="m6 3 5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></summary>
    <div className={s.disclosureContent}>{children}</div>
  </details>
}

export function RolePicker({ t, selected, onSelect }: { t: Translate; selected: PreviewRole; onSelect: (role: PreviewRole) => void }) {
  const [open, setOpen] = useState(false)
  const [editor, setEditor] = useState<EditorMode | null>(null)
  const close = () => { setOpen(false); setEditor(null) }
  return <>
    <button type="button" className={s.picker} aria-haspopup="dialog" aria-label={`${t('rolesChoose')}：${t(selected === 'chat' ? 'mode' : roleCatalog[selected].name)}`} onClick={() => setOpen(true)}><RoleIcon role={selected} /><span>{t(selected === 'chat' ? 'mode' : roleCatalog[selected].name)}</span>{selected !== 'chat' && <span className={s.previewBadge}>{t('rolesPreview')}</span>}<span aria-hidden="true">⌄</span></button>
    {open && <Modal title={t(editor ? 'rolesEdit' : 'rolesChoose')} closeLabel={t('rolesClose')} onClose={close} wide={editor !== null}>
      {editor ? <><button type="button" className={s.back} onClick={() => setEditor(null)}>← {t('rolesBack')}</button><RoleEditor key={editor} t={t} mode={editor} onClose={close} /></> : <div className={s.choices}>
        <p className={s.intro}>{t('rolesChooseHint')}</p>
        {(['chat', ...roleIds] as const).map(role => <button type="button" key={role} className={`${s.choice} ${selected === role ? s.chosen : ''}`} aria-pressed={selected === role} onClick={() => { onSelect(role); close() }}>
          <RoleIcon role={role} /><span className={s.choiceText}><strong>{t(role === 'chat' ? 'mode' : roleCatalog[role].name)}{role !== 'chat' && <span className={s.previewBadge}>{t('rolesPreview')}</span>}</strong><span>{t(role === 'chat' ? 'rolesChatSummary' : roleCatalog[role].summary)}</span></span><span className={s.radio} aria-hidden="true">{selected === role ? '✓' : ''}</span>
        </button>)}
        <div className={s.choiceTools}><button type="button" className={s.textButton} onClick={() => setEditor(selected === 'chat' ? 'analyst' : selected)}>{t('rolesConfigure')}</button><button type="button" className={s.textButton} onClick={() => setEditor('create')}>＋ {t('rolesCreate')}</button></div>
        <p className={s.sectionNote}>{t('rolesNotice')}</p><p className={s.caption}>{t('rolesSwitchHint')}</p>
      </div>}
    </Modal>}
  </>
}
