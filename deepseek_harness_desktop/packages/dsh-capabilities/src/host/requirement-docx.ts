import {createHash} from 'node:crypto'
import {createRequire} from 'node:module'
import {mkdir,readFile,writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import type {TemplateSlot,TemplateSource,TemplateWorkspace,TemplateVersion} from '../core/requirement-template.ts'
import {InputError} from '../core/validation.ts'
const require=createRequire(import.meta.url)
type ZipEntry={dir:boolean;_data?:{uncompressedSize?:number};asText():string;asNodeBuffer():Buffer}
type Zip={files:Record<string,ZipEntry>;file(name:string):ZipEntry|null;file(name:string,value:string):Zip;generate(options:unknown):Buffer}
const PizZip=require('pizzip') as new(bytes:Buffer)=>Zip
const decode=(s:string)=>s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi,(_m,key:string)=>key[0]==='#'?String.fromCodePoint(key[1]?.toLowerCase()==='x'?parseInt(key.slice(2),16):parseInt(key.slice(1),10)):({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[key.toLowerCase()]!))
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!))
type Span=TemplateSlot&{start:number;end:number;xml:string}

/** Preserve original XML byte ranges instead of round-tripping styles and package parts. */
function spans(xml:string,part:string):Span[]{
 if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw new InputError('此文档包含不支持的XML声明，请另存为普通DOCX')
 const found:Span[]=[],paragraphs:{start:number;index:number;table?:number;row?:number;cell?:number;nested:boolean}[]=[]
 let index=0,table=0,row=0,cell=0,tableDepth=0
 for(const match of xml.matchAll(/<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<[^>]*>/g)){
  const tag=match[0],at=match.index!,name=tag.match(/^<\/?([\w:.-]+)/)?.[1],closing=tag.startsWith('</'),self=tag.endsWith('/>')
  if(!name)continue
  if(name==='w:tbl'){if(closing)tableDepth--;else {tableDepth++;table++;row=0;cell=0}}
  if(name==='w:tr'&&!closing){row++;cell=0}if(name==='w:tc'&&!closing)cell++
  if(name!=='w:p')continue
  if(!closing){if(paragraphs.length)paragraphs[paragraphs.length-1]!.nested=true;paragraphs.push({start:at,index:index++,nested:false,...(tableDepth?{table,row,cell}:{})})}
  if(closing||self){const p=paragraphs.pop();if(!p)throw new InputError('Word段落结构不完整');const body=xml.slice(p.start,at+tag.length),text=[...body.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>|<w:(tab|br)\b[^>]*\/?\s*>/g)].map(m=>m[2]?(m[2]==='tab'?'\t':'\n'):decode(m[1]!)).join(''),style=body.match(/<w:pStyle\b[^>]*w:val="([^"]*)"/)?.[1]||'',image=/<w:(drawing|pict)\b/.test(body)
   const editable=!p.nested&&!/<w:(fldChar|instrText|fldSimple|object|ins|del)\b/.test(body)
   found.push({id:part+'#'+p.index,part,index:p.index,text,style,heading:!p.table&&(/heading|title|标题/i.test(style)||/^\d+(?:\.\d+)*[ 、]/.test(text)),image,editable,table:p.table,row:p.row,cell:p.cell,start:p.start,end:at+tag.length,xml:body})
  }
 }
 if(paragraphs.length)throw new InputError('Word段落结构不完整')
 return found.sort((a,b)=>a.start-b.start)
}
export function openDocx(bytes:Buffer):Zip{
 if(bytes.length>40*1024*1024)throw new InputError('Word文件超过40 MB',413)
 let zip:Zip;try{zip=new PizZip(bytes)}catch{throw new InputError('无法读取DOCX，请选择有效的Word文件')}
 if(!zip.file('word/document.xml'))throw new InputError('未找到Word正文')
 const entries=Object.values(zip.files);if(entries.length>5000||entries.reduce((n,e)=>n+(e._data?.uncompressedSize??0),0)>100*1024*1024)throw new InputError('解压后的文档过大，请精简图片后重试',413)
 return zip
}
export function inspectDocx(bytes:Buffer):TemplateSlot[]{
 const zip=openDocx(bytes),parts=Object.keys(zip.files).filter(n=>/^word\/(document|header\d+|footer\d+)\.xml$/.test(n)).sort((a,b)=>a==='word/document.xml'?-1:b==='word/document.xml'?1:a.localeCompare(b))
 const slots=parts.flatMap(part=>spans(zip.file(part)!.asText(),part).filter(p=>p.text.trim()||p.image).map(({start,end,xml,...slot})=>slot))
 if(!slots.length)throw new InputError('文档没有可读取的文字')
 if(slots.reduce((n,p)=>n+p.text.length,0)>180000||slots.length>4000)throw new InputError('文档超过180000字或4000个内容块，请按章节拆分')
 return slots
}
export async function storeDocx(root:string,bytes:Buffer){const asset=createHash('sha256').update(bytes).digest('hex');await mkdir(join(root,'_docx'),{recursive:true});try{await writeFile(join(root,'_docx',asset+'.docx'),bytes,{flag:'wx'})}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e}return asset}
export async function readAsset(root:string,asset:string){if(!/^[a-f0-9]{64}$/.test(asset))throw new InputError('文档资源无效');return readFile(join(root,'_docx',asset+'.docx'))}
function rewriteParagraph(p:Span,after:string){
 if(!p.editable)throw new InputError('这个段落含域、修订或嵌套内容，请在Word中处理')
 if(/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(after))throw new InputError('正文含无效控制字符')
 // A whole-paragraph rewrite adopts the first text run's formatting; original run/style definitions stay.
 const first=p.xml.match(/<w:t\b[^>]*>[\s\S]*?<\/w:t>/),escaped=escape(after).replace(/\r?\n/g,'</w:t><w:br/><w:t xml:space="preserve">')
 let body=p.xml
 if(p.image)body=body.replace(/<w:drawing\b[\s\S]*?<\/w:drawing>|<w:pict\b[\s\S]*?<\/w:pict>/g,'')
 if(first){let inserted=false;body=body.replace(/<w:t\b[^>]*>[\s\S]*?<\/w:t>|<w:(tab|br)\b[^>]*\/?\s*>/g,match=>{if(/^<w:br\b/.test(match)&&/w:type=["'](page|column)["']/.test(match))return match;if(inserted)return '';inserted=true;return '<w:t xml:space="preserve">'+escaped+'</w:t>'})}
 else {const run='<w:r><w:t xml:space="preserve">'+escaped+'</w:t></w:r>';body=body.endsWith('/>')?body.slice(0,-2)+'>'+run+'</w:p>':body.replace(/<\/w:p>$/,run+'</w:p>')}
 return body
}
export async function renderTemplate(root:string,workspace:TemplateWorkspace,version?:TemplateVersion){
 const template=workspace.template;if(!template?.asset)throw new InputError('请先选择Word模板')
 const bytes=await readAsset(root,template.asset),values=version?.values??workspace.values,note=version?.note??workspace.note
 if(!Object.keys(values).length&&!note)return bytes
 const zip=openDocx(bytes)
 for(const part of new Set(template.slots.map(s=>s.part))){let xml=zip.file(part)!.asText();const paragraphs=spans(xml,part)
  for(const p of [...paragraphs].reverse()){if(values[p.id]===undefined||values[p.id]===p.text)continue;xml=xml.slice(0,p.start)+rewriteParagraph(p,values[p.id]!)+xml.slice(p.end)}
  if(part==='word/document.xml'&&note){if(/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(note))throw new InputError('备注含无效控制字符');const content='<w:p><w:r><w:t xml:space="preserve">'+escape(note).replace(/\r?\n/g,'</w:t><w:br/><w:t xml:space="preserve">')+'</w:t></w:r></w:p>';const at=xml.lastIndexOf('<w:sectPr');xml=at<0||at<xml.lastIndexOf('</w:p>')?xml.replace('</w:body>',content+'</w:body>'):xml.slice(0,at)+content+xml.slice(at)}
  zip.file(part,xml)
 }
 // Keep template sections/margins and formatting; generated pages use A4 in the original orientation.
 let document=zip.file('word/document.xml')!.asText()
 if(!/<w:sectPr\b/.test(document))document=document.replace('</w:body>','<w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr></w:body>')
 document=document.replace(/<w:sectPr\b([^>]*?)\/>/g,'<w:sectPr$1></w:sectPr>')
 document=document.replace(/<w:sectPr\b[^>]*>[\s\S]*?<\/w:sectPr>/g,section=>{
  const size=section.match(/<w:pgSz\b[^>]*\/?\s*>/)?.[0],landscape=!!size&&(Number(size.match(/w:w="(\d+)"/)?.[1])>Number(size.match(/w:h="(\d+)"/)?.[1])||/w:orient="landscape"/.test(size)),width=landscape?16838:11906,height=landscape?11906:16838
  let next=size||'<w:pgSz/>'
  for(const [key,value] of [['w',width],['h',height]] as const){const attr=new RegExp('w:'+key+'="[^"]*"');next=attr.test(next)?next.replace(attr,`w:${key}="${value}"`):next.replace('/>',` w:${key}="${value}"/>`)}
  next=next.replace(/\s+w:code="[^"]*"/g,'')
  return size?section.replace(size,next):section.replace(/(<w:sectPr\b[^>]*>)/,'$1'+next)
 })
 zip.file('word/document.xml',document)
 const settings=zip.file('word/settings.xml')?.asText();if(settings)zip.file('word/settings.xml',/<w:updateFields\b/.test(settings)?settings.replace(/<w:updateFields\b[^>]*\/?\s*>/,'<w:updateFields w:val="true"/>'):settings.replace('</w:settings>','<w:updateFields w:val="true"/></w:settings>'))
 const output=zip.generate({type:'nodebuffer',compression:'DEFLATE'});inspectDocx(output);return output
}
export function sourceValue(source:TemplateSource,id:string){return source.slots.find(p=>p.id===id)?.text}
