import React, { useState, useSyncExternalStore } from 'react'
import { FileSearchForm } from '../../../../shared/client/FileSearchForm.tsx'
import { fileSearchClient, searchDesktop } from '../../../../shared/client/file-search-client.ts'
import s from './FileSearchView.module.css'
export function FileSearchView({ id = 'new', roleId }: { id?: string; roleId?: string }) {
  const client = fileSearchClient(), state = useSyncExternalStore(client.subscribe, client.getSnapshot), row = state.rows.find(r => r.id === id), pending = state.request?.id === id, [notice, setNotice] = useState('')
  const copy = async (path: string) => { try { await navigator.clipboard.writeText(path); setNotice('路径已复制') } catch { setNotice('复制失败，请选择结果路径手动复制') } }
  const reveal = async (path: string) => { try { const bridge = searchDesktop(); if (!bridge?.revealSearchResult) throw Error('请在桌面端定位文件，或复制路径'); await bridge.revealSearchResult(path); setNotice('') } catch (e) { setNotice((e as Error).message) } }
  return <section className={s.view} aria-label="本地文件搜索结果"><h3>{row?.title || '本地文件搜索'}</h3><FileSearchForm roleId={roleId}/>
    <p className={s.muted}>输入部分文件名即可查找，空格分隔多个关键词；支持 * 和 ?。路径留空为全局搜索。</p>
    {pending && state.busy && <p role="status">正在搜索… <button onClick={() => void client.cancel()}>取消搜索</button></p>}
    {pending && state.error && <p role="alert">{state.error}</p>}{notice && <p role="status">{notice}</p>}
    {row && <><p className={s.muted}>{row.roleName} · {new Date(row.createdAt).toLocaleString()}<br/>范围：{row.path || '全部已索引的本地位置'} · 关键词：{row.query} · {row.items.length} 项{row.hasMore ? '（仅显示前 200 项，请缩小范围）' : ''}</p>
      {!row.items.length ? <p>没有匹配结果，请尝试更短的关键词或清空路径。</p> : <div className={s.list}>{row.items.map(item => <article className={s.item} key={item.path}><div className={s.info}><strong>{item.name}</strong><span className={s.path}>{item.path}</span><small>{item.directory ? '文件夹' : item.size === null ? '文件' : (item.size / 1024).toFixed(1) + ' KB'}{item.modifiedAt && ' · ' + item.modifiedAt.replace('T', ' ')}</small></div><div className={s.actions}><button onClick={() => void reveal(item.path)}>所在位置</button><button onClick={() => void copy(item.path)}>复制路径</button></div></article>)}</div>}
    </>}
  </section>
}
