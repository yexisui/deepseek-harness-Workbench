#!/usr/bin/env node
/** Install the immutable custom build with pnpm 11 workspace overrides. */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(process.argv[2])
const profile = path.join(root, 'dsh-data/profiles/web')
const require = createRequire(path.join(root, 'runtime/package.json'))
const { parseDocument } = require('yaml')
const { entries } = JSON.parse(fs.readFileSync(path.join(root, 'runtime-dev/workshop-build-result.json'), 'utf8'))
const manifestPath = path.join(profile, 'package.json')
const workspacePath = path.join(profile, 'pnpm-workspace.yaml')
const originalManifest = fs.readFileSync(manifestPath, 'utf8')
const originalWorkspace = fs.existsSync(workspacePath) ? fs.readFileSync(workspacePath, 'utf8') : null
const manifest = JSON.parse(originalManifest)
// Install all standalone workbench services from this same complete build.
// JEV is mounted by capabilities and compiled into its runtime, not registered twice.
const roots = ['@linxin666/dsh-web-all', '@linxin666/dsh-client-ui-plain-chat', '@linxin666/dsh-capabilities']
manifest.dependencies ??= {}
for (const name of roots) {
  if (!entries.some(entry => entry.name === name)) throw new Error('Build is missing workbench service: ' + name)
}
const workspace = parseDocument(originalWorkspace ?? 'packages:\n  - .\nnodeLinker: hoisted\nautoInstallPeers: false\n')
if (workspace.errors.length) throw new Error('Cannot parse profile pnpm-workspace.yaml')
for (const entry of entries) {
  const spec = 'file:../../../' + entry.relative
  workspace.setIn(['overrides', entry.name], spec)
  if (roots.includes(entry.name)) manifest.dependencies[entry.name] = spec
}
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
fs.writeFileSync(workspacePath, workspace.toString())
const result = spawnSync(process.execPath, [path.join(root, 'runtime/node_modules/pnpm/bin/pnpm.cjs'), 'install', '--ignore-scripts'], {
  cwd: profile, stdio: 'inherit', windowsHide: true,
})
if (result.error || result.status !== 0) {
  fs.writeFileSync(manifestPath, originalManifest)
  if (originalWorkspace !== null) fs.writeFileSync(workspacePath, originalWorkspace)
  else fs.rmSync(workspacePath, { force: true })
  throw result.error ?? new Error('Local Workshop install failed; profile settings restored. See deployment backup for the lockfile.')
}
const runtimeRequire = createRequire(path.join(profile, 'node_modules/@linxin666/dsh-web-all/package.json'))
for (const entry of entries) {
  const installed = JSON.parse(fs.readFileSync(runtimeRequire.resolve(entry.name + '/package.json'), 'utf8'))
  if (installed.dshWorkbench?.authorServicesRemoved !== 1 || installed.dshWorkbench?.documentationArchived !== 1) throw new Error('Customized package was not selected: ' + entry.name)
}
console.log('Verified: all ' + entries.length + ' custom workbench packages are installed.')

const appearancePatch = spawnSync(process.execPath, [fileURLToPath(new URL('./lib/patch-workbench-appearance.mjs', import.meta.url)), root], { stdio: 'inherit', windowsHide: true })
if (appearancePatch.error || appearancePatch.status !== 0) throw appearancePatch.error ?? new Error('Workbench appearance patch failed')

// Reapply the checked Models key control after official package installation.
const keyPatch = spawnSync(process.execPath, [fileURLToPath(new URL("./lib/patch-model-key.mjs", import.meta.url)), require.resolve("@deepseek-ai/dsh-client-ui-settings-models/client")], { stdio: "inherit", windowsHide: true })
if (keyPatch.error || keyPatch.status !== 0) throw keyPatch.error ?? new Error("Models key patch failed")

// Keep custom-provider editing aligned with the native provider settings card.
const layoutPatch = spawnSync(process.execPath, [fileURLToPath(new URL("./lib/patch-model-layout.mjs", import.meta.url)), require.resolve("@deepseek-ai/dsh-client-ui-settings-models/client")], { stdio: "inherit", windowsHide: true })
if (layoutPatch.error || layoutPatch.status !== 0) throw layoutPatch.error ?? new Error("Models layout patch failed")