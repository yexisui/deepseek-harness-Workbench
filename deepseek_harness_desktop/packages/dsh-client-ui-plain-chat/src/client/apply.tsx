import {createAssistantArchives,type ArchiveEntry} from './assistant-archive-client.ts'
import {adaptAssistantArchiveController} from './assistant-archive-adapter.ts'
import type {SessionPreviewView} from '../../../dsh-session-archive/src/core/types.ts'
import type {ConversationHistoryRow} from './LocalConversationRows.tsx'
import { FlowchartLayouts } from './FlowchartLayouts.tsx'
import { documentsClient } from '../../../../shared/client/documents-client.ts'
import { DocumentAssistant } from './DocumentAssistant.tsx'
import { fileSearchClient, fileSearchCommand } from '../../../../shared/client/file-search-client.ts'
import { FileSearchView } from './FileSearchView.tsx'
import { recordingClient, recordingCommand } from '../../../../shared/client/recording-client.ts'
import { RecordingView } from './RecordingView.tsx'
import { roleCapabilityModes, defaultCapabilityMode, type CapabilityMode } from './role-capability-modes.ts'
import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
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
import { UnifiedCenter, settingsSectionForLink } from './UnifiedCenter.tsx'
import { registerComponentInventory } from './component-inventory-slot.tsx'
import { TeamContributions } from './TeamContributions.tsx'
import { registerCapabilityCenter, registerTeamContributions } from './capability-settings.tsx'
import { nativePresetHook } from './native-preset-view.ts'
import { AgentPresetDisclosure } from './RoleAssistants.tsx'

import { BrowserTaskStatus, ManagedRolePicker, ManagedRolesSection, MEETING_DEMO_ROLE_ID } from './ManagedRoles.tsx'
import { DeveloperAssistant } from './DeveloperAssistant.tsx'
import { developerApi, createDeveloperHistory, usesDeveloper } from './developer-client.ts'
import { RequirementsAssistant } from './RequirementsAssistant.tsx'
import { getRequirementTask, commandRequirementTask, summarizeRequirementTask } from './requirements-client.ts'
import type { DeveloperTask } from '../../../dsh-capabilities/src/core/developer-model.ts'
import { createRequirementHistory } from './requirement-history.ts'
import { usesRequirements } from './requirements-routing.ts'
import { MeetingDemo } from './MeetingDemo.tsx'
import { roleForPreset } from './conversation-history.ts'
import { AssistantHistory } from './AssistantHistory.tsx'
import { createLocalConversations } from './local-conversations.ts'
import { removeMeetingConversation } from './meeting-removal.ts'
import { createMeetingHistory } from './meeting-history.ts'
import { BrowserObservation } from './BrowserObservation.tsx'
import { capabilityClient, type CapabilityLink } from './capability-client.ts'
import { latest } from '../../../dsh-capabilities/src/core/model.ts'
import { createRoleSelection, createSettingsNavigation } from './role-ui-state.ts'
import { en, zh, type ChatKey } from './locales.ts'
import { ru } from '../../../dsh-i18n/src/client/ru/plain-chat.ts'
import styles from './Chat.module.css'
import { AssistantToolbar } from './AssistantToolbar.tsx'

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
  // The sidebar owns responsive geometry; use its current state and native toggle.
  let collapseSidebar = () => {}
  const created = new Set<string>()
  let revision = 0
  const listeners = new Set<() => void>()
  const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } }
  const snapshot = () => revision
  const clearSavedDraft = () => { try { sessionStorage.removeItem('workbench-chat-draft') } catch { /* Optional storage. */ } }
  const roleSelection = createRoleSelection<string>()
  const localConversations = createLocalConversations()
  const documents=documentsClient()
  let activeDocument:string|null=null
  let historyInitialLoaded = false
  const documentsLoaded = documents.refresh()
  const searches=fileSearchClient()
  let activeSearch:string|null=sessionStorage.getItem('workbench-file-search-active')
  const leaveSearch=()=>{activeDocument=null;activeSearch=null;sessionStorage.removeItem('workbench-file-search-active')}
  const searchesLoaded = searches.refresh();void searches.refreshConfig()
  const recordings = recordingClient()
  let activeRecording: string | null = sessionStorage.getItem('workbench-recording-active')
  const leaveRecording = () => {activeRecording=null;sessionStorage.removeItem('workbench-recording-active')}
  const recordingsLoaded = recordings.refresh()
  void Promise.allSettled([documentsLoaded, searchesLoaded, recordingsLoaded]).then(() => { historyInitialLoaded = true; revision++; listeners.forEach(fn => fn()) })
  const assistantArchives=createAssistantArchives()
  ctx.effect(()=>assistantArchives.start(),'plain-chat: assistant archive synchronization')
  const commitLocalChat=(id:string)=>{
    localConversations.commitChat(id)
    const entry=assistantArchives.getSnapshot().entries[id]
    // A restored draft is consumed when its real conversation is created.
    // Do not hydrate its old archive snapshot again on the next application start.
    if(entry&&!entry.removed)void assistantArchives.change({id,archived:false,removed:true}).catch(documents.fail)
  }
  const meetingHistory = createMeetingHistory(localConversations)
  ctx.effect(() => { void meetingHistory.load(); const refresh = () => { void meetingHistory.load() }; window.addEventListener('focus', refresh); return () => window.removeEventListener('focus', refresh) }, 'plain-chat: meeting history')
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
      if (local?.kind === 'draft') commitLocalChat(local.id)
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
    collapseSidebar()
    if (id === roleSelection.getSnapshot()) return
    leaveSearch();leaveRecording()
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
  const startFreshChat = (role = 'chat', mode?: CapabilityMode) => {
    if (role !== 'chat') collapseSidebar()
    void documents.newDocument().catch(documents.fail)
    leaveSearch();leaveRecording()
    requirementViewKey = `requirements-new-${role}-${++requirementNavigation}`
    requirementHistory.leave()
    developerHistory.leave(); developerViewKey = `developer-new-${++developerNavigation}`
    start.reset()
    clearSavedDraft()
    localConversations.start(role, mode)
    if (roleSelection.getSnapshot() !== role) roleSelection.select(role)
    revision++
    listeners.forEach(fn => fn())
    sessions.clear()
    layout.selectPanel(null)
  }
  const openDocument=(id:string)=>{
    const row=documents.getSnapshot().rows.find(r=>r.id===id);if(!row)return
    if (row.roleId !== 'chat') collapseSidebar()
    leaveSearch();leaveRecording();activeDocument=id;start.reset();localConversations.leave();requirementHistory.leave();developerHistory.leave();roleSelection.select(row.roleId);clearSavedDraft();revision++;listeners.forEach(fn=>fn());sessions.clear();layout.selectPanel(null)
    void documents.open(id).catch(documents.fail)
  }
  ctx.effect(()=>{const open=(e:Event)=>openDocument((e as CustomEvent<string>).detail);window.addEventListener('workbench-document-open',open);return()=>window.removeEventListener('workbench-document-open',open)},'plain-chat: document navigation')
  const openSearch=(id:string)=>{
    activeDocument=null
    const state=searches.getSnapshot(),row=state.rows.find(r=>r.id===id),roleId=row?.roleId??(state.request?.id===id?state.request.roleId:state.config?.roleId)
    if (roleId && roleId !== 'chat') collapseSidebar()
    if(row)searches.draft({query:row.query,path:row.path})
    leaveRecording();activeSearch=id;sessionStorage.setItem('workbench-file-search-active',id);start.reset();localConversations.leave();requirementHistory.leave();developerHistory.leave();if(roleId)roleSelection.select(roleId);clearSavedDraft();revision++;listeners.forEach(fn=>fn());sessions.clear();layout.selectPanel(null)
  }
  const openLocalConversation = (id: string) => {
    if(documents.getSnapshot().rows.some(r=>r.id===id)){openDocument(id);return}
    if(searches.getSnapshot().rows.some(r=>r.id===id)){openSearch(id);return}
    leaveSearch()
    const recording=recordings.getSnapshot().rows.find(row=>row.id===id)
    if(recording){if(recording.roleId !== 'chat')collapseSidebar();activeRecording=id;sessionStorage.setItem('workbench-recording-active',id);start.reset();localConversations.leave();requirementHistory.leave();developerHistory.leave();roleSelection.select(recording.roleId);clearSavedDraft();revision++;listeners.forEach(fn=>fn());sessions.clear();layout.selectPanel(null);return}
    leaveSearch();leaveRecording()
    const developer = developerHistory.getSnapshot().items.find(item => item.id === id)
    if (developer) {
      if (developer.roleId !== 'chat') collapseSidebar()
      developerViewKey = `developer-${id}-${++developerNavigation}`
      start.reset(); localConversations.leave(); requirementHistory.leave(); developerHistory.open(id); roleSelection.select(developer.roleId); clearSavedDraft()
      revision++; listeners.forEach(fn => fn()); sessions.clear(); layout.selectPanel(null); return
    }
    developerHistory.leave(); developerViewKey = `developer-local-${id}-${++developerNavigation}`
    const requirement = requirementHistory.getSnapshot().items.find(item => item.id === id)
    if (requirement) {
      if (requirement.roleId !== 'chat') collapseSidebar()
      requirementViewKey = `requirements-${id}-${++requirementNavigation}`
      start.reset(); localConversations.leave(); requirementHistory.open(id); roleSelection.select(requirement.roleId); clearSavedDraft()
      revision++; listeners.forEach(fn => fn()); sessions.clear(); layout.selectPanel(null); return
    }
    requirementHistory.leave()
    const row = localConversations.getSnapshot().items.find(item => item.id === id)
    if (!row) return
    if (row.role !== 'chat') collapseSidebar()
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
  // Switch the visible assistant without rebinding or stopping the previous session.
  const switchAssistant = (id: string) => {
    const draft = localConversations.getSnapshot().items.find(row => row.role === id && row.kind === 'draft' && !assistantArchives.hidden(row.id,row))
    localConversations.leave()
    leaveSearch(); leaveRecording()
    openLocalConversation((draft ?? localConversations.start(id)).id)
  }
  const archiveRows=():ConversationHistoryRow[]=>{
    const rows:ConversationHistoryRow[]=[...documents.getSnapshot().rows.map(row=>({id:row.id,role:row.roleId,kind:'demo' as const,title:row.title,draft:'',createdAt:Date.parse(row.createdAt),updatedAt:Date.parse(row.updatedAt),documentId:row.id,running:row.messages.some(m=>m.status==='running')})),...searches.getSnapshot().rows.map(row=>({id:row.id,role:row.roleId,kind:'demo' as const,title:row.title,draft:'',createdAt:Date.parse(row.createdAt),updatedAt:Date.parse(row.updatedAt),searchId:row.id})),...recordings.getSnapshot().rows.map(row=>({id:row.id,role:row.roleId,kind:'demo' as const,title:row.title,draft:'',roleName:row.roleName,createdAt:Date.parse(row.createdAt),updatedAt:Date.parse(row.updatedAt),recordingId:row.id,running:['recording','paused'].includes(row.status)})),...localConversations.getSnapshot().items.map(row=>({...row,localSnapshot:row})), ...developerHistory.getSnapshot().items.map(item => ({ id: item.id, role: item.roleId, kind: 'developer' as const, title: item.title, workspace: item.cwd?.split(/[\\/]/).pop(), running: item.running, draft: '', updatedAt: Date.parse(item.updatedAt) })),  ...requirementHistory.getSnapshot().items.map(item => ({ id: item.id, role: item.roleId, kind: 'requirements' as const, title: item.title, draft: '', running:item.running, updatedAt: Date.parse(item.updatedAt) }))].sort((a, b) => b.updatedAt - a.updatedAt)
    const entries=assistantArchives.getSnapshot().entries
    for(const entry of Object.values(entries))if(entry.localSnapshot&&!entry.removed&&!rows.some(row=>row.id===entry.id))rows.push({...entry.localSnapshot,localSnapshot:entry.localSnapshot})
    return rows.filter(row=>!assistantArchives.entryFor(row.id,row.localSnapshot)?.removed)
  }
  const archiveConversation=async(row:ConversationHistoryRow)=>{
    if(activeDocument===row.id)await documents.flush()
    const local=localConversations.getSnapshot().items.find(item=>item.id===row.id)??row.localSnapshot
    await assistantArchives.change({id:row.id,title:row.title,role:row.role,archived:true,...(local?{localSnapshot:local}:{})})
    if(local)localConversations.restoreArchived(local)
    const active=activeDocument??activeSearch??activeRecording??developerHistory.getSnapshot().activeId??requirementHistory.getSnapshot().activeId??localConversations.getSnapshot().activeId
    if(active===row.id)startFreshChat(row.role)
  }
  const restoreConversation=async(entry:ArchiveEntry)=>{
    if(entry.localSnapshot)localConversations.restoreArchived(entry.localSnapshot)
    await assistantArchives.change({id:entry.id,archived:false})
  }
  ctx.effect(()=>{
    let previous=assistantArchives.getSnapshot().entries,closing=false
    return assistantArchives.subscribe(()=>{
      const entries=assistantArchives.getSnapshot().entries
      for(const entry of Object.values(entries))if(!entry.removed&&(!previous[entry.id]||previous[entry.id]?.archived!==entry.archived)&&entry.localSnapshot)localConversations.restoreArchived(entry.localSnapshot)
      for(const row of localConversations.getSnapshot().items)if(assistantArchives.entryFor(row.id,row)?.removed)localConversations.remove(row.id)
      previous=entries
      const current=()=>activeDocument??activeSearch??activeRecording??developerHistory.getSnapshot().activeId??requirementHistory.getSnapshot().activeId??localConversations.getSnapshot().activeId
      const id=current(),entry=id?entries[id]:undefined
      if(!entry?.archived||closing)return
      closing=true
      void (async()=>{try{
        if(activeDocument===id)await documents.flush()
        if(current()!==id)return
        if(entry.localSnapshot)localConversations.restoreArchived(entry.localSnapshot)
        startFreshChat(entry.role)
      }catch(error){documents.fail(error)}finally{closing=false}})()
    })
  },'plain-chat: archived conversation navigation')
  const pendingForks=new Map<string,Promise<void>>()
  const forkRequests=new Map<string,string>()
  const forkLocalConversation=(id:string):Promise<void>=>{
    const pending=pendingForks.get(id);if(pending)return pending
    const work=(async()=>{
      const local=localConversations.getSnapshot().items.find(r=>r.id===id)
      const kind=documents.getSnapshot().rows.some(r=>r.id===id)?'documents':searches.getSnapshot().rows.some(r=>r.id===id)?'file-search':recordings.getSnapshot().rows.some(r=>r.id===id)?'recording':requirementHistory.getSnapshot().items.some(r=>r.id===id)?'requirements':developerHistory.getSnapshot().items.some(r=>r.id===id)?'developer':local?.codeTaskId?'code':(local?.meeting as {jobId?:string})?.jobId?'meeting':'local'
      const target=forkRequests.get(id)??crypto.randomUUID();forkRequests.set(id,target)
      if(kind==='local'){if(!local)throw Error('对话不存在');localConversations.addFork(local,target);openLocalConversation(target)}
      else{
        const source=kind==='code'?local!.codeTaskId:kind==='meeting'?(local!.meeting as {jobId:string}).jobId:id
        const response=await fetch('/api/capabilities/conversations/fork',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind,id:source,requestId:target})})
        const result=await response.json();if(!response.ok)throw Error(result.error||'分叉失败，请重试')
        if(kind==='code'||kind==='meeting'){
          const patch=kind==='code'?{codeTaskId:result.id}:{meeting:{...(structuredClone(local!.meeting) as object),jobId:result.id,phase:'ready'}}
          localConversations.addFork(local!,kind==='meeting'?'meeting-'+result.id:target,patch);openLocalConversation(kind==='meeting'?'meeting-'+result.id:target)
        }else{
          if(kind==='recording'){const raw=localStorage.getItem('recording-followup:'+id);if(raw){const saved=JSON.parse(raw);if(saved.state){saved.state.jobId=target;saved.state.phase='ready'}localStorage.setItem('recording-followup:'+target,JSON.stringify(saved))}await recordings.refresh()}
          else if(kind==='documents')await documents.refresh()
          else if(kind==='file-search')await searches.refresh()
          else if(kind==='requirements')requirementHistory.upsert(summarizeRequirementTask(result))
          else if(kind==='developer')developerHistory.upsert(result,false)
          openLocalConversation(result.id)
        }
      }
      forkRequests.delete(id)
    })();pendingForks.set(id,work);void work.finally(()=>pendingForks.delete(id)).catch(()=>{});return work
  }
  const renameLocalConversation = async (id: string, title: string) => {
    if(documents.getSnapshot().rows.some(r=>r.id===id)){await documents.command(id,'rename',title);return}
    if(searches.getSnapshot().rows.some(r=>r.id===id)){await searches.command(id,'rename',{title});return}
    if(recordings.getSnapshot().rows.some(r=>r.id===id)){await recordings.command(id,'rename',{title});return}
    if (requirementHistory.getSnapshot().items.some(row => row.id === id)) {
      const current = await getRequirementTask(id)
      const task = await commandRequirementTask(id, current.revision, { type: 'save', title })
      requirementHistory.upsert(summarizeRequirementTask(task))
      window.dispatchEvent(new CustomEvent('workbench-requirement-updated', { detail: task }))
      return
    }
    if (developerHistory.getSnapshot().items.some(row => row.id === id)) {
      const current = await developerApi<DeveloperTask>('task', { id })
      const task = await developerApi<DeveloperTask>('settings', {}, { id, revision: current.revision, settings: { title } })
      developerHistory.upsert(task, false)
      window.dispatchEvent(new CustomEvent('workbench-developer-updated', { detail: task }))
      return
    }
    const row = localConversations.getSnapshot().items.find(row => row.id === id)
    if (!row) throw new Error('此会话已不存在')
    const jobId = (row.meeting as { jobId?: string } | undefined)?.jobId
    if (jobId) {
      const response = await fetch('/api/capabilities/meeting/rename', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: jobId, title }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || '重命名失败，请重试')
    }
    localConversations.rename(id, title)
  }
  const removeLocalConversation = async (id:string, confirmed=false) => {
    if(!confirmed&&!window.confirm('移除此对话及其保存内容？此操作无法撤销。'))return
    if(documents.getSnapshot().rows.some(r=>r.id===id))await documents.command(id,'remove')
    else if(searches.getSnapshot().rows.some(r=>r.id===id))await searches.command(id,'delete')
    else if(recordings.getSnapshot().rows.some(r=>r.id===id))await recordings.command(id,'delete')
    else if(developerHistory.getSnapshot().items.some(r=>r.id===id))await developerHistory.remove(id)
    else if(requirementHistory.getSnapshot().items.some(r=>r.id===id))await requirementHistory.remove(id)
    else {
      const row=localConversations.getSnapshot().items.find(r=>r.id===id)??assistantArchives.getSnapshot().entries[id]?.localSnapshot
      if(!row)throw Error('未能读取此对话，请刷新后重试')
      const jobId=(row.meeting as {jobId?:string})?.jobId
      if(row.codeTaskId){const response=await fetch('/api/capabilities/code-assistant/task?id='+encodeURIComponent(row.codeTaskId),{method:'DELETE',credentials:'same-origin'});if(!response.ok){const body=await response.json();throw Error(body.error||'代码对话删除失败')}}
      if(jobId)await removeMeetingConversation(jobId,row.title,()=>meetingHistory.forget(jobId),()=>true)
      localConversations.remove(id)
    }
  }
  const previewArchivedConversation=async(id:string):Promise<SessionPreviewView>=>{
    const row=archiveRows().find(r=>r.id===id)
    if(!row)throw Error('未能读取此对话，请刷新后重试')
    let data:any=documents.getSnapshot().rows.find(r=>r.id===id)??searches.getSnapshot().rows.find(r=>r.id===id)??recordings.getSnapshot().rows.find(r=>r.id===id)??row.meeting
    const jobId=(row.meeting as {jobId?:string})?.jobId
    if(row.kind==='requirements')data=await getRequirementTask(id)
    else if(row.kind==='developer')data=await developerApi('task',{id})
    else if(jobId||row.codeTaskId){
      const response=await fetch(jobId?'/api/capabilities/meeting/job/'+encodeURIComponent(jobId):'/api/capabilities/code-assistant/task?id='+encodeURIComponent(row.codeTaskId!),{credentials:'same-origin'})
      data=await response.json();if(!response.ok)throw Error(data.error||'对话预览读取失败')
    }
    const excerpt:{role:string;text:string}[]=[]
    const append=(role:string,value:unknown)=>{if(typeof value==='string'&&value.trim())excerpt.push({role,text:value.slice(0,4000)})}
    for(const message of data?.messages??[])append(message.role??message.info?.role??'assistant',message.text??message.parts?.filter((part:any)=>part.type==='text').map((part:any)=>part.text).join('\n'))
    for(const note of data?.notes??[])append('user',note.text)
    for(const segment of data?.segments??[])append('user',segment.text)
    if(data?.minutes)append('assistant',JSON.stringify(data.minutes,null,2))
    if(data?.query){append('user',data.query);append('assistant',data.items?.map((item:any)=>item.path).join('\n'))}
    if(row.draft)append('user',row.draft)
    return {id,title:row.title,createdAt:row.createdAt,messageCount:excerpt.length,excerpt:excerpt.slice(0,20)}
  }
  ctx.effect(() => {
    const unsubscribe = sessions.list.subscribe(() => {
      if (sessions.list.getSnapshot().current !== undefined) { leaveSearch();leaveRecording(); if (localConversations.active()) localConversations.leave(); if (requirementHistory.getSnapshot().activeId) requirementHistory.leave(); if (developerHistory.getSnapshot().activeId) developerHistory.leave() }
    })
    return unsubscribe
  }, 'plain-chat: local draft lifecycle')
  ctx.effect(()=>{
    const open=(e:Event)=>openLocalConversation((e as CustomEvent<string>).detail)
    const removed=(e:Event)=>{if(activeRecording===(e as CustomEvent<string>).detail)startFreshChat()}
    const refresh=()=>void recordings.refresh()
    window.addEventListener('workbench-recording-open',open);window.addEventListener('workbench-recording-removed',removed);window.addEventListener('focus',refresh)
    return()=>{window.removeEventListener('workbench-recording-open',open);window.removeEventListener('workbench-recording-removed',removed);window.removeEventListener('focus',refresh)}
  },'plain-chat: recording navigation')
  ctx.effect(()=>{
    const open=(e:Event)=>openSearch((e as CustomEvent<string>).detail)
    const refresh=()=>{void searches.refresh();void searches.refreshConfig()}
    window.addEventListener('workbench-file-search-open',open);window.addEventListener('focus',refresh)
    return()=>{window.removeEventListener('workbench-file-search-open',open);window.removeEventListener('focus',refresh)}
  },'plain-chat: file search navigation')
  const registry = ctx.slots as unknown as Registry
  ctx.effect(()=>decorateSlot(registry,'settings.section','SessionArchiveCard',Original=>function AssistantArchivesSettings(props:any){
    const controller=useMemo(()=>adaptAssistantArchiveController(props.controller,{
      archives:assistantArchives,rows:archiveRows,
      current:()=>activeDocument??activeSearch??activeRecording??developerHistory.getSnapshot().activeId??requirementHistory.getSnapshot().activeId??localConversations.getSnapshot().activeId??undefined,
      archive:archiveConversation,restore:restoreConversation,remove:id=>removeLocalConversation(id,true),preview:previewArchivedConversation,
    },async()=>{await sessions.refresh()}),[props.controller])
    return <Original {...props} controller={controller}/>
  }), 'plain-chat: existing archive list data adapter')
  ctx.effect(()=>decorateSlot(registry,'conversation.chat.node','AssistantNodeView',Original=>function FlowchartMessage(props:any){return <FlowchartLayouts><Original {...props}/></FlowchartLayouts>}), 'plain-chat: flowchart layout controls')
  ctx.effect(() => registerComponentInventory(registry), 'plain-chat: shared component inventory compatibility')
  ctx.effect(()=>decorateSlot(registry,'conversation.composer.bar','InputBar',Original=>function RecordingCommands(props:any){
    const keyboard=useMemo(()=>props.keyboard?new Proxy(props.keyboard,{get(target,key){if(key==='submit')return(mode:unknown)=>{const binding=props.sessionId?sessions.binding(props.sessionId):undefined;const input=binding?ctx.conversation.input.for(binding.ctx):undefined;if(input&&(fileSearchCommand(input.state.getSnapshot().draft)||recordingCommand(input.state.getSnapshot().draft))){input.setDraft('');return}target.submit(mode)};const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value}}):undefined,[props.keyboard,props.sessionId])
    return <Original {...props} keyboard={keyboard}/>
  }),'plain-chat: native recording commands')
  const capabilityPreview = createCapabilityPreview()
  registerCapabilityCenter(ctx.slots as unknown as Parameters<typeof registerCapabilityCenter>[0], () => t('centerTitle'), () => <UnifiedCenter />)
  registerTeamContributions(ctx.slots as unknown as Parameters<typeof registerTeamContributions>[0],TeamContributions)
  const settingsNavigation = createSettingsNavigation()
  ctx.effect(() => {
    const open = (event: Event) => settingsNavigation.openSection(settingsSectionForLink((event as CustomEvent<CapabilityLink>).detail))
    window.addEventListener('workbench-capability-link', open)
    return () => window.removeEventListener('workbench-capability-link', open)
  }, 'plain-chat: capability links')
  ctx.effect(() => decorateSlot(registry, 'sidebar.settings', 'SettingsRoot', Original =>
    withAppearanceNavigation(Original as (props: any) => React.ReactNode, () => t('appearanceTitle'), settingsNavigation)), 'plain-chat: appearance navigation group')

  // Keep the official roster and its injected actions; this addition is UI-only.
  ctx.effect(() => decorateSlot(registry, 'settings.section', 'AgentPresetSection', Original => function RolePresetSection(props: any) {
    const selected = useSyncExternalStore(roleSelection.subscribe, roleSelection.getSnapshot)
    const useNativePresets = useMemo(() => props.useAgentPresetSection ? nativePresetHook(props.useAgentPresetSection) : undefined, [props.useAgentPresetSection])
    return <><ManagedRolesSection selected={selected} onSelect={selectRole} /><AgentPresetDisclosure t={t}><Original {...props} useAgentPresetSection={useNativePresets} /></AgentPresetDisclosure></>
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
      const recordingSnapshot=useSyncExternalStore(recordings.subscribe,recordings.getSnapshot)
      const recording=recordingSnapshot.rows.find(r=>r.id===activeRecording)
      const searchSnapshot=useSyncExternalStore(searches.subscribe,searches.getSnapshot)
      const search=searchSnapshot.rows.find(r=>r.id===activeSearch)
      const documentSnapshot=useSyncExternalStore(documents.subscribe,documents.getSnapshot)
      const documentRow=documentSnapshot.rows.find(r=>r.id===activeDocument)
      const effectiveRole = documentRow?.roleId ?? search?.roleId ?? recording?.roleId ?? developer?.roleId ?? requirement?.roleId ?? local?.role ?? selectedRole
      const capabilities = useSyncExternalStore(capabilityClient.subscribe, capabilityClient.getSnapshot)
      const analysisRole = capabilities.data?.state.roles.find(role => role.id === effectiveRole)
      const analysisVersion = requirement ? analysisRole?.versions.find(version => version.version === requirement.roleVersion) : analysisRole && latest(analysisRole.versions)
      const developerVersion = developer ? analysisRole?.versions.find(v => v.version === developer.roleVersion) : analysisRole && latest(analysisRole.versions)

      const analysisViewKey = requirementViewKey

      const meetingRole = capabilities.data?.state.roles.find(role => role.id === effectiveRole)
      const savedMeetingVersion = local?.meeting && typeof local.meeting === 'object' ? (local.meeting as { roleVersion?: unknown }).roleVersion : undefined
      const meetingVersion = meetingRole?.versions.find(version => version.version === savedMeetingVersion) ?? (meetingRole && latest(meetingRole.versions))
      const summary = props.useSessions((s: any) => props.sessionId ? s.byId[props.sessionId] : undefined)
      const composerBlock = props.useComposerBlock((block: unknown) => block)
      const actualPreset = summary?.projectionValues?.agentPreset
      const plain = actualPreset === PRESET_ID || String(actualPreset ?? '').startsWith('workbench-role-') || created.has(props.sessionId)
      const noSession = props.sessionId === undefined
      const sessionRole = actualPreset === PRESET_ID ? 'chat' : capabilities.data?.state.roles.find(role => role.versions.some(version => version.preset === actualPreset))?.id
      const displayedRole = noSession ? effectiveRole : sessionRole ?? (actualPreset ? 'chat' : selectedRole)
      const originRole = capabilities.data?.state.roles.find(role => role.id === displayedRole)
      const originVersion = noSession ? (developer ? developerVersion : requirement ? analysisVersion : local?.kind === 'demo' ? meetingVersion : originRole && latest(originRole.versions)) : originRole?.versions.find(v => v.preset === actualPreset)
      const modes = roleCapabilityModes(capabilities.data?.state, originVersion)
      const workMode: CapabilityMode = activeDocument ? 'document' : activeSearch ? 'file-search' : developer ? 'developer' : requirement ? 'requirements' : local?.kind === 'demo' ? 'meeting' : local?.workMode && modes.some(m => m.mode === local.workMode) ? local.workMode : defaultCapabilityMode(modes)
      const showDeveloper = workMode === 'developer', showRequirements = workMode === 'requirements'
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
        if (binding && local?.kind === 'draft') commitLocalChat(local.id)
      }
      return <div className={styles.conversationShell}>
        <AssistantToolbar scopeKey={displayedRole} modes={displayedRole === 'chat' ? [] : modes} activeMode={noSession ? workMode : 'chat'} onModeChange={mode => { if (noSession && workMode === mode) return; startFreshChat(displayedRole, mode) }}>
          <ManagedRolePicker t={t} selected={displayedRole} onSelect={id => { collapseSidebar(); if (id !== displayedRole) switchAssistant(id) }} current={{ preset: noSession && search ? originRole?.versions.find(v=>v.version===search.roleVersion)?.preset : noSession && recording ? originRole?.versions.find(v=>v.version===recording.roleVersion)?.preset : noSession && showDeveloper ? developerVersion?.preset : noSession && showRequirements ? analysisVersion?.preset : noSession && workMode === 'meeting' ? meetingVersion?.preset : noSession ? undefined : actualPreset }} onManage={settingsNavigation.openPresets} />
        </AssistantToolbar>
        {!recording && recordingSnapshot.error && <p role="alert" style={{margin:"4px 24px",fontSize:13}}>{recordingSnapshot.error}</p>}
        <BrowserTaskStatus sessionId={props.sessionId}/>
        {String(actualPreset ?? '').startsWith('workbench-role-') && <BrowserObservation sessionId={props.sessionId}/>}
        <div className={styles.conversationContent}>{noSession && workMode==='document' ? <DocumentAssistant roleId={effectiveRole} loadModels={loadMeetingModels}/> : noSession && (activeSearch || !recording && workMode==='file-search') ? <FileSearchView key={activeSearch??effectiveRole} id={activeSearch??'new'} roleId={effectiveRole==='chat'?undefined:effectiveRole}/> : noSession && recording ? <RecordingView key={recording.id} id={recording.id} loadModels={loadMeetingModels}/> : noSession && developerSnapshot.activeId && !developer ? <p role="status">{developerSnapshot.error || '正在恢复开发任务…'}<button onClick={() => { void developerHistory.load() }}>重新读取</button><button onClick={() => startFreshChat()}>返回新对话</button></p> : noSession && showDeveloper
          ? <DeveloperAssistant initialTaskId={local?.codeTaskId} onTaskChange={task => { const row = localConversations.active(); if (row && row.role === effectiveRole && developerKey === developerViewKey) localConversations.setCodeTask(row.id, task) }} initialTitle={local?.customTitle ? local.title : undefined} key={developerKey} taskId={developer?.id} draftKey={local?.id ?? developerKey} initialDraft={local?.kind === 'draft' ? local.draft : undefined} roleId={effectiveRole} roleVersion={developerVersion?.version} loadModels={loadMeetingModels} onDraftChange={value => {
            if (developerKey !== developerViewKey || sessions.list.getSnapshot().current !== undefined || developerHistory.getSnapshot().activeId) return
            const row = localConversations.active()
            if (row?.kind === 'draft' && row.role === effectiveRole && row.draft !== value) localConversations.setDraft(row.id, value)
          }} onCommit={task => {
            const current = developerKey === developerViewKey && sessions.list.getSnapshot().current === undefined && roleSelection.getSnapshot() === effectiveRole
            const origin = local && localConversations.getSnapshot().items.find(row => row.id === local.id)
            if (current && origin?.kind === 'draft') commitLocalChat(origin.id)
            developerHistory.upsert(task, current)
          }}/>
          : noSession && requirementSnapshot.activeId && !requirement ? <p role="status">{requirementSnapshot.error || '正在恢复需求分析…'}<button onClick={() => { void requirementHistory.load() }}>重新读取</button><button onClick={() => startFreshChat()}>返回新对话</button></p> : noSession && showRequirements
          ? <RequirementsAssistant initialTitle={local?.customTitle ? local.title : undefined} key={analysisViewKey} taskId={requirement?.id} draftKey={local?.id ?? analysisViewKey} initialDraft={local?.kind === 'draft' ? local.draft : undefined} roleId={effectiveRole} roleVersion={analysisVersion?.version} assistant={analysisVersion} loadModels={loadMeetingModels} onDraftChange={value => {
            if (analysisViewKey !== requirementViewKey || sessions.list.getSnapshot().current !== undefined || requirementHistory.getSnapshot().activeId) return
            const row = localConversations.active()
            if (row?.kind === 'draft' && row.role === effectiveRole && row.draft !== value) localConversations.setDraft(row.id, value)
          }} onCommit={task => {
            const activeId = requirementHistory.getSnapshot().activeId
            const current = analysisViewKey === requirementViewKey && sessions.list.getSnapshot().current === undefined && (requirement ? activeId === requirement.id : revision === draftKey && roleSelection.getSnapshot() === effectiveRole && (!activeId || activeId === task.id))
            const origin = localSnapshot.items.find(row => row.id === local?.id)
            const retained = origin && localConversations.getSnapshot().items.find(row => row.id === origin.id)
            if (retained?.kind === 'draft' && retained.role === effectiveRole && (current || retained.draft === origin?.draft)) commitLocalChat(retained.id)
            requirementHistory.upsert(task, current)
          }}/>
          : noSession && workMode === 'meeting'
          ? <MeetingDemo conversationTitle={local?.customTitle ? local.title : undefined} key={draftKey} initialState={local?.meeting} assistant={meetingVersion} roleId={effectiveRole} roleVersion={meetingVersion?.version} loadModels={loadMeetingModels} onSnapshot={state => {
            const row = localConversations.active() ?? localConversations.start(effectiveRole, 'meeting')
            localConversations.setMeeting(row.id, state, state.draft)
          }} onCommit={title => {
            const row = localConversations.active() ?? localConversations.start(effectiveRole, 'meeting')
            localConversations.commitDemo(row.id, title)
          }} onReset={() => startFreshChat(effectiveRole, 'meeting')}/>
          : <Original {...props} t={translate} renderSlot={renderSlot} selectWorkspace={selectWorkspace} />}</div>
      </div>
    }
  }), 'plain-chat: conversation adapter')

  ctx.effect(() => decorateSlot(registry, 'sidebar', 'SidebarRoot', Original => function ChatSidebar(props: any) {
    useEffect(() => {
      let expanded = !props.collapsed
      const collapse = () => {
        if (!expanded) return
        expanded = false
        props.toggleSidebar()
      }
      collapseSidebar = collapse
      return () => { if (collapseSidebar === collapse) collapseSidebar = () => {} }
    }, [props.collapsed, props.toggleSidebar])
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
    const meetings = useSyncExternalStore(meetingHistory.subscribe, meetingHistory.getSnapshot)
    const recorded=useSyncExternalStore(recordings.subscribe,recordings.getSnapshot)
    const searched=useSyncExternalStore(searches.subscribe,searches.getSnapshot)
    const documentRows=useSyncExternalStore(documents.subscribe,documents.getSnapshot)
    useSyncExternalStore(subscribe, snapshot)
    useEffect(() => { if (meetings.hasMore && !meetings.loading && !meetings.error) void meetingHistory.load(true) }, [meetings])
    useEffect(() => { if (requirements.hasMore && !requirements.loading && !requirements.error) void requirementHistory.load(true) }, [requirements])
    const historyRows = archiveRows()
    const nativeSessions = props.useSessions((state: any) => state.byId)
    const open = (id: string) => {
      if (roleForPreset(nativeSessions[id]?.projectionValues?.agentPreset, capabilityClient.getSnapshot().data?.state.roles ?? []) !== 'chat') collapseSidebar()
      leaveSearch();leaveRecording(); start.reset(); localConversations.leave(); requirementHistory.leave(); developerHistory.leave(); clearSavedDraft(); props.open(id) }
    const historyReady = historyInitialLoaded && !developers.loading && !meetings.loading && !meetings.hasMore && !meetings.error && !requirements.loading && !requirements.hasMore && !requirements.error && !developers.error && !recorded.error && !searched.error && !documentRows.error
    return <>
      <AssistantHistory archives={assistantArchives} onArchive={archiveConversation} Original={Original} browser={{ ...props, open }} rows={historyRows} activeId={activeDocument ?? activeSearch ?? activeRecording ?? developers.activeId ?? requirements.activeId ?? local.activeId} onOpen={openLocalConversation} onRemove={removeLocalConversation} onFork={forkLocalConversation} onRename={renameLocalConversation} onNew={startFreshChat} ready={historyReady} historyStatus={<>
        {(meetings.loading || requirements.loading || meetings.hasMore || requirements.hasMore) && <p role="status">正在读取历史对话…</p>}
        {meetings.error && <p role="alert">{meetings.error}<button onClick={() => { void meetingHistory.load(meetings.hasMore) }}>重试会议记录</button></p>}
        {requirements.error && <p role="alert">{requirements.error}<button onClick={() => { void requirementHistory.load(requirements.hasMore) }}>重试需求记录</button></p>}
        {meetings.unreadableCount > 0 && <p role="status">{meetings.unreadableCount} 条会议记录暂不可读，原文件已保留。</p>}
        {developers.error && <p role="alert">{developers.error}<button onClick={() => { void developerHistory.load() }}>重试开发记录</button></p>}
        {recorded.error && <p role="status">{recorded.error}</p>}{searched.error && <p role="status">{searched.error}</p>}{documentRows.error && <p role="status">{documentRows.error}</p>}
      </>}/>

    </>
  }), 'plain-chat: history label')
  ctx.effect(() => () => { start.reset(); listeners.clear() }, 'plain-chat: cleanup')
}


