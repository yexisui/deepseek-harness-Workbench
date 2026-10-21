import type { ServerResponse } from 'node:http'
import { flowchartArtifact } from './flowchart-artifact.ts'
import { flowchartViewer } from './flowchart-viewer.ts'
import { randomBytes } from 'node:crypto'
import { InputError } from '../core/validation.ts'
import type { PackageRunner } from './package-runner.ts'


type XlsxArtifact = {kind:'xlsx';fileName:string;base64:string;sheets:unknown[];formulaCount:number;recalculation:string}
function xlsx(output:unknown):output is XlsxArtifact {
  if(!output||typeof output!=='object'||(output as Record<string,unknown>).kind!=='xlsx')return false
  const value=output as XlsxArtifact
  if(typeof value.fileName!=='string'||value.fileName.length>150||!value.fileName.toLowerCase().endsWith('.xlsx')||/[\\/:*?"<>|\r\n]/.test(value.fileName)||typeof value.base64!=='string'||value.base64.length>466668||!Array.isArray(value.sheets)||!Number.isSafeInteger(value.formulaCount)||value.formulaCount<0)throw new InputError('Excel结果格式无效')
  const bytes=Buffer.from(value.base64,'base64')
  if(bytes.toString('base64')!==value.base64||bytes.length<4||bytes.length>350000||bytes.readUInt32LE(0)!==0x04034b50)throw new InputError('Excel文件内容无效')
  return true
}

function diagram(output: unknown): output is {kind:'flowchart';svg:string;document:Record<string,unknown>} {
  if(!output||typeof output!=='object')return false
  const v=output as Record<string,unknown>
  return v.kind==='flowchart'&&typeof v.svg==='string'&&v.svg.startsWith('<svg ')&&!!v.document&&typeof v.document==='object'
}
/** Keep large SVG bytes out of the model context; immutable job IDs preserve earlier chat images. */
export function packageResult(id:string,output:unknown,port:number):unknown {
  if(xlsx(output)) {
    if(!Number.isInteger(port)||port<1||port>65535)throw new InputError('Excel下载地址不可用')
    return {documentId:id,fileName:output.fileName,sheets:output.sheets,formulaCount:output.formulaCount,recalculation:output.recalculation,downloadUrl:`http://127.0.0.1:${port}/api/capabilities/packages/artifact/${encodeURIComponent(id)}/download.xlsx`,message:'请使用返回的downloadUrl提供Excel下载链接。公式已保留，打开后重算；文件生成成功不代表业务估算已审核。'}
  }
  if(!diagram(output))return output
  // Chat treats slash-prefixed Markdown destinations as workspace files.
  // Use the actual local listener; never place authentication tokens in URLs.
  if(!Number.isInteger(port)||port<1||port>65535)throw new InputError('流程图查看地址不可用')
  const root=`http://127.0.0.1:${port}/api/capabilities/packages/artifact/`+encodeURIComponent(id)
  return {documentId:id,document:output.document,previewUrl:root+'/image.svg',viewUrl:root+'/view',downloadUrl:root+'/download.svg',message:'生成成功。请在回复中用 Markdown 图片展示 previewUrl，并提供 viewUrl（查看大图、下载 PNG）和 downloadUrl（下载 SVG）。后续修改传 documentId；不要让用户编辑代码。'}
}
/** The parent router performs the same authentication and origin checks as every capability request. */
export function servePackageArtifact(runner:PackageRunner,route:string,res:ServerResponse,style?:string|null) {
  const match=/^([a-f0-9-]{36})\/(image\.svg|download\.svg|download\.xlsx|view)$/.exec(route)
  if(!match)throw new InputError('图像不存在',404)
  const job=runner.get(match[1]!),output=job.output
  if(match[2]==='download.xlsx') {
    if(job.status!=='done'||!xlsx(output))throw new InputError('Excel文件尚未生成',404)
    const bytes=Buffer.from(output.base64,'base64')
    res.writeHead(200,{'content-type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','content-length':bytes.length,'cache-control':'no-store','x-content-type-options':'nosniff','content-disposition':`attachment; filename="workbook.xlsx"; filename*=UTF-8''${encodeURIComponent(output.fileName)}`})
    res.end(bytes);return
  }
  if(job.status!=='done'||!diagram(output))throw new InputError('图像尚未生成',404)
  const title=String(output.document.title??'流程图'),root='/api/capabilities/packages/artifact/'+match[1]
  if(match[2]!=='view') {
    const chart=flowchartArtifact(runner,match[1]!,style)
    const bytes=Buffer.from(style||job.presentation?chart.svg():output.svg,'utf8')
    res.writeHead(200,{'content-type':'image/svg+xml; charset=utf-8','content-length':bytes.length,'cache-control':'no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; sandbox",...(match[2]==='download.svg'?{'content-disposition':`attachment; filename="flowchart.svg"; filename*=UTF-8''${encodeURIComponent(title.replace(/[\\/:*?"<>|\r\n]/g,'_'))}.svg`}:{})})
    res.end(bytes);return
  }
  const nonce=randomBytes(18).toString('base64'),escaped=title.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))
  res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','content-security-policy':`default-src 'none'; img-src 'self' blob:; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'; connect-src 'self'; base-uri 'none'; frame-ancestors 'self'`})
  res.end(flowchartViewer(root,escaped,nonce))
}
