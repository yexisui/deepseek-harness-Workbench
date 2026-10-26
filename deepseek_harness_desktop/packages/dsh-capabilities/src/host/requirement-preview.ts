import {posix} from 'node:path'
import {openDocx} from './requirement-docx.ts'
import type {TemplateSlot} from '../core/requirement-template.ts'
import type {PreviewStyle,PreviewRun,PreviewNode,PreviewParagraph,PreviewCell,RequirementPreview} from '../core/requirement-preview.ts'
import {InputError} from '../core/validation.ts'

type Node={name:string;attrs:Record<string,string>;children:Node[];text?:string}
const decode=(text:string)=>text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi,(_,key:string)=>{if(key[0]!=='#')return ({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"} as Record<string,string>)[key.toLowerCase()]!;const n=key[1]?.toLowerCase()==='x'?parseInt(key.slice(2),16):Number(key.slice(1));return n>0&&n<=0x10ffff?String.fromCodePoint(n):''})
/** No entity expansion, external resources, HTML or document-provided CSS. */
function xml(text:string):Node{
 if(/<!DOCTYPE|<!ENTITY/i.test(text))throw new InputError('文档包含不支持的XML声明')
 const root:Node={name:'root',attrs:{},children:[]},stack=[root]
 for(const match of text.matchAll(/<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<[^>]*>|[^<]+/g)){
  const token=match[0];if(token.startsWith('<?')||token.startsWith('<!'))continue
  if(token.startsWith('</')){if(stack.length>1)stack.pop();continue}
  if(token.startsWith('<')){const name=token.match(/^<([^\s/>]+)/)?.[1];if(!name)continue;const attrs:Record<string,string>={};for(const m of token.matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g))attrs[m[1]!]=decode(m[2]??m[3]??'');const node:Node={name,attrs,children:[]};stack.at(-1)!.children.push(node);if(!token.endsWith('/>'))stack.push(node)}
  else stack.at(-1)!.children.push({name:'#text',attrs:{},children:[],text:decode(token)})
 }
 return root
}
const child=(n:Node|undefined,name:string)=>n?.children.find(c=>c.name===name)
const value=(n:Node|undefined,name:string)=>child(n,name)?.attrs['w:val']
function all(n:Node|undefined,name:string):Node[]{if(!n)return [];return n.children.flatMap(c=>[...(c.name===name?[c]:[]),...all(c,name)])}
const number=(s:string|undefined,min:number,max:number)=>{if(s===undefined||!Number.isFinite(Number(s)))return undefined;return Math.min(max,Math.max(min,Number(s)))}
const color=(s:string|undefined)=>s&&/^[a-f\d]{6}$/i.test(s)?'#'+s:undefined
function style(n:Node|undefined):PreviewStyle{
 const p=child(n,'w:pPr'),r=child(n,'w:rPr'),out:PreviewStyle={},font=child(r,'w:rFonts')?.attrs,size=number(value(r,'w:sz'),12,144),jc=value(p,'w:jc'),spacing=child(p,'w:spacing')?.attrs
 const family=font?.['w:eastAsia']||font?.['w:ascii']||font?.['w:hAnsi'];if(family&&/^[\w\s\u3400-\u9fff-]{1,80}$/.test(family))out.font=family
 if(size)out.size=size/2
 for(const [tag,key] of [['w:b','bold'],['w:i','italic'],['w:u','underline']] as const){const node=child(r,tag);if(node)out[key]=!['0','false','none','off'].includes(node.attrs['w:val']||'')}
 const ink=color(value(r,'w:color')),fill=color(child(r,'w:shd')?.attrs['w:fill']);if(ink)out.color=ink;if(fill)out.background=fill
 if(jc&&['left','right','center','both','justify'].includes(jc))out.align=jc==='both'?'justify':jc as PreviewStyle['align']
 for(const [attr,key]of [['w:before','before'],['w:after','after']] as const){const n=number(spacing?.[attr],0,2880);if(n!==undefined)out[key]=n/20}
 const line=number(spacing?.['w:line'],120,720);if(line&&(!spacing?.['w:lineRule']||spacing['w:lineRule']==='auto'))out.line=line/240
 const indent=number(child(p,'w:ind')?.attrs['w:firstLine'],-1440,2880);if(indent!==undefined)out.indent=indent/20
 return out
}
export function buildRequirementPreview(bytes:Buffer,asset:string,slots:TemplateSlot[]):RequirementPreview{
 const zip=openDocx(bytes),read=(name:string)=>zip.file(name)?.asText(),styles=xml(read('word/styles.xml')||''),defaults=all(styles,'w:docDefaults')[0]
 const standard={...style({name:'default',attrs:{},children:[...all(defaults,'w:rPr'),...all(defaults,'w:pPr')]})},styleMap=new Map(all(styles,'w:style').map(n=>[n.attrs['w:styleId'],n]))
 const resolveStyle=(id:string|undefined,seen=new Set<string>()):PreviewStyle=>{if(!id||seen.has(id)||seen.size>16)return {};seen.add(id);const n=styleMap.get(id);return {...resolveStyle(value(n,'w:basedOn'),seen),...style(n)}}
 const result:RequirementPreview={asset,body:[],headers:[],footers:[],images:{}},slotMap=new Map(slots.map(s=>[s.id,s]))
 for(const part of [...new Set(['word/document.xml',...slots.map(s=>s.part)])]){
  const content=read(part);if(!content)continue
  const tree=xml(content),paragraphs=all(tree,'w:p'),ids=new Map(paragraphs.map((p,i)=>[p,part+'#'+i])),rels=new Map(all(xml(read(posix.join(posix.dirname(part),'_rels',posix.basename(part)+'.rels'))||''),'Relationship').map(n=>[n.attrs.Id,n.attrs]))
  let tableIndex=0
  function image(node:Node):PreviewRun|undefined{
   const blip=all(node,'a:blip')[0],vml=all(node,'v:imagedata')[0],id=blip?.attrs['r:embed']||vml?.attrs['r:id'],rel=rels.get(id)
   if(!rel||rel.TargetMode==='External'||!rel.Target)return undefined
   const path=posix.normalize(posix.join(posix.dirname(part),rel.Target));if(!path.startsWith('word/media/')||path.includes('..'))return undefined
   const ext=posix.extname(path).toLowerCase(),mime=({'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp'} as Record<string,string>)[ext],entry=zip.file(path);if(!mime||!entry)return undefined
   if(!result.images[path])result.images[path]='data:'+mime+';base64,'+entry.asNodeBuffer().toString('base64')
   const extent=all(node,'wp:extent')[0],properties=all(node,'wp:docPr')[0]
   return {image:path,style:{},width:number(extent?.attrs.cx,0,19050000)!/9525||undefined,height:number(extent?.attrs.cy,0,19050000)!/9525||undefined,alt:properties?.attrs.descr||properties?.attrs.name||'文档插图'}
  }
  function paragraph(n:Node):PreviewParagraph{
   const id=ids.get(n)!,pStyle=value(child(n,'w:pPr'),'w:pStyle'),base={...standard,...resolveStyle(pStyle),...style(n)},runs:PreviewRun[]=[]
   function collect(node:Node,format:PreviewStyle){
    if(node.name==='w:p'&&node!==n)return
    if(node.name==='w:r'){format={...format,...resolveStyle(value(child(node,'w:rPr'),'w:rStyle')),...style({name:'run',attrs:{},children:[{name:'w:rPr',attrs:{},children:child(node,'w:rPr')?.children??[]}]})}}
    if(node.name==='w:drawing'||node.name==='w:pict'){const pic=image(node);if(pic)runs.push(pic);else runs.push({text:'[此处插图请在Word文件中查看]',style:format});return}
    if(node.name==='w:t'){runs.push({text:node.children.map(c=>c.text||'').join(''),style:format});return}
    if(node.name==='w:tab'){runs.push({text:'\t',style:format});return}
    if(node.name==='w:br'){if(node.attrs['w:type']!=='page')runs.push({text:'\n',style:format});return}
    if(node.name.endsWith('Pr'))return
    node.children.forEach(c=>collect(c,format))
   }
   collect(n,base)
   return {type:'paragraph',id,runs,style:base,heading:slotMap.get(id)?.heading??false,pageBreak:!!child(child(n,'w:pPr'),'w:pageBreakBefore')||all(n,'w:br').some(b=>b.attrs['w:type']==='page')}
  }
  function nodes(n:Node):PreviewNode[]{
   return n.children.flatMap((c):PreviewNode[]=>{
    if(c.name==='w:p')return [paragraph(c)]
    if(c.name==='w:tbl'){
     const id=part+'@table'+(++tableIndex),grid=child(c,'w:tblGrid')?.children.filter(g=>g.name==='w:gridCol').map(g=>number(g.attrs['w:w'],1,30000)??1)??[],rows:{cells:PreviewCell[];header:boolean}[]=[],vertical=new Map<number,PreviewCell>()
     const childrenNamed=(parent:Node,name:string):Node[]=>parent.children.flatMap(x=>x.name===name?[x]:['w:sdt','w:sdtContent','w:customXml'].includes(x.name)?childrenNamed(x,name):[])
     for(const row of childrenNamed(c,'w:tr')){
      const cells:PreviewCell[]=[],before=Number(value(child(row,'w:trPr'),'w:gridBefore')||0),active=new Set<number>();let col=before
      if(before>0)cells.push({colSpan:Math.min(before,64),rowSpan:1,nodes:[]})
      for(const cell of childrenNamed(row,'w:tc')){
       const props=child(cell,'w:tcPr'),span=number(value(props,'w:gridSpan'),1,64)??1,merge=child(props,'w:vMerge'),previous=vertical.get(col)
       if(merge&&merge.attrs['w:val']!=='restart'&&previous&&previous.colSpan===span){previous.rowSpan++;previous.nodes.push(...nodes(cell).filter(x=>x.type!=='paragraph'||x.runs.length>0));active.add(col);col+=span;continue}
       const valign=value(props,'w:vAlign'),current:PreviewCell={colSpan:span,rowSpan:1,nodes:nodes(cell),background:color(child(props,'w:shd')?.attrs['w:fill']),vertical:valign==='center'||valign==='bottom'?valign:'top'}
       cells.push(current);if(merge){vertical.set(col,current);active.add(col)}col+=span
      }
      for(const key of vertical.keys())if(!active.has(key))vertical.delete(key)
      rows.push({cells,header:!!child(child(row,'w:trPr'),'w:tblHeader')})
     }
     return [{type:'table',id,columns:grid,rows}]
    }
    if(['w:body','w:hdr','w:ftr','w:sdt','w:sdtContent','w:customXml','w:document'].includes(c.name))return nodes(c)
    return []
   })
  }
  const section=part==='word/document.xml'?'body':part.includes('/header')?'headers':'footers';result[section].push(...nodes(tree))
 }
 return result
}
