import React from 'react'

// Stable module IDs keep custom names and translated labels independent of decoration.
const paths: Record<string, React.ReactNode> = {
  layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
  inbox: <><path d="m3 13 3-8h12l3 8v6H3v-6Z"/><path d="M3 13h5l2 3h4l2-3h5"/></>,
  chat: <path d="M21 11a8 8 0 0 1-8 8H8l-5 3V11a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8ZM7 9h10M7 13h6"/>,
  chip: <><rect x="6" y="6" width="12" height="12" rx="3"/><path d="M9 3v3m6-3v3M9 18v3m6-3v3M3 9h3m-3 6h3m12-6h3m-3 6h3"/><rect x="10" y="10" width="4" height="4" rx="1"/></>,
  folder: <path d="M3 7V5a2 2 0 0 1 2-2h5l3 4h6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Zm0 0h10"/>,
  plan: <><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 2h6v4H9zM9 11h6m-6 5h4"/></>,
  flow: <><rect x="8" y="2" width="8" height="6" rx="2"/><rect x="2" y="16" width="8" height="6" rx="2"/><rect x="14" y="16" width="8" height="6" rx="2"/><path d="M12 8v4H6v4m6-4h6v4"/></>,
  terminal: <><rect x="3" y="4" width="18" height="16" rx="3"/><path d="m7 9 3 3-3 3m6 0h4"/></>,
  shield: <path d="m12 3 8 3v6c0 4-5 8-8 9-3-1-8-5-8-9V6l8-3Zm-4 9 3 3 5-6"/>,
  spark: <><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z"/><path d="M20 2v4m-2-2h4"/></>,
  globe: <><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/></>,
  layout: <><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 9v12"/></>,
  chart: <><path d="M4 3v17h17M8 15v-4m5 4V7m5 8V4"/></>,
  refresh: <><path d="M20 7a9 9 0 0 0-15-2L2 8m0-5v5h5M4 17a9 9 0 0 0 15 2l3-3m0 5v-5h-5"/></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
  chevron: <path d="m9 5 7 7-7 7"/>,
}

const modules: Record<string, string> = {
  'core-0':'layers', 'core-1':'chip', 'core-2':'chat', 'core-3':'plan',
  'core-4':'chip', 'core-5':'terminal', 'core-6':'shield', 'core-7':'folder',
  'core-8':'spark', 'core-9':'flow', 'core-10':'globe', 'core-11':'layout',
  management:'grid', development:'terminal', maintenance:'chart', resources:'spark',
  community:'layout', local:'chat',
}

export function InventoryIcon({name, className}:{name:string;className?:string}) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[modules[name]??name]??paths.grid}</svg>
}
