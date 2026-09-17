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
// A renamed source directory can leave the locally linked chat plugin dangling.
// Preserve working links (including immutable builds); repair only a missing target.
const chatName = '@linxin666/dsh-client-ui-plain-chat'
const chatSpec = manifest.dependencies?.[chatName]
if (typeof chatSpec === 'string' && chatSpec.startsWith('link:')
  && !fs.existsSync(path.resolve(profile, chatSpec.slice(5), 'package.json'))) {
  const chatDirectory = fileURLToPath(new URL('../packages/dsh-client-ui-plain-chat/', import.meta.url))
  const chatManifest = JSON.parse(fs.readFileSync(path.join(chatDirectory, 'package.json'), 'utf8'))
  if (chatManifest.name !== chatName || !fs.existsSync(path.join(chatDirectory, 'lib/client.js'))) throw new Error('Local chat build is missing')
  manifest.dependencies[chatName] = 'link:' + path.relative(profile, chatDirectory).split(path.sep).join('/')
}
const workspace = parseDocument(originalWorkspace ?? 'packages:\n  - .\nnodeLinker: hoisted\nautoInstallPeers: false\n')
if (workspace.errors.length) throw new Error('Cannot parse profile pnpm-workspace.yaml')
for (const entry of entries) {
  const spec = 'file:../../../' + entry.relative
  workspace.setIn(['overrides', entry.name], spec)
  if (entry.name === '@linxin666/dsh-web-all') manifest.dependencies[entry.name] = spec
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
