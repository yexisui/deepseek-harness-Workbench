import React, { useEffect, useState } from 'react'
import type { DeveloperProject } from '../../../dsh-capabilities/src/core/developer-model.ts'
import { developerApi } from './developer-client.ts'
import s from './ManagedCapabilities.module.css'
type Config = DeveloperProject & { candidates: { name: string; command: string }[] }
/** One form and API for the workspace and the capability's default-configuration page. */
export function DeveloperProjectSettings({ cwd: initial, disabled = false, onSaved, onEditingChange }: { cwd?: string; disabled?: boolean; onSaved?: () => void; onEditingChange?: (value: boolean) => void }) {
  const [cwd, setCwd] = useState(initial ?? ''), [projects, setProjects] = useState<{ path: string; name: string }[]>([]), [config, setConfig] = useState<Config | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  useEffect(() => { if (!initial) void developerApi<typeof projects>('projects').then(setProjects).catch(e => setError(e.message)) }, [initial])
  useEffect(() => { let alive = true; setConfig(null); if (cwd) void developerApi<Config>('project', { cwd }).then(c => { if (alive) setConfig(c) }).catch(e => { if (alive) setError(e.message) }); return () => { alive = false } }, [cwd])
  const change = (value: Config) => { setConfig(value); onEditingChange?.(true) }
  return <div className={s.page}><p>配置作用于所选项目的新验证。模型沿用工作台账户，在对话中选择；项目内文件默认只读。</p>{!initial && <label>项目<select aria-label="配置的项目" value={cwd} onChange={e => setCwd(e.target.value)}><option value="">选择已登记项目</option>{projects.map(p => <option value={p.path} key={p.path}>{p.name} · {p.path}</option>)}</select></label>}
    <small>{cwd}</small>{config && <><h4>验证命令</h4><p>保存后可在“运行”页主动执行。脚本使用本机权限运行，工作目录固定为此项目。</p>
      {config.commands.map((c, i) => <div className={s.row} key={c.id}><input aria-label={`检查名称 ${i + 1}`} value={c.name} disabled={disabled} onChange={e => change({ ...config, commands: config.commands.map(v => v.id === c.id ? { ...v, name: e.target.value } : v) })}/><input aria-label={`检查命令 ${i + 1}`} value={c.command} disabled={disabled} onChange={e => change({ ...config, commands: config.commands.map(v => v.id === c.id ? { ...v, command: e.target.value } : v) })}/><button disabled={disabled} aria-label={'移除检查 ' + c.name} onClick={() => change({ ...config, commands: config.commands.filter(v => v.id !== c.id) })}>移除</button></div>)}
      <div className={s.actions}><button disabled={disabled} onClick={() => change({ ...config, commands: [...config.commands, { id: crypto.randomUUID(), name: '', command: '' }] })}>添加命令</button>{config.candidates.filter(c => !config.commands.some(v => v.command === c.command)).map(c => <button key={c.name} disabled={disabled} onClick={() => change({ ...config, commands: [...config.commands, { ...c, id: crypto.randomUUID() }] })}>加入 {c.name}</button>)}</div>
      <label>外部编辑器<select aria-label="外部编辑器" disabled={disabled} value={config.editor} onChange={e => change({ ...config, editor: e.target.value as Config['editor'] })}><option value="none">未配置</option><option value="vscode">本机 VS Code（需已安装）</option></select></label>
      <button className={`${s.button} ${s.primary}`} disabled={disabled || busy} onClick={() => { setBusy(true); setError(''); void developerApi<Config>('project', {}, { cwd, revision: config.revision, settings: { commands: config.commands, editor: config.editor } }).then(c => { setConfig(c); onEditingChange?.(false); onSaved?.() }).catch(e => setError(e.message)).finally(() => setBusy(false)) }}>{busy ? '保存中…' : '保存项目设置'}</button></>}
    {error && <p role="alert">{error}</p>}
  </div>
}
