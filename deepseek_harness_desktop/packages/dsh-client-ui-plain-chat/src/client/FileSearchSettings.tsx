import React, { useEffect, useState, useSyncExternalStore } from 'react'
import { fileSearchApi, fileSearchClient, type FileSearchConfig } from '../../../../shared/client/file-search-client.ts'
import s from './ManagedCapabilities.module.css'
export function FileSearchSettings({ disabled = false, onEditingChange }: { disabled?: boolean; onEditingChange?: (value: boolean) => void }) {
  const client = fileSearchClient(), state = useSyncExternalStore(client.subscribe, client.getSnapshot), [role, setRole] = useState(''), [busy, setBusy] = useState(false), [notice, setNotice] = useState(''), [loaded, setLoaded] = useState(false)
  useEffect(() => { void client.refreshConfig() }, [client])
  useEffect(() => { if (state.config && !loaded) { setRole(state.config.roleId); setLoaded(true) } }, [state.config, loaded])
  const changed = loaded && role !== state.config?.roleId
  useEffect(() => { onEditingChange?.(changed); return () => onEditingChange?.(false) }, [changed, onEditingChange])
  const save = async () => { setBusy(true); setNotice(''); try { await fileSearchApi<FileSearchConfig>('config', { roleId: role }); await client.refreshConfig(); window.dispatchEvent(new Event('workbench-file-search-config-changed')); setNotice('已保存，下次搜索生效') } catch (e) { setNotice((e as Error).message) } finally { setBusy(false) } }
  return <div className={s.row} style={{ display: 'block' }}><strong>本地文件搜索</strong><p className={s.muted}>支持部分文件名、多关键词及 * / ? 通配符。路径留空搜索全部已索引的本地位置。</p>
    <p role="status">{state.config?.engine.message || state.error || '正在读取搜索状态…'}</p>
    <label>搜索归属岗位<select aria-label="搜索归属岗位" value={role} disabled={disabled || busy} onChange={e => { setRole(e.target.value); setNotice('') }} style={{ display: 'block', width: '100%', margin: '10px 0', padding: 10, borderRadius: 10 }}><option value="">请选择已绑定的岗位</option>{role && !state.config?.roles.some(r => r.id === role) && <option value={role} disabled>原岗位已不可用，请重新选择</option>}{state.config?.roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
    {state.config && !state.config.roles.length && <p>请先在岗位编辑中添加“本地文件搜索”能力。</p>}
    <div className={s.actions}><button className={s.button} disabled={disabled || busy || !role || !changed} onClick={() => void save()}>保存</button><button className={s.button} disabled={busy || !changed} onClick={() => { setRole(state.config?.roleId || ''); setNotice('') }}>取消</button><button className={s.button} disabled={busy} onClick={() => void client.refreshConfig()}>刷新状态</button><button className={s.button} disabled={disabled || !state.config?.ready || changed} onClick={client.open}>开始搜索</button></div>
    <p className={s.muted}>查询结果保存在该岗位下；移除搜索记录只移除记录，不删除原文件。</p>{notice && <p role="status">{notice}</p>}
  </div>
}
