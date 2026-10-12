import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { InputError } from '../core/validation.ts'
import { json } from './http.ts'
const definitions=[['SimSun','simsun.ttc',400],['Microsoft YaHei','msyh.ttc',400],['Microsoft YaHei','msyhbd.ttc',700],['SimHei','simhei.ttf',400],['Arial','arial.ttf',400],['Arial','arialbd.ttf',700],['Times New Roman','times.ttf',400],['Times New Roman','timesbd.ttf',700],['Calibri','calibri.ttf',400],['Calibri','calibrib.ttf',700]] as const
const assets=new Set(['index.html','editor.js','editor.css','harfbuzz.wasm'])
export async function documentAssets(req:IncomingMessage,res:ServerResponse,route:string){
 const base='/api/capabilities/documents/editor/'
 if(!route.startsWith(base))return false
 if(req.method!=='GET')throw new InputError('此资源只支持读取',405)
 const name=route.slice(base.length)
 if(name==='fonts.json'){
  const rows=[]
  for(let index=0;index<definitions.length;index++){
   const [family,file,weight]=definitions[index]!
   if(await stat(join(process.env.WINDIR||'C:/Windows','Fonts',file)).then(s=>s.isFile(),()=>false))rows.push({id:'system-'+index,request:{family,weight,style:'normal'},faceIndex:0,url:'font/'+index})
  }
  if(!rows.length)throw new InputError('未找到本机字体，请安装宋体或微软雅黑后重启。',503)
  json(res,200,rows);return true
 }
 if(/^font\/\d+$/.test(name)){
  const face=definitions[Number(name.slice(5))];if(!face)throw new InputError('字体不存在',404)
  res.setHeader('Content-Type','font/ttf');res.setHeader('Cache-Control','private, max-age=86400');res.end(await readFile(join(process.env.WINDIR||'C:/Windows','Fonts',face[1])));return true
 }
 if(!assets.has(name))throw new InputError('编辑资源不存在',404)
 const data=await readFile(new URL('./document-editor/'+name,import.meta.url))
 res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.wasm')?'application/wasm':'text/html; charset=utf-8')
 res.setHeader('Cache-Control','no-cache');res.setHeader('X-Content-Type-Options','nosniff')
 if(name==='index.html')res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' blob:; connect-src 'self'; frame-ancestors 'self'; object-src 'none'")
 res.end(data);return true
}
