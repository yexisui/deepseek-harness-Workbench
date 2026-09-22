import React, { type CSSProperties } from 'react'
import type { Item } from './capability-catalog.ts'
import s from './Capabilities.module.css'

export function Icon({ item }: { item: Item }) {
  return <span className={s.icon} style={{ '--cap-color': item.color } as CSSProperties} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    {item.id === 'browser' ? <><circle cx="12" cy="12" r="9" /><ellipse cx="12" cy="12" rx="4" ry="9" /><path d="M3 12h18" /></>
      : item.id === 'documents' ? <><path d="M14 3H6v18h12V7zM14 3v5h4M9 12h6M9 16h6" /></>
      : item.id === 'sheets' ? <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M9 10v10M15 10v10M3 15h18" /></>
      : item.id === 'knowledge' ? <><path d="M12 6c-3-3-7-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V5c-2-1-6-2-9 1ZM12 6v15" /></>
      : item.id === 'files' ? <path d="M3 7V5h7l2 3h9v12H3z" />
      : <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 6 9 7 9-7" /></>}
  </svg></span>
}
