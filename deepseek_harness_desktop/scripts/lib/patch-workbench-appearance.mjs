#!/usr/bin/env node
/** Apply the initial HTML presentation after install, before plugins can load. */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export function patchFrontendHtml(html) {
  return html.replace(/<title>DeepSeek Harness<\/title>/, '<title>工作台</title>')
    .replace(/<link\b[^>]*\brel=["'](?:shortcut )?icon["'][^>]*>/g,
      '<link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=" />')
}

export function patchWorkbenchAppearance(root) {
  let patched = 0
  for (const location of ['runtime/node_modules', 'dsh-data/profiles/web/node_modules']) {
    const file = path.join(root, location, '@deepseek-ai/dsh-web-frontend/dist/index.html')
    if (fs.existsSync(file)) {
      const before = fs.readFileSync(file, 'utf8')
      const after = patchFrontendHtml(before)
      if (after !== before) { fs.writeFileSync(file, after); patched++ }
    }
    for (const relative of ['@deepseek-ai/dsh-client-ui-settings-models/lib/client.js', 'dsh-better-sidebar/lib/client.js', 'dsh-better-sidebar/lib/client-registry.js']) {
      const client = path.join(root, location, relative)
      if (!fs.existsSync(client)) continue
      const before = fs.readFileSync(client, 'utf8')
      const after = before.replace(/(welcomeBody:\s*")((?:[^"\\]|\\.)*)(")/g, (_all, start, body, end) =>
        start + body.replaceAll('DeepSeek Harness', /[\u3400-\u9fff]/.test(body) ? '工作台' : 'Workbench').replaceAll('Harness', /[\u3400-\u9fff]/.test(body) ? '工作台' : 'Workbench').replaceAll('DSH 插件生态', '插件生态') + end)
        .replaceAll('title: "DeepSeek Harness Desktop"', 'title: "桌面工作台"')
      if (after !== before) { fs.writeFileSync(client, after); patched++ }
    }
  }
  return patched
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv[2]) throw new Error('Usage: patch-workbench-appearance.mjs <workbench-root>')
  console.log('Initial web presentation updated: ' + patchWorkbenchAppearance(path.resolve(process.argv[2])) + ' frontend copies')
}
