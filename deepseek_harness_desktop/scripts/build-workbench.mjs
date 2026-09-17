#!/usr/bin/env node
/** Build custom Workshop packages outside the source tree for the portable workbench. */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'

const [rootArg, sourceArg] = process.argv.slice(2)
if (!rootArg || !sourceArg) throw new Error('Usage: build-workbench.mjs <workbench> <source>')
const root = path.resolve(rootArg)
const source = path.resolve(sourceArg)
const dev = path.join(root, 'runtime-dev')
const aggregateDependencies = JSON.parse(fs.readFileSync(path.join(source, 'packages/dsh-web-all/package.json'), 'utf8')).dependencies
const packages = fs.readdirSync(path.join(source, 'packages')).filter(name =>
  name !== 'skins' && name !== 'dsh-client-ui-plain-chat' && name !== 'dsh-web-all'
  && fs.existsSync(path.join(source, 'packages', name, 'tsdown.config.ts'))
  && Object.hasOwn(aggregateDependencies, JSON.parse(fs.readFileSync(path.join(source, 'packages', name, 'package.json'), 'utf8')).name),
).sort().concat(['skins/skin-center', 'dsh-web-all'])
const excluded = new Set(['node_modules', '.git', '.agents', 'lib', 'dist', 'tests', 'test'])
const inputs = []
function collect(relative) {
  const absolute = path.join(source, relative)
  const stat = fs.lstatSync(absolute)
  if (stat.isSymbolicLink()) throw new Error('Build input cannot be a link: ' + relative)
  if (stat.isDirectory()) {
    for (const name of fs.readdirSync(absolute).sort()) if (!excluded.has(name)) collect(path.join(relative, name))
  } else if (stat.isFile()) inputs.push(relative)
}
collect('shared'); collect('packages')
inputs.push('scripts/build-workbench.mjs')
const digest = crypto.createHash('sha256')
for (const file of inputs) digest.update(file).update(fs.readFileSync(path.join(source, file)))
const devLock = path.join(dev, 'package-lock.json')
if (fs.existsSync(devLock)) digest.update(fs.readFileSync(devLock))
const builds = path.join(dev, 'workshop-builds')
fs.mkdirSync(builds, { recursive: true })
// Each successful installation keeps its immutable build; a failed build cannot replace it.
const mirror = fs.mkdtempSync(path.join(builds, digest.digest('hex').slice(0, 16) + '-'))
for (const file of inputs) {
  const target = path.join(mirror, file)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.copyFileSync(path.join(source, file), target)
}
const dependencies = path.join(mirror, 'node_modules')
fs.mkdirSync(dependencies)
function linkPackage(parent, name) {
  const target = path.join(dependencies, name)
  if (fs.existsSync(target)) return
  const original = path.join(parent, name)
  try {
    if (!fs.statSync(original).isDirectory() || !fs.existsSync(path.join(original, 'package.json'))) return
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.symlinkSync(fs.realpathSync(original), target, process.platform === 'win32' ? 'junction' : 'dir')
  } catch (error) { if (error.code !== 'ENOENT') throw error }
}
// Reuse the pinned installed SDK/build tools without adding an environment to source.
for (const parent of [
  path.join(dev, 'node_modules'),
  path.join(root, 'runtime/node_modules'),
  path.join(root, 'dsh-data/profiles/web/node_modules'),
  path.join(root, 'dsh-data/profiles/web/node_modules/.pnpm/node_modules'),
]) {
  if (!fs.existsSync(parent)) continue
  for (const name of fs.readdirSync(parent)) {
    if (name.startsWith('@')) {
      for (const child of fs.readdirSync(path.join(parent, name))) linkPackage(parent, name + '/' + child)
    } else if (!name.startsWith('.')) linkPackage(parent, name)
  }
}
const tool = path.join(dependencies, 'tsdown/dist/run.mjs')
if (!fs.existsSync(tool)) throw new Error('Development dependencies are missing; run Deploy first.')
const entries = []
function copyTree(input, output) {
  if (fs.lstatSync(input).isSymbolicLink()) throw new Error('Runtime files cannot be links: ' + input)
  if (fs.statSync(input).isDirectory()) {
    fs.mkdirSync(output, { recursive: true })
    for (const name of fs.readdirSync(input)) copyTree(path.join(input, name), path.join(output, name))
  } else {
    fs.mkdirSync(path.dirname(output), { recursive: true })
    fs.copyFileSync(input, output)
  }
}
for (const relative of packages) {
  const directory = path.join(mirror, 'packages', relative)
  const result = spawnSync(process.execPath, [tool], { cwd: directory, stdio: 'inherit', windowsHide: true })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error('Build failed: ' + relative)
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'))
  const packed = path.join(mirror, 'runtime-packages', relative.replaceAll('/', '-'))
  fs.mkdirSync(packed, { recursive: true })
  // Several feature packages whitelist lib/**/*.js instead of the lib directory.
  // The build output is trusted here; copy lib once so every entrypoint is staged.
  const runtimeFiles = new Set((manifest.files ?? ['lib', 'cordis.patch.yml'])
    .map(file => file.startsWith('lib/') ? 'lib' : file))
  for (const file of runtimeFiles) {
    const input = path.join(directory, file)
    if (fs.existsSync(input)) copyTree(input, path.join(packed, file))
  }
  const required = ['lib/index.js', 'cordis.patch.yml']
  if (fs.existsSync(path.join(directory, 'src/client/index.ts'))) required.push('lib/client.js')
  for (const file of required) {
    if (!fs.existsSync(path.join(packed, file))) throw new Error('Missing runtime file: ' + relative + '/' + file)
  }
  if (!fs.existsSync(path.join(packed, 'LICENSE'))) fs.copyFileSync(path.join(source, 'LICENSE'), path.join(packed, 'LICENSE'))
  // Runtime snapshots behave like published packages; they never run source prepare scripts.
  delete manifest.scripts
  delete manifest.devDependencies
  manifest.dshWorkbench = { localWorkshop: 1, authorServicesRemoved: 1, documentationArchived: 1 }
  for (const [name, version] of Object.entries(manifest.dependencies ?? {})) {
    if (version.startsWith('workspace:')) manifest.dependencies[name] = '0.3.23'
  }
  fs.writeFileSync(path.join(packed, 'package.json'), JSON.stringify(manifest, null, 2) + '\n')
  entries.push({ name: manifest.name, relative: path.relative(root, packed).split(path.sep).join('/') })
}
fs.writeFileSync(path.join(dev, 'workshop-build-result.json'), JSON.stringify({ entries }, null, 2))
console.log('Workshop build prepared: ' + entries.length + ' local packages')
