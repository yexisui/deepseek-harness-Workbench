import React,{useEffect,useRef} from 'react'
import s from './RequirementsAssistant.module.css'
export function RequirementsTabBar<T extends string>({ items, value, label, onChange }: { items: readonly (readonly [T, string])[]; value: T; label: string; onChange: (value: T) => void }) {
  return <div className={s.tabs} role="tablist" aria-label={label}>{items.map(([key, name], index) => <button type="button" key={key} role="tab" aria-selected={value === key} tabIndex={value === key ? 0 : -1} onClick={() => onChange(key)} onKeyDown={event => {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return
    event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length
    onChange(items[next][0]); (event.currentTarget.parentElement?.children[next] as HTMLButtonElement)?.focus()
  }}>{name}</button>)}</div>
}
export function RequirementsModal({ title, children, footer, onClose }: { title: string; children: React.ReactNode; footer?: React.ReactNode; onClose: () => void }) {
  const dialog = useRef<HTMLDivElement>(null)
  const close = useRef(onClose); close.current = onClose
  useEffect(() => { const previous = document.activeElement as HTMLElement | null; dialog.current?.focus(); return () => { if (previous?.isConnected) previous.focus() } }, [])
  return <div className={s.overlay} onMouseDown={e => { if (e.target === e.currentTarget) close.current() }}><div ref={dialog} className={s.dialog} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} onKeyDown={e => {
    if (e.key === 'Escape') { e.stopPropagation(); close.current() }
    if (e.key === 'Tab') { const focusable = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]') ?? []); const first = focusable[0], last = focusable.at(-1); if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { e.preventDefault(); last?.focus() } else if (!e.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { e.preventDefault(); first?.focus() } }
  }}><header><h2>{title}</h2><button type="button" onClick={onClose} aria-label="关闭面板">×</button></header><div className={s.dialogBody}>{children}</div>{footer && <footer>{footer}</footer>}</div></div>
}
