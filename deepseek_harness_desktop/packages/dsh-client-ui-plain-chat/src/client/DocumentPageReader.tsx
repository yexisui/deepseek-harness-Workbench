import React,{useEffect,useRef,useState} from 'react'
import type {DocumentAsset,DocumentPage,DocumentBlock,DocumentTableCell} from '../../../dsh-capabilities/src/core/document-workflow.ts'
import s from './document-workflow.module.css'

type Table=Extract<DocumentBlock,{type:'table'}>
function Cell({cell,heading=false,preserveLines=false}:{cell:DocumentTableCell;heading?:boolean;preserveLines?:boolean}){
 const Tag=heading?'th':'td',value=preserveLines?cell.text:cell.text.replace(/\n/g,'')
 const compact=!preserveLines&&heading&&value.length>32?value.split(/[（(]/)[0]:undefined
 return <Tag colSpan={cell.colspan} rowSpan={cell.rowspan} data-column={cell.col} scope={heading?'col':undefined}>{preserveLines&&cell.blocks?.length?<StructuredBlocks blocks={cell.blocks}/>:compact??value}</Tag>
}
function PageTable({block}:{block:Table}){
 const headers=block.continuedHeader??(block.headerRow===undefined?[]:block.rows[block.headerRow]??[])
 const notes=block.preserveLines?[]:headers.map(cell=>cell.text.replace(/\n/g,'')).filter(value=>value.length>32)
 return <><div className={s.pageTable}><table style={{minWidth:block.columns>5?block.columns*64:undefined}}>
  {block.continuedHeader&&<thead><tr>{block.continuedHeader.map(cell=><Cell key={cell.col} cell={cell} heading preserveLines={block.preserveLines}/>)}</tr></thead>}
  <tbody>{block.rows.map((row,index)=><tr key={index}>{row.map(cell=><Cell key={cell.col} cell={cell} heading={index===block.headerRow} preserveLines={block.preserveLines}/>)}</tr>)}</tbody>
 </table></div>{notes.map((note,index)=><p key={index} className={s.tableNote}>{note}</p>)}</>
}
function PageContent({page}:{page:DocumentPage}){
 if(!page.blocks?.length)return <p className={s.pageText}>{page.text||'等待 OCR 解析'}</p>
 return <StructuredBlocks blocks={page.blocks}/>
}
function StructuredBlocks({blocks}:{blocks:DocumentBlock[]}){
 const nodes:React.ReactNode[]=[],lines:string[]=[]
 const flush=()=>{if(lines.length){nodes.push(<p key={'text-'+nodes.length} className={s.pageText}>{lines.join('\n')}</p>);lines.length=0}}
 for(const block of blocks){if(block.type==='text'){if(block.headingLevel){flush();const Tag=('h'+Math.min(6,Math.max(2,block.headingLevel))) as 'h2'|'h3'|'h4'|'h5'|'h6';nodes.push(<Tag className={s.pageHeading} key={'heading-'+nodes.length}>{block.text}</Tag>)}else lines.push(block.text)}else{flush();nodes.push(<PageTable key={'table-'+nodes.length} block={block}/>)} }
 flush();return <>{nodes}</>
}
function readingPages(asset:DocumentAsset):DocumentPage[]{
 if(asset.extension==='.pdf'||asset.pages.some(p=>p.blocks?.length))return asset.pages
 return asset.pages.flatMap(page=>{
  if(page.text.length<=4000)return [page]
  const chunks:string[]=[];let current=''
  for(const line of page.text.split('\n')){if(current.length+line.length>4000&&current){chunks.push(current);current=''}current+=line+'\n'}
  if(current)chunks.push(current)
  return chunks.map((text,index)=>({...page,page:index+1,text}))
 })
}
export function DocumentPageReader({taskId,assets}:{taskId?:string;assets:DocumentAsset[]}){
 const [assetId,setAssetId]=useState(''),[index,setIndex]=useState(0),[original,setOriginal]=useState(false),[imageError,setImageError]=useState(false),[imageLoading,setImageLoading]=useState(false)
 const scroller=useRef<HTMLDivElement>(null)
 const asset=assets.find(a=>a.id===assetId)??assets[0],pages=asset?readingPages(asset):[],position=Math.max(0,Math.min(index,pages.length-1)),page=pages[position]
 const canPreview=asset&&['.pdf','.png','.jpg','.jpeg'].includes(asset.extension)
 useEffect(()=>{setIndex(0);setOriginal(false)},[asset?.id])
 useEffect(()=>{if(scroller.current)scroller.current.scrollTop=0;setImageError(false);setImageLoading(original)},[asset?.id,position,original])
 if(!asset)return <div className={s.empty}><p>上传文档后，在这里查看解析内容。</p></div>
 const imageUrl='/api/capabilities/document-workflow/preview?'+new URLSearchParams({id:taskId??'',asset:asset.id,page:String(page?.page??1)})
 return <section className={s.reader} aria-label="文档分页阅读">
  <header className={s.documentHead}><div>{assets.length>1?<select aria-label="选择文档" value={asset.id} onChange={event=>setAssetId(event.target.value)}>{assets.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select>:<strong>{asset.name}</strong>}<span>{original?'原始扫描页':page?.method==='ocr'?'OCR 文本':'解析文本'}</span></div>{canPreview&&page&&<button aria-pressed={original} onClick={()=>setOriginal(value=>!value)}>{original?'返回整理文本':'查看原页'}</button>}</header>
  <div className={s.pageBody} ref={scroller}><div className={s.pageHead}><span>{asset.extension==='.pdf'?'文件第 '+(page?.page??1)+' 页':'阅读第 '+(position+1)+' 页'+(asset.extension==='.docx'?' · 按段落与表格分页':'')}</span><span>{position+1} / {pages.length||1}</span></div>
   {original?<>{imageLoading&&<p className={s.hint} role="status">正在读取原页…</p>}{imageError?<p className={s.error}>原页暂时无法显示，可返回整理文本继续阅读。</p>:<img key={imageUrl} className={s.originalPage} src={imageUrl} alt={asset.name+' 第 '+page?.page+' 页'} onLoad={()=>setImageLoading(false)} onError={()=>{setImageLoading(false);setImageError(true)}}/>}</>:page?<PageContent page={page}/>:<p className={s.hint}>正在读取文档…</p>}
  </div>
  <footer className={s.pager}><button disabled={!position} onClick={()=>setIndex(position-1)}>‹ 上一页</button><label>第 <input key={asset.id+'-'+position} type="number" min="1" max={pages.length||1} defaultValue={position+1} aria-label="跳转到页码" onBlur={event=>{const next=Math.max(0,Math.min(pages.length-1,Math.round(Number(event.target.value)||1)-1));setIndex(next);event.target.value=String(next+1)}} onKeyDown={event=>{if(event.key==='Enter')event.currentTarget.blur()}}/> / {pages.length||1} 页</label><button disabled={position>=pages.length-1} onClick={()=>setIndex(position+1)}>下一页 ›</button></footer>
 </section>
}
