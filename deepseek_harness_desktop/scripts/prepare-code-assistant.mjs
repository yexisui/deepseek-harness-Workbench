import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'
const [rootArg, sourceArg] = process.argv.slice(2)
if (!rootArg || !sourceArg) throw new Error('Usage: prepare-code-assistant.mjs WORKBENCH_ROOT SOURCE_ROOT')
const root = fs.realpathSync(rootArg), source = fs.realpathSync(sourceArg)
const assets = path.join(root, 'runtime-dev/code-assistant-assets')
for (const [name, target] of [['engine', 'engine-runtime'], ['editor', 'editor-runtime']]) {
  const locks = path.join(source, 'packages/dsh-code-assistant/assets-lock', name)
  const lock = fs.readFileSync(path.join(locks, 'package-lock.json'))
  const hash = crypto.createHash('sha256').update(lock).digest('hex')
  const directory = path.join(assets, target), marker = path.join(directory, '.workbench-assets-lock')
  if (fs.existsSync(path.join(directory, 'node_modules')) && fs.existsSync(marker) && fs.readFileSync(marker, 'utf8') === hash) continue
  fs.mkdirSync(directory, { recursive: true })
  for (const file of ['package.json', 'package-lock.json']) fs.copyFileSync(path.join(locks, file), path.join(directory, file))
  const npm = path.join(root, 'runtime-node/node_modules/npm/bin/npm-cli.js')
  const result = spawnSync(process.execPath, [npm, 'ci', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: directory, windowsHide: true, stdio: 'inherit' })
  if (result.error || result.status !== 0) throw result.error ?? new Error('Failed to prepare ' + name + ' assets')
  fs.writeFileSync(marker, hash)
}
console.log('Pinned code-assistant assets ready')
