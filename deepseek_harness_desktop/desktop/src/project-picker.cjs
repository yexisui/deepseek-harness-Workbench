'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

const ROOT_MARKERS = ['.git', 'package.json', 'pyproject.toml', 'requirements.txt', 'setup.py', 'setup.cfg', 'Cargo.toml', 'go.mod', 'pom.xml', 'build.gradle', 'build.gradle.kts', 'CMakeLists.txt', 'PERF_PLAN.md', 'PERF_PLAN.MD', 'PEFR_PLAN.md', 'PEFR_PLAN.MD'];

/** Only the current local application's top frame can invoke filesystem IPC. */
function assertProjectSender(event, window, tokenUrl) {
  try {
    if (!window || window.isDestroyed() || event.sender !== window.webContents
      || !event.senderFrame || event.senderFrame !== window.webContents.mainFrame) throw new Error();
    const expected = new URL(tokenUrl);
    const current = new URL(window.webContents.getURL());
    const sender = new URL(event.senderFrame.url);
    if (!['http:', 'https:'].includes(expected.protocol)
      || !['127.0.0.1', 'localhost', '[::1]'].includes(expected.hostname)
      || current.origin !== expected.origin || sender.origin !== expected.origin) throw new Error();
  } catch {
    throw new Error('当前页面不能访问项目选择功能，请返回工作台后重试。');
  }
}

async function existingPath(value) {
  if (typeof value !== 'string' || !value.trim() || value.includes('\0') || !path.isAbsolute(value)) {
    throw new Error('未能取得本机完整路径，请使用“选择文件夹”。');
  }
  try {
    const real = await fs.realpath(value);
    return { path: real, stat: await fs.stat(real) };
  } catch {
    throw new Error('路径不存在或无法访问，请重新选择项目根目录。');
  }
}

async function resolveOne(value) {
  const entry = await existingPath(value);
  if (entry.stat.isDirectory()) return { path: entry.path, detected: true };
  if (!entry.stat.isFile()) throw new Error('请选择普通项目文件或项目文件夹。');
  const parent = path.dirname(entry.path);
  for (let directory = parent; ; directory = path.dirname(directory)) {
    const markers = await Promise.all(ROOT_MARKERS.map(async (marker) => {
      try { await fs.stat(path.join(directory, marker)); return true; } catch { return false; }
    }));
    if (markers.some(Boolean)) return { path: directory, detected: true };
    if (path.dirname(directory) === directory) return { path: parent, detected: false };
  }
}

async function resolveProjectPaths(values) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error('请拖入项目文件夹或同一项目的文件。');
  }
  const results = await Promise.all(values.map(resolveOne));
  const key = (value) => process.platform === 'win32' ? value.toLowerCase() : value;
  if (results.some((result) => key(result.path) !== key(results[0].path))) {
    throw new Error('拖入的文件属于不同项目，请只拖入同一项目的文件，或直接选择项目根目录。');
  }
  return { path: results[0].path, detected: results.some((result) => result.detected) };
}

module.exports = { assertProjectSender, resolveProjectPaths };
