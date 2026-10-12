import { build } from 'esbuild'
import { mkdir, writeFile, copyFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const here=dirname(fileURLToPath(import.meta.url)),out=resolve(here,'../lib/document-editor')
const require=createRequire(import.meta.url)
await mkdir(out,{recursive:true})
await build({entryPoints:[join(here,'entry.tsx')],bundle:true,outfile:join(out,'editor.js'),format:'esm',platform:'browser',target:'chrome130',minify:true,define:{'process.env.NODE_ENV':'"production"'},loader:{'.wasm':'file'}})
await copyFile(require.resolve('@docx-editor.dev/core/harfbuzz.wasm'),join(out,'harfbuzz.wasm'))
await writeFile(join(out,'index.html'),'<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="editor.css"><title>文档编辑</title></head><body><div id="root"></div><script type="module" src="editor.js"></script></body></html>')
console.log('Built local DOCX editor assets.')
