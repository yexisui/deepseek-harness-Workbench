import React, { useState, useSyncExternalStore } from 'react'
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
import { ComponentCenter } from './ComponentCenter.tsx'
import { registerComponentInventory } from './component-inventory-slot.tsx'
import { registerCapabilityCenter, registerComponentCenter } from './capability-settings.tsx'
import { AgentPresetDisclosure } from './RoleAssistants.tsx'
import { ManagedCenter } from './ManagedCenter.tsx'
import { BrowserTaskStatus, ManagedCurrentAssistant, ManagedRolePicker, ManagedRolesSection, MEETING_DEMO_ROLE_ID } from './ManagedRoles.tsx'
import { DeveloperAssistant } from './DeveloperAssistant.tsx'
import { createDeveloperHistory, usesDeveloper } from './developer-client.ts'
import { RequirementsAssistant } from './RequirementsAssistant.tsx'
import { createRequirementHistory } from './requirement-history.ts'
import { usesRequirements } from './requirements-routing.ts'
import { MeetingDemo } from './MeetingDemo.tsx'
import { LocalConversationRows } from './LocalConversationRows.tsx'
import { NativeConversationRemoval } from './NativeConversationRemoval.tsx'
import { createLocalConversations } from './local-conversations.ts'
import { BrowserObservation } from './BrowserObservation.tsx'
import { capabilityClient, type CapabilityLink } from './capability-client.ts'
import { latest } from '../../../dsh-capabilities/src/core/model.ts'
import { createRoleSelection, createSettingsNavigation } from './role-ui-state.ts'
import { en, zh, type ChatKey } from './locales.ts'
import { ru } from '../../../dsh-i18n/src/client/ru/plain-chat.ts'
import styles from './Chat.module.css'
import { JevToggle, JevActivity, JevSettings, JevModelReturn } from '../../../dsh-jev-mode/src/ui/JevControls.tsx'
import { registerJevNavigation } from '../../../dsh-jev-mode/src/ui/view-model.ts'

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
  const loadMeetingModels = async () => {
    const remote = ctx.remote as unknown as { session?: { modelCatalog?: () => Promise<{ ok: boolean; value?: { groups?: Array<{ id?: string; provider?: string; models?: Array<{ id: string; name?: string }> }> } }> } }
    const result = await remote.session?.modelCatalog?.()
    if (!result?.ok) return []
    return (result.value?.groups ?? []).flatMap(group => (group.models ?? []).map(model => ({ id: `${group.id ?? group.provider}/${model.id}`, name: model.name ?? model.id }))).filter(model => !model.id.startsWith('undefined/'))
  }
  const layout = ctx.get('layout') as { selectPanel(id: string | null): void }
  const created = new Set<string>()
  let revision = 0
  const listeners = new Set<() => void>()
  const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } }
  const snapshot = () => revision
  const clearSavedDraft = () => { try { sessionStorage.removeItem('workbench-chat-draft') } catch { /* Optional storage. */ } }
  const roleSelection = createRoleSelection<string>()
  const localConversations = createLocalConversations()
  const requirementHistory = createRequirementHistory()
  const developerHistory = createDeveloperHistory()
  let developerNavigation = 0
  let developerViewKey = `developer-${developerHistory.getSnapshot().activeId ?? "initial"}`
  if (sessions.list.getSnapshot().current !== undefined || localConversations.active()) developerHistory.leave()
  ctx.effect(() => { void developerHistory.load(); const refresh = () => { void developerHistory.load() }; window.addEventListener("focus", refresh); return () => window.removeEventListener("focus", refresh) }, "plain-chat: developer history")
  let requirementViewKey = `requirements-${requirementHistory.getSnapshot().activeId ?? 'initial'}`
  let requirementNavigation = 0
  if (sessions.list.getSnapshot().current !== undefined || localConversations.active()) requirementHistory.leave()
  ctx.effect(() => { void requirementHistory.load(); const refresh = () => { void requirementHistory.load() }; window.addEventListener("focus", refresh); return () => window.removeEventListener("focus", refresh) }, "plain-chat: requirement history")
  const resumedLocal = localConversations.active()
  if (resumedLocal && sessions.list.getSnapshot().current === undefined) roleSelection.select(resumedLocal.role)
  else if (resumedLocal) localConversations.leave()
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
      const local = localConversations.active()
      if (local?.kind === 'draft') localConversations.commitChat(local.id)
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
    requirementHistory.leave()
    developerHistory.leave(); developerViewKey = `developer-new-${++developerNavigation}`
    requirementViewKey = `requirements-${id}-${++requirementNavigation}`
    roleSelection.select(id)
    if (sessions.list.getSnapshot().current === undefined) {
      const active = localConversations.active()
      const local = active?.kind === 'demo' ? localConversations.start(id) : active ?? localConversations.start(id)
      if (local.kind === 'draft') localConversations.setRole(local.id, id)
    }
  }
  // Both the main New button and the ungrouped chat-row + open a fresh draft.
  // A new draft always begins in free chat; published sessions keep their own preset.
  const startFreshChat = (role = 'chat') => {
    requirementViewKey = `requirements-new-${role}-${++requirementNavigation}`
    requirementHistory.leave()
    developerHistory.leave(); developerViewKey = `developer-new-${++developerNavigation}`
    start.reset()
    clearSavedDraft()
    localConversations.start(role)
    if (roleSelection.getSnapshot() !== role) roleSelection.select(role)
    revision++
    listeners.forEach(fn => fn())
    sessions.clear()
    layout.selectPanel(null)
  }
  const openLocalConversation = (id: string) => {
    const developer = developerHistory.getSnapshot().items.find(item => item.id === id)
    if (developer) {
      developerViewKey = `developer-${id}-${++developerNavigation}`
      start.reset(); localConversations.leave(); requirementHistory.leave(); developerHistory.open(id); roleSelection.select(developer.roleId); clearSavedDraft()
      revision++; listeners.forEach(fn => fn()); sessions.clear(); layout.selectPanel(null); return
    }
    developerHistory.leave(); developerViewKey = `developer-local-${id}-${++developerNavigation}`
    const requirement = requirementHistory.getSnapshot().items.find(item => item.id === id)
    if (requirement) {
      requirementViewKey = `requirements-${id}-${++requirementNavigation}`
      start.reset(); localConversations.leave(); requirementHistory.open(id); roleSelection.select(requirement.roleId); clearSavedDraft()
      revision++; listeners.forEach(fn => fn()); sessions.clear(); layout.selectPanel(null); return
    }
    requirementHistory.leave()
    const row = localConversations.getSnapshot().items.find(item => item.id === id)
    if (!row) return
    requirementViewKey = `requirements-local-${id}-${++requirementNavigation}`
    start.reset()
    localConversations.open(id)
    roleSelection.select(row.role)
    try { sessionStorage.setItem('workbench-chat-draft', row.draft) } catch { /* Optional storage. */ }
    revision++
    listeners.forEach(fn => fn())
    sessions.clear()
    layout.selectPanel(null)
  }
  const removeLocalConversation = (id: string) => {
    const developer = developerHistory.getSnapshot().items.find(item => item.id === id)
    if (developer) {
      if (!window.confirm(`移除“${developer.title}”的开发记录？代码、提交和工作目录保留；此对话和运行记录将被删除。`)) return
      const active = developerHistory.getSnapshot().activeId === id, navigation = developerViewKey
      void developerHistory.remove(id).then(() => { if (active && navigation === developerViewKey) startFreshChat() }).catch(error => window.alert(error instanceof Error ? error.message : String(error)))
      return
    }
    const requirement = requirementHistory.getSnapshot().items.find(item => item.id === id)
    if (requirement) {
      if (!window.confirm(`移除“${requirement.title}”？这将删除此需求分析的资料、对话、需求条目和确认版本，无法撤销。`)) return
      const active = requirementHistory.getSnapshot().activeId === id
      const navigation = requirementViewKey
      void requirementHistory.remove(id).then(() => { if (active && navigation === requirementViewKey && sessions.list.getSnapshot().current === undefined) startFreshChat() }).catch(error => window.alert(error instanceof Error ? error.message : String(error)))
      return
    }
    const row = localConversations.getSnapshot().items.find(item => item.id === id)
    const meetingId = row?.meeting && typeof row.meeting === 'object' ? (row.meeting as { jobId?: unknown }).jobId : undefined
    if (typeof meetingId === 'string') void fetch(`/api/capabilities/meeting/job/${encodeURIComponent(meetingId)}`, { method: 'DELETE', credentials: 'same-origin' }).catch(() => {})
    const active = localConversations.getSnapshot().activeId === id
    localConversations.remove(id)
    if (!active) return
    start.reset(); clearSavedDraft(); roleSelection.select('chat')
    revision++; listeners.forEach(fn => fn())
  }
  ctx.effect(() => {
    const unsubscribe = sessions.list.subscribe(() => {
      if (sessions.list.getSnapshot().current !== undefined) { if (localConversations.active()) localConversations.leave(); if (requirementHistory.getSnapshot().activeId) requirementHistory.leave(); if (developerHistory.getSnapshot().activeId) developerHistory.leave() }
    })
    return unsubscribe
  }, 'plain-chat: local draft lifecycle')
  const registry = ctx.slots as unknown as Registry
  ctx.effect(() => registerComponentInventory(registry), 'plain-chat: shared component inventory compatibility')
  const capabilityPreview = createCapabilityPreview()
  registerCapabilityCenter(ctx.slots as unknown as Parameters<typeof registerCapabilityCenter>[0], () => t('centerTitle'), () => <ManagedCenter />)
  ctx.slots.inject('settings.section', () => ctx.slots.register({name:'settings.section',id:'jev-mode',order:23,label:()=> 'JEV 模式',locale:NS}, () => <JevSettings/>))
  registerComponentCenter(ctx.slots as unknown as Parameters<typeof registerComponentCenter>[0], () => <ComponentCenter />)
  const settingsNavigation = createSettingsNavigation()
  ctx.effect(()=>registerJevNavigation(scope=>{
    const separator=scope.indexOf(':'),kind=scope.slice(0,separator),id=scope.slice(separator+1)
    if(kind==='native'){
      const session=sessions.list.getSnapshot().byId[id as Parameters<typeof sessions.open>[0]]
      return session?{name:session.title||session.displayTitle||'聊天会话',open:()=>{sessions.open(session.id);layout.selectPanel(null);settingsNavigation.close()}}:undefined
    }
    const row=kind==='developer'?developerHistory.getSnapshot().items.find(row=>row.id===id):kind==='requirements'?requirementHistory.getSnapshot().items.find(row=>row.id===id):kind==='meeting'?localConversations.getSnapshot().items.find(row=>(row.meeting as {jobId?:string}|undefined)?.jobId===id):undefined
    return row?{name:row.title,open:()=>{openLocalConversation(row.id);settingsNavigation.close()}}:undefined
  }), 'plain-chat: JEV conversation navigation')
  ctx.effect(()=>decorateSlot(registry,'settings.section','ModelsSection',Original=>function JevLinkedModels(props:any){return <JevModelReturn><Original {...props}/></JevModelReturn>}), 'plain-chat: JEV model settings return')
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
      const localSnapshot = useSyncExternalStore(localConversations.subscribe, localConversations.getSnapshot)
      const local = localSnapshot.items.find(row => row.id === localSnapshot.activeId)
      const requirementSnapshot = useSyncExternalStore(requirementHistory.subscribe, requirementHistory.getSnapshot)
      const requirement = requirementSnapshot.items.find(row => row.id === requirementSnapshot.activeId)
      const developerSnapshot = useSyncExternalStore(developerHistory.subscribe, developerHistory.getSnapshot)
      const developer = developerSnapshot.items.find(row => row.id === developerSnapshot.activeId)
      const developerKey = developerViewKey
      const effectiveRole = developer?.roleId ?? requirement?.roleId ?? local?.role ?? selectedRole
      const capabilities = useSyncExternalStore(capabilityClient.subscribe, capabilityClient.getSnapshot)
      const analysisRole = capabilities.data?.state.roles.find(role => role.id === effectiveRole)
      const analysisVersion = requirement ? analysisRole?.versions.find(version => version.version === requirement.roleVersion) : analysisRole && latest(analysisRole.versions)
      const developerVersion = developer ? analysisRole?.versions.find(v => v.version === developer.roleVersion) : analysisRole && latest(analysisRole.versions)
      const showDeveloper = Boolean(developer) || usesDeveloper(capabilities.data?.state, developerVersion)
      const analysisViewKey = requirementViewKey
      const showRequirements = Boolean(requirement) || usesRequirements(capabilities.data?.state, analysisVersion)
      const meetingRole = capabilities.data?.state.roles.find(role => role.id === MEETING_DEMO_ROLE_ID)
      const savedMeetingVersion = local?.meeting && typeof local.meeting === 'object' ? (local.meeting as { roleVersion?: unknown }).roleVersion : undefined
      const meetingVersion = meetingRole?.versions.find(version => version.version === savedMeetingVersion) ?? (meetingRole && latest(meetingRole.versions))
      const summary = props.useSessions((s: any) => props.sessionId ? s.byId[props.sessionId] : undefined)
      const composerBlock = props.useComposerBlock((block: unknown) => block)
      const actualPreset = summary?.projectionValues?.agentPreset
      const plain = actualPreset === PRESET_ID || String(actualPreset ?? '').startsWith('workbench-role-') || created.has(props.sessionId)
      const noSession = props.sessionId === undefined
      const sessionRole = actualPreset === PRESET_ID ? 'chat' : capabilities.data?.state.roles.find(role => role.versions.some(version => version.preset === actualPreset))?.id
      const displayedRole = noSession ? effectiveRole : sessionRole ?? (actualPreset ? 'chat' : selectedRole)
      const translate = (key: string, ...args: unknown[]) => key === 'hero.chooseWorkspace' && (plain || noSession) ? t('workspace') : props.t(key, ...args)
      const renderSlot = (key: string, owner: any, ...rest: any[]) => {
        if (key === 'conversation.hero.agentPreset' && noSession) return <ManagedRolePicker t={t} selected={effectiveRole} onSelect={selectRole} />
        if (key === 'conversation.hero.agentPreset' && plain) return <span className={styles.badge}>{t('mode')}</span>
        if (key === 'conversation.composer.bar') {
          if (noSession) return <DraftComposer key={draftKey} start={start} t={t} available={chatRoot !== ''} initialDraft={local?.kind === 'draft' ? local.draft : undefined} onDraftChange={value => {
            let row = localConversations.active()
            if (!row && value.trim()) row = localConversations.start(effectiveRole)
            if (row?.kind === 'draft') localConversations.setDraft(row.id, value)
          }} />
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
        if (binding && local?.kind === 'draft') localConversations.commitChat(local.id)
      }
      return <div className={styles.conversationShell}>
        <div className={styles.assistantToolbar}><ManagedCurrentAssistant selected={displayedRole} preset={noSession && showDeveloper ? developerVersion?.preset : noSession && showRequirements ? analysisVersion?.preset : noSession && effectiveRole === MEETING_DEMO_ROLE_ID ? meetingVersion?.preset : noSession ? undefined : actualPreset} onOpen={settingsNavigation.openPresets} /><JevToggle/></div>
        <JevActivity scope={!noSession?'native:'+props.sessionId:developer?'developer:'+developer.id:requirement?'requirements:'+requirement.id:(local?.meeting as {jobId?:string}|undefined)?.jobId?'meeting:'+(local!.meeting as {jobId:string}).jobId:undefined}/>
        <BrowserTaskStatus sessionId={props.sessionId}/>
        {String(actualPreset ?? '').startsWith('workbench-role-') && <BrowserObservation sessionId={props.sessionId}/>}
        <div className={styles.conversationContent}>{noSession && developerSnapshot.activeId && !developer ? <p role="status">{developerSnapshot.error || '正在恢复开发任务…'}<button onClick={() => { void developerHistory.load() }}>重新读取</button><button onClick={() => startFreshChat()}>返回新对话</button></p> : noSession && showDeveloper
          ? <DeveloperAssistant key={developerKey} taskId={developer?.id} draftKey={local?.id ?? developerKey} initialDraft={local?.kind === 'draft' ? local.draft : undefined} roleId={effectiveRole} roleVersion={developerVersion?.version} loadModels={loadMeetingModels} onDraftChange={value => {
            if (developerKey !== developerViewKey || sessions.list.getSnapshot().current !== undefined || developerHistory.getSnapshot().activeId) return
            const row = localConversations.active()
            if (row?.kind === 'draft' && row.role === effectiveRole && row.draft !== value) localConversations.setDraft(row.id, value)
          }} onCommit={task => {
            const current = developerKey === developerViewKey && sessions.list.getSnapshot().current === undefined && roleSelection.getSnapshot() === effectiveRole
            const origin = local && localConversations.getSnapshot().items.find(row => row.id === local.id)
            if (current && origin?.kind === 'draft') localConversations.commitChat(origin.id)
            developerHistory.upsert(task, current)
          }}/>
          : noSession && requirementSnapshot.activeId && !requirement ? <p role="status">{requirementSnapshot.error || '正在恢复需求分析…'}<button onClick={() => { void requirementHistory.load() }}>重新读取</button><button onClick={() => startFreshChat()}>返回新对话</button></p> : noSession && showRequirements
          ? <RequirementsAssistant key={analysisViewKey} taskId={requirement?.id} draftKey={local?.id ?? analysisViewKey} initialDraft={local?.kind === 'draft' ? local.draft : undefined} roleId={effectiveRole} roleVersion={analysisVersion?.version} assistant={analysisVersion} loadModels={loadMeetingModels} onDraftChange={value => {
            if (analysisViewKey !== requirementViewKey || sessions.list.getSnapshot().current !== undefined || requirementHistory.getSnapshot().activeId) return
            const row = localConversations.active()
            if (row?.kind === 'draft' && row.role === effectiveRole && row.draft !== value) localConversations.setDraft(row.id, value)
          }} onCommit={task => {
            const activeId = requirementHistory.getSnapshot().activeId
            const current = analysisViewKey === requirementViewKey && sessions.list.getSnapshot().current === undefined && (requirement ? activeId === requirement.id : revision === draftKey && roleSelection.getSnapshot() === effectiveRole && (!activeId || activeId === task.id))
            const origin = localSnapshot.items.find(row => row.id === local?.id)
            const retained = origin && localConversations.getSnapshot().items.find(row => row.id === origin.id)
            if (retained?.kind === 'draft' && retained.role === effectiveRole && (current || retained.draft === origin?.draft)) localConversations.commitChat(retained.id)
            requirementHistory.upsert(task, current)
          }}/>
          : noSession && (local?.kind === 'demo' || effectiveRole === MEETING_DEMO_ROLE_ID)
          ? <MeetingDemo key={draftKey} initialState={local?.meeting} assistant={meetingVersion} roleVersion={meetingVersion?.version} loadModels={loadMeetingModels} onSnapshot={state => {
            const row = localConversations.active() ?? localConversations.start(MEETING_DEMO_ROLE_ID)
            localConversations.setMeeting(row.id, state, state.draft)
          }} onCommit={title => {
            const row = localConversations.active() ?? localConversations.start(MEETING_DEMO_ROLE_ID)
            localConversations.commitDemo(row.id, title)
          }} onReset={() => startFreshChat(MEETING_DEMO_ROLE_ID)}/>
          : <Original {...props} t={translate} renderSlot={renderSlot} selectWorkspace={selectWorkspace} />}</div>
      </div>
    }
  }), 'plain-chat: conversation adapter')

  ctx.effect(() => decorateSlot(registry, 'sidebar', 'SidebarRoot', Original => function ChatSidebar(props: any) {
    const startSession = (workspaceId?: string) => {
      if (workspaceId !== undefined) return props.startSession(workspaceId)
      startFreshChat()
    }
    return <Original {...props} startSession={startSession} />
  }), 'plain-chat: new conversation')

  ctx.effect(() => decorateSlot(registry, 'sidebar.workspaces', 'WorkspaceBrowser', Original => function ChatHistory(props: any) {
    const local = useSyncExternalStore(localConversations.subscribe, localConversations.getSnapshot)
    const requirements = useSyncExternalStore(requirementHistory.subscribe, requirementHistory.getSnapshot)
    const developers = useSyncExternalStore(developerHistory.subscribe, developerHistory.getSnapshot)
    const historyRows = [...local.items, ...developers.items.map(item => ({ id: item.id, role: item.roleId, kind: 'developer' as const, title: item.title, draft: '', updatedAt: Date.parse(item.updatedAt) })),  ...requirements.items.map(item => ({ id: item.id, role: item.roleId, kind: 'requirements' as const, title: item.title, draft: '', updatedAt: Date.parse(item.updatedAt) }))].sort((a, b) => b.updatedAt - a.updatedAt)
    const [host, setHost] = useState<HTMLDivElement | null>(null)
    const translate = (key: string, ...args: unknown[]) => key === 'group.ungrouped' ? t('history') : props.t(key, ...args)
    // The upstream ungrouped row renders a + button but deliberately gives it
    // no action. Capture that one button without changing real workspace rows.
    const ungroupedNewLabel = props.t('actions.newSession.aria', { name: t('history') })
    const onClickCapture = (event: React.MouseEvent<HTMLDivElement>) => {
      const button = (event.target as HTMLElement).closest('button[aria-label]')
      if (button?.getAttribute('aria-label') !== ungroupedNewLabel) return
      event.preventDefault()
      event.stopPropagation()
      startFreshChat()
      const header = button?.closest<HTMLElement>('[role="treeitem"]')
      if (header?.getAttribute('aria-expanded') === 'false') header.click()
    }
    const open = (id: string) => { start.reset(); localConversations.leave(); requirementHistory.leave(); developerHistory.leave(); clearSavedDraft(); props.open(id) }
    return <div ref={setHost} style={{ display: 'contents' }} onClickCapture={onClickCapture}>
      <Original {...props} t={translate} open={open} />
      <LocalConversationRows host={host} label={ungroupedNewLabel} rows={historyRows} activeId={developers.activeId ?? requirements.activeId ?? local.activeId} onLoadMore={requirements.hasMore || requirements.error ? () => { void requirementHistory.load(!requirements.error) } : undefined} loading={requirements.loading} error={requirements.error} onOpen={openLocalConversation} onRemove={removeLocalConversation}/>
      <NativeConversationRemoval sessions={sessions}/>
    </div>
  }), 'plain-chat: history label')
  ctx.effect(() => () => { start.reset(); listeners.clear() }, 'plain-chat: cleanup')
}
