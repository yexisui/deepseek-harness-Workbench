import { PillCheckbox } from '../../../../shared/client/PillCheckbox.tsx'
import React, { useEffect, useRef } from 'react'
import s from './ManagedCapabilities.module.css'

export function CapabilitySelection({ checked, mixed = false, disabled = false, label, onChange }: { checked: boolean; mixed?: boolean; disabled?: boolean; label: string; onChange: () => void }) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { if (ref.current) ref.current.indeterminate = mixed }, [mixed])
  return <label className={s.recycleSelect} title={label}><PillCheckbox ref={ref} type="checkbox" checked={checked} disabled={disabled} aria-label={label} onChange={onChange}/></label>
}
