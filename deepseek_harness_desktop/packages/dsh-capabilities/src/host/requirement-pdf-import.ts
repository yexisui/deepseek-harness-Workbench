import {createRequire} from 'node:module'
import {dirname,join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {InputError} from '../core/validation.ts'
const require=createRequire(import.meta.url)
type Cell={text:string;x:number;end:number;size:number;bold:boolean}
type Line={y:number;cells:Cell[]}
/** PDF has positions, not Word paragraphs. Rebuild editable text and simple aligned tables. */
export async function importPdfAsDocx(bytes:Buffer):Promise<Buffer>{
 const base=dirname(require.resolve('dsh-office-toolkit')),vendor=join(base,'../vendor/pdfjs')
 const pdfjs=await import(pathToFileURL(join(vendor,'pdf.min.mjs')).href)
 pdfjs.GlobalWorkerOptions.workerSrc=pathToFileURL(join(vendor,'pdf.worker.min.mjs')).href
 const {Document,Paragraph,TextRun,Table,TableRow,TableCell,Packer,WidthType}=require(require.resolve('docx',{paths:[base]}))
 const loading=pdfjs.getDocument({data:new Uint8Array(bytes),isEvalSupported:false,useSystemFonts:false,disableFontFace:true,cMapUrl:join(vendor,'cmaps')+'/',cMapPacked:true,standardFontDataUrl:join(vendor,'standard_fonts')+'/',verbosity:0})
 let doc:any
 try{
  doc=await loading.promise
  if(doc.numPages>300)throw new InputError('PDF页数过多，请按章节拆分')
  const children:any[]=[],sizes:number[]=[],pages:{width:number;height:number;lines:Line[]}[]=[]
  let characters=0
  for(let i=1;i<=doc.numPages;i++){
   const page=await doc.getPage(i),viewport=page.getViewport({scale:1}),content=await page.getTextContent(),lines:Line[]=[]
   for(const item of content.items){
    if(!('str'in item)||!item.str.trim())continue
    characters+=item.str.length;if(characters>180000)throw new InputError('PDF文字超过180000字，请按章节拆分')
    const size=Math.max(6,Math.min(32,Math.hypot(item.transform[2],item.transform[3]))),x=item.transform[4],y=item.transform[5]
    sizes.push(size);let line=lines.find(l=>Math.abs(l.y-y)<Math.min(3,size/3))
    if(!line){line={y,cells:[]};lines.push(line)}
    line.cells.push({text:item.str,x,end:x+item.width,size,bold:/bold|hei|黑体/i.test(content.styles[item.fontName]?.fontFamily||'')})
   }
   for(const line of lines){const groups:Cell[]=[];for(const item of line.cells.sort((a,b)=>a.x-b.x)){const previous=groups.at(-1);if(previous&&item.x-previous.end<Math.max(14,item.size*1.4)){previous.text+=(item.x-previous.end>item.size*.4?' ':'')+item.text;previous.end=Math.max(previous.end,item.end);previous.size=Math.max(previous.size,item.size);previous.bold||=item.bold}else groups.push({...item})}line.cells=groups}
   pages.push({width:viewport.width,height:viewport.height,lines:lines.sort((a,b)=>b.y-a.y).filter(l=>!(l.y<55&&l.cells.length===1&&/^[-—\s]*\d+[-—\s]*$/.test(l.cells[0]!.text)))})
   page.cleanup()
  }
  if(!characters)throw new InputError('此PDF没有可读取的文字，请先进行OCR或使用Word版')
  sizes.sort((a,b)=>a-b);const normal=sizes[Math.floor(sizes.length/2)]||11
  const paragraph=(cell:Cell,heading=false)=>new Paragraph({heading:heading?'Heading1':undefined,spacing:{after:heading?160:80,line:Math.round(normal*20*1.5)},children:[new TextRun({text:cell.text,font:'宋体',size:Math.round(cell.size*2),bold:cell.bold||heading})]})
  for(const page of pages){
   let table:Line[]=[],pending:Cell|undefined
   const flushText=()=>{if(pending){children.push(paragraph(pending));pending=undefined}}
   const flushTable=()=>{if(!table.length)return
    const count=Math.max(...table.map(l=>l.cells.length)),columnPositions=table.find(l=>l.cells.length===count)!.cells.map(c=>c.x)
    if(table.length<2){for(const line of table)children.push(paragraph({...line.cells[0]!,text:line.cells.map(c=>c.text).join('  ')}))}
    else children.push(new Table({width:{size:100,type:WidthType.PERCENTAGE},rows:table.map((line,index)=>{
     const values:Array<Cell|undefined>=Array.from({length:count})
     for(const cell of line.cells){let nearest=0;for(let n=1;n<count;n++)if(Math.abs(columnPositions[n]!-cell.x)<Math.abs(columnPositions[nearest]!-cell.x))nearest=n;values[nearest]=values[nearest]?{...values[nearest]!,text:values[nearest]!.text+' '+cell.text}:cell}
     return new TableRow({tableHeader:index===0,children:values.map(cell=>new TableCell({children:[paragraph(cell??{text:'',x:0,end:0,size:normal,bold:false})]}))})
    })}))
    table=[]
   }
   for(const line of page.lines){
    if(line.cells.length>1){flushText();table.push(line);continue}
    flushTable();const cell=line.cells[0]!,heading=cell.size>normal*1.15||(/^(第[一二三四五六七八九十\d]+[章节]|\d+(?:\.\d+)*[、.\s])/.test(cell.text)&&cell.text.length<65)
    if(heading){flushText();children.push(paragraph(cell,true))}
    else if(pending&&Math.abs(pending.size-cell.size)<1&&!/[。！？：:]$/.test(pending.text)&&pending.text.length<1400){pending.text+=cell.text;pending.end=cell.end}
    else{flushText();pending={...cell}}
   }
   flushTable();flushText()
  }
  const first=pages[0]!
  return Buffer.from(await Packer.toBuffer(new Document({styles:{default:{document:{run:{font:'宋体',size:Math.round(normal*2)}}}},sections:[{properties:{page:{size:{width:Math.round(first.width*20),height:Math.round(first.height*20)},margin:{top:1134,bottom:1134,left:1134,right:1134}}},children}]})))
 }catch(e){if(e instanceof InputError)throw e;throw new InputError('PDF无法解析，请使用未加密的含文字PDF或Word版')}
 finally{await loading.destroy().catch(()=>{})}
}
