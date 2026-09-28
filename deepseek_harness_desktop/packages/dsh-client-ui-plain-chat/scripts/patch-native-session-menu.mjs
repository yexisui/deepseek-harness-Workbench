/** Keep the installed upstream WorkspaceBrowser menu aligned with plain-chat's removal dialog.
 * Usage: node scripts/patch-native-session-menu.mjs <absolute path to ui-workspace/lib/client.js>
 * The installed package has no shipped source, so this exact-version patch is intentionally narrow.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const path = process.argv[2]
if (!path) throw new Error('Pass the ui-workspace client.js path')
const source = readFileSync(path, 'utf8')
if (source.includes('dsh-plain-chat:remove-session')) {
  if (!source.includes('"menu.removeSession"')) throw new Error('Native menu patch is incomplete')
  process.stdout.write('Native session menu already patched\n')
  process.exit(0)
}
const start = source.indexOf('function SessionNodeItem(')
const end = source.indexOf('//#endregion', start)
if (start < 0 || end < 0) throw new Error('Expected ui-workspace SessionNodeItem was not found')
let part = source.slice(start, end)
const arrayEnd = /(\t{4}\{\r?\n\t{5}id: "archive",[\s\S]*?\t{4})\}(\r?\n\t{3}\];)/
if (!arrayEnd.test(part)) throw new Error('Expected native archive menu item was not found')
part = part.replace(arrayEnd, '$1}, { id: "remove", label: t("menu.removeSession"), icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconTrashOutline16, {}) }$2')
const archiveAction = 'if (id === "archive") onArchive(node.id);'
if (!part.includes(archiveAction)) throw new Error('Expected native archive action was not found')
part = part.replace(archiveAction, `${archiveAction} if (id === "remove") window.dispatchEvent(new CustomEvent("dsh-plain-chat:remove-session", { detail: { id: node.id, title } }));`)
let patched = source.slice(0, start) + part + source.slice(end)
for (const [existing, next] of [
  ['"menu.archiveSession": "归档会话",', '"menu.archiveSession": "归档会话", "menu.removeSession": "移除对话",'],
  ['"menu.archiveSession": "Archive session",', '"menu.archiveSession": "Archive session", "menu.removeSession": "Remove conversation",'],
]) {
  if (!patched.includes(existing)) throw new Error(`Expected locale entry was not found: ${existing}`)
  patched = patched.replace(existing, next)
}
if (patched.split('\n').length !== source.split('\n').length) throw new Error('Patch shifted source-map line numbers')
writeFileSync(path, patched)
process.stdout.write('Patched native session menu\n')
