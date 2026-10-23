/** Keep upstream menus limited to rename, fork and archive. Safe to run repeatedly. */
import {readFileSync,writeFileSync} from 'node:fs'
const path=process.argv[2]
if(!path)throw Error('Pass the ui-workspace client.js path')
let source=readFileSync(path,'utf8')
source=source.replace(', { id: "remove", label: t("menu.removeSession"), icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconTrashOutline16, {}) }','')
source=source.replace(' if (id === "remove") window.dispatchEvent(new CustomEvent("dsh-plain-chat:remove-session", { detail: { id: node.id, title } }));','')
source=source.replace('"menu.archiveSession": "归档会话"','"menu.archiveSession": "归档"')
writeFileSync(path,source)
console.log('Native menu: rename, fork, archive')
