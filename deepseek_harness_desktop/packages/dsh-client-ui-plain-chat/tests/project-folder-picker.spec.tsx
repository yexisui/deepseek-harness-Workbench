// @vitest-environment jsdom
import React, { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { RequirementsNotebook } from '../src/client/RequirementsNotebook.tsx'
import { ProjectFolderPicker, type ProjectFolderBridge } from '../src/client/ProjectFolderPicker.tsx'
import type { RequirementTask } from '../../dsh-capabilities/src/core/requirements-model.ts'

let root: Root, host: HTMLDivElement
const command = vi.fn(async () => undefined)
let bridge: ProjectFolderBridge
const desktopWindow = window as Window & { desktop?: ProjectFolderBridge }
function SavedNotebook({ failDetach = false, failAttach = false }: { failDetach?: boolean; failAttach?: boolean }) {
  const [task, setTask] = useState<RequirementTask>({ sections: [], materials: [] } as unknown as RequirementTask)
  return <RequirementsNotebook task={task} busy={false} mode="quick" view="setup" onGuide={() => {}} onCommand={async c => {
    if (c.type === 'project.attach') {
      if (failAttach) return undefined
      const next = { ...task, project: { path: c.path, ledger: c.ledger, ledgerName: 'PERF_PLAN.md', files: [] } } as RequirementTask
      setTask(next); return next
    }
    if (c.type === 'project.detach') {
      if (failDetach) return undefined
      const next = { ...task }; delete next.project; setTask(next); return next
    }
    return task
  }}/>
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  command.mockClear()
  bridge = {
    selectProjectDirectory: vi.fn(async () => 'C:\\项目\\语音助手'),
    getPathForFile: vi.fn(file => 'C:\\项目\\语音助手\\src\\' + file.name),
    resolveProjectPaths: vi.fn(async () => ({ path: 'C:\\项目\\语音助手', detected: true })),
  }
  desktopWindow.desktop = bridge
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); delete desktopWindow.desktop; vi.restoreAllMocks() })
const button = (name: string) => Array.from(host.querySelectorAll('button')).find(b => b.textContent === name)!
const input = () => host.querySelector<HTMLInputElement>('[aria-label="项目文件夹路径"]')!
async function click(name: string) { await act(async () => button(name).click()) }
async function render(busy = false) {
  await act(async () => root.render(<RequirementsNotebook task={null} busy={busy} mode="quick" view="setup" onCommand={command} onGuide={() => {}}/>))
  expect(host.querySelector('[aria-label="项目根目录选择框"]')).not.toBeNull()
}
async function fill(value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input(), value)
    input().dispatchEvent(new Event('input', { bubbles: true }))
  })
}
async function drop(files = [new File(['content'], 'main.ts')]) {
  const event = new Event('drop', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'dataTransfer', { value: { files } })
  await act(async () => host.querySelector('[aria-label="项目根目录选择框"]')!.dispatchEvent(event))
  return event
}

it('automatically attaches the selected native directory', async () => {
  await render(); await click('选择项目根目录')
  expect(input().value).toBe('C:\\项目\\语音助手')
  expect(command).toHaveBeenCalledTimes(1)
  expect(command).toHaveBeenCalledWith({ type: 'project.attach', path: 'C:\\项目\\语音助手', ledger: true })
})

it('shows the root picker immediately and keeps it separate from the reference file dialog', async () => {
  await act(async () => root.render(<RequirementsNotebook task={null} busy={false} mode="quick" view="setup" onCommand={command} onGuide={() => {}} onFiles={vi.fn(async () => {})}/>))
  const referenceInput = host.querySelector<HTMLInputElement>('input[type="file"]')!
  const openFiles = vi.spyOn(referenceInput, 'click').mockImplementation(() => {})
  expect(host.querySelector('[aria-label="项目根目录选择框"]')).not.toBeNull()
  await click('选择项目根目录')
  expect(bridge.selectProjectDirectory).toHaveBeenCalledTimes(1)
  expect(openFiles).not.toHaveBeenCalled()
  await click('添加参考文件（可多选）')
  expect(openFiles).toHaveBeenCalledTimes(1)
  expect(bridge.selectProjectDirectory).toHaveBeenCalledTimes(1)
  expect(command).toHaveBeenCalledTimes(1)
})

it('retains the typed directory when the native dialog is cancelled or fails', async () => {
  await render(); await fill('C:\\原项目')
  vi.mocked(bridge.selectProjectDirectory).mockResolvedValueOnce(null)
  await click('选择项目根目录'); expect(input().value).toBe('C:\\原项目')
  vi.mocked(bridge.selectProjectDirectory).mockRejectedValueOnce(new Error('目录不可用'))
  await click('选择项目根目录'); expect(host.querySelector('[role="alert"]')?.textContent).toContain('目录不可用')
  expect(input().value).toBe('C:\\原项目'); expect(command).not.toHaveBeenCalled()
})

it('resolves dropped files through their real desktop paths and automatically attaches without importing their contents', async () => {
  await render()
  const files = [new File(['first'], 'main.ts'), new File(['second'], 'test.ts')]
  const event = await drop(files)
  expect(event.defaultPrevented).toBe(true)
  expect(bridge.getPathForFile).toHaveBeenCalledWith(files[0])
  expect(bridge.resolveProjectPaths).toHaveBeenCalledWith(['C:\\项目\\语音助手\\src\\main.ts', 'C:\\项目\\语音助手\\src\\test.ts'])
  expect(input().value).toBe('C:\\项目\\语音助手'); expect(command).toHaveBeenCalledWith({type:'project.attach',path:'C:\\项目\\语音助手',ledger:true})
})

it('shows the containing-folder fallback and preserves the existing value on mixed-project failure', async () => {
  await render()
  vi.mocked(bridge.resolveProjectPaths).mockResolvedValueOnce({ path: 'C:\\临时目录', detected: false })
  await drop(); expect(input().value).toBe('C:\\临时目录')
  vi.mocked(bridge.resolveProjectPaths).mockRejectedValueOnce(new Error('请一次拖入同一项目的文件'))
  await drop(); expect(input().value).toBe('C:\\临时目录')
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('同一项目')
})

it('blocks selecting, editing and dropping while the task is busy', async () => {
  await render(true)
  expect(button('选择项目根目录').disabled).toBe(true); expect(input().disabled).toBe(true)
  await drop(); expect(bridge.resolveProjectPaths).not.toHaveBeenCalled()
})

it('disables attach until asynchronous selection finishes', async () => {
  await render(); await fill('C:\\原项目')
  let finish!: (value: string | null) => void
  vi.mocked(bridge.selectProjectDirectory).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  await click('选择项目根目录')
  expect(button('关联项目').disabled).toBe(true); expect(input().disabled).toBe(true)
  await drop(); expect(bridge.resolveProjectPaths).not.toHaveBeenCalled()
  await act(async () => finish('C:\\新项目'))
  expect(button('关联项目').disabled).toBe(false); expect(input().value).toBe('C:\\新项目')
})

it('allows manual paths in browsers and reports unavailable native path access without guessing', async () => {
  delete desktopWindow.desktop
  await render(); await fill('C:\\项目')
  await click('选择项目根目录'); expect(host.querySelector('[role="alert"]')?.textContent).toContain('桌面端')
  await drop(); expect(input().value).toBe('C:\\项目')
  await click('关联项目'); expect(command).toHaveBeenCalledWith({ type: 'project.attach', path: 'C:\\项目', ledger: true })
})

it('does not update the project after the picker is closed while resolving', async () => {
  const onChange = vi.fn(), onBusyChange = vi.fn()
  let finish!: (value: string | null) => void
  vi.mocked(bridge.selectProjectDirectory).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  await act(async () => root.render(<ProjectFolderPicker value="" onChange={onChange} disabled={false} onBusyChange={onBusyChange}/>))
  await click('选择项目根目录')
  await act(async () => root.render(<div>另一个对话</div>))
  await act(async () => finish('C:\\旧对话的项目'))
  expect(onChange).not.toHaveBeenCalled(); expect(onBusyChange).toHaveBeenLastCalledWith(false)
})

it('refuses browser virtual files that do not have a native path', async () => {
  await render(); await fill('C:\\原项目')
  vi.mocked(bridge.getPathForFile).mockReturnValue('')
  await drop(); expect(host.textContent).toContain('无法获取文件的本机路径')
  expect(bridge.resolveProjectPaths).not.toHaveBeenCalled(); expect(input().value).toBe('C:\\原项目')
})

it('has exactly two choices and shows persisted selection after automatic attach and detach', async () => {
  await act(async () => root.render(<SavedNotebook/>))
  expect(host.querySelector('[aria-label="项目关联状态"]')!.querySelectorAll('button')).toHaveLength(2)
  expect(host.textContent).not.toContain('暂不关联')
  expect(button('解除关联').getAttribute('aria-pressed')).toBe('true')
  await click('选择项目根目录')
  expect(button('关联项目').getAttribute('aria-pressed')).toBe('true')
  expect(button('解除关联').getAttribute('aria-pressed')).toBe('false')
  expect(host.textContent).toContain('已关联：C:\\项目\\语音助手')
  await click('解除关联')
  expect(input().value).toBe('')
  expect(button('解除关联').getAttribute('aria-pressed')).toBe('true')
  expect(button('关联项目').getAttribute('aria-pressed')).toBe('false')
  expect(host.textContent).not.toContain('已关联项目。')
  expect(host.textContent).toContain('当前未关联项目')
})

it('does not pretend to detach or clear the saved path when the server rejects detach', async () => {
  await act(async () => root.render(<SavedNotebook failDetach/>))
  await click('选择项目根目录'); await click('解除关联')
  expect(input().value).toBe('C:\\项目\\语音助手')
  expect(button('关联项目').getAttribute('aria-pressed')).toBe('true')
})

it('does not show linked state when automatic attach fails and clears an unbound draft without saving', async () => {
  await act(async () => root.render(<SavedNotebook failAttach/>))
  await click('选择项目根目录')
  expect(button('解除关联').getAttribute('aria-pressed')).toBe('true')
  expect(host.textContent).toContain('项目关联未成功')
  await click('解除关联'); expect(input().value).toBe('')
})
