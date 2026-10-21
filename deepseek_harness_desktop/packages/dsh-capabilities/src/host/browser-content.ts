import { parse, serializeOuter, type DefaultTreeAdapterMap } from 'parse5'
import { extractArticle } from './browser-article.ts'

type Node = DefaultTreeAdapterMap['node']
const children = (n: Node): Node[] => 'childNodes' in n ? n.childNodes : []
const tag = (n: Node) => 'tagName' in n ? n.tagName : ''
const attr = (n: Node, k: string) => 'attrs' in n ? n.attrs.find(a => a.name === k)?.value ?? '' : ''
const identity = (n: Node) => attr(n, 'id') + ' ' + attr(n, 'class')
const skip = (n: Node) => /^(script|style|noscript|template|head)$/.test(tag(n)) || attr(n,'aria-hidden') === 'true' || ('attrs' in n && n.attrs.some(a=>a.name==='hidden')) || /display\s*:\s*none|visibility\s*:\s*hidden/i.test(attr(n,'style'))
const clean = (s: string) => s.replace(/[\t \r\u00a0]+/g,' ').replace(/ *\n */g,'\n').replace(/\n{3,}/g,'\n\n').trim()
function text(n: Node): string { return skip(n) ? '' : n.nodeName === '#text' ? (n as DefaultTreeAdapterMap['textNode']).value : children(n).map(text).join(/^(p|div|section|li|tr|br)$/.test(tag(n))?'\n':'') }
function all(n: Node): Node[] { return skip(n) ? [] : [n,...children(n).flatMap(all)] }
export function webAddress(raw: string, base: string) { try { const u=new URL(raw,base); return /^(https?:)$/.test(u.protocol)&&!u.username&&!u.password ? u.href : '' } catch { return '' } }
export type Resource = {id:string;kind:'image'|'attachment'|'media';category:'main'|'other';url:string;alt:string;caption:string;selector?:string;file?:string;status?:string;error?:string;sha256?:string;bytes?:number;mime?:string}
export type Block = {kind:'text'|'heading'|'image'|'table'|'media';text?:string;level?:number;resource?:string;rows?:string[][]}
export type PageContent = {blocks:Block[];other:Block[];resources:Resource[];links:{text:string;url:string;category:string}[];warnings:string[];text:string;title:string}
function selector(node:Node):string { const parts:string[]=[];let n:Node|undefined=node;while(n&&tag(n)&&tag(n)!=='html'){const parent:Node|undefined=('parentNode'in n?n.parentNode:undefined)??undefined;const siblings=parent?children(parent).filter(s=>tag(s)===tag(n!)):[];parts.unshift(tag(n)+`:nth-of-type(${siblings.indexOf(n)+1})`);n=parent}return parts.join(' > ') }
function imageUrl(n:Node,base:string) {
  const parent='parentNode'in n?n.parentNode:undefined
  const srcset=attr(n,'data-srcset')||attr(n,'srcset')||(parent&&tag(parent)==='picture'?children(parent).filter(x=>tag(x)==='source').map(x=>attr(x,'srcset')).join(','):'')
  const candidates=srcset.split(',').map(s=>s.trim().split(/\s+/)).filter(a=>a[0]).sort((a,b)=>parseFloat(b[1]||'1')-parseFloat(a[1]||'1'))
  const raw=attr(n,'data-original')||attr(n,'data-src')||attr(n,'data-lazy-src')||candidates[0]?.[0]||attr(n,'src')
  return raw?.startsWith('data:image/')?raw:webAddress(raw||'',base)
}
/** Preserve ordered content blocks; peripheral material remains a separate appendix. */
export function extractContent(html:string,url:string):PageContent {
  const tree=parse(html), nodes=all(tree), body=nodes.find(n=>tag(n)==='body')??tree
  const primary=nodes.find(n=>attr(n,'itemprop')==='articleBody'||/chan_newsDetail|article[-_]?content|article[-_]?body|post[-_]?content|entry[-_]?content/i.test(identity(n)))??nodes.find(n=>tag(n)==='article')??nodes.find(n=>tag(n)==='main')??body
  const title=clean(text(nodes.find(n=>tag(n)==='h1'&&!/logo/i.test(identity(n)))??body)).slice(0,250)
  const out:PageContent={blocks:[],other:[],resources:[],links:[],warnings:[],text:'',title}
  let pending=''
  const flush=(dest:Block[])=>{const value=clean(pending);if(value)dest.push({kind:'text',text:value});pending=''}
  const resource=(n:Node,category:'main'|'other',kind:Resource['kind'],raw:string)=>{
    const parent='parentNode'in n?n.parentNode:undefined,caption=parent&&tag(parent)==='figure'?clean(children(parent).filter(x=>tag(x)==='figcaption').map(text).join(' ')):''
    const r:Resource={id:'r'+(out.resources.length+1),kind,category,url:raw,alt:attr(n,'alt')||attr(n,'title')||clean(text(n)).slice(0,200),caption,selector:kind==='image'?selector(n):undefined}
    out.resources.push(r);return r.id
  }
  function walk(n:Node,inside=false){
    if(skip(n))return
    const main=inside||n===primary,category=main?'main':'other',dest=main?out.blocks:out.other,t=tag(n)
    if(n===primary)flush(out.other)
    if(n.nodeName==='#text'){pending+=text(n);return}
    if(t==='img'){
      flush(dest);const id=resource(n,category,'image',imageUrl(n,url));dest.push({kind:'image',resource:id});return
    }
    if(t==='svg'){
      flush(dest);dest.push({kind:'image',resource:resource(n,category,'image','data:image/svg+xml;base64,'+Buffer.from(serializeOuter(n)).toString('base64'))});return
    }
    if(t==='video'||t==='audio'){
      flush(dest);const media=webAddress(attr(n,'src')||children(n).filter(x=>tag(x)==='source').map(x=>attr(x,'src'))[0]||'',url)
      dest.push({kind:'media',resource:resource(n,category,'media',media)});
      if(attr(n,'poster'))dest.push({kind:'image',resource:resource(n,category,'image',webAddress(attr(n,'poster'),url))})
      return
    }
    if(t==='canvas'||t==='iframe'){out.warnings.push(`${main?'正文':'其他区域'}含${t}，未展开其内部内容`)}
    if(t==='table'){
      flush(dest);const rows=all(n).filter(x=>tag(x)==='tr').map(row=>children(row).filter(x=>/^(td|th)$/.test(tag(x))).map(x=>clean(text(x))))
      dest.push({kind:'table',rows});for(const image of all(n).filter(x=>tag(x)==='img'))walk(image,main);return
    }
    if(/^h[1-6]$/.test(t)){flush(dest);dest.push({kind:'heading',text:clean(text(n)),level:Number(t[1])});return}
    if(t==='a'){
      const href=webAddress(attr(n,'href'),url),label=clean(text(n));if(href){out.links.push({text:label,url:href,category});if(/\.(pdf|docx?|xlsx?|pptx?|csv|txt|zip)(?:[?#]|$)/i.test(href))resource(n,category,'attachment',href)}
    }
    // Inline background images are content resources too; stylesheet-only graphics are outside the DOM inventory.
    for(const match of attr(n,'style').matchAll(/(?:background(?:-image)?\s*:)[^;]*?url\(["']?([^)'"\s]+)["']?\)/g)){
      flush(dest);dest.push({kind:'image',resource:resource(n,category,'image',webAddress(match[1]!,url))})
    }
    const boundary=/^(p|div|section|li|ul|ol|nav|aside|footer|br|figure|figcaption)$/.test(t)
    if(boundary)flush(dest)
    for(const child of children(n))walk(child,main)
    if(boundary||n===primary)flush(dest)
  }
  walk(body);flush(primary===body?out.blocks:out.other)
  out.text=out.blocks.map(b=>b.text??b.rows?.map(r=>r.join('\t')).join('\n')??'').filter(Boolean).join('\n\n')
  out.warnings=[...new Set(out.warnings)]
  return out
}
/** Archive can also capture general pages; the old strict article tool is unchanged. */
export function extractArchivePage(html:string,url:string){
  try{return extractArticle(html,url)}catch(error){
    const page=extractContent(html,url)
    if(!page.text||(!page.title&&page.text.length<20))throw error
    // A failed article parser must never quietly bypass an identified pager.
    if(/class=["'][^"']*(?:pagination|multipage)|id=["'][^"']*multipage/i.test(html))throw error
    const title=/<title[^>]*>([^<]+)<\/title>/i.exec(html)?.[1]||page.title||new URL(url).hostname
    return {title,body:page.text,publishedAt:'',source:'',author:'',links:[] as {url:string;number?:number}[],currentPage:1,expectedPages:1,issues:[] as string[]}
  }
}
