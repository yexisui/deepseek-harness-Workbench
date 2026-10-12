import React, { useState, useSyncExternalStore } from 'react'
import { fileSearchClient, searchDesktop } from './file-search-client.ts'
import s from './FileSearchForm.module.css'
export function SearchIcon({ kind = 'search' }: { kind?: 'search' | 'folder' | 'back' }) {
  return <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">{kind === 'folder' ? <path d="M3 7V5h7l2 3h9v12H3zM3 10h18"/> : kind === 'back' ? <path d="m15 5-7 7 7 7"/> : <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>}</svg>
}
export function FileSearchForm({ compact = false, roleId, onPickingChange }: { compact?: boolean; roleId?: string; onPickingChange?: (picking: boolean) => void }) {
  const client = fileSearchClient(), state = useSyncExternalStore(client.subscribe, client.getSnapshot), [error, setError] = useState(''), [picking, setPicking] = useState(false)
  const pick = async () => {
    const bridge = searchDesktop(); if (!bridge?.selectSearchDirectory) { setError('请在桌面端选择文件夹，或直接填写宿主机器的完整路径'); return }
    setPicking(true); onPickingChange?.(true); setError('')
    try { const path = await bridge.selectSearchDirectory(state.path); if (path !== null) client.draft({ path }) } catch (e) { setError((e as Error).message) }
    finally { setPicking(false); onPickingChange?.(false) }
  }
  return <form className={`${s.form} ${compact ? s.compact : ''}`} aria-label="本地文件搜索" onSubmit={e => { e.preventDefault(); void client.search(roleId) }} onPointerDown={e => e.stopPropagation()} onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter' && e.nativeEvent.isComposing) e.preventDefault() }}>
    <div className={s.field}><input aria-label="搜索路径（可选，留空全局搜索）" placeholder="路径（留空全局）" value={state.path} onChange={e => client.draft({ path: e.target.value })} spellCheck={false}/><button type="button" className={s.folder} disabled={picking} aria-label="选择搜索文件夹" title="选择文件夹" onClick={() => void pick()}><SearchIcon kind="folder"/></button></div>
    <div className={s.field}><input aria-label="搜索内容" placeholder="搜索内容" required maxLength={500} value={state.query} onChange={e => client.draft({ query: e.target.value })}/><button type="submit" disabled={state.busy || !state.query.trim()} aria-label="搜索本地文件" title="搜索"><SearchIcon/></button></div>
    {error && <p className={s.error} role="alert">{error}</p>}
  </form>
}
