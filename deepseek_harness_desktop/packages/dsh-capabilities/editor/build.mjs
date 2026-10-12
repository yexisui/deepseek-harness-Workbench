import { build } from 'esbuild'
import { mkdir, writeFile, copyFile, readFile, readdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const here=dirname(fileURLToPath(import.meta.url)),out=resolve(here,'../lib/document-editor')
const require=createRequire(import.meta.url)
await mkdir(out,{recursive:true})
const result=await build({entryPoints:[join(here,'entry.tsx')],bundle:true,outfile:join(out,'editor.js'),format:'esm',platform:'browser',target:'chrome130',minify:true,metafile:true,define:{'process.env.NODE_ENV':'"production"'},loader:{'.wasm':'file'}})
await copyFile(require.resolve('@docx-editor.dev/core/harfbuzz.wasm'),join(out,'harfbuzz.wasm'))
// Preserve notices of every bundled dependency, including the core's prebundled code/WASM.
const packages=new Map()
for(const input of Object.keys(result.metafile.inputs)){
 if(!input.replaceAll('\\','/').includes('/node_modules/')&&!input.startsWith('node_modules/'))continue
 let current=dirname(resolve(input))
 while(current!==dirname(current)){
  try{const pkg=JSON.parse(await readFile(join(current,'package.json'),'utf8'));if(pkg.name&&pkg.version){packages.set(pkg.name,{path:current,pkg});break}}catch{}
  current=dirname(current)
 }
}
const notices=['Third-party notices for the local document editor. Bundled/minified copies; no proprietary modules or font files are redistributed.']
for(const [name,{path,pkg}] of [...packages].sort(([a],[b])=>a.localeCompare(b))){
 const files=(await readdir(path,{withFileTypes:true})).filter(file=>file.isFile()&&/^(license|copying|notice|third_party_notices)/i.test(file.name)).map(file=>file.name)
 const extra=await readdir(join(path,'licenses')).catch(()=>[])
 notices.push(`\n## ${name} ${pkg.version} (${pkg.license||'see license'})`)
 if(!files.length&&!extra.length){
  const omitted={'@nodable/entities':['nodable-entities-MIT.txt','https://github.com/nodable/val-parsers/blob/master/LICENSE'],'react-remove-scroll-bar':['react-remove-scroll-bar-MIT.txt','https://github.com/theKashey/react-remove-scroll-bar/blob/master/LICENSE']}[name]
  if(!omitted)throw Error('Missing bundled license: '+name)
  notices.push('Source: '+omitted[1]+'\n'+await readFile(join(here,'licenses',omitted[0]),'utf8'))
 }
 for(const file of [...files,...extra.map(name=>'licenses/'+name)])notices.push(`\n### ${file}\n`+await readFile(join(path,file),'utf8'))
}
await writeFile(join(out,'THIRD_PARTY_NOTICES.txt'),notices.join('\n'))
await writeFile(join(out,'index.html'),'<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="editor.css"><title>文档编辑</title></head><body><div id="root"></div><script type="module" src="editor.js"></script></body></html>')
console.log('Built local DOCX editor assets.')
