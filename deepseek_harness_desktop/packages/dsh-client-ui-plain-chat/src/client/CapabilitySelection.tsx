import React, { useEffect, useRef } from 'react'
import s from './ManagedCapabilities.module.css'

export function CapabilitySelection({ checked, mixed = false, disabled = false, label, onChange }: { checked: boolean; mixed?: boolean; disabled?: boolean; label: string; onChange: () => void }) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { if (ref.current) ref.current.indeterminate = mixed }, [mixed])
  return <label className={s.recycleSelect} title={label}><input ref={ref} type="checkbox" checked={checked} disabled={disabled} aria-label={label} onChange={onChange}/><span className={s.selectionMark} aria-hidden="true">{mixed ? <svg viewBox="0 0 20 20"><path d="M5 10h10"/></svg> : checked ? <svg viewBox="0 0 20 20"><path d="m4 10 4 4 8-8"/></svg> : null}</span></label>
}
