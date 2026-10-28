import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import vm from 'node:vm'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { assertProjectSender } = require('../src/project-picker.cjs')

test('code project IPC opens the directory itself and reports missing paths and OS errors', async () => {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'code-folder-'))
  try {
    const frame = { url: 'http://127.0.0.1:4321/' }
    const contents = { mainFrame: frame, getURL: () => frame.url }
    const mainWindow = { isDestroyed: () => false, webContents: contents }
    const event = { sender: contents, senderFrame: frame }, calls = [], handlers = new Map()
    let failure = ''
    const source = await fs.readFile(new URL('../src/main.cjs', import.meta.url), 'utf8')
    const start = source.indexOf("ipcMain.handle('desktop:open-code-project-directory'")
    const end = source.indexOf("ipcMain.on('desktop:retry'", start)
    vm.runInNewContext(source.slice(start, end), { ipcMain: { handle: (key, handler) => handlers.set(key, handler) }, assertProjectSender, mainWindow, tokenUrl: frame.url, path, fs: { promises: fs }, shell: { openPath: async value => { calls.push(value); return failure } } })
    const open = handlers.get('desktop:open-code-project-directory')
    await open(event, folder); assert.deepEqual(calls, [path.resolve(folder)])
    await assert.rejects(open(event, 'relative'), /请选择/)
    await assert.rejects(open(event, path.join(folder, 'missing')), /不存在/)
    await fs.writeFile(path.join(folder, 'file.txt'), 'x')
    await assert.rejects(open(event, path.join(folder, 'file.txt')), /不存在/)
    await assert.rejects(open({ sender: {} }, folder), /当前页面不能/)
    failure = 'Explorer failed'; await assert.rejects(open(event, folder), /Explorer failed/)
  } finally { await fs.rm(folder, { recursive: true, force: true }) }
})

test('preload exposes the code-only open operation and retains existing directory picker', async () => {
  let bridge; const calls = []
  vm.runInNewContext(await fs.readFile(new URL('../src/preload.cjs', import.meta.url), 'utf8'), { require: () => ({ contextBridge: { exposeInMainWorld: (_name, value) => { bridge = value } }, ipcRenderer: { invoke: async (...args) => { calls.push(args); return null }, send() {}, on() {} }, webUtils: {} }) })
  await bridge.selectProjectDirectory(); await bridge.openCodeProjectDirectory('C:\\项目')
  assert.deepEqual(calls, [['desktop:select-project-directory'], ['desktop:open-code-project-directory', 'C:\\项目']])
})
