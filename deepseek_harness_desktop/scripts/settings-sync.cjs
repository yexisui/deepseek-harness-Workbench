'use strict';
// Share configuration only. Runtime data and credentials never enter this manifest.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const structuredFiles = [
  'settings.yaml', 'pet.json', 'skin-center-active.json',
  'plugin-management/classification.json', 'skill-management/state.json',
  'capabilities/state.json', 'capabilities/recordings/settings.json',
  'capabilities/file-search/settings.json',
  'profiles/web/cordis.patch.yml',
];
const trees = ['skills/', 'skill-management/versions/', 'skins/', '.agent-presets/'];
const token = '{{WORKBENCH_ROOT}}';
const secretField = /^(?:api[-_]?key|.*apiKey|password|passwd|secret|clientSecret|accessToken|refreshToken|token|cookie|authorization|credentials|privateKey)$/i;
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function allowed(relative) {
  if (relative.includes('\\') || relative.split('/').some(p => !p || p === '.' || p === '..' || p.includes(':'))) return false;
  if (structuredFiles.includes(relative)) return true;
  if (!trees.some(p => relative.startsWith(p))) return false;
  if (relative.split('/').some(p => ['node_modules', '.git', '.cache'].includes(p))) return false;
  // These presets are regenerated from capabilities/state.json or installed by the runtime.
  if (/^\.agent-presets\/workbench-(?:role-|chat\/)/.test(relative)) return false;
  if (/^(?:skills|skill-management\/versions)\//.test(relative) && /\.(?:py|xlsx)$/i.test(relative)) return true;
  return /\.(?:json|ya?ml|md|txt|css|m?js|png|jpe?g|webp|gif|svg)$/i.test(relative) || /\/LICENSE$/.test(relative);
}
function safe(root, relative) {
  const full = path.resolve(root, relative);
  const rel = path.relative(root, full);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) throw Error('Invalid settings path');
  let cursor = full;
  while (cursor !== path.resolve(root)) {
    try { if (fs.lstatSync(cursor).isSymbolicLink()) throw Error('Linked settings path: ' + relative); }
    catch (e) { if (e.code !== 'ENOENT') throw e; }
    cursor = path.dirname(cursor);
  }
  if (fs.existsSync(root) && fs.lstatSync(root).isSymbolicLink()) throw Error('Linked settings root');
  return full;
}
function atomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = file + '.' + crypto.randomUUID() + '.tmp';
  try { fs.writeFileSync(temp, data); fs.renameSync(temp, file); }
  finally { if (fs.existsSync(temp)) fs.unlinkSync(temp); }
}
function yamlAt(root) {
  for (const p of ['runtime/node_modules/yaml', 'runtime-dev/node_modules/yaml', 'deepseek_harness_desktop/node_modules/yaml']) {
    try { return require(path.join(root, p)); } catch (e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; }
  }
  throw Error('YAML runtime missing. Install/repair the local runtime first.');
}
function codec(root) {
  const yaml = yamlAt(root);
  return {
    read: (name, bytes) => /\.ya?ml$/.test(name) ? yaml.parse(bytes.toString()) : JSON.parse(bytes.toString().replace(/^\uFEFF/, '')),
    write: (name, value) => /\.ya?ml$/.test(name) ? yaml.stringify(value) : json(value),
  };
}
function transform(value, mapString, strip = false) {
  if (typeof value === 'string') return mapString(value);
  if (Array.isArray(value)) return value.map(v => transform(v, mapString, strip));
  if (!object(value)) return value;
  return Object.fromEntries(Object.entries(value).filter(([k]) => !['__proto__', 'constructor', 'prototype'].includes(k) && !(strip && secretField.test(k)))
    .map(([k,v]) => [k, transform(v, mapString, strip)]));
}
function inspectSecrets(text, secrets, name) {
  if (secrets.some(s => text.includes(s)) || /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bsk-[A-Za-z0-9_-]{20,}|\bBearer\s+[A-Za-z0-9._-]{20,}|https?:\/\/[^\s/]+:[^\s/@]+@/i.test(text)) {
    throw Error('Possible credential in settings; export stopped: ' + name);
  }
}
function secretValues(root, read) {
  const values = [];
  const collect = v => { if (typeof v === 'string' && v.length >= 12) values.push(v); else if (v && typeof v === 'object') Object.values(v).forEach(collect); };
  const file = path.join(root, 'dsh-data/.credentials.yaml');
  if (fs.existsSync(file)) collect(read('settings.yaml', fs.readFileSync(file)));
  const legacy = path.join(root, 'ai_key.txt');
  if (fs.existsSync(legacy)) for (const match of fs.readFileSync(legacy, 'utf8').matchAll(/(?:sk-|Bearer\s+)[A-Za-z0-9._-]{12,}/g)) values.push(match[0]);
  return [...new Set(values)];
}
function walk(root, relative, out) {
  const dir = safe(root, relative.replace(/\/$/, ''));
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw Error('Linked configuration asset: ' + relative + entry.name);
    if (['node_modules', '.git', '.cache'].includes(entry.name)) continue;
    const name = relative + entry.name;
    if (entry.isDirectory()) walk(root, name + '/', out);
    else if (allowed(name)) out.push(name);
  }
}
function exportSettings(root) {
  const { read, write } = codec(root), home = path.join(root, 'dsh-data');
  const secrets = secretValues(root, read), names = structuredFiles.filter(n => fs.existsSync(safe(home, n)));
  for (const tree of trees) walk(home, tree, names);
  const portable = s => s.split(root).join(token).split(root.replace(/\\/g, '/')).join(token);
  // Build and inspect everything in memory before publishing any files.
  const files = names.sort().map(name => {
    let bytes = fs.readFileSync(safe(home, name));
    const format = /\.(json|ya?ml)$/.test(name) ? 'structured' : /\.(png|jpe?g|webp|gif|xlsx)$/i.test(name) ? 'binary' : 'text';
    if (format === 'structured') {
      let value = transform(read(name, bytes), portable, true);
      if (name === 'capabilities/state.json') delete value.stoppedSessions;
      if (name === 'plugin-management/classification.json') delete value.aiClassification;
      if (name === 'skill-management/state.json') for (const skill of value.skills ?? []) delete skill.usageHistory;
      bytes = Buffer.from(write(name, value));
    } else if (format === 'text') bytes = Buffer.from(portable(bytes.toString('utf8')));
    inspectSecrets(bytes.toString('utf8'), secrets, name);
    return { path: name, format, sha256: hash(bytes), bytes };
  });
  const shared = path.join(root, 'shared-settings');
  const manifest = { schema: 1, files: files.map(({bytes, ...entry}) => entry) };
  const previous = fs.existsSync(path.join(shared, 'manifest.json')) ? JSON.parse(fs.readFileSync(path.join(shared, 'manifest.json'))) : {files: []};
  for (const file of files) atomic(safe(shared, 'files/' + file.path), file.bytes);
  for (const old of previous.files) if (allowed(old.path) && !names.includes(old.path)) {
    const stale = safe(shared, 'files/' + old.path); if (fs.existsSync(stale)) fs.unlinkSync(stale);
  }
  atomic(safe(shared, 'manifest.json'), json(manifest));
  return { exported: files.length, bytes: files.reduce((sum, f) => sum + f.bytes.length, 0) };
}
function merge(local, incoming) {
  if (!object(local) || !object(incoming)) return incoming;
  const result = { ...local };
  for (const [k, v] of Object.entries(incoming)) result[k] = merge(local[k], v);
  return result;
}
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  return object(value) ? Object.fromEntries(Object.keys(value).sort().map(k => [k, stable(value[k])])) : value;
}
function definition(version) {
  const { version: _v, createdAt: _t, preset: _p, directSave: _d, ...rest } = version;
  return JSON.stringify(stable(rest));
}
// Keep historical version numbers valid for this computer's existing tasks.
function mergeCapabilities(local, incoming) {
  if (!local) return incoming;
  const result = merge(local, incoming), bindings = new Map(), presets = new Map();
  const combine = (kind, rewrite) => {
    const list = structuredClone(local[kind] ?? []);
    for (const source of incoming[kind] ?? []) {
      const target = list.find(e => e.id === source.id);
      if (!target) {
        const added = structuredClone(source);
        added.draft = rewrite(added.draft); added.versions = added.versions.map(rewrite);
        list.push(added);
        for (const v of added.versions) if (kind === 'capabilities') bindings.set(source.id + ':' + v.version, v.version);
        continue;
      }
      const versions = structuredClone(target.versions ?? []);
      for (const [index, original] of source.versions.entries()) {
        const item = rewrite(structuredClone(original));
        let found = versions.find(v => definition(v) === definition(item));
        if (!found || (index === source.versions.length - 1 && found !== versions.at(-1))) {
          const number = Math.max(0, ...versions.map(v => v.version)) + 1;
          found = { ...item, version: number };
          if (kind === 'roles') found.preset = 'workbench-role-' + source.id + '-v' + number;
          versions.push(found);
        }
        if (kind === 'capabilities') bindings.set(source.id + ':' + original.version, found.version);
        else presets.set(original.preset, found.preset);
      }
      Object.assign(target, source, { draft: rewrite(structuredClone(source.draft)), versions });
    }
    return list;
  };
  result.capabilities = combine('capabilities', v => v);
  result.roles = combine('roles', v => ({...v, capabilities: (v.capabilities ?? []).map(b => ({...b, version: bindings.get(b.capabilityId + ':' + b.version) ?? b.version}))}));
  result.revision = Math.max(local.revision ?? 0, incoming.revision ?? 0) + 1;
  return { state: result, presets };
}
function settingsOwners(root, processes, lock, selfPid = process.pid) {
  const prefix = path.win32.resolve(root).toLowerCase().replace(/\\+$/, '') + '\\';
  const lockedAt = Date.parse(lock?.startedAt);
  return processes.filter(p => {
    if (p.pid === selfPid) return false;
    // Auxiliary RAG/build processes also use portable Node. They do not own settings.
    const desktop = String(p.name).toLowerCase() === 'electron.exe' && p.exe &&
      path.win32.resolve(p.exe).toLowerCase().startsWith(prefix);
    const started = Date.parse(p.startedAt);
    const writer = p.pid === lock?.pid && Number.isFinite(lockedAt) &&
      (!Number.isFinite(started) || started <= lockedAt + 5000);
    return desktop || writer;
  });
}
function assertStopped(root) {
  if (process.platform !== 'win32') return;
  const command = "[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); $p=@(Get-CimInstance Win32_Process -ErrorAction Stop | Where-Object { $_.Name -in @('node.exe','electron.exe') } | ForEach-Object { @{pid=[int]$_.ProcessId;name=$_.Name;exe=$_.ExecutablePath;startedAt=if($_.CreationDate){$_.CreationDate.ToUniversalTime().ToString('o')}else{''}} }); ConvertTo-Json -InputObject $p -Compress";
  const output = execFileSync('powershell.exe', ['-NoProfile', '-Command', command], {windowsHide: true, encoding: 'utf8', env:{...process.env, PSModulePath:''}});
  let lock;
  try { lock = JSON.parse(fs.readFileSync(path.join(root, 'dsh-data/capabilities/writer.lock'), 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw Error('无法核对工作台写入锁，请先关闭工作台后重试。'); }
  const owners = settingsOwners(root, JSON.parse(output), lock);
  if (owners.length) throw Error('工作台仍在运行（进程 ' + owners.map(p => p.pid).join('、') + '）。请关闭工作台窗口后重新启动，以应用共享设置。');
}
function applySettings(root) {
  const shared = path.join(root, 'shared-settings');
  if (!fs.existsSync(path.join(shared, 'manifest.json'))) return { skipped: true };
  const manifest = JSON.parse(fs.readFileSync(path.join(shared, 'manifest.json')));
  if (manifest.schema !== 1 || !Array.isArray(manifest.files)) throw Error('Unsupported settings manifest');
  const home = path.join(root, 'dsh-data');
  const receiptFile = safe(root, 'settings-local/applied.json');
  const receipt = fs.existsSync(receiptFile) ? JSON.parse(fs.readFileSync(receiptFile)) : {files:{}};
  if (receipt.root !== root) receipt.files = {};
  const entries = manifest.files.map(entry => {
    if (!allowed(entry.path)) throw Error('Unshared settings path');
    const bytes = fs.readFileSync(safe(shared, 'files/' + entry.path));
    if (hash(bytes) !== entry.sha256) throw Error('Settings checksum mismatch: ' + entry.path);
    return {...entry, bytes};
  });
  const pending = entries.filter(e => receipt.files[e.path] !== e.sha256);
  if (!pending.length) return {applied: 0};
  assertStopped(root);
  const {read, write} = codec(root), changes = [], secrets = secretValues(root, read);
  let presetMap = new Map(Object.entries(receipt.presets ?? {}));
  // State first, so the default preset can follow remapped historical version numbers.
  pending.sort((a,b) => (a.path === 'capabilities/state.json' ? -1 : 0) - (b.path === 'capabilities/state.json' ? -1 : 0));
  for (const entry of pending) {
    const file = safe(home, entry.path), before = fs.existsSync(file) ? fs.readFileSync(file) : null;
    inspectSecrets(entry.bytes.toString('utf8'), secrets, entry.path);
    let after = entry.bytes;
    if (entry.format === 'structured') {
      const incoming = transform(read(entry.path, entry.bytes), s => s.split(token).join(root), true);
      const local = before ? read(entry.path, before) : undefined;
      let value;
      if (entry.path === 'capabilities/state.json' && local) {
        const merged = mergeCapabilities(local, incoming); value = merged.state;
        for (const [from,to] of merged.presets) presetMap.set(from,to);
      } else if (entry.path === 'skill-management/state.json') {
        value = merge(local, incoming);
        value.skills = [...(local?.skills ?? []).filter(v => !incoming.skills.some(s => s.id === v.id)), ...incoming.skills.map(v => merge(local?.skills?.find(s => s.id === v.id), v))];
      } else if (Array.isArray(incoming) && Array.isArray(local) && entry.path === 'profiles/web/cordis.patch.yml') {
        value = [...local.filter(v => !incoming.some(i => i.id === v.id)), ...incoming.map(v => merge(local.find(i => i.id === v.id), v))];
      } else value = merge(local, incoming);
      if (entry.path === 'settings.yaml' && value['agent-presets']?.default) value['agent-presets'].default = presetMap.get(value['agent-presets'].default) ?? value['agent-presets'].default;
      after = Buffer.from(write(entry.path, value));
    } else if (entry.format === 'text') after = Buffer.from(after.toString().split(token).join(root));
    if (!before?.equals(after)) changes.push({file, before, after, name:entry.path});
  }
  const backup = 'settings-local/backups/' + new Date().toISOString().replace(/[:.]/g,'-');
  for (const change of changes) if (change.before) atomic(safe(root, backup + '/' + change.name), change.before);
  const written = [];
  try {
    for (const change of changes) { atomic(change.file, change.after); written.push(change); }
    for (const entry of pending) receipt.files[entry.path] = entry.sha256;
    receipt.presets = Object.fromEntries(presetMap);
    receipt.root = root;
    atomic(receiptFile, json(receipt));
  } catch (error) {
    for (const change of written.reverse()) { if (change.before) atomic(change.file, change.before); else fs.unlinkSync(change.file); }
    throw error;
  }
  return {applied: changes.length};
}
module.exports = { exportSettings, applySettings, mergeCapabilities, allowed, settingsOwners };
if (require.main === module) {
  try {
    const [mode, rootArg] = process.argv.slice(2), root = path.resolve(rootArg || path.join(__dirname, '../..'));
    if (!['export','apply'].includes(mode)) throw Error('Usage: settings-sync.cjs export|apply [workbench-root]');
    console.log('Shared settings: ' + JSON.stringify(mode === 'export' ? exportSettings(root) : applySettings(root)));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
