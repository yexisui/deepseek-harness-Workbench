import React,{useEffect,useLayoutEffect,useMemo,useRef,useState,type CSSProperties} from 'react'
import {createPortal} from 'react-dom'
import {paginateRequirement,type FlowBlock} from './requirement-pagination.ts'
import {A4_PAGE,type PreviewBorders,type PreviewStyle,type PreviewNode,type PreviewParagraph,type PreviewPage,type RequirementPreview} from '../../../dsh-capabilities/src/core/requirement-preview.ts'
import type {TemplateSource,TemplateSlot,TemplateChange} from '../../../dsh-capabilities/src/core/requirement-template.ts'
import {RequirementTableEditor,tableParagraphs,type DocumentTable} from './RequirementTableEditor.tsx'
import {getRequirementPreview} from './requirements-client.ts'
import {NOTE_BLOCK,textChangeSpan,type DocumentChanges,type TextChange,type DocumentChange} from './requirement-changes.ts'
import s from './RequirementDocumentView.module.css'
function ChangeText({change}:{change:TextChange}){const text=textChangeSpan(change.before,change.after);return <>{text.prefix}{text.added&&<mark className={change.kind==='added'?s.addedText:s.modifiedText}>{text.added}</mark>}{text.removed&&!text.added&&<span className={s.deletedText}>已删除</span>}{text.suffix}</>}
function ChangeDetail({group,expanded,onExpanded}:{group:DocumentChange;expanded?:boolean;onExpanded?:(open:boolean)=>void}){const kind=group.changes.every(c=>c.kind===group.changes[0]!.kind)?group.changes[0]!.kind:'modified';return <details className={s.changeDetail} data-kind={kind} open={expanded} onToggle={e=>onExpanded?.(e.currentTarget.open)}><summary>{kind==='added'?'新增':kind==='deleted'?'已删除':'修改'} · 查看前后内容</summary><div>{group.changes.map(c=><section key={c.id}><div><b>修改前</b><p>{c.before?<del>{c.before}</del>:'（空）'}</p></div><div><b>修改后</b><p>{c.after||'（已删除）'}</p></div></section>)}</div></details>}

type Props={changes?:DocumentChanges;activeChangeId?:string;endedDraftId?:string;readOnly?:boolean;highlightChanges?:boolean;taskId?:string;template:TemplateSource;slots:TemplateSlot[];values:Record<string,string>;original:boolean;note:string;disabled:boolean;pendingIds:string[];onEdit:(slot:TemplateSlot)=>void;onCompare:(id:string)=>void;onEditTable?:(changes:TemplateChange[])=>Promise<void>}
const pt=(n:number|undefined)=>n===undefined?undefined:`${n}pt`
function border(b:PreviewBorders[keyof PreviewBorders]){return b?`${b.width}pt ${b.style} ${b.color}`:undefined}
function edges(b?:PreviewBorders):CSSProperties{return Object.fromEntries((['top','bottom','left','right'] as const).filter(side=>b?.[side]).map(side=>['border'+side[0]!.toUpperCase()+side.slice(1),border(b![side])]))}
function css(p:PreviewStyle):CSSProperties{return {fontFamily:p.font||p.latinFont?[...new Set([p.latinFont,p.font].filter(Boolean))].map(f=>`"${f}"`).join(',')+',SimSun,serif':undefined,letterSpacing:pt(p.tracking),fontSize:pt(p.size),fontWeight:p.bold?'bold':p.bold===false?'normal':undefined,fontStyle:p.italic?'italic':p.italic===false?'normal':undefined,textDecoration:p.underline?'underline':undefined,color:p.color,backgroundColor:p.background,textAlign:p.align,marginTop:pt(p.before),marginBottom:pt(p.after),marginLeft:pt(p.left),marginRight:pt(p.right),textIndent:pt(p.indent),lineHeight:p.linePoints?pt(p.linePoints):p.line,...edges(p.borders)}}
type MeasuredBlock=FlowBlock&{paragraphs:Record<string,{start:number;end:number}>;headerHeight:number}
type RenderContext={page?:number;total?:number;sectionTotal?:number;measure?:boolean;range?:{start:number;end:number;positions:MeasuredBlock['paragraphs']};repeat?:boolean}
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
 const [editingTable,setEditingTable]=useState<DocumentTable>(),[measured,setMeasured]=useState<MeasuredBlock[]>([]),[scale,setScale]=useState(1),[expandedChanges,setExpandedChanges]=useState<Record<string,boolean>>({})
 const container=useRef<HTMLDivElement>(null),measure=useRef<HTMLDivElement>(null)
 useEffect(()=>setEditingTable(undefined),[template.id,template.asset])
 const base=useMemo(()=>basicRequirementPreview(template),[template.id,template.asset]),shown=useMemo(()=>new Set(props.slots.map(p=>p.id)),[props.slots]),byId=useMemo(()=>new Map(template.slots.map(p=>[p.id,p])),[template]),pending=new Set(props.pendingIds)
 useEffect(()=>{let alive=true;const controller=new AbortController();setLayout(undefined);setError('');setLoading(false)
  if(props.taskId&&template.asset){setLoading(true);void getRequirementPreview(props.taskId,controller.signal,props.endedDraftId).then(data=>{if(alive){if(data.asset!==template.asset)throw Error('模板已更新，请重新载入预览');setLayout(data)}}).catch(e=>{if(alive)setError(e instanceof Error?e.message:String(e))}).finally(()=>{if(alive)setLoading(false)})}
  return()=>{alive=false;controller.abort()}
 },[props.taskId,props.endedDraftId,template.id,template.asset,retry])
 const doc=layout&&layout.asset===template.asset?layout:base
 const complete=shown.size===template.slots.length
 function visible(n:PreviewNode):boolean{return n.type==='paragraph'?n.id===NOTE_BLOCK||shown.has(n.id)||(complete&&!byId.has(n.id)):n.rows.some(r=>r.cells.some(c=>c.nodes.some(visible)))}
 const flow=useMemo(()=>[...doc.body.filter(visible),...(!props.original&&(props.note||props.changes?.byId.has(NOTE_BLOCK))?[{type:'paragraph',id:NOTE_BLOCK,runs:[{text:props.note,style:{}}],style:{},heading:false,section:doc.body.at(-1)?.section??0} satisfies PreviewParagraph]:[])],[doc,shown,template,props.note,props.original,props.changes])
 const paper=(section=0):PreviewPage=>doc.pages?.[section]??A4_PAGE
 const blocks=flow.map((n,i)=>measured[i]??{height:0,section:n.section??0,before:n.type==='paragraph'&&n.pageBreak,after:n.type==='paragraph'&&n.breakAfter})
 const pages=blocks.some(b=>b.height>0)?paginateRequirement(blocks,section=>(paper(section).height-paper(section).top-paper(section).bottom)*4/3):[{section:0,fragments:flow.map((_n,index)=>({index,start:0,height:0}))}]
 useLayoutEffect(()=>{
  const root=measure.current;if(!root)return
  let alive=true,frame=0
  const recalculate=()=>{if(!alive)return;const blocks=Array.from(root.querySelectorAll<HTMLElement>('[data-flow-node]')).map((el,i):MeasuredBlock=>{
   const n=flow[i]!,box=el.getBoundingClientRect(),paragraphs:MeasuredBlock['paragraphs']={}
   for(const p of Array.from(el.querySelectorAll<HTMLElement>('[data-block-id]'))){const r=p.getBoundingClientRect();paragraphs[p.dataset.blockId!]={start:r.top-box.top,end:r.bottom-box.top}}
   const rows=n.type==='table'?Array.from(el.querySelector('table')!.rows):[],cuts:number[]=[]
   let mergeEnd=0
   rows.forEach((row,index)=>{for(const cell of Array.from(row.cells))mergeEnd=Math.max(mergeEnd,index+cell.rowSpan);if(index+1>=mergeEnd)cuts.push(row.getBoundingClientRect().bottom-box.top)})
   if(!rows.length&&box.height>(paper(n.section).height-paper(n.section).top-paper(n.section).bottom)*4/3){const lines=new Set<number>();for(const p of Array.from(el.querySelectorAll('p'))){const walker=document.createTreeWalker(p,NodeFilter.SHOW_TEXT);let text:globalThis.Node|null;while((text=walker.nextNode())){const range=document.createRange();range.selectNodeContents(text);for(const r of Array.from(range.getClientRects()))if(r.height)lines.add(Math.round((r.bottom-box.top)*100)/100)}}cuts.push(...[...lines].sort((a,b)=>a-b))}
   const headerRows=rows.filter((_row,index)=>n.type==='table'&&n.rows[index]?.header),headerHeight=headerRows.reduce((sum,r)=>sum+r.getBoundingClientRect().height,0)
   return {height:n.type==='paragraph'&&!n.runs.length&&(n.breakAfter||n.pageBreak)?0:box.height,cuts,split:n.type==='table',before:n.type==='paragraph'&&n.pageBreak,after:n.type==='paragraph'&&n.breakAfter,keepNext:n.type==='paragraph'&&(n.keepNext||n.heading),section:n.section??0,paragraphs,headerHeight,repeat:headerHeight}
  });setMeasured(old=>JSON.stringify(old)===JSON.stringify(blocks)?old:blocks)}
  const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(recalculate)}
  recalculate();void document.fonts?.ready.then(schedule)
  const observer=typeof ResizeObserver==='undefined'?undefined:new ResizeObserver(schedule);for(const el of Array.from(root.querySelectorAll('[data-flow-node]')))observer?.observe(el)
  root.addEventListener('load',schedule,true)
  return()=>{alive=false;cancelAnimationFrame(frame);observer?.disconnect();root.removeEventListener('load',schedule,true)}
 },[doc,flow,props.values,props.original,props.changes,props.note,expandedChanges])
 useLayoutEffect(()=>{const root=container.current;if(!root)return;const update=()=>{const width=root.clientWidth;if(width)setScale(Math.min(1,width/(Math.max(...(doc.pages??[A4_PAGE]).map(p=>p.width))*4/3)))};update();const observer=typeof ResizeObserver==='undefined'?undefined:new ResizeObserver(update);observer?.observe(root);return()=>observer?.disconnect()},[doc])
 function furniture(kind:'headers'|'footers',section:number,pageIndex:number){
  const config=paper(section),first=pages.findIndex(p=>p.section===section)===pageIndex,type=config.first&&first?'first':config.even&&(pageIndex+1)%2===0?'even':'default',parts=config[kind],part=parts?.[type]
  if(parts&&Object.keys(parts).length)return part?doc[kind].filter(n=>n.id.startsWith(part+'#')||n.id.startsWith(part+'@')):[]
  return doc[kind]
 }
 function paragraph(p:PreviewParagraph,wholeTable=false,context:RenderContext={}){
  if(!wholeTable&&!visible(p))return null
  const slot=byId.get(p.id),replacement=props.original?undefined:props.values[p.id],changed=replacement!==undefined&&replacement!==slot?.text,isPending=!props.original&&pending.has(p.id),editable=slot?.editable&&!props.original&&!props.readOnly
  const difference=props.original?undefined:props.changes?.byId.get(p.id),anchor=difference?.group.id===p.id
  const hasContent=p.runs.some(r=>r.image||r.text?.trim())||!!replacement
  const position=context.range?.positions[p.id],hidden=!!position&&(position.end<=context.range!.start+.5||position.start>=context.range!.end-.5),interactive=!context.measure&&!context.repeat&&!hidden
  return <div key={p.id} aria-hidden={hidden||context.repeat||undefined} data-block-id={hidden||context.repeat?undefined:p.id} data-change-id={anchor&&interactive?p.id:undefined} data-active-change={difference&&props.activeChangeId===difference.group.id||undefined} data-diff-kind={difference?.change.kind} data-changed={changed&&props.highlightChanges!==false||undefined} data-pending={isPending||undefined} className={`${s.paragraph} ${p.heading?s.heading:''} ${p.id===NOTE_BLOCK?s.note:''}`}>
   <p className={hasContent?s.text:s.blank} style={css(p.style)}>{difference?<span style={css(p.runs.find(r=>r.text)?.style??p.style)}><ChangeText change={difference.change}/></span>:changed?<span style={css(p.runs.find(r=>r.text)?.style??p.style)}>{replacement||'\u00a0'}</span>:p.runs.map((r,i)=>r.image?<img key={i} src={doc.images[r.image]} alt={r.alt||'文档插图'} loading="eager" style={{width:r.width?Math.min(1200,r.width):undefined,maxWidth:'100%',height:'auto'}}/>:<span key={i} style={css(r.style)}>{r.field==='PAGE'?context.page??1:r.field==='NUMPAGES'?context.total??1:r.field==='SECTIONPAGES'?context.sectionTotal??1:r.text}</span>)}</p>
   {(interactive&&(editable||changed||isPending))&&<div className={s.tools}>{isPending&&<span className={s.pending}>待审</span>}{changed&&!props.readOnly&&props.highlightChanges!==false&&!props.changes&&<button type="button" aria-label="查看此处修改" onClick={()=>props.onCompare(p.id)}>已修改</button>}{editable&&<button type="button" disabled={props.disabled} aria-label={'编辑：'+(slot.text.slice(0,35)||'图片说明')} onClick={()=>props.onEdit(slot)}>编辑</button>}</div>}
   {anchor&&difference&&!hidden&&<ChangeDetail key={JSON.stringify(difference.group.changes)} group={difference.group} expanded={!!expandedChanges[p.id]} onExpanded={open=>setExpandedChanges(old=>!!old[p.id]===open?old:{...old,[p.id]:open})}/>}
  </div>
 }
 function node(n:PreviewNode,wholeTable=false,context:RenderContext={}):React.ReactNode{
  if(n.type==='paragraph')return paragraph(n,wholeTable,context)
  if(!wholeTable&&!visible(n))return null
  const total=n.columns.reduce((sum,x)=>sum+x,0),rows=context.repeat?n.rows.filter(r=>r.header):n.rows
  return <div className={s.tableGroup} key={n.id} data-table-id={context.measure||context.repeat?undefined:n.id}>{!context.measure&&!context.repeat&&!context.range?.start&&!props.original&&!props.readOnly&&props.onEditTable&&tableParagraphs(n).some(id=>byId.get(id)?.editable&&!byId.get(id)?.image)&&<div className={s.tableActions}><button type="button" disabled={props.disabled||loading} onClick={()=>setEditingTable(n)}>编辑表格</button></div>}<div className={s.tableScroll} tabIndex={context.measure||context.repeat?-1:0} aria-label="文档表格，可横向滚动"><table className={s.table} style={{width:n.width?pt(n.width):undefined,marginLeft:n.align==='center'||n.align==='right'?'auto':0,marginRight:n.align==='center'?'auto':0,...edges(n.borders)}}>{total>0&&<colgroup>{n.columns.map((width,i)=><col key={i} style={{width:100*width/total+'%'}}/>)}</colgroup>}<tbody>{rows.map((row,i)=><tr key={i}>{row.cells.map((cell,j)=>{const Tag=row.header?'th':'td',m={...n.margins,...cell.margins};return <Tag key={j} colSpan={cell.colSpan} rowSpan={cell.rowSpan} style={{backgroundColor:cell.background,verticalAlign:cell.vertical==='center'?'middle':cell.vertical,borderTop:border(n.borders?.insideH),borderBottom:border(n.borders?.insideH),borderLeft:border(n.borders?.insideV),borderRight:border(n.borders?.insideV),...edges(cell.borders),paddingTop:pt(m.top),paddingBottom:pt(m.bottom),paddingLeft:pt(m.left),paddingRight:pt(m.right)}}>{cell.nodes.map(p=>node(p,true,context))}</Tag>})}</tr>)}</tbody></table></div></div>

 }
 return <><div className={s.root} ref={container} aria-label="文档正文预览" aria-busy={loading}>
  {loading&&<p className={s.status} role="status">正在载入文档排版…</p>}
  {error&&<div className={s.status} role="alert">完整排版暂未载入，当前显示基础正文。{error}<button onClick={()=>setRetry(n=>n+1)}>重新载入</button></div>}
  {pages.map((page,index)=>{const config=paper(page.section),context={page:index+1,total:pages.length,sectionTotal:pages.filter(p=>p.section===page.section).length};return <section key={index} className={s.page} data-document-page={index+1} aria-label={`第 ${index+1} 页，共 ${pages.length} 页`} style={{width:pt(config.width),height:pt(config.height),zoom:scale}}>
   <div className={s.header} aria-label="文档页眉" style={{top:pt(config.header),left:pt(config.left),right:pt(config.right)}}>{furniture('headers',page.section,index).map(n=>node(n,true,context))}</div>
   <div className={s.body} style={{top:pt(config.top),bottom:pt(config.bottom),left:pt(config.left),right:pt(config.right)}}>{page.fragments.map((f,j)=>{const n=flow[f.index];if(!n)return null;const m=measured[f.index],split=!!m&&(f.start>0||f.height<m.height-.5),repeat=f.start>0&&m?.headerHeight&&n.type==='table';return <div key={j} className={s.fragment} data-page-fragment={n.id} style={split?{height:f.height+(repeat?m.headerHeight:0),position:'relative'}:undefined}>
    {split&&n.type==='table'&&!f.start&&!props.original&&!props.readOnly&&props.onEditTable&&tableParagraphs(n).some(id=>byId.get(id)?.editable)&&<div className={s.tableActions}><button type="button" disabled={props.disabled||loading} onClick={()=>setEditingTable(n)}>编辑表格</button></div>}
    {repeat?<div className={s.repeatedHeader} style={{height:m.headerHeight}}>{node(n,true,{...context,repeat:true})}</div>:null}
    <div style={split?{height:f.height,overflow:'clip'}:undefined}><div className={s.flowNode} style={f.start?{transform:`translateY(-${f.start}px)`}:undefined}>{node(n,false,{...context,...(split&&m?{range:{start:f.start,end:f.start+f.height,positions:m.paragraphs}}:{})})}</div></div>
   </div>})}</div>
   <div className={s.footer} aria-label="文档页脚" style={{bottom:pt(config.footer),left:pt(config.left),right:pt(config.right)}}>{furniture('footers',page.section,index).map(n=>node(n,true,context))}</div>
  </section>})}

 </div>{createPortal(<div className={`${s.root} ${s.measure}`} ref={measure} aria-hidden="true">{flow.map((n,i)=>{const config=paper(n.section);return <div key={n.id} className={s.flowNode} data-flow-node={i} style={{width:pt(config.width-config.left-config.right)}}>{node(n,false,{measure:true})}</div>})}</div>,document.body)}{editingTable&&props.onEditTable&&<RequirementTableEditor key={template.id+editingTable.id} table={editingTable} slots={template.slots} values={props.values} images={doc.images} disabled={props.disabled} onSave={props.onEditTable} onClose={()=>setEditingTable(undefined)}/>}</>
}
