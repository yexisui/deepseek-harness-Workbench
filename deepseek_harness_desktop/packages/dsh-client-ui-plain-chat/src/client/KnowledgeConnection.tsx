import React, {useEffect, useRef, useState} from 'react'
import {useLeaveGuard} from '../../../dsh-plugin-manager/src/client/workbench-navigation.ts'
import {PillCheckbox} from '../../../../shared/client/PillCheckbox.tsx'
import s from './ManagedCapabilities.module.css'

type Connection = {name: string; baseUrl: string; hasApiKey: boolean; configured: boolean; editable: boolean; revision: number}
async function api(path: string, body?: object) {
  const response = await fetch('/api/capabilities/knowledge/' + path, {method: body ? 'POST' : 'GET', credentials: 'same-origin', headers: body ? {'content-type':'application/json'} : {}, body: body ? JSON.stringify(body) : undefined})
  const value = await response.json(); if (!response.ok) throw Error(value.error || '知识库配置操作失败'); return value
}
export function KnowledgeConnectionEditor({disabled, onEditingChange, onSaved}: {disabled?: boolean; onEditingChange?: (value: boolean)=>void; onSaved: ()=>Promise<void>}) {
  const [config,setConfig]=useState<Connection>(),[editing,setEditing]=useState(false),[name,setName]=useState(''),[baseUrl,setUrl]=useState(''),[apiKey,setKey]=useState(''),[clearKey,setClear]=useState(false)
  const [busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),sequence=useRef(0)
  const reload=async()=>{try{const value=await api('config');setConfig(value);return value as Connection}catch(e){setError(e instanceof Error?e.message:'配置读取失败')}}
  useEffect(()=>{void reload();return()=>{sequence.current++}},[])
  const stop=()=>{sequence.current++;setEditing(false);setKey('');setBusy('');setError('');setNotice('');onEditingChange?.(false)}
  useLeaveGuard(editing,stop)
  const start=async()=>{const value=await reload();if(!value)return;setName(value.name);setUrl(value.baseUrl);setKey('');setClear(false);setError('');setNotice('');setEditing(true);onEditingChange?.(true)}
  const payload=()=>({revision:config?.revision,name,baseUrl,...(apiKey?{apiKey}:{}),clearKey})
  const run=async(action:'check'|'save'|'reset')=>{
    const seq=++sequence.current;setBusy(action);setError('');setNotice('')
    try {
      const result=await api(action==='check'?'check':'config',action==='reset'?{revision:config?.revision,reset:true}:payload())
      if(seq!==sequence.current)return
      if(action==='check'){if(!result.verified)throw Error(result.message);setNotice(`连接检测通过，发现 ${result.collections.length} 个资料集。当前填写尚未保存。`)}
      else{setConfig(result);stop();setNotice(action==='reset'?'连接已移除，历史检索结果保留。':'连接已保存，后续检索立即使用。');await onSaved()}
    }catch(e){if(seq===sequence.current)setError(e instanceof Error?e.message:'配置操作失败')}
    finally{if(seq===sequence.current)setBusy('')}
  }
  const changed=()=>{setNotice('');setError('')}
  return <div data-knowledge-connection>
    <div className={s.row}><div style={{minWidth:0,overflowWrap:'anywhere'}}><strong>服务连接</strong><small>{config?.configured?`${config.name} · ${config.baseUrl}`:'尚未配置连接'}</small><small>所有助手共用连接，各岗位分别选择可引用的资料集。</small></div>{!editing&&<button className={s.button} disabled={disabled||busy!==''||config?.editable===false} onClick={()=>void start()}>配置连接</button>}</div>
    {editing&&<div className={s.fields}>
      <label className={s.field}>连接名称<input aria-label="连接名称" value={name} disabled={!!busy} onChange={e=>{setName(e.target.value);changed()}} placeholder="例如：蟹黄堡示例知识库"/></label>
      <label className={s.field}>服务地址<input aria-label="知识库服务地址" value={baseUrl} disabled={!!busy} onChange={e=>{setUrl(e.target.value);changed()}} placeholder="http://127.0.0.1:18766"/></label>
      <label className={s.field}>API Key（可选）<input type="password" autoComplete="new-password" aria-label="知识库 API Key" value={apiKey} disabled={!!busy||clearKey} onChange={e=>{setKey(e.target.value);changed()}} placeholder={config?.hasApiKey?'已保存；地址不变时留空保留':'本地示例无需填写'}/></label>
      {config?.hasApiKey&&<label className={s.check}><PillCheckbox checked={clearKey} disabled={!!busy} onChange={e=>{setClear(e.target.checked);setKey('');changed()}}/>清除已保存的密钥</label>}
      <p className={s.muted}>支持工作台 HTTP 检索协议（workbench-knowledge-v1）。填写服务根地址，不直接填写向量数据库地址。更换地址时需重新填写密钥；检测只读取资料集，不上传文档。密钥仅在服务端保存。</p>
      <div className={s.actions}><button className={s.button} disabled={!!busy||!name.trim()||!baseUrl.trim()} onClick={()=>void run('check')}>{busy==='check'?'检测中…':'测试连接'}</button><button className={`${s.button} ${s.primary}`} disabled={!!busy||!name.trim()||!baseUrl.trim()} onClick={()=>void run('save')}>{busy==='save'?'保存中…':'保存连接'}</button><button className={s.button} disabled={!!busy} onClick={stop}>取消</button>{config?.configured&&<button className={s.button} disabled={!!busy} onClick={()=>void run('reset')}>移除连接</button>}</div>
    </div>}
    {error&&<p className={s.error} role="alert">{error}</p>}{notice&&<p className={s.notice} role="status">{notice}</p>}
  </div>
}
