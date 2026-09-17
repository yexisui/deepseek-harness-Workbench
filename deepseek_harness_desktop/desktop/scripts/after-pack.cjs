'use strict';

// afterPack hook: copy the staged runtime payload into the packaged app with
// plain fs copies. electron-builder's extraResources copier applies the app
// directory's node_modules exclusion glob to extra files as well (the
// exclusion patterns are shared between the files and extraResources
// matchers), which silently drops both payload node_modules trees — and a
// missing extraResources source only WARNS. Copying here, with hard
// existence assertions on the destination, keeps the payload whole and the
// build loud.

const fs = require('node:fs');
const path = require('node:path');

const stagingRoot = path.join(__dirname, '..', 'resources', 'runtime');

// builder-util's Arch enum: ia32=0, x64=1, armv7l=2, arm64=3, universal=4.
const ARCH_NAMES = { 0: 'ia32', 1: 'x64', 2: 'armv7l', 3: 'arm64', 4: 'universal' };
const OS_NAMES = { darwin: 'mac', win32: 'win', linux: 'linux' };

function resourcesDir(context) {
  if (context.electronPlatformName === 'darwin') {
    const productName = context.packager.appInfo.productFilename;
    return path.join(context.appOutDir, `${productName}.app`, 'Contents', 'Resources');
  }
  return path.join(context.appOutDir, 'resources');
}

function copyPayload(source, destination) {
  if (!fs.existsSync(source)) {
    throw new Error(`after-pack: staged payload is missing: ${source} (run "npm run prepare-runtime" first)`);
  }
  fs.rmSync(destination, { recursive: true, force: true });
  fs.cpSync(source, destination, { recursive: true, dereference: true });
}

function assertDestFile(file) {
  if (!fs.existsSync(file)) {
    throw new Error(`after-pack: packaged app is missing ${file} — the runtime payload copy is broken`);
  }
}

exports.default = async function afterPack(context) {
  const os = OS_NAMES[context.electronPlatformName];
  const cpu = ARCH_NAMES[context.arch];
  if (os === undefined || cpu === undefined) {
    throw new Error(`after-pack: unsupported target ${context.electronPlatformName}-${context.arch}`);
  }
  const root = resourcesDir(context);
  const runtimeRoot = path.join(root, 'runtime');

  copyPayload(path.join(stagingRoot, 'host'), path.join(runtimeRoot, 'host'));
  copyPayload(path.join(stagingRoot, 'profile-web'), path.join(runtimeRoot, 'profile-web'));
  copyPayload(path.join(stagingRoot, `node-${os}-${cpu}`), path.join(runtimeRoot, 'node'));
  // The reseed contract compares the seeded profile's stamp against this file;
  // without it a packaged app would never reseed after a runtime bump.
  copyPayload(path.join(stagingRoot, 'VERSION.json'), path.join(runtimeRoot, 'VERSION.json'));

  assertDestFile(path.join(runtimeRoot, 'node', os === 'win' ? 'node.exe' : path.join('bin', 'node')));
  // The bundled toolchain (npm from the official distribution, pnpm staged by
  // fetch-pnpm.mjs) must reach the packaged app or in-app `dsh plugin` flows
  // fail on machines without preinstalled tooling.
  assertDestFile(path.join(runtimeRoot, 'node', os === 'win' ? 'npm.cmd' : path.join('bin', 'npm')));
  assertDestFile(path.join(runtimeRoot, 'node', os === 'win' ? 'pnpm.cmd' : path.join('bin', 'pnpm')));
  assertDestFile(path.join(runtimeRoot, 'host', 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js'));
  assertDestFile(path.join(runtimeRoot, 'profile-web', 'node_modules', '@linxin666', 'dsh-web-all', 'cordis.patch.yml'));
  console.log(`[after-pack] runtime payload staged into ${path.relative(path.join(__dirname, '..'), runtimeRoot)} (${os}-${cpu})`);
};
