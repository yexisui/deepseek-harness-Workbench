import React,{useEffect,useMemo,useState,type CSSProperties} from 'react'
import type {PreviewStyle,PreviewNode,PreviewParagraph,RequirementPreview} from '../../../dsh-capabilities/src/core/requirement-preview.ts'
import type {TemplateSource,TemplateSlot} from '../../../dsh-capabilities/src/core/requirement-template.ts'
import {getRequirementPreview} from './requirements-client.ts'
import s from './RequirementDocumentView.module.css'

type Props={taskId?:string;template:TemplateSource;slots:TemplateSlot[];values:Record<string,string>;original:boolean;note:string;disabled:boolean;pendingIds:string[];onEdit:(slot:TemplateSlot)=>void;onCompare:(id:string)=>void}
function css(p:PreviewStyle):CSSProperties{return {fontFamily:p.font?`"${p.font}",SimSun,serif`:undefined,fontSize:p.size?`${p.size}pt`:undefined,fontWeight:p.bold?'bold':p.bold===false?'normal':undefined,fontStyle:p.italic?'italic':undefined,textDecoration:p.underline?'underline':undefined,color:p.color,backgroundColor:p.background,textAlign:p.align,marginTop:p.before===undefined?undefined:`${p.before}pt`,marginBottom:p.after===undefined?undefined:`${p.after}pt`,textIndent:p.indent===undefined?undefined:`${p.indent}pt`,lineHeight:p.line}}
/** Legacy/synthetic records still have a readable table view if full layout is unavailable. */
export function basicRequirementPreview(source:TemplateSource):RequirementPreview{
 const result:RequirementPreview={asset:source.asset||'',body:[],headers:[],footers:[],images:{}}
 const paragraph=(p:TemplateSlot):PreviewParagraph=>({type:'paragraph',id:p.id,runs:[{text:p.text,style:{}}],heading:p.heading,style:p.heading?{bold:true,size:14}:{size:11}})
 for(const p of source.slots){const target=p.part==='word/document.xml'?result.body:p.part.includes('header')?result.headers:result.footers
  if(!p.table){target.push(paragraph(p));continue}
  let table=target.at(-1);const id=p.part+'@table'+p.table
  if(table?.type!=='table'||table.id!==id){table={type:'table',id,columns:[],rows:[]};target.push(table)}
  while(table.rows.length<(p.row||1))table.rows.push({cells:[],header:false});const row=table.rows[(p.row||1)-1]!
  while(row.cells.length<(p.cell||1))row.cells.push({colSpan:1,rowSpan:1,nodes:[]});row.cells[(p.cell||1)-1]!.nodes.push(paragraph(p))
 }
 return result
}
export function RequirementDocumentView(props:Props){
 const {template}=props,[layout,setLayout]=useState<RequirementPreview>(),[error,setError]=useState(''),[retry,setRetry]=useState(0),[loading,setLoading]=useState(false)
 const base=useMemo(()=>basicRequirementPreview(template),[template.id,template.asset]),shown=useMemo(()=>new Set(props.slots.map(p=>p.id)),[props.slots]),byId=useMemo(()=>new Map(template.slots.map(p=>[p.id,p])),[template]),pending=new Set(props.pendingIds)
 useEffect(()=>{let alive=true;const controller=new AbortController();setLayout(undefined);setError('');setLoading(false)
  if(props.taskId&&template.asset){setLoading(true);void getRequirementPreview(props.taskId,controller.signal).then(data=>{if(alive){if(data.asset!==template.asset)throw Error('模板已更新，请重新载入预览');setLayout(data)}}).catch(e=>{if(alive)setError(e instanceof Error?e.message:String(e))}).finally(()=>{if(alive)setLoading(false)})}
  return()=>{alive=false;controller.abort()}
 },[props.taskId,template.id,template.asset,retry])
 const doc=layout??base
 function visible(n:PreviewNode):boolean{return n.type==='paragraph'?shown.has(n.id):n.rows.some(r=>r.cells.some(c=>c.nodes.some(visible)))}
 function paragraph(p:PreviewParagraph,wholeTable=false){
  if(!wholeTable&&!shown.has(p.id))return null
  const slot=byId.get(p.id),replacement=props.original?undefined:props.values[p.id],changed=replacement!==undefined&&replacement!==slot?.text,isPending=!props.original&&pending.has(p.id),editable=slot?.editable&&!props.original
  const hasContent=p.runs.some(r=>r.image||r.text?.trim())||!!replacement
  return <div key={p.id} data-block-id={p.id} data-changed={changed||undefined} data-pending={isPending||undefined} className={`${s.paragraph} ${p.heading?s.heading:''} ${p.pageBreak?s.pageBreak:''}`}>
   <p className={hasContent?s.text:s.blank} style={css(p.style)}>{changed?<span style={css(p.runs.find(r=>r.text)?.style??p.style)}>{replacement||'\u00a0'}</span>:p.runs.map((r,i)=>r.image?<img key={i} src={doc.images[r.image]} alt={r.alt||'文档插图'} loading="lazy" style={{width:r.width?Math.min(1200,r.width):undefined,maxWidth:'100%',height:'auto'}}/>:<span key={i} style={css(r.style)}>{r.text}</span>)}</p>
   {(editable||changed||isPending)&&<div className={s.tools}>{isPending&&<span className={s.pending}>待审</span>}{changed&&<button type="button" aria-label="查看此处修改" onClick={()=>props.onCompare(p.id)}>已修改</button>}{editable&&<button type="button" disabled={props.disabled} aria-label={'编辑：'+(slot.text.slice(0,35)||'图片说明')} onClick={()=>props.onEdit(slot)}>编辑</button>}</div>}
  </div>
 }
 function node(n:PreviewNode,wholeTable=false):React.ReactNode{
  if(n.type==='paragraph')return paragraph(n,wholeTable)
  if(!wholeTable&&!visible(n))return null
  const total=n.columns.reduce((sum,x)=>sum+x,0),count=n.columns.length||Math.max(1,...n.rows.map(r=>r.cells.reduce((sum,c)=>sum+c.colSpan,0)))
  return <div className={s.tableScroll} key={n.id} tabIndex={0} aria-label="文档表格，可横向滚动"><table className={s.table} style={{minWidth:count>3?Math.min(640,count*90):undefined}}>{total>0&&<colgroup>{n.columns.map((width,i)=><col key={i} style={{width:100*width/total+'%'}}/>)}</colgroup>}<tbody>{n.rows.map((row,i)=><tr key={i}>{row.cells.map((cell,j)=>{const Tag=row.header?'th':'td';return <Tag key={j} colSpan={cell.colSpan} rowSpan={cell.rowSpan} style={{backgroundColor:cell.background,verticalAlign:cell.vertical==='center'?'middle':cell.vertical}}>{cell.nodes.map(p=>node(p,true))}</Tag>})}</tr>)}</tbody></table></div>
 }
 return <div className={s.root} aria-label="文档正文预览" aria-busy={loading}>
  {loading&&<p className={s.status} role="status">正在载入文档排版…</p>}
  {error&&<div className={s.status} role="alert">完整排版暂未载入，当前显示基础正文。{error}<button onClick={()=>setRetry(n=>n+1)}>重新载入</button></div>}
  {doc.headers.some(visible)&&<div className={s.header} aria-label="文档页眉">{doc.headers.map(n=>node(n))}</div>}
  {doc.body.map(n=>node(n))}
  {!props.original&&props.note&&<p className={s.note}>{props.note}</p>}
  {doc.footers.some(visible)&&<div className={s.footer} aria-label="文档页脚">{doc.footers.map(n=>node(n))}</div>}
 </div>
}
