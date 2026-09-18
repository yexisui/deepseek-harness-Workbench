// @vitest-environment jsdom
import React, { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { withAppearanceNavigation } from '../src/client/AppearanceNavigation.tsx'
import { createSettingsNavigation } from '../src/client/role-ui-state.ts'

it('groups the three original navigation buttons while preserving page selection and collapsing', async () => {
  ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
  const select = vi.fn()
  const rows = ['general', 'skin-center', 'pet', 'dsh-workshop', 'usage']
  function SettingsPanel({ activeId, onSelect }: any) {
    return <div role="dialog"><nav><div>{rows.map(id => <button key={id} className="original-nav" aria-current={id === activeId ? 'true' : undefined} onClick={() => onSelect(id)}>{id}</button>)}</div></nav><main>{activeId}</main></div>
  }
  function SettingsRoot() {
    const [activeId, setActiveId] = useState('general')
    return <><SettingsPanel activeId={activeId} onSelect={(id: string) => { select(id); setActiveId(id) }} /></>
  }
  const Grouped = withAppearanceNavigation(SettingsRoot, () => '外观')
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    await act(async () => root.render(<Grouped />))
    const disclosure = container.querySelector('details')!
    expect(disclosure.open).toBe(false)
    expect(disclosure.querySelector('summary')!.textContent).toBe('外观')
    expect(Array.from(disclosure.querySelectorAll('button')).map(button => button.textContent)).toEqual(['skin-center', 'pet', 'dsh-workshop'])
    expect(container.querySelector('nav > div > button')!.textContent).toBe('general')
    for (const id of ['skin-center', 'pet', 'dsh-workshop']) {
      await act(async () => { Array.from(disclosure.querySelectorAll('button')).find(button => button.textContent === id)!.click() })
      expect(container.querySelector('main')!.textContent).toBe(id)
      expect(select).toHaveBeenLastCalledWith(id)
      expect(disclosure.open).toBe(true)
      expect(disclosure.querySelector('[aria-current="true"]')!.textContent).toBe(id)
    }
    await act(async () => { disclosure.querySelector('summary')!.click() })
    expect(disclosure.open).toBe(false)
    expect(container.querySelector('main')!.textContent).toBe('dsh-workshop')
  } finally {
    await act(async () => root.unmount())
    container.remove()
  }
})

it('opens Agent presets from the main UI even after settings have been closed', async () => {
  ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
  function SettingsPanel({ activeId, onSelect, onClose }: any) {
    return <div role="dialog"><button onClick={() => onSelect('general')}>General</button><button onClick={onClose}>Close</button><main>{activeId}</main></div>
  }
  function SettingsRoot() {
    const [open, setOpen] = useState(false)
    const [active, setActive] = useState('general')
    return <><button aria-haspopup="dialog" onClick={() => setOpen(true)}>Settings</button>{open && <SettingsPanel activeId={active} onSelect={setActive} onClose={() => { setOpen(false); setActive('general') }} />}</>
  }
  const navigation = createSettingsNavigation()
  const Grouped = withAppearanceNavigation(SettingsRoot, () => '外观', navigation)
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    await act(async () => root.render(<Grouped />))
    for (let attempt = 0; attempt < 2; attempt++) {
      await act(async () => navigation.openPresets())
      expect(container.querySelector('main')!.textContent).toBe('agent-presets')
      await act(async () => { Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'Close')!.click() })
      expect(container.querySelector('[role="dialog"]')).toBeNull()
    }
  } finally { await act(async () => root.unmount()); container.remove() }
})
