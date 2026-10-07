import React from 'react'
import css from './enable-switch.module.css'

/** Shared enablement control. Runtime health is rendered separately by callers. */
export function EnableSwitch({checked, busy, disabled, label, reason, onChange}: {checked:boolean;busy?:boolean;disabled?:boolean;label:string;reason?:string;onChange:(value:boolean)=>void}) {
 return <button type="button" role="switch" aria-checked={checked} aria-label={label} aria-busy={busy || undefined} title={reason ?? label} disabled={disabled || busy} className={css.switch} data-on={checked} onClick={event=>{event.stopPropagation();onChange(!checked)}}><span>{busy?'…':''}</span></button>
}
