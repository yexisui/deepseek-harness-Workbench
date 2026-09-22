import React, { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import s from './Roles.module.css'

export function Modal({ title, onClose, children, wide = false, closeLabel, className = '' }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean; closeLabel: string; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const dialog = ref.current!
    dialog.showModal()
    return () => { dialog.close(); if (previous?.isConnected) previous.focus() }
  }, [])
  return createPortal(<dialog ref={ref} className={`${s.dialog} ${wide ? s.wide : ''} ${className}`} aria-labelledby={titleId}
    onKeyDown={event => {
      if (event.key !== 'Escape') return
      // The settings shell also listens on document. Close only this top layer.
      event.stopPropagation()
      if (!event.defaultPrevented) { event.preventDefault(); onClose() }
    }}
    onCancel={event => { event.preventDefault(); event.stopPropagation(); onClose() }}>
    <div className={s.dialogHeader}><h2 id={titleId}>{title}</h2><button type="button" autoFocus className={s.close} onClick={onClose} aria-label={closeLabel}>×</button></div>
    {children}
  </dialog>, document.body)
}
