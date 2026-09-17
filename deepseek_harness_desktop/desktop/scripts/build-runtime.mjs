#!/usr/bin/env node
'use strict';

/**
 * Install the runtime payload (dsh host + preinstalled web profile) with the
 * pinned versions from runtime/<part>/package.json, then stage the result
 * into desktop/resources/runtime/ for electron-builder's extraResources.
 *
 * Both payloads install with a hoisted, multi-platform pnpm layout (see each
 * pnpm-workspace.yaml) so the staged trees are real files that cover every
 * shipped OS/arch and survive being copied into the user's $DSH_HOME.
 *
 * Usage: node scripts/build-runtime.mjs
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const desktopDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtimeSrc = path.join(desktopDir, 'runtime');
const stagingRoot = path.join(desktopDir, 'resources', 'runtime');

/** Files copied from runtime/<part> into the staged payload. */
const PART_FILES = {
  host: ['package.json', 'pnpm-workspace.yaml', 'pnpm-lock.yaml', 'node_modules'],
  'profile-web': ['package.json', 'pnpm-workspace.yaml', 'pnpm-lock.yaml', 'cordis.patch.yml', 'node_modules'],
};

function readPinnedVersion(part, packageName) {
  const manifest = JSON.parse(fs.readFileSync(path.join(runtimeSrc, part, 'package.json'), 'utf8'));
  const version = manifest.dependencies?.[packageName];
  if (version === undefined) throw new Error(part + '/package.json does not pin ' + packageName);
  return version;
}

function pnpmInstall(part) {
  console.log('[build-runtime] pnpm install in runtime/' + part);
  // stdio is piped and relayed: inheriting a non-TTY stdout can stall pnpm's
  // progress renderer in background job contexts.
  //
  // pnpm >= 11.24 was observed exiting 1 with empty stderr on the live
  // supply-chain policy verification of a cold install (CI runner, run
  // 33824501455), and once locally behind a flaky proxy; a second attempt
  // passes. Retry a few times and relay the captured output as text so the
  // real diagnosis is not lost to a byte-array dump.
  const attempts = 3;
  // Windows resolves pnpm through a .cmd shim, which spawnSync cannot
  // execute without a shell (ENOENT on every retry). The shell is only
  // needed there, and every argument is a constant literal, so routing
  // through cmd.exe adds no injection surface. Same fix as the dsh-trading
  // desktop runtime; failure class surfaced by release run 34077107610.
  const spawnOptions = {
    cwd: path.join(runtimeSrc, part),
    env: { ...process.env },
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    shell: process.platform === 'win32',
  };
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const result = spawnSync('pnpm', ['install'], spawnOptions);
    if (result.status === 0) {
      console.log(String(result.stdout).split('\n').slice(-6).join('\n'));
      return;
    }
    console.log('[build-runtime] pnpm install failed (attempt ' + attempt + '/' + attempts + '), status=' + result.status);
    if (result.stdout) console.log(String(result.stdout).split('\n').slice(-15).join('\n'));
    if (result.stderr) console.log(String(result.stderr).split('\n').slice(-15).join('\n'));
    if (attempt < attempts) {
      // Synchronous, dependency-free sleep that works on every platform.
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 15000);
    } else result.error && console.log(result.error);
  }
  throw new Error('pnpm install kept failing in runtime/' + part + ' after ' + attempts + ' attempts');
}

/** Remove every node_modules command-shim directory (.bin) at any depth. */
function removeBinDirs(root) {
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const full = path.join(root, entry.name);
    if (entry.name === '.bin') fs.rmSync(full, { recursive: true, force: true });
    else removeBinDirs(full);
  }
}

function assertNoSymlinks(root) {
  const offenders = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) offenders.push(path.relative(root, full));
      else if (entry.isDirectory()) walk(full);
    }
  };
  walk(root);
  if (offenders.length > 0) {
    throw new Error('staged payload contains symlinks (would break inside installers): ' + offenders.slice(0, 5).join(', '));
  }
}

function stage(part) {
  const dest = path.join(stagingRoot, part);
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  for (const name of PART_FILES[part]) {
    const source = path.join(runtimeSrc, part, name);
    if (!fs.existsSync(source)) {
      if (name === 'pnpm-lock.yaml') continue;
      throw new Error('expected ' + path.join('runtime', part, name) + ' after pnpm install');
    }
    fs.cpSync(source, path.join(dest, name), { recursive: true, dereference: true });
  }
  // node_modules/.bin holds pnpm's command shims (symlinks) at any depth;
  // nothing at runtime resolves through them, and symlinks must not enter
  // the installer.
  removeBinDirs(path.join(dest, 'node_modules'));
  assertNoSymlinks(path.join(dest, 'node_modules'));
  console.log('[build-runtime] staged ' + part + ' -> ' + path.relative(desktopDir, dest));
}

function assertRuntimeEntrypoints() {
  const hostBin = path.join(stagingRoot, 'host', 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js');
  if (!fs.existsSync(hostBin)) throw new Error('staged host is missing ' + path.relative(desktopDir, hostBin));
  const bundle = path.join(stagingRoot, 'profile-web', 'node_modules', '@linxin666', 'dsh-web-all', 'cordis.patch.yml');
  if (!fs.existsSync(bundle)) throw new Error('staged profile is missing the dsh-web-all bundle patch');
  // The extraResources glob `node-${os}-${arch}` uses the electron-builder os
  // spelling (mac/win). electron-builder only WARNS when a source is missing,
  // and the result is an app without a runtime — assert here instead. npm
  // ships inside the official distributions; pnpm is staged by
  // scripts/fetch-pnpm.mjs so in-app plugin flows work with zero tooling.
  const nodePayloads = [
    ['node-mac-arm64', [['bin', 'node'], ['bin', 'npm'], ['bin', 'pnpm']]],
    ['node-mac-x64', [['bin', 'node'], ['bin', 'npm'], ['bin', 'pnpm']]],
    ['node-win-x64', [['node.exe'], ['npm.cmd'], ['pnpm.cmd']]],
  ];
  for (const [dir, required] of nodePayloads) {
    for (const segments of required) {
      const bin = path.join(stagingRoot, dir, ...segments);
      if (!fs.existsSync(bin)) throw new Error('staged payload is missing ' + path.relative(desktopDir, bin) + ' (electron-builder resolves node-${os}-${arch} as node-<mac|win>-<arch>)');
    }
  }
}

async function main() {
  const hostVersion = readPinnedVersion('host', '@deepseek-ai/dsh');
  const webAllVersion = readPinnedVersion('profile-web', '@linxin666/dsh-web-all');

  pnpmInstall('host');
  pnpmInstall('profile-web');
  stage('host');
  stage('profile-web');
  assertRuntimeEntrypoints();

  const stamp = {
    node: 'see .node-version markers under node-<os>-<cpu>',
    host: '@deepseek-ai/dsh@' + hostVersion,
    webAll: '@linxin666/dsh-web-all@' + webAllVersion,
    builtAt: new Date().toISOString(),
  };
  fs.mkdirSync(stagingRoot, { recursive: true });
  fs.writeFileSync(path.join(stagingRoot, 'VERSION.json'), JSON.stringify(stamp, null, 2) + '\n');
  console.log('[build-runtime] runtime payload ready: ' + stamp.host + ' + ' + stamp.webAll);
}

main();
