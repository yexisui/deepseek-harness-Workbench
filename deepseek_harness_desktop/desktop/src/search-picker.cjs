'use strict';
const fs = require('node:fs/promises');
const { win32 } = require('node:path');
async function searchResultPath(value) {
  if (typeof value !== 'string' || !/^[a-z]:[\\/]/i.test(value) || /[\x00-\x1f]/.test(value)) throw Error('请选择本机文件的完整路径');
  const path = win32.normalize(value);
  const info = await fs.stat(path).catch(() => null);
  if (!info || !info.isFile() && !info.isDirectory()) throw Error('文件已移动、删除或无法访问，请重新搜索');
  return path;
}
async function searchDirectoryDefault(value) {
  try { const path = await searchResultPath(value); return (await fs.stat(path)).isDirectory() ? path : undefined } catch { return undefined }
}
module.exports = { searchResultPath, searchDirectoryDefault };
