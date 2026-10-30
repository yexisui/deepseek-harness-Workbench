import React,{useEffect,useRef,useState} from 'react'
import {DocumentPageReader} from './DocumentPageReader.tsx'
import {MessageTime} from './MessageTime.tsx'
import type {DocumentWorkflow,DocumentRun} from '../../../dsh-capabilities/src/core/document-workflow.ts'
import s from './document-workflow.module.css'

export async function documentWorkflowApi<T=any>(route:string,query:Record<string,string>={},body?:unknown,method=body===undefined?'GET':'POST'):Promise<T>{
 const response=await fetch('/api/capabilities/document-workflow/'+route+'?'+new URLSearchParams(query),{method,credentials:'same-origin',headers:body===undefined?undefined:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)})
 const value=await response.json();if(!response.ok)throw Error(value.error||'请求未完成');return value
}
type Options={skills:{id:string;name:string;description:string}[];capabilities:{id:string;name:string;kind:string}[]}
type Task=DocumentWorkflow&{running?:boolean}
function inline(text:string){return text.split(/(\*\*[^*]+\*\*)/g).map((v,i)=>v.startsWith('**')?<strong key={i}>{v.slice(2,-2)}</strong>:v)}
function Report({text}:{text:string}){
 const lines=text.split('\n'),nodes:React.ReactNode[]=[]
 for(let i=0;i<lines.length;i++){const line=lines[i]!;if(/^\s*\|/.test(line)&&/^\s*\|?[\s:|-]+\|/.test(lines[i+1]??'')){const cells=(v:string)=>v.trim().replace(/^\||\|$/g,'').split('|').map(c=>c.trim());const head=cells(line),rows:string[][]=[];i+=2;while(i<lines.length&&/^\s*\|/.test(lines[i]!))rows.push(cells(lines[i++]!));i--;nodes.push(<div className={s.table} key={i}><table><thead><tr>{head.map((v,k)=><th key={k}>{inline(v)}</th>)}</tr></thead><tbody>{rows.map((row,j)=><tr key={j}>{row.map((v,k)=><td key={k}>{inline(v)}</td>)}</tr>)}</tbody></table></div>);continue}
  const heading=line.match(/^(#{1,3})\s+(.+)/);if(heading){const Tag=('h'+heading[1]!.length) as 'h1'|'h2'|'h3';nodes.push(<Tag key={i}>{inline(heading[2]!)}</Tag>)}else if(line.trim())nodes.push(<p key={i}>{inline(line.replace(/^[-*]\s+/,'• '))}</p>)}return <div className={s.report}>{nodes}</div>
}
function downloadReport(run:DocumentRun,title:string){const url=URL.createObjectURL(new Blob([run.report],{type:'text/markdown;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=title.replace(/[<>:"/\\|?*]/g,'_')+'-报告.md';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
export function DocumentWorkflowAssistant({roleId,taskId,initialDraft,onDraftChange,onTask}:{roleId:string;taskId?:string;initialDraft?:string;onDraftChange:(v:string)=>void;onTask:(v:Task)=>void}){
 const [task,setTask]=useState<Task>(),[options,setOptions]=useState<Options>({skills:[],capabilities:[]}),[instruction,setInstruction]=useState(initialDraft||'请根据文档和所选技能生成报告。'),[skillId,setSkillId]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[view,setView]=useState('result'),[selectedRun,setSelectedRun]=useState('')
 const input=useRef<HTMLInputElement>(null),current=useRef<Task>(),callbacks=useRef({onTask,onDraftChange}),alive=useRef(true),dirty=useRef(false)
 callbacks.current={onTask,onDraftChange};current.current=task
 const accept=(value:Task)=>{current.current=value;if(alive.current){setTask(value);callbacks.current.onTask(value)}}
 const fail=(e:unknown)=>{if(alive.current)setError(e instanceof Error?e.message:String(e))}
 useEffect(()=>{alive.current=true;let cancelled=false;void documentWorkflowApi<Options>('options',{roleId}).then(v=>{if(cancelled)return;setOptions(v)}).catch(fail)
  if(taskId)void documentWorkflowApi<Task>('task',{id:taskId}).then(v=>{if(cancelled)return;accept(v);setInstruction(v.instruction);setSkillId(v.skillId)}).catch(fail)
  return()=>{cancelled=true;alive.current=false}
 },[roleId,taskId])
 useEffect(()=>{if(!task?.id)return;let cancelled=false;const timer=setInterval(()=>{if(!current.current?.running)return;void documentWorkflowApi<Task>('task',{id:task.id}).then(v=>{if(!cancelled)accept(v)}).catch(fail)},1500);return()=>{cancelled=true;clearInterval(timer)}},[task?.id])
 useEffect(()=>{if(!task?.id||!dirty.current||task.running)return;const timer=setTimeout(()=>{dirty.current=false;void documentWorkflowApi<Task>('settings',{id:task.id},{instruction,skillId}).then(accept).catch(fail)},500);return()=>clearTimeout(timer)},[instruction,skillId,task?.id,task?.running])
 async function perform(fn:()=>Promise<void>){setError('');setBusy(true);try{await fn()}catch(e){fail(e)}finally{if(alive.current)setBusy(false)}}
 async function ensure(){if(current.current)return current.current;const v=await documentWorkflowApi<Task>('create',{}, {roleId});const configured=await documentWorkflowApi<Task>('settings',{id:v.id},{instruction,skillId});current.current=configured;return configured}
 async function upload(file?:File){if(!file)return;const row=await ensure();const response=await fetch('/api/capabilities/document-workflow/upload?'+new URLSearchParams({id:row.id,name:file.name}),{method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/octet-stream'},body:file});const value=await response.json();if(!response.ok)throw Error(value.error||'上传失败');accept(value)}
 const active=task?.runs.find(r=>r.id===selectedRun)??task?.runs.at(-1),running=!!task?.running,locked=busy||running,assets=task?.assets??[],needsOcr=assets.some(a=>a.needsOcr),selectedSkill=options.skills.find(x=>x.id===skillId)
 function edit(fn:()=>void){dirty.current=true;fn()}
 return <section className={s.root} aria-label="文档估算工作区">
  <header className={s.heading}><div><h1>从文档到报告</h1><p>提交文档，选择技能，直接生成结果。</p></div><span className={s.badge}>{running?'正在处理':'文档工作区'}</span></header>
  {error&&<div className={s.error} role="alert">{error}<button onClick={()=>setError('')} aria-label="关闭提示">×</button></div>}
  <div className={s.layout}><aside className={s.setup}>
   <section className={s.card}><h2><i>1</i>提交文档</h2><input ref={input} hidden type="file" accept=".pdf,.docx,.png,.jpg,.jpeg,.txt,.md" onChange={e=>{void perform(()=>upload(e.target.files?.[0]));e.target.value=''}}/>
    <button className={s.drop} disabled={locked} onClick={()=>input.current?.click()} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(!locked)void perform(()=>upload(e.dataTransfer.files[0]))}}><span aria-hidden="true">↑</span><strong>点击上传或拖入文档</strong><small>PDF / Word / 图片 / 文本 · 单文件 80 MB</small></button>
    {assets.map(a=><div className={s.asset} key={a.id}><div><strong>{a.name}</strong><small>{a.needsOcr?'含扫描内容 · 可使用 OCR':a.pages.length?'已读取 '+a.pages.length+(a.extension==='.docx'?' 个阅读页':' 页 / 内容块'):'读取中…'}</small></div><button disabled={locked} title="移除文档" aria-label={'移除 '+a.name} onClick={()=>void perform(async()=>accept(await documentWorkflowApi('asset',{id:task!.id,asset:a.id},undefined,'DELETE')))}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></svg></button></div>)}
    {needsOcr&&<div className={s.notice}><p>这份文档包含扫描内容，使用 OCR 转为文字后即可生成报告。</p><button disabled={locked} onClick={()=>void perform(async()=>accept(await documentWorkflowApi('parse',{id:task!.id},{})))}>使用 OCR 解析</button></div>}
    {task?.processing&&<div className={task.processing.error?s.error:s.progress} role="status">{task.processing.phase}{task.processing.total>0?' · '+task.processing.completed+'/'+task.processing.total:''}{task.processing.error&&<p>{task.processing.error}</p>}</div>}
   </section>
   <section className={s.card}><h2><i>2</i>选择技能</h2><label className={s.label}>本次使用的技能<select disabled={locked} value={skillId} onChange={e=>edit(()=>setSkillId(e.target.value))}><option value="">不使用技能 · 按我的要求处理</option>{options.skills.map(v=><option value={v.id} key={v.id}>{v.name}</option>)}</select></label>{selectedSkill&&<p className={s.hint}>{selectedSkill.description}</p>}
    <div className={s.outputHint}>输出内容与格式由所选技能决定</div>
   </section>
   <section className={s.card}><h2><i>3</i>生成结果</h2><label className={s.label}>补充要求<textarea rows={4} value={instruction} disabled={locked} onChange={e=>edit(()=>{setInstruction(e.target.value);callbacks.current.onDraftChange(e.target.value)})} placeholder="例如：仅估算 AI 相关需求，生成工作量报告和 Excel。"/></label>
    {running?<button className={s.primary} onClick={()=>void perform(async()=>accept(await documentWorkflowApi('stop',{id:task!.id},{})))}>停止处理</button>:<button className={s.primary} disabled={busy||!assets.length} onClick={()=>void perform(async()=>{dirty.current=false;setSelectedRun('');setView('result');accept(await documentWorkflowApi('run',{id:task!.id},{instruction,skillId}))})}>{busy?'正在提交…':'开始生成报告 →'}</button>}
   </section>
  </aside><main className={s.output}><header className={s.outputHead}><div className={s.tabs}><button aria-pressed={view==='result'} onClick={()=>setView('result')}>生成结果</button><button aria-pressed={view==='text'} onClick={()=>setView('text')}>解析内容</button></div>{(task?.runs.length??0)>1&&<select aria-label="选择生成记录" value={active?.id??''} onChange={e=>setSelectedRun(e.target.value)}>{task!.runs.map((r,i)=><option value={r.id} key={r.id}>第 {i+1} 次 · {new Date(r.createdAt).toLocaleString()}</option>)}</select>}</header>
   {view==='text'?<DocumentPageReader key={task?.id} taskId={task?.id} assets={assets}/>:active?<article className={s.result}>
    <div className={s.runHead}><div><strong>{active.phase}</strong><small>{active.skillName||'按本次要求处理'}</small></div><span className={s.badge}>{active.status==='done'?'已生成':active.status==='running'?'处理中':active.status==='stopped'?'已停止':'未完成'}</span></div>
    {active.error&&<p className={s.error} role="alert">{active.error}</p>}{active.report?<Report text={active.report}/>:<div className={s.empty}><span aria-hidden="true">✦</span><h2>{active.status==='running'?'正在生成你的报告':'暂无报告内容'}</h2><p>{active.status==='running'?'处理完成后会在这里显示报告与下载文件。':'可以调整要求后再次生成。'}</p></div>}
    {active.report&&<div className={s.downloads}><button onClick={()=>downloadReport(active,task!.title)}>下载文字报告</button>{active.files.map(f=><a key={f.id} href={'/api/capabilities/document-workflow/file?'+new URLSearchParams({id:task!.id,file:f.id})} download={f.name}>↓ {f.name}</a>)}</div>}<MessageTime value={active.finishedAt??active.createdAt} label={active.finishedAt?'生成时间':'提交时间'}/>
   </article>:<div className={s.empty}><span aria-hidden="true">✦</span><h2>你的下一份报告，从这里开始</h2><p>上传文档后，手动选择 workload-estimator<br/>或 iDOC 项目估算技能，再点击生成。</p><div className={s.path}>文档 <b>→</b> 解析 <b>→</b> 技能 <b>→</b> 报告</div></div>}
  </main></div>
 </section>
}
