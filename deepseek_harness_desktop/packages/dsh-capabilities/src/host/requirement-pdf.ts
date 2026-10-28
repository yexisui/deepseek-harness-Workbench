import {importPdfAsDocx} from './requirement-pdf-import.ts'
import {spawn} from 'node:child_process'
import {mkdtemp,writeFile,readFile,rm,mkdir} from 'node:fs/promises'
import {join,resolve,relative} from 'node:path'
import {tmpdir} from 'node:os'
import {createHash} from 'node:crypto'
import {InputError} from '../core/validation.ts'

// Reuse the installed Word renderer only for PDF output; import uses the bundled parser.
const script=String.raw`param([string]$Source,[string]$Target,[switch]$Recover)
$ErrorActionPreference='Stop'
$directory=$PSScriptRoot
function Stop-Conversion {
 $file=Join-Path $directory 'recovery.json'
 if(!(Test-Path -LiteralPath $file)){return}
 $r=Get-Content -LiteralPath $file -Raw -Encoding UTF8 | ConvertFrom-Json
 if($r.owned){$p=Get-Process -Id $r.wordPid -ErrorAction SilentlyContinue;if($p -and $p.ProcessName -eq 'WINWORD' -and $p.StartTime.ToUniversalTime().ToString('o') -eq $r.started){Stop-Process -Id $r.wordPid -Force}}
}
if($Recover){Stop-Conversion;exit}
$word=$null
$doc=$null
try {
 $existing=@(Get-Process WINWORD -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
 $word=New-Object -ComObject Word.Application
 $word.Visible=$false
 $word.DisplayAlerts=0
 $word.AutomationSecurity=3
 $created=@(Get-Process WINWORD -ErrorAction SilentlyContinue | Where-Object {$existing -notcontains $_.Id})
 $process=if($created.Count -eq 1){$created[0]}else{$null}
 $record=@{wordPid=if($process){$process.Id}else{0};owned=($null -ne $process);started=if($process){$process.StartTime.ToUniversalTime().ToString('o')}else{''}}
 $record | ConvertTo-Json -Compress | Set-Content -LiteralPath (Join-Path $directory 'recovery.json') -Encoding UTF8
 $doc=$word.Documents.Open($Source,$false,$true,$false,'','')
 $doc.Repaginate()
 foreach($field in $doc.Fields){if($field.Type -in @(26,33,66)){[void]$field.Update()}}
 foreach($section in $doc.Sections){foreach($header in $section.Headers){foreach($field in $header.Range.Fields){if($field.Type -in @(26,33,66)){[void]$field.Update()}}};foreach($footer in $section.Footers){foreach($field in $footer.Range.Fields){if($field.Type -in @(26,33,66)){[void]$field.Update()}}}}
 $doc.ExportAsFixedFormat($Target,17)
} catch { $_.Exception.Message | Set-Content -LiteralPath (Join-Path $directory 'error.txt') -Encoding UTF8;exit 1 }
finally {
 if($null -ne $doc){try{$doc.Close(0)}catch{};[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($doc)}
 if($null -ne $word){try{$word.Quit()}catch{};[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($word)}
 Stop-Conversion
}
`
function run(exe:string,args:string[],timeout:number):Promise<void>{return new Promise((resolve,reject)=>{
 const child=spawn(exe,args,{windowsHide:true,stdio:'ignore'})
 const timer=setTimeout(()=>{child.kill();reject(Object.assign(new Error('Conversion timed out'),{killed:true}))},timeout)
 child.once('error',e=>{clearTimeout(timer);reject(e)})
 child.once('exit',code=>{clearTimeout(timer);code===0?resolve():reject(new Error('Conversion exited with '+code))})
})}
export function validatePdf(bytes:Buffer){
 if(bytes.length>40*1024*1024)throw new InputError('PDF文件超过40 MB',413)
 if(!bytes.subarray(0,1024).includes(Buffer.from('%PDF-')))throw new InputError('无法读取PDF，请选择有效的PDF文件')
}
let tail:Promise<unknown>=Promise.resolve()
/** Keep Word conversions sequential; never attach to or close the user's open document. */
export function convertRequirementDocument(bytes:Buffer,from:'pdf'|'docx',to:'pdf'|'docx'):Promise<Buffer>{
 if(from==='pdf'){validatePdf(bytes);return importPdfAsDocx(bytes)}
 const next=tail.then(async()=>{
  if(process.platform!=='win32')throw new InputError('导出PDF需要本机Microsoft Word；可先导出Word文件',503)
  const directory=await mkdtemp(join(tmpdir(),'dsh-requirement-convert-'))
  try{
   const input=join(directory,'input.'+from),output=join(directory,'output.'+to),worker=join(directory,'convert.ps1')
   await writeFile(input,bytes);await writeFile(worker,'\uFEFF'+script,'utf8')
   const exe=join(process.env.SystemRoot||'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe')
   try {await run(exe,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',worker,'-Source',input,'-Target',output],120000)}
   catch(e){const error=new InputError((e as {killed?:boolean}).killed?'文档转换超时，原内容保留；可先导出Word，稍后重试':'PDF导出未完成，请确认本机Microsoft Word已安装且可正常使用；当前文档保留，可先导出Word',503);error.cause=await readFile(join(directory,'error.txt'),'utf8').catch(()=>String(e));throw error}
   const result=await readFile(output);if(to==='pdf')validatePdf(result);if(!result.length)throw new InputError('转换结果为空，原内容保留');return result
  }finally{
   const exe=join(process.env.SystemRoot||'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe')
   await run(exe,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',join(directory,'convert.ps1'),'-Recover'],15000).catch(()=>{})
   const target=resolve(directory),base=resolve(tmpdir()),rel=relative(base,target)
   if(!rel.startsWith('..')&&rel.startsWith('dsh-requirement-convert-'))await rm(target,{recursive:true,force:true}).catch(()=>{})
  }
 });tail=next.catch(()=>{});return next
}
export async function storePdf(root:string,bytes:Buffer){validatePdf(bytes);const id=createHash('sha256').update(bytes).digest('hex');await mkdir(join(root,'_pdf'),{recursive:true});await writeFile(join(root,'_pdf',id+'.pdf'),bytes);return id}
export async function readPdfAsset(root:string,id:string){if(!/^[a-f0-9]{64}$/.test(id))throw new InputError('PDF资源无效');return readFile(join(root,'_pdf',id+'.pdf'))}
