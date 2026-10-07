import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export function patchModelKey(source, component) {
  if (source.includes('function WorkbenchModelKeyInput(')) return source
  const marker = '\t\tlet react = require("react");'
  if (!source.includes(marker)) throw Error('Models React anchor changed')
  const regex = /\(0, react_jsx_runtime\.jsx\)\("input", \{(\s*className: ModelsSection_module_css_default\["input"\],\s*type: "password",[\s\S]*?\n\s*\})\),/g
  let count = 0
  const updated = source.replace(regex, (match, fields) => {
    count++
    const stored = fields.includes('placeholder: keyPlaceholder')
    return '(0, react_jsx_runtime.jsx)(WorkbenchModelKeyInput, {' + (stored ? '\n savedProvider: props.provider, savedKey: keyState?.configured === true,' : '') + fields + '),'
  })
  if (count !== 2) throw Error('Expected two Models key inputs; got ' + count)
  return updated.replace(marker, marker + '\n' + component)
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const target = path.resolve(process.argv[2])
  const source = fs.readFileSync(target, 'utf8')
  const component = fs.readFileSync(new URL('./ModelKeyInput.js', import.meta.url), 'utf8')
  const result = patchModelKey(source, component)
  if (source !== result) {
    const backup = target + '.before-model-key'
    if (!fs.existsSync(backup)) fs.copyFileSync(target, backup)
    fs.writeFileSync(target, result)
  }
  console.log('Models eye control verified: ' + target)
}
