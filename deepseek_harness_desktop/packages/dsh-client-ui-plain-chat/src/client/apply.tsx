import React, { useSyncExternalStore } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { ChatStart, PRESET_ID } from '../core/start.ts'
import { decorateSlot, type Registry } from './slot-adapter.ts'
import { DraftComposer } from './DraftComposer.tsx'
import { withAppearanceNavigation } from './AppearanceNavigation.tsx'
import { CapabilityPreviewContext, createCapabilityPreview } from './capability-preview.tsx'
import { registerCapabilityCenter } from './capability-settings.tsx'
import { AgentPresetDisclosure } from './RoleAssistants.tsx'
import { ManagedCenter } from './ManagedCenter.tsx'
import { BrowserTaskStatus, ManagedCurrentAssistant, ManagedRolePicker, ManagedRolesSection } from './ManagedRoles.tsx'
import { BrowserObservation } from './BrowserObservation.tsx'
import { capabilityClient, type CapabilityLink } from './capability-client.ts'
import { latest } from '../../../dsh-capabilities/src/core/model.ts'
import { createRoleSelection, createSettingsNavigation } from './role-ui-state.ts'
import { en, zh, type ChatKey } from './locales.ts'
import { ru } from '../../../dsh-i18n/src/client/ru/plain-chat.ts'
import styles from './Chat.module.css'

export const inject = ['slots', 'locale', 'sessions', 'conversation', 'layout', 'remote', 'remote.session']
const NS = 'workbench-chat'
declare module '@deepseek-ai/dsh-client-ui-slots' { interface LocaleNamespaceMap { 'workbench-chat': ChatKey } }

export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'plain-chat: locale')
  ctx.effect(() => {
    try { return ctx.locale.register(NS, 'ru', { ...en, ...ru }) }
    catch { return () => {} /* A rebuilt language pack may already own this dictionary. */ }
  }, 'plain-chat: central Russian dictionary')
  const t = ctx.locale.bind(NS)
  const chatRoot = document.querySelector<HTMLMetaElement>('meta[name="dsh-plain-chat-root"]')?.content ?? ''
  const sessions = ctx.sessions
  const layout = ctx.get('layout') as { selectPanel(id: string | null): void }
  const created = new Set<string>()
  let revision = 0
  const listeners = new Set<() => void>()
  const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } }
  const snapshot = () => revision
  const clearSavedDraft = () => { try { sessionStorage.removeItem('workbench-chat-draft') } catch { /* Optional storage. */ } }
  const roleSelection = createRoleSelection<string>()
  const start = new ChatStart({
    create: request => (ctx.remote as unknown as { session: { create: import('../core/start.ts').StartPort['create'] } }).session.create(request),
    adopt: request => sessions.create(request as Parameters<typeof sessions.create>[0]),
    deliver: (id, text) => {
      const binding = sessions.binding(id as Parameters<typeof sessions.binding>[0])
      if (!binding) throw new Error('Plain chat session is unavailable')
      const input = ctx.conversation.input.for(binding.ctx)
      input.setDraft(text)
      created.add(id)
      clearSavedDraft()
      sessions.open(binding.sessionId)
      layout.selectPanel(null)
      input.submit()
    },
  }, chatRoot, () => `session-${crypto.randomUUID()}`, () => {
    const selected = roleSelection.getSnapshot()
    if (selected === 'chat') return PRESET_ID
    const role = capabilityClient.getSnapshot().data?.state.roles.find(r => r.id === selected)
    const version = role && latest(role.versions)
    if (!role?.enabled || !version) throw new Error('此岗位尚未发布或已停用，请重新选择岗位。')
    return version.preset
  })
  // 切换岗位需要重新创建会话；重复选中则保留失败重试的会话身份。
  const selectRole = (id: string) => {
    if (id === roleSelection.getSnapshot()) return
    start.reset()
    roleSelection.select(id)
  }
  const registry = ctx.slots as unknown as Registry
  const capabilityPreview = createCapabilityPreview()
  registerCapabilityCenter(ctx.slots as unknown as Parameters<typeof registerCapabilityCenter>[0], () => t('centerTitle'), () => <ManagedCenter />)
  const settingsNavigation = createSettingsNavigation()
  ctx.effect(() => {
    const open = (event: Event) => settingsNavigation.openSection((event as CustomEvent<CapabilityLink>).detail.section)
    window.addEventListener('workbench-capability-link', open)
    return () => window.removeEventListener('workbench-capability-link', open)
  }, 'plain-chat: capability links')
  ctx.effect(() => decorateSlot(registry, 'sidebar.settings', 'SettingsRoot', Original =>
    withAppearanceNavigation(Original as (props: any) => React.ReactNode, () => t('appearanceTitle'), settingsNavigation)), 'plain-chat: appearance navigation group')

  // Keep the official roster and its injected actions; this addition is UI-only.
  ctx.effect(() => decorateSlot(registry, 'settings.section', 'AgentPresetSection', Original => function RolePresetSection(props: any) {
    const selected = useSyncExternalStore(roleSelection.subscribe, roleSelection.getSnapshot)
    return <><ManagedRolesSection selected={selected} onSelect={selectRole} /><AgentPresetDisclosure t={t}><Original {...props} /></AgentPresetDisclosure></>
  }), 'plain-chat: role assistant settings preview')

  // These resident entries own private inject callbacks and child declarations.
  // Decorate only their component face, preserving those identities and cleanup.
  ctx.effect(() => decorateSlot(registry, 'main.conversation', 'ConversationRoot', Original => {
    return function ChatConversation(props: any) {
      const draftKey = useSyncExternalStore(subscribe, snapshot)
      const selectedRole = useSyncExternalStore(roleSelection.subscribe, roleSelection.getSnapshot)
      const summary = props.useSessions((s: any) => props.sessionId ? s.byId[props.sessionId] : undefined)
      const composerBlock = props.useComposerBlock((block: unknown) => block)
      const actualPreset = summary?.projectionValues?.agentPreset
      const plain = actualPreset === PRESET_ID || String(actualPreset ?? '').startsWith('workbench-role-') || created.has(props.sessionId)
      const noSession = props.sessionId === undefined
      const translate = (key: string, ...args: unknown[]) => key === 'hero.chooseWorkspace' && (plain || noSession) ? t('workspace') : props.t(key, ...args)
      const renderSlot = (key: string, owner: any, ...rest: any[]) => {
        if (key === 'conversation.hero.agentPreset' && noSession) return <ManagedRolePicker t={t} selected={selectedRole} onSelect={selectRole} />
        if (key === 'conversation.hero.agentPreset' && plain) return <span className={styles.badge}>{t('mode')}</span>
        if (key === 'conversation.composer.bar') {
          if (noSession) return <DraftComposer key={draftKey} start={start} t={t} available={chatRoot !== ''} />
          // Only the workspace gate is removed. Business composer blocks remain intact.
          if (plain && owner.onRequestWorkspace) {
            return props.renderSlot(key, { ...owner, disabled: false, blocked: composerBlock, placeholder: composerBlock?.reason ?? t('placeholder'), onRequestWorkspace: undefined }, ...rest)
          }
          if (plain) return props.renderSlot(key, { ...owner, placeholder: owner.blocked?.reason ?? t('placeholder') }, ...rest)
        }
        return props.renderSlot(key, owner, ...rest)
      }
      const selectWorkspace = async (id: string) => {
        start.reset()
        await props.selectWorkspace(id)
        if (!noSession) return
        const current = sessions.list.getSnapshot().current
        const binding = current ? sessions.binding(current) : undefined
        let draft = ''
        try { draft = sessionStorage.getItem('workbench-chat-draft') ?? '' } catch { /* Optional storage. */ }
        if (binding && draft) {
          const input = ctx.conversation.input.for(binding.ctx)
          if (!input.state.getSnapshot().draft) { input.setDraft(draft); clearSavedDraft() }
        }
      }
      return <div className={styles.conversationShell}>
        <div className={styles.assistantToolbar}><ManagedCurrentAssistant selected={selectedRole} preset={actualPreset} onOpen={settingsNavigation.openPresets} /></div>
        <BrowserTaskStatus sessionId={props.sessionId}/>
        {String(actualPreset ?? '').startsWith('workbench-role-') && <BrowserObservation sessionId={props.sessionId}/>}
        <div className={styles.conversationContent}><Original {...props} t={translate} renderSlot={renderSlot} selectWorkspace={selectWorkspace} /></div>
      </div>
    }
  }), 'plain-chat: conversation adapter')

  ctx.effect(() => decorateSlot(registry, 'sidebar', 'SidebarRoot', Original => function ChatSidebar(props: any) {
    const startSession = (workspaceId?: string) => {
      if (workspaceId !== undefined) return props.startSession(workspaceId)
      start.reset(); clearSavedDraft(); revision++; listeners.forEach(fn => fn())
      sessions.clear(); layout.selectPanel(null)
    }
    return <Original {...props} startSession={startSession} />
  }), 'plain-chat: new conversation')

  ctx.effect(() => decorateSlot(registry, 'sidebar.workspaces', 'WorkspaceBrowser', Original => function ChatHistory(props: any) {
    const translate = (key: string, ...args: unknown[]) => key === 'group.ungrouped' ? t('history') : props.t(key, ...args)
    return <Original {...props} t={translate} />
  }), 'plain-chat: history label')
  ctx.effect(() => () => { start.reset(); listeners.clear() }, 'plain-chat: cleanup')
}
