import React, { useEffect, useId, useRef, useState } from 'react'
import s from './RequirementsAssistant.module.css'

export interface ProjectFolderBridge {
  selectProjectDirectory: () => Promise<string | null>
  getPathForFile: (file: File) => string
  resolveProjectPaths: (paths: string[]) => Promise<{ path: string; detected: boolean }>
}

type Props = {
  value: string
  onChange: (path: string) => void
  disabled: boolean
  onBusyChange: (busy: boolean) => void
}

export function ProjectFolderPicker({ value, onChange, disabled, onBusyChange }: Props) {
  const bridge = (window as Window & { desktop?: Partial<ProjectFolderBridge> }).desktop
  const [pending, setPending] = useState(false), [dragging, setDragging] = useState(false)
  const [error, setError] = useState(''), [notice, setNotice] = useState('')
  const active = useRef(true), working = useRef(false), id = useId()
  const unavailable = '请在新版桌面端选择项目根目录或拖入项目文件；也可以在这里粘贴项目根目录的完整路径。'
  useEffect(() => { active.current = true; return () => { active.current = false; onBusyChange(false) } }, [onBusyChange])

  async function run(action: () => Promise<{ path: string; message: string } | null>) {
    if (disabled || working.current) return
    working.current = true; setPending(true); onBusyChange(true); setError(''); setNotice('')
    try {
      const result = await action()
      if (active.current && result) { onChange(result.path); setNotice(result.message) }
    } catch (cause) {
      if (active.current) setError(cause instanceof Error ? cause.message : '无法识别项目路径，请重新选择项目根目录。')
    } finally {
      working.current = false
      if (active.current) { setPending(false); onBusyChange(false) }
    }
  }

  const choose = () => run(async () => {
    if (!bridge?.selectProjectDirectory) throw Error(unavailable)
    const path = await bridge.selectProjectDirectory()
    return path ? { path, message: '已选择项目根目录，点击“关联项目”保存。' } : null
  })

  const drop = (files: File[]) => run(async () => {
    if (!bridge?.getPathForFile || !bridge.resolveProjectPaths) throw Error(unavailable)
    if (!files.length) throw Error('请拖入本机项目文件夹或项目中的文件。')
    const paths = files.map(file => bridge.getPathForFile!(file))
    if (paths.some(path => !path)) throw Error('无法获取文件的本机路径，请使用“选择项目根目录”。')
    const result = await bridge.resolveProjectPaths(paths)
    return { path: result.path, message: result.detected
      ? '已识别项目根目录，请核对路径后点击“关联项目”。'
      : '未找到项目标记，已使用文件所在文件夹；可调整路径后关联。' }
  })

  return <div className={s.projectPicker} role="group" aria-label="项目根目录选择框" aria-busy={pending}
    data-dragging={dragging} data-disabled={disabled || pending}
    onDragOver={event => { event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = disabled || pending ? 'none' : 'copy'; if (!disabled && !pending) setDragging(true) }}
    onDragLeave={event => { if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setDragging(false) }}
    onDrop={event => { event.preventDefault(); event.stopPropagation(); setDragging(false); if (!disabled && !pending) void drop(Array.from(event.dataTransfer.files)) }}>
    <label htmlFor={id}>项目根目录</label>
    <div className={s.projectPickerRow}>
      <input id={id} aria-label="项目文件夹路径" aria-describedby={`${id}-hint`} value={value}
        placeholder="选择项目根目录，或粘贴项目根目录路径" disabled={disabled || pending}
        onChange={event => { onChange(event.target.value); setError(''); setNotice('') }}/>
      <button type="button" disabled={disabled || pending} onClick={() => void choose()}>
        {pending ? '正在识别…' : '选择项目根目录'}
      </button>
    </div>
    <p id={`${id}-hint`} className={s.projectPickerHint}>
      {bridge?.selectProjectDirectory
        ? '选中项目文件夹后，点击“确认根目录”即可；也可将文件夹或项目内文件拖到此处。'
        : unavailable}
    </p>
    {notice && <p className={s.projectPickerHint} role="status">{notice}</p>}
    {error && <p className={s.projectPickerError} role="alert">{error}</p>}
  </div>
}
