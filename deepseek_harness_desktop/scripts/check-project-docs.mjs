#!/usr/bin/env node
/** Validate the deployment tree without requiring the archived upstream manuals. */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('..', import.meta.url))
const errors = []
for (const name of ['.agents', '.github', 'docs', 'market']) {
  if (fs.existsSync(path.join(root, name))) errors.push('Archived directory remains: ' + name)
}
if (!fs.existsSync(path.join(root, 'LICENSE'))) errors.push('Project LICENSE is missing')
function inspect(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'lib', 'dist'].includes(entry.name) || entry.isSymbolicLink()) continue
    const file = path.join(dir, entry.name)
    if (entry.isDirectory()) { inspect(file); continue }
    const relative = path.relative(root, file)
    if (/^(?:README(?:\..*)?|AGENTS(?:\..*)?|CONTRIBUTING\.md|ISSUE_TRIAGE\.md|PR_TRIAGE\.md)$/i.test(entry.name)) errors.push('Upstream development document remains: ' + relative)
    if (entry.name !== 'package.json') continue
    const manifest = JSON.parse(fs.readFileSync(file, 'utf8'))
    for (const item of manifest.files ?? []) {
      if (/(?:^|\/)(?:README(?:\.[^/]*)?|AGENTS(?:\.[^/]*)?|docs)(?:\/|$)/i.test(item)) errors.push(relative + ': obsolete packaging entry ' + item)
    }
    for (const [name, command] of Object.entries(manifest.scripts ?? {})) {
      for (const match of command.matchAll(/\bnode\s+(scripts\/[\w./-]+)/g)) {
        if (!fs.existsSync(path.join(dir, match[1]))) errors.push(relative + ': missing script for ' + name + ': ' + match[1])
      }
    }
  }
}
inspect(root)
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1 }
else console.log('Project documentation and packaging references passed; archived development material is absent.')
