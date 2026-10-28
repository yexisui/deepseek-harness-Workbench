import {posix} from 'node:path'
import {openDocx} from './requirement-docx.ts'
import type {TemplateSlot} from '../core/requirement-template.ts'
import {A4_PAGE,type PreviewBorders,type PreviewPage,type PreviewStyle,type PreviewRun,type PreviewNode,type PreviewParagraph,type PreviewCell,type RequirementPreview} from '../core/requirement-preview.ts'
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
const on=(n:Node|undefined)=>!!n&&!['0','false','off'].includes(n.attrs['w:val']||'')
function borders(n:Node|undefined):PreviewBorders|undefined{
 if(!n)return undefined
 const out:PreviewBorders={}
 for(const side of ['top','bottom','left','right','insideH','insideV'] as const){const b=child(n,'w:'+side);if(!b)continue;const v=b.attrs['w:val'];out[side]={width:(number(b.attrs['w:sz'],0,96)??4)/8,color:color(b.attrs['w:color'])||'#000000',style:['nil','none'].includes(v||'')?'none':v==='double'?'double':v==='dotted'?'dotted':v?.includes('dash')?'dashed':'solid'}}
 return out
}
function margins(n:Node|undefined):PreviewCell['margins']{
 if(!n)return undefined
 const result:PreviewCell['margins']={};for(const side of ['top','bottom','left','right'] as const){const v=number(child(n,'w:'+side)?.attrs['w:w'],0,2880);if(v!==undefined)result[side]=v/20}return result
}
function style(n:Node|undefined,theme:Record<string,string>={}):PreviewStyle{
 const p=child(n,'w:pPr'),r=child(n,'w:rPr'),out:PreviewStyle={},font=child(r,'w:rFonts')?.attrs,size=number(value(r,'w:sz'),12,144),jc=value(p,'w:jc'),spacing=child(p,'w:spacing')?.attrs
 const family=font?.['w:eastAsia']||theme[font?.['w:eastAsiaTheme']||'']||font?.['w:ascii']||font?.['w:hAnsi'];if(family&&/^[\w\s\u3400-\u9fff-]{1,80}$/.test(family))out.font=family
 const latin=font?.['w:ascii']||theme[font?.['w:asciiTheme']||'']||font?.['w:hAnsi']||theme[font?.['w:hAnsiTheme']||''];if(latin&&/^[\w\s\u3400-\u9fff-]{1,80}$/.test(latin))out.latinFont=latin
 const tracking=number(value(r,'w:spacing'),-400,400);if(tracking!==undefined)out.tracking=tracking/20
 if(size)out.size=size/2
 for(const [tag,key] of [['w:b','bold'],['w:i','italic'],['w:u','underline']] as const){const node=child(r,tag);if(node)out[key]=!['0','false','none','off'].includes(node.attrs['w:val']||'')}
 const ink=color(value(r,'w:color')),fill=color(child(r,'w:shd')?.attrs['w:fill']);if(ink)out.color=ink;if(fill)out.background=fill
 if(jc&&['left','right','center','both','justify'].includes(jc))out.align=jc==='both'?'justify':jc as PreviewStyle['align']
 for(const [attr,key]of [['w:before','before'],['w:after','after']] as const){const n=number(spacing?.[attr],0,2880);if(n!==undefined)out[key]=n/20}
 const line=number(spacing?.['w:line'],1,14400);if(line){if(!spacing?.['w:lineRule']||spacing['w:lineRule']==='auto')out.line=line/240;else out.linePoints=line/20}
 const indent=number(child(p,'w:ind')?.attrs['w:firstLine'],-1440,2880);if(indent!==undefined)out.indent=indent/20
 const ind=child(p,'w:ind')?.attrs;for(const side of ['left','right'] as const){const v=number(ind?.['w:'+side],-2880,7200);if(v!==undefined)out[side]=v/20};if(ind?.['w:hanging'])out.indent=-Number(ind['w:hanging'])/20
 out.borders=borders(child(p,'w:pBdr'));if(!out.borders)delete out.borders
 return out
}
export function buildRequirementPreview(bytes:Buffer,asset:string,slots:TemplateSlot[]):RequirementPreview{
 const zip=openDocx(bytes),read=(name:string)=>zip.file(name)?.asText(),styles=xml(read('word/styles.xml')||''),defaults=all(styles,'w:docDefaults')[0]
 const theme=xml(read('word/theme/theme1.xml')||''),themeFonts:Record<string,string>={}
 for(const kind of ['major','minor']){const group=all(theme,'a:'+kind+'Font')[0],latin=child(group,'a:latin')?.attrs.typeface,east=child(group,'a:ea')?.attrs.typeface||all(group,'a:font').find(f=>f.attrs.script==='Hans')?.attrs.typeface;if(latin){themeFonts[kind+'HAnsi']=latin;themeFonts[kind+'Ascii']=latin}if(east)themeFonts[kind+'EastAsia']=east}
 const readStyle=(n:Node|undefined)=>style(n,themeFonts)
 const standard={...readStyle({name:'default',attrs:{},children:[...all(defaults,'w:rPr'),...all(defaults,'w:pPr')]})},styleMap=new Map(all(styles,'w:style').map(n=>[n.attrs['w:styleId'],n]))
 const resolveStyle=(id:string|undefined,seen=new Set<string>()):PreviewStyle=>{if(!id||seen.has(id)||seen.size>16)return {};seen.add(id);const n=styleMap.get(id);return {...resolveStyle(value(n,'w:basedOn'),seen),...readStyle(n)}}
 const result:RequirementPreview={asset,body:[],headers:[],footers:[],images:{},pages:[]},slotMap=new Map(slots.map(s=>[s.id,s]))
 const bodyTree=xml(read('word/document.xml')||''),sections=all(bodyTree,'w:sectPr'),bodyRels=new Map(all(xml(read('word/_rels/document.xml.rels')||''),'Relationship').map(n=>[n.attrs.Id,n.attrs]))
 const even=on(all(xml(read('word/settings.xml')||''),'w:evenAndOddHeaders')[0])
 for(const section of sections){
  const size=child(section,'w:pgSz')?.attrs,mar=child(section,'w:pgMar')?.attrs,page:PreviewPage={...A4_PAGE,first:on(child(section,'w:titlePg')),even,headers:{...result.pages!.at(-1)?.headers},footers:{...result.pages!.at(-1)?.footers}}
  if(Number(size?.['w:w'])>Number(size?.['w:h'])){page.width=A4_PAGE.height;page.height=A4_PAGE.width}
  for(const key of ['top','bottom','left','right','header','footer'] as const){const v=number(mar?.['w:'+key],0,7200);if(v!==undefined)page[key]=v/20}
  for(const kind of ['header','footer'] as const)for(const ref of section.children.filter(n=>n.name==='w:'+kind+'Reference')){const rel=bodyRels.get(ref.attrs['r:id']),type=ref.attrs['w:type'];if(rel?.TargetMode!=='External'&&rel?.Target&&['default','first','even'].includes(type||''))page[kind==='header'?'headers':'footers']![type as 'default']=posix.normalize(posix.join('word',rel.Target))}
  result.pages!.push(page)
 }
 if(!result.pages!.length)result.pages!.push({...A4_PAGE})
 const extra=result.pages!.flatMap(p=>[...Object.values(p.headers??{}),...Object.values(p.footers??{})])
 const normal=all(styles,'w:style').find(n=>n.attrs['w:type']==='paragraph'&&n.attrs['w:default']==='1')?.attrs['w:styleId']
 let sectionIndex=0
 for(const part of [...new Set(['word/document.xml',...slots.map(s=>s.part),...extra])]){
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
   const id=ids.get(n)!,pStyle=value(child(n,'w:pPr'),'w:pStyle'),base={...standard,...resolveStyle(normal),...resolveStyle(pStyle),...readStyle(n)},runs:PreviewRun[]=[]
   let field='',fieldResult=false,fieldWritten=false
   function collect(node:Node,format:PreviewStyle){
    if(node.name==='w:p'&&node!==n)return
    if(node.name==='w:r'){format={...format,...resolveStyle(value(child(node,'w:rPr'),'w:rStyle')),...readStyle({name:'run',attrs:{},children:[{name:'w:rPr',attrs:{},children:child(node,'w:rPr')?.children??[]}]})}}
    if(node.name==='w:drawing'||node.name==='w:pict'){const pic=image(node);if(pic)runs.push(pic);else runs.push({text:'[此处插图请在Word文件中查看]',style:format});return}
    if(node.name==='w:fldSimple'){const previous=field,oldResult=fieldResult;field=node.attrs['w:instr']?.trim().split(/\s+/)[0]||'';fieldResult=true;fieldWritten=false;node.children.forEach(c=>collect(c,format));field=previous;fieldResult=oldResult;return}
    if(node.name==='w:fldChar'){const kind=node.attrs['w:fldCharType'];if(kind==='begin'){field='';fieldResult=false;fieldWritten=false}else if(kind==='separate')fieldResult=true;else if(kind==='end'){field='';fieldResult=false}return}
    if(node.name==='w:instrText'){field+=node.children.map(c=>c.text||'').join('');return}
    if(node.name==='w:t'){const code=field.trim().split(/\s+/)[0],dynamic=fieldResult&&['PAGE','NUMPAGES','SECTIONPAGES'].includes(code||'');if(dynamic&&fieldWritten)return;runs.push({text:node.children.map(c=>c.text||'').join(''),style:format,...(dynamic?{field:code as 'PAGE'}:{})});if(dynamic)fieldWritten=true;return}
    if(node.name==='w:tab'){runs.push({text:'\t',style:format});return}
    if(node.name==='w:br'){if(node.attrs['w:type']!=='page')runs.push({text:'\n',style:format});return}
    if(node.name.endsWith('Pr'))return
    node.children.forEach(c=>collect(c,format))
   }
   collect(n,base)
   return {type:'paragraph',id,runs,style:base,heading:slotMap.get(id)?.heading??false,pageBreak:on(child(child(n,'w:pPr'),'w:pageBreakBefore')),breakAfter:all(n,'w:br').some(b=>b.attrs['w:type']==='page'),keepNext:on(child(child(n,'w:pPr'),'w:keepNext'))||on(child(child(styleMap.get(pStyle||''),'w:pPr'),'w:keepNext'))}
  }
  function nodes(n:Node):PreviewNode[]{
   return n.children.flatMap((c):PreviewNode[]=>{
    if(c.name==='w:p'){const p=paragraph(c);if(part==='word/document.xml'){p.section=sectionIndex;if(child(child(c,'w:pPr'),'w:sectPr')){p.breakAfter=true;sectionIndex++}}return [p]}
    if(c.name==='w:tbl'){
     const props=child(c,'w:tblPr'),tableStyle=styleMap.get(value(props,'w:tblStyle')||''),inherited=child(tableStyle,'w:tblPr'),id=part+'@table'+(++tableIndex),grid=child(c,'w:tblGrid')?.children.filter(g=>g.name==='w:gridCol').map(g=>number(g.attrs['w:w'],1,30000)??1)??[],rows:{cells:PreviewCell[];header:boolean}[]=[],vertical=new Map<number,PreviewCell>()
     const childrenNamed=(parent:Node,name:string):Node[]=>parent.children.flatMap(x=>x.name===name?[x]:['w:sdt','w:sdtContent','w:customXml'].includes(x.name)?childrenNamed(x,name):[])
     for(const row of childrenNamed(c,'w:tr')){
      const cells:PreviewCell[]=[],before=Number(value(child(row,'w:trPr'),'w:gridBefore')||0),active=new Set<number>();let col=before
      if(before>0)cells.push({colSpan:Math.min(before,64),rowSpan:1,nodes:[]})
      for(const cell of childrenNamed(row,'w:tc')){
       const props=child(cell,'w:tcPr'),span=number(value(props,'w:gridSpan'),1,64)??1,merge=child(props,'w:vMerge'),previous=vertical.get(col)
       if(merge&&merge.attrs['w:val']!=='restart'&&previous&&previous.colSpan===span){previous.rowSpan++;previous.nodes.push(...nodes(cell).filter(x=>x.type!=='paragraph'||x.runs.length>0));active.add(col);col+=span;continue}
       const valign=value(props,'w:vAlign'),current:PreviewCell={colSpan:span,rowSpan:1,nodes:nodes(cell),background:color(child(props,'w:shd')?.attrs['w:fill']),vertical:valign==='center'||valign==='bottom'?valign:'top',borders:borders(child(props,'w:tcBorders')),margins:margins(child(props,'w:tcMar'))}
       cells.push(current);if(merge){vertical.set(col,current);active.add(col)}col+=span
      }
      for(const key of vertical.keys())if(!active.has(key))vertical.delete(key)
      rows.push({cells,header:!!child(child(row,'w:trPr'),'w:tblHeader')})
     }
     return [{type:'table',id,columns:grid,rows,section:part==='word/document.xml'?sectionIndex:undefined,borders:{...borders(child(inherited,'w:tblBorders')),...borders(child(props,'w:tblBorders'))},margins:{...margins(child(inherited,'w:tblCellMar')),...margins(child(props,'w:tblCellMar'))},align:(value(props,'w:jc')||'left') as 'left',width:child(props,'w:tblW')?.attrs['w:type']==='dxa'?Number(child(props,'w:tblW')?.attrs['w:w'])/20:undefined}]
    }
    if(['w:body','w:hdr','w:ftr','w:sdt','w:sdtContent','w:customXml','w:document'].includes(c.name))return nodes(c)
    return []
   })
  }
  const section=part==='word/document.xml'?'body':part.includes('/header')?'headers':'footers';result[section].push(...nodes(tree))
 }
 return result
}
