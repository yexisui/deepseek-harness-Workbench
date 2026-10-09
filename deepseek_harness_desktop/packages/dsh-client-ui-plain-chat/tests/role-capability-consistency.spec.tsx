// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CapabilityPackages } from '../../dsh-capabilities/src/host/packages.ts'
import { readFile } from 'node:fs/promises'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CapabilityStore } from '../../dsh-capabilities/src/host/store.ts'
import { components, emptyRole, latest, type Command, type Snapshot, type Task } from '../../dsh-capabilities/src/core/model.ts'
import { ManagedCenter } from '../src/client/ManagedCenter.tsx'
import { ManagedRoleEditor, ManagedRolesSection } from '../src/client/ManagedRoles.tsx'
import { capabilityClient, editorDrafts } from '../src/client/capability-client.ts'

describe('managed capability card actions', () => {
  let container: HTMLDivElement, root: Root, store: CapabilityStore, secondId: string
  let tasks: Task[], commands: Command[], nextCommandError: string | undefined
  let pendingCommand: Promise<string> | undefined
  const send = (command: Command) => store.command(store.snapshot().revision, command)
  const snapshot = (): Snapshot => ({ state: store.snapshot(), components, tasks, health: { checkedAt: null, installed: true, loaded: true, state: 'ready', message: '浏览器已连接', browsers: [] } })

  beforeEach(async () => {
    ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
    store = new CapabilityStore(await mkdtemp(join(tmpdir(), 'dsh-capability-cards-')))
    await store.init()
    const definition = { ...store.snapshot().capabilities[0]!.draft, name: '自定义采集' }
    secondId = (await send({ type: 'capability.save', definition, publish: true })).id
    tasks = []; commands = []; nextCommandError = undefined; pendingCommand = undefined
    editorDrafts.clear(); sessionStorage.clear()
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
    HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
    vi.stubGlobal('fetch', vi.fn(async (url: string, options?: RequestInit) => {
      if (url.endsWith('/dsh-skill-explorer/manage/list')) return { ok: true, json: async () => ({ skills: [{ id:'e5163661-906f-4075-976d-159db1281ad4', name:'requirement-review', hash:'a'.repeat(64), description:'需求检查', scope:'global', enabled:true }] }) }
      if (url.endsWith('/meeting/config')) return { ok: true, json: async () => ({ ready: false, state: 'unconfigured', message: '请配置语音识别接口', provider: '自定义语音识别接口' }) }
      if (url.endsWith('/state')) return { ok: true, json: async () => snapshot() }
      if (url.endsWith('/command')) {
        const { revision, command } = JSON.parse(String(options?.body))
        commands.push(command)
        if (nextCommandError) { const error = nextCommandError; nextCommandError = undefined; return { ok: false, json: async () => ({ error }) } }
        try { const result = await store.command(revision, command); return { ok: true, json: async () => ({ id: result.id }) } }
        catch (error) { return { ok: false, json: async () => ({ error: (error as Error).message }) } }
      }
      throw new Error(`Unexpected capability endpoint: ${url}`)
    }))
    const command = capabilityClient.command
    vi.spyOn(capabilityClient, 'command').mockImplementation((...args) => { pendingCommand = command(...args); return pendingCommand })
    await capabilityClient.refresh()
    container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  })
  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove(); await store.close(); await rm(store.directory,{recursive:true,force:true}); editorDrafts.clear(); sessionStorage.clear()
    vi.restoreAllMocks(); vi.unstubAllGlobals()
  })

  const buttons = (scope: ParentNode = document) => Array.from(scope.querySelectorAll<HTMLButtonElement>('button'))
  const button = (label: string, scope: ParentNode = document) => buttons(scope).find(node => node.getAttribute('aria-label') === label || node.textContent?.trim() === label)
  const settleCommand = async () => { await pendingCommand?.catch(() => {}) }
  const click = async (label: string, scope: ParentNode = document) => act(async () => {
    const target = button(label, scope); expect(target, label).toBeTruthy()
    pendingCommand = undefined; target!.click(); await settleCommand()
  })
  const render = async () => act(async () => root.render(<ManagedCenter/>))
  const cardIds = () => Array.from(container.querySelectorAll('[data-managed-capability]')).map(card => card.getAttribute('data-managed-capability'))
  const checkbox = (label: string) => Array.from(container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')).find(node => node.getAttribute('aria-label') === label)!
  const select = async (label: string) => act(async () => { expect(checkbox(label), label).toBeTruthy(); checkbox(label).click() })
  const search = async (value: string) => act(async () => {
    const input = container.querySelector<HTMLInputElement>('input[aria-label="搜索能力"]')!
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  async function openRecycleBin(ids = ['browser', secondId]) {
    for (const id of ids) await send({ type: 'capability.remove', id })
    await capabilityClient.refresh(); await render();  await click(`回收站 ${ids.length}`)
  }
  async function makeRole(name: string) {
    return send({ type: 'role.save', definition: { ...emptyRole(), name, capabilities: [{ capabilityId: 'browser', version: 1, enabled: true }] }, publish: true })
  }


  it('shows the same complete catalog in the center and every role, including unpublished records', async () => {
    await send({type:'capability.save',definition:{...store.snapshot().capabilities[0]!.draft,name:'尚未发布能力'},publish:false})
    await capabilityClient.refresh(); await render()
    const names=Array.from(container.querySelectorAll('[data-managed-capability]')).map(card=>card.querySelector('strong')?.textContent ?? card.textContent)
    const expected=store.snapshot().capabilities.filter(c=>!c.removedAt).map(c=>latest(c.versions)?.name??c.draft.name)
    expect(names.length).toBe(expected.length)
    for(const id of ['builtin-manager','meeting-minutes-demo']) {
      await act(async()=>root.render(<ManagedRoleEditor key={id} id={id} onClose={()=>{}}/>))
      const library=document.querySelector('section[aria-label="能力配件库"]')!
      for(const name of expected)expect(button('添加 '+name,library),name).toBeTruthy()
      expect(library.querySelectorAll('[data-capability-add]').length).toBe(expected.length+1)
      expect(button('添加 尚未发布能力',library)!.disabled).toBe(true)
      expect(library.textContent).toContain('未发布，请先在能力中心发布')
      expect(library.textContent).toContain('Skills 技能 1 项')
      if(id==='builtin-manager') {
        expect(button('添加 会议录音转写',library)!.disabled).toBe(false)
        expect(library.textContent).not.toContain('仅供会议纪要助手使用')
        await act(async()=>library.querySelector<HTMLButtonElement>('button[title="会议录音转写"]')!.click())
        expect(button('管理录音转写能力 ↗')).toBeTruthy()
      }
    }
  })
  it('adds, removes, saves, reopens and directly saves a real imported meeting segment capability',async()=>{
    const packs=new CapabilityPackages(store);await packs.init()
    try {
      const zip=await readFile(join(process.env.DSH_SEGMENT_TEST_ROOT!,'capability-packages/audio-segment-location/dist/audio-segment-location-latest.zip'))
      const {token}=await packs.start('zip');await packs.put(token,'ability.zip',(async function*(){yield zip})());const preview=await packs.inspect(token);const installed=await packs.install(token,preview.hash,preview.revision,{trusted:true})
      const id='meeting-minutes-demo',getRole=()=>store.snapshot().roles.find(r=>r.id===id)!
      const published=structuredClone(getRole().versions)
      await capabilityClient.refresh();await act(async()=>root.render(<ManagedRoleEditor id={id} onClose={()=>{}}/>))
      expect(button('添加 录音分段定位')!.disabled).toBe(false)
      expect(button('添加 浏览器操作')!.disabled).toBe(false)
      await click('添加 录音分段定位');expect(button('添加 录音分段定位')!.disabled).toBe(true)
      await click('保存');expect(getRole().draft.capabilities.some(b=>b.capabilityId===installed.id)).toBe(true);expect(getRole().versions.slice(0,-1)).toEqual(published)
      await act(async()=>root.render(<></>));editorDrafts.clear();await act(async()=>root.render(<ManagedRoleEditor id={id} onClose={()=>{}}/>))
      await click('移除 录音分段定位');await click('保存')
      expect(getRole().draft.capabilities.some(b=>b.capabilityId===installed.id)).toBe(false)
      await act(async()=>root.render(<></>));editorDrafts.clear();await act(async()=>root.render(<ManagedRoleEditor id={id} onClose={()=>{}}/>))
      await click('添加 录音分段定位');await click('保存')
      expect(latest(getRole().versions)!.capabilities.filter(b=>b.capabilityId===installed.id)).toHaveLength(1)
      expect(getRole().versions.slice(0,published.length)).toEqual(published)
    }finally{await packs.close()}
  })
  it('offers one save, keeps edits on continue, and discards only after confirmation',async()=>{
    const id='builtin-manager',before=structuredClone(store.snapshot()),close=vi.fn()
    await act(async()=>root.render(<ManagedRoleEditor id={id} onClose={close}/>))
    expect(button('保存')).toBeTruthy();expect(button('取消')).toBeTruthy()
    expect(button('保存草稿')).toBeUndefined();expect(button('保存并发布')).toBeUndefined()
    expect(document.body.textContent).not.toContain('从历史版本恢复')
    expect(document.body.textContent).not.toContain('能力版本：')
    await click('添加 会议录音转写');await click('取消')
    expect(button('放弃修改')).toBeTruthy();expect(close).not.toHaveBeenCalled()
    await click('继续编辑');expect(button('添加 会议录音转写')!.disabled).toBe(true)
    expect(store.snapshot()).toEqual(before)
    await click('取消');await click('放弃修改')
    expect(close).toHaveBeenCalledTimes(1);expect(editorDrafts.has('role:'+id)).toBe(false)
    expect(store.snapshot()).toEqual(before)
    await act(async()=>root.render(<></>));await act(async()=>root.render(<ManagedRoleEditor id={id} onClose={close}/>))
    expect(button('添加 会议录音转写')!.disabled).toBe(false)
    await click('添加 会议录音转写');await click('保存')
    expect(commands.at(-1)).toMatchObject({type:'role.save',directSave:true,publish:true})
    expect(latest(store.snapshot().roles.find(r=>r.id===id)!.versions)!.capabilities.some(b=>b.capabilityId==='meeting-transcription')).toBe(true)
    expect(button('确认发布')).toBeUndefined()
  })

  it('does not create a copied role until save and removes a cancelled copy',async()=>{
    const before=store.snapshot()
    await act(async()=>root.render(<ManagedRolesSection selected="chat" onSelect={()=>{}}/>))
    const card=container.querySelector('[data-role-id="builtin-manager"]')!
    await click('复制岗位',card)
    expect(store.snapshot()).toEqual(before)
    await click('取消');await click('放弃修改')
    expect(store.snapshot()).toEqual(before);expect(editorDrafts.has('role:new')).toBe(false)
    await click('复制岗位',card);await click('保存')
    expect(store.snapshot().roles).toHaveLength(before.roles.length+1)
    const copied=store.snapshot().roles.find(r=>!before.roles.some(old=>old.id===r.id))!
    expect(latest(copied.versions)!.name).toContain('副本')
    expect(container.textContent).toContain('已保存')
  })

})
