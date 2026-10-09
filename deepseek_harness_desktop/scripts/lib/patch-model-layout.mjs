import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** Keep the native provider editor first; optional capability controls belong inside editing. */
export function patchModelLayout(source) {
  if (source.includes('workbench-provider-editor-first')) return source
  const pattern = /(^\t+renderSlot\("settings\.models\.provider-card", \{\r?\n\s*provider: row\.entry,\r?\n\s*configured: row\.configured,\r?\n\s*keyConfigured: keyConfiguredOf\(row\)\r?\n\s*\}, \{ entryKey: row\.entry\.settingsNs \}\)),\r?\n(\t+open \? renderProviderEditor\(\{[\s\S]*?\}\) : null)/gm
  let count = 0
  const result = source.replace(pattern, (_, slot, editor) => {
    count++
    return editor + ',\n\t\t\t\t\t\t\t\t\t/* workbench-provider-editor-first */\n\t\t\t\t\t\t\t\t\topen ? ' + slot.trimStart() + ' : null'
  })
  if (count !== 1) throw new Error('Provider editor anchor changed; no file was modified')
  return result
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const target = path.resolve(process.argv[2])
  const source = fs.readFileSync(target, 'utf8')
  const result = patchModelLayout(source)
  if (source !== result) fs.writeFileSync(target, result)
  console.log('Native provider editor layout applied')
}
