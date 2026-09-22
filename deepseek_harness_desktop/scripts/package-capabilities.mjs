#!/usr/bin/env node
/** Produce an offline package with the official provider as a library, never a global bundle. */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
const [sourceArg, providerArg, outputArg] = process.argv.slice(2)
if (!sourceArg || !providerArg || !outputArg) throw Error('Usage: package-capabilities.mjs <built package> <official provider> <new output folder>')
const source = path.resolve(sourceArg), provider = path.resolve(providerArg), output = path.resolve(outputArg)
if (fs.existsSync(output)) throw Error('Output must be new; preserve previous releases')
const upstream = JSON.parse(fs.readFileSync(path.join(provider, 'package.json'), 'utf8'))
if (upstream.name !== '@wxg-prc-cpg/browser-skill-dsh-plugin' || upstream.version !== '0.3.0') throw Error('Expected official BrowserSkill 0.3.0')
const copy = (from, to) => {
  const stat = fs.lstatSync(from)
  if (stat.isSymbolicLink()) throw Error('Runtime package inputs must be ordinary files')
  if (stat.isDirectory()) { fs.mkdirSync(to, { recursive: true }); for (const entry of fs.readdirSync(from)) copy(path.join(from, entry), path.join(to, entry)) }
  else { fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(from, to) }
}
for (const file of ['package.json', 'cordis.patch.yml', 'lib']) copy(path.join(source, file), path.join(output, file))
const library = path.join(output, 'node_modules', upstream.name)
for (const file of ['package.json', 'cordis.patch.yml', 'lib', 'LICENSE']) copy(path.join(provider, file), path.join(library, file))
const manifest = JSON.parse(fs.readFileSync(path.join(output, 'package.json'), 'utf8'))
delete manifest.scripts; delete manifest.devDependencies
manifest.dshCapabilityProvider = { name: upstream.name, version: upstream.version, mode: 'scoped-library', source: 'https://github.com/Tencent/BrowserSkill' }
fs.writeFileSync(path.join(output, 'package.json'), JSON.stringify(manifest, null, 2) + '\n')
fs.writeFileSync(path.join(output, 'THIRD-PARTY-NOTICES.txt'), 'Includes Tencent/BrowserSkill DSH plugin 0.3.0 (MIT). Original LICENSE is retained in node_modules/@wxg-prc-cpg/browser-skill-dsh-plugin/LICENSE. The upstream global apply entry is not activated; tools are registered by the workbench role adapter.\n')
const digest = crypto.createHash('sha256').update(fs.readFileSync(path.join(library, 'lib/index.mjs'))).digest('hex')
console.log(JSON.stringify({ output, provider: upstream.name, version: upstream.version, providerEntrySha256: digest }))
