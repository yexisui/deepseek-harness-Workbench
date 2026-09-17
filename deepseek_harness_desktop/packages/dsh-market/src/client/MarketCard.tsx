/** Local resource Workshop, rendered with the shared settings card and SDK controls. */
import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react'
import { Button, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRenderSlots } from '@deepseek-ai/dsh-client-ui-slots'
import type { SettingsScope } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import { PluginSettingsCard, BooleanField } from './PluginSettingsCard.tsx'
import { CardForm, booleanField, type CardActions, type CardShell, type FieldState as CardFieldState } from './settings-form.ts'
import type { LocalKind, LocalPreview, LocalResource } from '../core/local-types.ts'
import { localWorkshopApi, resourceSize, type LocalAction, type LocalWorkshopApi } from './local-workshop.ts'
import type { MarketKey } from './locales.ts'
import css from './market.module.css'

export interface MarketSettings { enabled?: boolean }
export interface MarketCardState extends CardShell { enabled: CardFieldState }
export interface MarketCardFace extends CardActions { hooks: { marketCard: SnapshotStore<MarketCardState> } }
export class MarketCardController {
  private readonly form: CardForm<MarketSettings>
  private readonly store: SnapshotStore<MarketCardState>
  constructor(scope: SettingsScope<MarketSettings>) {
    this.form = new CardForm(scope, [booleanField('enabled')])
    this.store = this.form.bind(() => ({ ...this.form.shell(), enabled: this.form.field('enabled') }))
  }
  inject(): MarketCardFace { return { hooks: { marketCard: this.store }, ...this.form.actions() } }
  dispose(): void { this.form.dispose() }
}

/** Compatibility contracts for plugins declaring the Workshop child slot. */
export interface WorkshopPresetRecord {
  id: string
  name?: string
  nameEn?: string
  author?: string
  description?: string
  descriptionEn?: string
  version?: string
  tags?: string[]
  repo?: string
  rank?: number
}
export interface WorkshopPanelKeyProps { children?: never }
export interface WorkshopPanelOwnerProps {
  items?: readonly WorkshopPresetRecord[]
  catalogState?: 'loading' | 'ready' | 'error'
  gateway?: boolean
  installs?: Record<string, number>
  install?: (id: string, force: boolean) => Promise<{ dest: string }>
  reportInstall?: (id: string) => Promise<number>
}

export type MarketCardProps = PropsLocale<'dsh-web-ui-market'> & InjectFace<MarketCardFace>
  & PropsRenderSlots<'dsh-workshop.panel'> & { api?: LocalWorkshopApi }
const KINDS: LocalKind[] = ['skin', 'pet', 'plugin', 'preset']
const KIND_LABEL: Record<LocalKind, MarketKey> = { skin: 'tab.skin', pet: 'tab.pet', plugin: 'tab.plugin', preset: 'tab.preset' }
const STATUS_LABEL: Record<string, MarketKey> = {
  available: 'local.status.available', imported: 'local.status.available', active: 'local.status.active',
  enabled: 'local.status.active', installed: 'local.status.installed', disabled: 'local.status.disabled',
  'pending-restart': 'local.status.pendingRestart', invalid: 'local.status.invalid',
}
const ACTION_LABEL: Record<LocalAction, MarketKey> = {
  install: 'local.install', enable: 'local.enable', disable: 'local.disable', remove: 'local.remove', trust: 'local.trust',
}
const messageOf = (reason: unknown): string => reason instanceof Error ? reason.message : String(reason)
const activeResource = (resource: LocalResource): boolean => resource.status === 'active' || String(resource.status) === 'enabled'
type Selection = { kind: LocalKind; files: File[]; format: 'zip' | 'folder' }
type Confirmation = { resource: LocalResource; action: LocalAction }

export function MarketCard(props: MarketCardProps): ReactNode {
  const { t } = props
  const api = props.api ?? localWorkshopApi
  const state = props.useMarketCard((snapshot: MarketCardState) => snapshot)
  const cardVisible = state.enabled.text !== 'false'
  const [tab, setTab] = useState<LocalKind>('skin')
  const [query, setQuery] = useState('')
  const [resources, setResources] = useState<LocalResource[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [preview, setPreview] = useState<LocalPreview | null>(null)
  const [committing, setCommitting] = useState(false)
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const [actionRunning, setActionRunning] = useState(false)
  const [lastSelection, setLastSelection] = useState<Selection | null>(null)
  const zipInput = useRef<HTMLInputElement>(null)
  const folderInput = useRef<HTMLInputElement | null>(null)
  const upload = useRef<{ id: string; api: LocalWorkshopApi } | null>(null)
  const abort = useRef<AbortController | null>(null)
  const mounted = useRef(true)
  const locked = useRef(false)
  const commitInFlight = useRef(false)
  const generation = useRef(0)
  const loadSequence = useRef(0)
  const disabled = !state.writable || busy || confirmation !== null

  async function refresh(): Promise<void> {
    const sequence = ++loadSequence.current
    setLoading(true)
    setLoadError('')
    try {
      const next = await api.list()
      if (mounted.current && loadSequence.current === sequence) setResources(next)
    } catch (reason) {
      if (mounted.current && loadSequence.current === sequence) setLoadError(messageOf(reason))
    } finally {
      if (mounted.current && loadSequence.current === sequence) setLoading(false)
    }
  }

  async function discardUpload(): Promise<void> {
    const current = upload.current
    upload.current = null
    if (current) {
      try { await current.api.discard(current.id) } catch { /* The host expires abandoned uploads. */ }
    }
  }

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      generation.current++
      abort.current?.abort()
      // An accepted commit owns its staging until it finishes. Deleting that
      // staging while the settings panel closes would race the file copy.
      if (!commitInFlight.current) void discardUpload()
    }
  }, [])
  useEffect(() => { if (cardVisible) void refresh() }, [api, cardVisible])

  function finish(): void {
    locked.current = false
    if (!mounted.current) return
    setBusy(false)
    setProgress('')
    setCommitting(false)
    setActionRunning(false)
  }

  async function importSelection(selection: Selection): Promise<void> {
    if (locked.current || selection.files.length === 0 || !state.writable) return
    locked.current = true
    setBusy(true)
    setError('')
    setNotice('')
    setLastSelection(selection)
    setProgress(t('local.preparing'))
    const controller = new AbortController()
    abort.current = controller
    const sequence = ++generation.current
    try {
      const id = await api.start(selection.kind, selection.format, controller.signal)
      if (sequence !== generation.current) { await api.discard(id); return }
      upload.current = { id, api }
      for (let index = 0; index < selection.files.length; index++) {
        const file = selection.files[index]
        setProgress(t('local.uploading', { current: index + 1, total: selection.files.length }))
        await api.upload(id, selection.format === 'zip' ? 'archive.zip' : file.webkitRelativePath || file.name, file, controller.signal)
      }
      setProgress(t('local.inspecting'))
      const result = await api.inspect(id, controller.signal)
      if (sequence !== generation.current || !mounted.current) return
      setPreview(result)
      setProgress('')
      setLastSelection(null)
    } catch (reason) {
      if (sequence !== generation.current || !mounted.current) return
      setError(messageOf(reason))
      await discardUpload()
      finish()
    }
  }

  function pickFiles(files: FileList | null, format: 'zip' | 'folder'): void {
    if (files?.length) void importSelection({ kind: tab, files: Array.from(files), format })
  }

  async function cancelImport(): Promise<void> {
    if (commitInFlight.current) return
    generation.current++
    abort.current?.abort()
    setPreview(null)
    setError('')
    setLastSelection(null)
    await discardUpload()
    finish()
  }

  async function commitImport(): Promise<void> {
    const pending = upload.current
    if (!pending || !preview || commitInFlight.current) return
    commitInFlight.current = true
    setCommitting(true)
    setError('')
    try {
      const resource = await pending.api.commit(pending.id, preview.conflict)
      upload.current = null
      commitInFlight.current = false
      if (!mounted.current) return
      setPreview(null)
      setTab(resource.kind)
      setQuery('')
      setNotice(t(resource.kind === 'pet' ? 'local.petImported' : 'local.imported', { name: resource.name }))
      await refresh()
      finish()
    } catch (reason) {
      commitInFlight.current = false
      if (mounted.current) { setError(messageOf(reason)); setCommitting(false) }
      else await discardUpload()
    }
  }

  async function performAction(target: Confirmation): Promise<void> {
    if (locked.current || !state.writable) return
    locked.current = true
    setBusy(true)
    setActionRunning(true)
    setError('')
    setNotice('')
    setProgress(t('local.working'))
    try {
      const result = await api.action(target.resource.kind, target.resource.id, target.action, true)
      if (result.jobId) {
        const controller = new AbortController()
        abort.current = controller
        let completed = false
        for (let attempt = 0; attempt < 300; attempt++) {
          if (!mounted.current) return
          const job = await api.job(result.jobId, controller.signal)
          if (job.phase === 'error') throw new Error(job.error ?? t('local.actionFailed'))
          if (job.phase === 'done') { completed = true; break }
          await new Promise<void>((resolve) => setTimeout(resolve, 1000))
        }
        if (!completed) throw new Error(t('local.jobTimeout'))
      }
      if (!mounted.current) return
      setConfirmation(null)
      setNotice(t(result.requiresRestart ? 'local.restart' : target.action === 'trust' ? 'local.trustDone' : target.action === 'remove' ? 'local.removed' : 'local.actionDone'))
      await refresh()
    } catch (reason) {
      if (mounted.current) setError(messageOf(reason))
    } finally { finish() }
  }

  const items = resources.filter((resource) => resource.kind === tab)
  const needle = query.trim().toLocaleLowerCase()
  const shown = items.filter((resource) => [resource.name, resource.id, resource.description ?? ''].join(' ').toLocaleLowerCase().includes(needle))
  const actionButton = (resource: LocalResource, action: LocalAction): ReactNode => (
    <Button key={action} variant="outline" size="sm" disabled={disabled} onClick={() => { setError(''); setConfirmation({ resource, action }) }}>{t(ACTION_LABEL[action])}</Button>
  )
  const actionNeedsCode = confirmation?.action === 'install' || confirmation?.action === 'trust'
    || (confirmation?.action === 'enable' && confirmation.resource.kind === 'preset')

  return (
    <PluginSettingsCard t={t} titleKey="settings.title" descriptionKey="settings.description" state={state} alwaysOpen onSave={props.save} onDiscard={props.discard}>
      <BooleanField id="settings-market-enabled" label={t('settings.enable')} hint={t('settings.enableHint')}
        inheritLabel={t('settings.inherit')} onLabel={t('settings.on')} offLabel={t('settings.off')}
        overriddenLabel={t('settings.overridden')} resetLabel={t('settings.reset')} invalidLabel={t('settings.invalidNumber')}
        disabled={disabled} {...state.enabled} onEdit={(value) => { props.edit('enabled', value) }} onReset={() => { props.resetField('enabled') }} />
      {cardVisible ? <div className={css.market} data-dsh-plugin="dsh-web-ui-market">
        <div className={css.tabs} role="tablist" aria-label={t('settings.title')}>
          {KINDS.map((kind, index) => <button key={kind} type="button" role="tab" id={`workshop-tab-${kind}`}
            aria-selected={tab === kind} aria-controls="workshop-local-panel" tabIndex={tab === kind ? 0 : -1}
            disabled={busy || confirmation !== null} className={`${css.tab} ${tab === kind ? css.tabActive : ''}`}
            onClick={() => { setTab(kind); setQuery('') }}
            onKeyDown={(event) => {
              const offset = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
              const next = event.key === 'Home' ? 0 : event.key === 'End' ? KINDS.length - 1 : offset ? (index + offset + KINDS.length) % KINDS.length : -1
              if (next >= 0) { event.preventDefault(); setTab(KINDS[next]); setQuery(''); document.getElementById(`workshop-tab-${KINDS[next]}`)?.focus() }
            }}>
            {t(KIND_LABEL[kind])}<span className={css.tabCount}>{resources.filter((resource) => resource.kind === kind).length}</span>
          </button>)}
        </div>
        <div role="tabpanel" id="workshop-local-panel" aria-labelledby={`workshop-tab-${tab}`} className={css.panel}>
          <div className={css.toolbar}>
            <div className={css.actions}>
              <Button variant="primary" size="sm" className={`${css.toolbarButton} ${css.toolbarPrimary}`} disabled={disabled} onClick={() => zipInput.current?.click()}>{t('local.importZip')}</Button>
              <Button variant="outline" size="sm" className={`${css.toolbarButton} ${css.toolbarSecondary}`} disabled={disabled} onClick={() => folderInput.current?.click()}>{t('local.importFolder')}</Button>
            </div>
            <Button variant="outline" size="sm" className={`${css.toolbarButton} ${css.toolbarSecondary}`} disabled={disabled || loading} onClick={() => { void refresh() }}>{t('local.refresh')}</Button>
          </div>
          <input ref={zipInput} hidden type="file" accept=".zip,application/zip" aria-label={t('local.importZip')} onChange={(event) => { pickFiles(event.currentTarget.files, 'zip'); event.currentTarget.value = '' }} />
          <input ref={(element) => { folderInput.current = element; element?.setAttribute('webkitdirectory', '') }} hidden type="file" multiple aria-label={t('local.importFolder')} onChange={(event) => { pickFiles(event.currentTarget.files, 'folder'); event.currentTarget.value = '' }} />
          <p className={css.hint}>{t('local.importHint', { kind: t(KIND_LABEL[tab]) })}</p>
          <input type="search" className={css.search} value={query} aria-label={t('search.label')} placeholder={t('search.label')} onChange={(event) => { setQuery(event.target.value) }} />
          {progress ? <div className={css.feedback} role="status" aria-live="polite"><span>{progress}</span>{!confirmation && !committing ? <Button onClick={() => { void cancelImport() }}>{t('cancel')}</Button> : null}</div> : null}
          {notice ? <p className={css.notice} role="status">{notice}</p> : null}
          {error && !preview && !confirmation ? <div className={css.feedback} role="alert"><span className={css.error}>{error}</span>{lastSelection ? <Button disabled={disabled} onClick={() => { void importSelection(lastSelection) }}>{t('retry')}</Button> : null}</div> : null}
          {loadError ? <div className={css.feedback} role="alert"><span className={css.error}>{t('local.loadFailed', { reason: loadError })}</span><Button disabled={busy} onClick={() => { void refresh() }}>{t('retry')}</Button></div> : null}
          {loading ? <p className={css.hint} role="status">{t('loading')}</p> : null}
          {!loading && !loadError && shown.length === 0 ? <div className={css.empty}><strong>{t(needle ? 'noMatch' : 'local.empty')}</strong><p>{t(needle ? 'local.searchHint' : 'local.emptyHint')}</p></div> : null}
          {shown.length ? <ul className={css.grid}>{shown.map((resource) => <li key={`${resource.kind}:${resource.id}`} className={css.card}>
            <div className={css.cardHeading}><strong className={css.cardName}>{resource.name}</strong>{resource.version ? <span className={css.version}>v{resource.version}</span> : null}</div>
            <div className={css.cardMeta}><span className={css.badge}>{t(resource.kind === 'plugin' && resource.installed ? resource.enabled === false ? 'local.status.disabled' : 'local.status.installed' : STATUS_LABEL[resource.status] ?? 'local.status.available')}</span><span>{t(resource.source === 'local' ? 'local.source.local' : 'local.source.existing')}</span></div>
            {resource.description ? <p className={css.description}>{resource.description}</p> : null}
            <p className={css.identifier}>{resource.id}</p>
            {resource.kind === 'skin' || resource.kind === 'pet' ? <p className={css.hint}>{t(resource.kind === 'skin' ? 'local.applySkin' : 'local.applyPet')}</p> : null}
            {!resource.managed && (resource.kind === 'plugin' || resource.kind === 'preset') ? <p className={css.hint}>{t(resource.kind === 'plugin' ? 'local.managePlugins' : 'local.managePresets')}</p> : null}
            <div className={css.actions}>
              {resource.managed && resource.status !== 'invalid' && resource.kind === 'plugin' ? actionButton(resource, resource.installed ? resource.enabled === false ? 'enable' : 'disable' : 'install') : null}
              {resource.managed && resource.status !== 'invalid' && resource.kind === 'preset' ? actionButton(resource, activeResource(resource) ? 'disable' : 'enable') : null}
              {resource.managed && resource.status !== 'invalid' && resource.kind === 'skin' && resource.executable ? actionButton(resource, 'trust') : null}
              {resource.managed && !activeResource(resource) && !resource.installed ? actionButton(resource, 'remove') : null}
            </div>
          </li>)}</ul> : null}
        </div>
      </div> : null}
      <Modal open={preview !== null} title={t('local.confirmImport')} closeLabel={t('cancel')} onClose={() => { if (!committing) void cancelImport() }}>
        {preview ? <div className={css.confirmation}>
          <dl className={css.details}><dt>{t('local.name')}</dt><dd>{preview.name}</dd><dt>{t('local.kind')}</dt><dd>{t(KIND_LABEL[preview.kind])}</dd><dt>{t('local.version')}</dt><dd>{preview.version ?? t('local.noVersion')}</dd><dt>{t('local.files')}</dt><dd>{t('local.fileSummary', { count: preview.fileCount, size: resourceSize(preview.totalBytes) })}</dd></dl>
          <p className={css.hint}>{t('local.importOnly')}</p>
          {preview.conflict ? <p className={css.warning}>{t('local.replaceHint')}</p> : null}
          {error ? <p className={css.error} role="alert">{error}</p> : null}
          <div className={css.modalActions}><Button variant="outline" size="sm" disabled={committing} onClick={() => { void cancelImport() }}>{t('cancel')}</Button><Button variant="primary" size="sm" disabled={committing} onClick={() => { void commitImport() }}>{t(committing ? 'local.importing' : preview.conflict ? 'local.replaceImport' : 'local.confirmImport')}</Button></div>
        </div> : null}
      </Modal>
      <Modal open={confirmation !== null} title={confirmation ? t(ACTION_LABEL[confirmation.action]) : ''} closeLabel={t('cancel')} onClose={() => { if (!actionRunning) { setConfirmation(null); setError('') } }}>
        {confirmation ? <div className={css.confirmation}>
          <p>{t('local.confirmAction', { action: t(ACTION_LABEL[confirmation.action]), name: confirmation.resource.name })}</p>
          {actionNeedsCode ? <p className={css.warning}>{t(confirmation.action === 'install' ? 'local.installCodeHint' : confirmation.action === 'trust' ? 'local.trustCodeHint' : 'local.presetCodeHint')}</p> : null}
          {confirmation.action === 'remove' ? <p className={css.hint}>{t('local.removeHint')}</p> : null}
          {error ? <p className={css.error} role="alert">{error}</p> : null}
          {actionRunning ? <p className={css.hint} role="status">{progress}</p> : null}
          <div className={css.modalActions}><Button variant="outline" size="sm" disabled={actionRunning} onClick={() => { setConfirmation(null); setError('') }}>{t('cancel')}</Button><Button variant="primary" size="sm" disabled={actionRunning} onClick={() => { void performAction(confirmation) }}>{t(actionRunning ? 'local.working' : actionNeedsCode ? 'local.confirmCode' : ACTION_LABEL[confirmation.action])}</Button></div>
        </div> : null}
      </Modal>
    </PluginSettingsCard>
  )
}

export type MarketSectionProps = ComponentProps<typeof MarketCard>
export function MarketSection(props: MarketSectionProps): ReactNode { return <MarketCard {...props} /> }
