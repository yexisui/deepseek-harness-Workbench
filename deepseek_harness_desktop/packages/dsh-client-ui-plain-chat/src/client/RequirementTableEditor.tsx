import React,{useRef,useState,type CSSProperties} from 'react'
import type {PreviewNode} from '../../../dsh-capabilities/src/core/requirement-preview.ts'
import type {TemplateSlot,TemplateChange} from '../../../dsh-capabilities/src/core/requirement-template.ts'
import {RequirementsModal} from './RequirementsUI.tsx'
import s from './RequirementTableEditor.module.css'

export type DocumentTable=Extract<PreviewNode,{type:'table'}>
export function tableParagraphs(table:DocumentTable):string[]{
 return table.rows.flatMap(row=>row.cells.flatMap(cell=>cell.nodes.flatMap(node=>node.type==='paragraph'?[node.id]:tableParagraphs(node))))
}
type Props={table:DocumentTable;slots:TemplateSlot[];values:Record<string,string>;images:Record<string,string>;disabled:boolean;onSave:(changes:TemplateChange[])=>Promise<void>;onClose:()=>void}
export function RequirementTableEditor(props:Props){
 const [original]=useState(()=>Object.fromEntries(props.slots.map(p=>[p.id,props.values[p.id]??p.text])))
 const [draft,setDraft]=useState(original),[saving,setSaving]=useState(false),[error,setError]=useState(''),savingRef=useRef(false)
 const byId=new Map(props.slots.map(p=>[p.id,p])),ids=new Set(tableParagraphs(props.table))
 const changes=props.slots.filter(p=>ids.has(p.id)&&p.editable&&!p.image&&draft[p.id]!==original[p.id]).map(p=>({id:p.id,before:original[p.id]!,after:draft[p.id]!}))
 const locked=saving||props.disabled
 function close(){if(!savingRef.current)props.onClose()}
 async function save(){if(savingRef.current||locked||!changes.length)return;savingRef.current=true;setSaving(true);setError('');try{await props.onSave(changes);props.onClose()}catch(e){setError(e instanceof Error?e.message:String(e))}finally{savingRef.current=false;setSaving(false)}}
 function fit(el:HTMLTextAreaElement|null){if(el){el.style.height='auto';el.style.height=Math.max(36,el.scrollHeight)+'px'}}
 function table(value:DocumentTable):React.ReactNode{
  const total=value.columns.reduce((sum,n)=>sum+n,0),columns=value.columns.length||Math.max(1,...value.rows.map(r=>r.cells.reduce((n,c)=>n+c.colSpan,0)))
  return <div className={s.scroll} key={value.id} tabIndex={0} aria-label="可编辑表格，可左右滚动"><table className={s.table} style={{minWidth:Math.max(560,columns*110)}}>
   {total>0&&<colgroup>{value.columns.map((width,i)=><col key={i} style={{width:100*width/total+'%'}}/>)}</colgroup>}
   <tbody>{value.rows.map((row,i)=><tr key={i}>{row.cells.map((cell,j)=><td key={j} colSpan={cell.colSpan} rowSpan={cell.rowSpan}>
    {cell.nodes.map((node,k)=>{if(node.type==='table')return table(node);const slot=byId.get(node.id),editable=slot?.editable&&!slot.image,style:CSSProperties={textAlign:node.style.align,fontWeight:row.header?'bold':undefined}
     return editable?<textarea key={node.id} ref={fit} rows={1} aria-label={`第${i+1}行第${j+1}列${cell.nodes.length>1?'第'+(k+1)+'段':''}`} data-edit-id={node.id} data-modified={draft[node.id]!==original[node.id]||undefined} style={style} value={draft[node.id]??''} disabled={locked} onChange={e=>{setDraft(old=>({...old,[node.id]:e.target.value}));fit(e.target)}}/>:<div key={node.id} className={s.readonly} style={style}>{node.runs.map((run,index)=>run.image?<img key={index} src={props.images[run.image]} alt={run.alt||'文档插图'}/>:<span key={index}>{run.text}</span>)}</div>
    })}
   </td>)}</tr>)}</tbody>
  </table></div>
 }
 return <RequirementsModal title="编辑表格" onClose={close} footer={<><span>{changes.length?'已修改 '+changes.length+' 处':'可连续修改多个单元格'}</span><button disabled={saving} onClick={close}>取消</button><button className={s.primary} disabled={locked||!changes.length} onClick={()=>void save()}>{saving?'正在保存…':'保存修改'}</button></>}>
  <p className={s.hint}>直接修改格子里的文字，一次保存。行列和合并格式保持，数字不会自动计算。</p>
  {error&&<p className={s.error} role="alert">{error}。输入仍保留，可继续编辑或重试。</p>}
  <div className={s.editor}>{table(props.table)}</div>
 </RequirementsModal>
}
