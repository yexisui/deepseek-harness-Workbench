import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { resolveProjectPaths, assertProjectSender } = require('../src/project-picker.cjs');

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-project-picker-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, '项目', 'src'), { recursive: true });
  await fs.writeFile(path.join(root, '项目', 'package.json'), '{}');
  await fs.writeFile(path.join(root, '项目', 'src', 'one.ts'), '');
  await fs.writeFile(path.join(root, '项目', 'src', 'two.ts'), '');
  return await fs.realpath(root);
}

test('project files use nearest marker; explicit directories remain unchanged', async (t) => {
  const root = await fixture(t);
  const project = path.join(root, '项目');
  assert.deepEqual(await resolveProjectPaths([path.join(project, 'src', 'one.ts'), path.join(project, 'src', 'two.ts')]), { path: project, detected: true });
  assert.deepEqual(await resolveProjectPaths([path.join(project, 'src')]), { path: path.join(project, 'src'), detected: true });
  await fs.writeFile(path.join(project, 'src', 'pyproject.toml'), '');
  assert.deepEqual(await resolveProjectPaths([path.join(project, 'src', 'one.ts')]), { path: path.join(project, 'src'), detected: true });
});

test('files with no marker fall back to containing directory and mixed projects reject', async (t) => {
  const root = await fixture(t);
  await fs.writeFile(path.join(root, 'loose.txt'), '');
  assert.deepEqual(await resolveProjectPaths([path.join(root, 'loose.txt')]), { path: root, detected: false });
  await assert.rejects(resolveProjectPaths([path.join(root, 'loose.txt'), path.join(root, '项目', 'src', 'one.ts')]), /不同项目/);
});

test('invalid and absent paths produce readable errors', async () => {
  for (const input of [null, [], 'file']) await assert.rejects(resolveProjectPaths(input), /请拖入/);
  for (const input of ['relative.txt', '', 123, 'bad\0name']) await assert.rejects(resolveProjectPaths([input]), /完整路径/);
  await assert.rejects(resolveProjectPaths([path.join(os.tmpdir(), 'dsh-not-existing-' + Date.now())]), /不存在或无法访问/);
});

test('filesystem IPC requires original loopback origin, real window and main frame', () => {
  const origin = 'http://127.0.0.1:4762/';
  const frame = { url: origin };
  const contents = { mainFrame: frame, getURL: () => origin };
  const window = { isDestroyed: () => false, webContents: contents };
  const event = { sender: contents, senderFrame: frame };
  assert.doesNotThrow(() => assertProjectSender(event, window, origin + '?token=private'));
  for (const target of [null, 'file:///tmp/test', 'https://example.com', 'http://127.0.0.1:9999/']) {
    assert.throws(() => assertProjectSender(event, window, target), /当前页面不能/);
  }
  assert.throws(() => assertProjectSender({ ...event, senderFrame: { url: origin } }, window, origin), /当前页面不能/);
  assert.throws(() => assertProjectSender({ ...event, sender: {} }, window, origin), /当前页面不能/);
  frame.url = 'https://example.com/';
  assert.throws(() => assertProjectSender(event, window, origin), /当前页面不能/);
  frame.url = origin;
  contents.getURL = () => 'file:///splash.html';
  assert.throws(() => assertProjectSender(event, window, origin), /当前页面不能/);
});

test('preload preserves attention API and transports actual File via webUtils', async () => {
  let bridge;
  const calls = [];
  const file = {};
  const electron = {
    contextBridge: { exposeInMainWorld: (name, value) => { assert.equal(name, 'desktop'); bridge = value; } },
    ipcRenderer: { invoke: async (...args) => { calls.push(args); return null; }, send: (...args) => calls.push(args), on: () => {} },
    webUtils: { getPathForFile: (value) => { assert.equal(value, file); return 'C:\\项目\\one.ts'; } },
  };
  vm.runInNewContext(await fs.readFile(new URL('../src/preload.cjs', import.meta.url), 'utf8'), { require: () => electron });
  assert.equal(await bridge.selectProjectDirectory(), null);
  assert.equal(bridge.getPathForFile(file), 'C:\\项目\\one.ts');
  await bridge.resolveProjectPaths(['C:\\项目']);
  bridge.notify('approval');
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [['desktop:select-project-directory'], ['desktop:resolve-project-paths', ['C:\\项目']], ['desktop:attention', { kind: 'approval' }]]);
});

test('main directory IPC preserves explicit selection, handles cancellation and rejects navigation during dialog', async () => {
  const handlers = new Map();
  const frame = { url: 'http://127.0.0.1:4762/' };
  const contents = { mainFrame: frame, getURL: () => frame.url };
  const window = { isDestroyed: () => false, webContents: contents };
  const event = { sender: contents, senderFrame: frame };
  let response = { canceled: true, filePaths: [] };
  let opened = 0;
  let navigate = false;
  const electron = {
    app: { isPackaged: true, requestSingleInstanceLock: () => true, on: () => {}, whenReady: () => new Promise(() => {}) },
    ipcMain: { on: () => {}, handle: (name, handler) => handlers.set(name, handler) },
    dialog: { showOpenDialog: async (owner, options) => {
      assert.equal(owner, window);
      assert.deepEqual(Array.from(options.properties), ['openDirectory']);
      assert.equal(options.buttonLabel, '确认根目录');
      assert.equal(options.filters, undefined);
      opened++;
      if (navigate) frame.url = 'http://127.0.0.1:9999/';
      return response;
    } },
  };
  const context = { process: { env: {} }, console, URL, __dirname: path.resolve('src'), require: (name) => name === 'electron' ? electron : require(name.startsWith('./') ? '../src/' + name.slice(2) : name) };
  vm.runInNewContext((await fs.readFile(new URL('../src/main.cjs', import.meta.url), 'utf8')) + '\nglobalThis.setupPicker = (window, url) => { mainWindow = window; tokenUrl = url; };', context);
  context.setupPicker(window, frame.url);
  const select = handlers.get('desktop:select-project-directory');
  assert.equal(await select(event), null);
  response = { canceled: false, filePaths: ['C:\\项目\\selected-subfolder'] };
  assert.equal(await select(event), response.filePaths[0]);
  await assert.rejects(select({ sender: contents, senderFrame: { url: frame.url } }), /当前页面不能/);
  assert.equal(opened, 2);
  navigate = true;
  await assert.rejects(select(event), /当前页面不能/);
});
