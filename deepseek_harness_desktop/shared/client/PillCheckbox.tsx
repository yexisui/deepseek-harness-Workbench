import React, { forwardRef, type InputHTMLAttributes } from 'react'
import css from './pill-checkbox.module.css'

/** Native selection/change semantics with the shared pill appearance, including mixed selection. */
export const PillCheckbox = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function PillCheckbox({className,...props},ref) {
  return <input {...props} ref={ref} type="checkbox" className={[css.pill,className].filter(Boolean).join(' ')}/>
})
