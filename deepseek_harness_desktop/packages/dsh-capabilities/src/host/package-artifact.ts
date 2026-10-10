import type { ServerResponse } from 'node:http'
import { randomBytes } from 'node:crypto'
import { InputError } from '../core/validation.ts'
import type { PackageRunner } from './package-runner.ts'

function diagram(output: unknown): output is {kind:'flowchart';svg:string;document:Record<string,unknown>} {
  if(!output||typeof output!=='object')return false
  const v=output as Record<string,unknown>
  return v.kind==='flowchart'&&typeof v.svg==='string'&&v.svg.startsWith('<svg ')&&!!v.document&&typeof v.document==='object'
}
/** Keep large SVG bytes out of the model context; immutable job IDs preserve earlier chat images. */
export function packageResult(id:string,output:unknown,port:number):unknown {
  if(!diagram(output))return output
  // Chat treats slash-prefixed Markdown destinations as workspace files.
  // Use the actual local listener; never place authentication tokens in URLs.
  if(!Number.isInteger(port)||port<1||port>65535)throw new InputError('流程图查看地址不可用')
  const root=`http://127.0.0.1:${port}/api/capabilities/packages/artifact/`+encodeURIComponent(id)
  return {documentId:id,document:output.document,previewUrl:root+'/image.svg',viewUrl:root+'/view',downloadUrl:root+'/download.svg',message:'生成成功。请在回复中用 Markdown 图片展示 previewUrl，并提供 viewUrl（查看大图、下载 PNG）和 downloadUrl（下载 SVG）。后续修改传 documentId；不要让用户编辑代码。'}
}
/** The parent router performs the same authentication and origin checks as every capability request. */
export function servePackageArtifact(runner:PackageRunner,route:string,res:ServerResponse) {
  const match=/^([a-f0-9-]{36})\/(image\.svg|download\.svg|view)$/.exec(route)
  if(!match)throw new InputError('图像不存在',404)
  const job=runner.get(match[1]!),output=job.output
  if(job.status!=='done'||!diagram(output))throw new InputError('图像尚未生成',404)
  const title=String(output.document.title??'流程图'),root='/api/capabilities/packages/artifact/'+match[1]
  if(match[2]!=='view') {
    const bytes=Buffer.from(output.svg,'utf8')
    res.writeHead(200,{'content-type':'image/svg+xml; charset=utf-8','content-length':bytes.length,'cache-control':'no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; sandbox",...(match[2]==='download.svg'?{'content-disposition':`attachment; filename="flowchart.svg"; filename*=UTF-8''${encodeURIComponent(title.replace(/[\\/:*?"<>|\r\n]/g,'_'))}.svg`}:{})})
    res.end(bytes);return
  }
  const nonce=randomBytes(18).toString('base64'),escaped=title.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))
  res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','content-security-policy':`default-src 'none'; img-src 'self' blob:; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'; connect-src 'self'; base-uri 'none'; frame-ancestors 'self'`})
  res.end(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escaped}</title><style nonce="${nonce}">*{box-sizing:border-box}body{margin:0;background:#edf2f7;color:#18324e;font:16px "Microsoft YaHei",sans-serif}header{position:sticky;top:0;padding:16px 24px;background:white;display:flex;align-items:center;gap:12px;flex-wrap:wrap;border-bottom:1px solid #d9e2ee}h1{font-size:18px;margin:0;flex:1}button,a{padding:9px 16px;border:1px solid #c6d7e9;border-radius:8px;background:#fff;color:#17539b;text-decoration:none;cursor:pointer;font:inherit}main{padding:24px;overflow:auto}img{display:block;max-width:100%;height:auto;margin:auto;background:white;box-shadow:0 4px 24px #18324e12}#status{font-size:14px}</style><header><h1>${escaped}</h1><button id="size">原始大小</button><button id="png">下载 PNG</button><a href="${root}/download.svg" download>下载 SVG</a><span id="status" role="status"></span></header><main><img id="diagram" src="${root}/image.svg" alt="${escaped}"></main><script nonce="${nonce}">const img=document.getElementById('diagram'),status=document.getElementById('status');document.getElementById('size').onclick=function(){const full=img.style.maxWidth==='none';img.style.maxWidth=full?'100%':'none';this.textContent=full?'原始大小':'适应宽度'};document.getElementById('png').onclick=async function(){this.disabled=true;try{await img.decode();const scale=Math.min(2,16384/Math.max(img.naturalWidth,img.naturalHeight)),c=document.createElement('canvas');c.width=Math.round(img.naturalWidth*scale);c.height=Math.round(img.naturalHeight*scale);const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(img,0,0,c.width,c.height);const blob=await new Promise(r=>c.toBlob(r,'image/png'));if(!blob)throw Error();const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=document.title+'.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status.textContent='已生成 PNG'}catch(e){status.textContent='图片下载失败，请重试或下载 SVG'}finally{this.disabled=false}};</script></html>`)
}
