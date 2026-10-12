import { fileSearchCommand } from '../../../../shared/client/file-search-client.ts'
import React,{useState,useSyncExternalStore} from 'react'
import {recordingClient,recordingCommand,recordingTime} from '../../../../shared/client/recording-client.ts'
import {RecordingControls} from '../../../../shared/client/RecordingControls.tsx'
import s from './Chat.module.css'
export function RecordingView({id}:{id:string}){
 const c=recordingClient(),state=useSyncExternalStore(c.subscribe,c.getSnapshot),row=state.rows.find(r=>r.id===id),[draft,setDraft]=useState(''),[error,setError]=useState('')
 const send=async()=>{if(!draft.trim())return;if(fileSearchCommand(draft)||recordingCommand(draft)){setDraft('');return}try{await c.command(id,'note',{text:draft});setDraft('');setError('')}catch(e){setError(String(e))}}
 if(!row)return <p role="status">正在读取录音…</p>
 const active=state.activeId===id,live=row.status==='recording'||row.status==='paused'
 return <section style={{height:'100%',display:'flex',flexDirection:'column',padding:'20px 28px',boxSizing:'border-box',gap:16}}>
  <div style={{flex:1,overflowY:'auto'}}><h3 style={{fontSize:18}}>{row.title}</h3><p>{row.roleName} · {{recording:'正在录音',paused:'已暂停',finished:'录音已保存',interrupted:'录音已中断，已保存的部分可回听',cancelled:'录音已取消'}[row.status]} · {recordingTime(active?state.elapsed:row.durationMs)}</p>
   {active&&<RecordingControls/>}
   {live&&!active&&<button onClick={()=>void c.command(id,'recover').catch(e=>setError(e.message))}>恢复已保存部分</button>}
   {row.audio&&<div style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}><audio controls preload="metadata" src={'/api/capabilities/recording/audio?id='+id}/><a href={'/api/capabilities/recording/audio?id='+id} download={row.title+(row.audio.endsWith('.webm')?'.webm':'.m4a')}>下载录音</a></div>}
   {row.warning&&<p role="status">{row.warning}</p>}
   <small style={{fontSize:12,opacity:.7}}>创建于 {new Date(row.createdAt).toLocaleString()}{!live&&<> · 保存于 {new Date(row.updatedAt).toLocaleString()}</>}</small>
   {row.notes.map((note,i)=><div key={i} className={s.card} style={{marginTop:16,whiteSpace:'pre-wrap'}}>{note.text}<footer style={{fontSize:12,opacity:.7,marginTop:8}}>{new Date(note.at).toLocaleString()}</footer></div>)}
  </div>
  {(error||state.error)&&<p role="alert">{error||state.error}</p>}
  <div className={s.card}><textarea className={s.input} aria-label="录音会话输入" placeholder="添加录音备注，或输入暂停录音、继续录音、完成录音" value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void send()}}}/><div className={s.row}><small>录音与备注保存在当前岗位会话中</small><button className={s.send} aria-label="发送录音备注" onClick={()=>void send()}>↑</button></div></div>
 </section>
}
