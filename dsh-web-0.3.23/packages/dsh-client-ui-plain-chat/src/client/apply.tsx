import React, { useSyncExternalStore } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { ChatStart, PRESET_ID } from '../core/start.ts'
import { decorateSlot, type Registry } from './slot-adapter.ts'
import { DraftComposer } from './DraftComposer.tsx'
import { en, zh, type ChatKey } from './locales.ts'
import { ru } from '../../../dsh-i18n/src/client/ru/plain-chat.ts'
import styles from './Chat.module.css'

export const inject = ['slots', 'locale', 'sessions', 'conversation', 'layout', 'remote', 'remote.session']
const NS = 'workbench-chat'
declare module '@deepseek-ai/dsh-client-ui-slots' { interface LocaleNamespaceMap { 'workbench-chat': ChatKey } }

export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'plain-chat: locale')
  ctx.effect(() => {
    try { return ctx.locale.register(NS, 'ru', ru) }
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
  }, chatRoot, () => `session-${crypto.randomUUID()}`)
  const registry = ctx.slots as unknown as Registry

  // These resident entries own private inject callbacks and child declarations.
  // Decorate only their component face, preserving those identities and cleanup.
  ctx.effect(() => decorateSlot(registry, 'main.conversation', 'ConversationRoot', Original => {
    return function ChatConversation(props: any) {
      const draftKey = useSyncExternalStore(subscribe, snapshot)
      const summary = props.useSessions((s: any) => props.sessionId ? s.byId[props.sessionId] : undefined)
      const composerBlock = props.useComposerBlock((block: unknown) => block)
      const plain = summary?.projectionValues?.agentPreset === PRESET_ID || created.has(props.sessionId)
      const noSession = props.sessionId === undefined
      const translate = (key: string, ...args: unknown[]) => key === 'hero.chooseWorkspace' && (plain || noSession) ? t('workspace') : props.t(key, ...args)
      const renderSlot = (key: string, owner: any, ...rest: any[]) => {
        if (key === 'conversation.hero.agentPreset' && (plain || noSession)) return <span className={styles.badge}>{t('mode')}</span>
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
      return <Original {...props} t={translate} renderSlot={renderSlot} selectWorkspace={selectWorkspace} />
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
