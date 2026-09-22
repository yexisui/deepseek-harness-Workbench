// @vitest-environment jsdom
import React, { useState } from 'react'
import { afterEach, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { withCapabilityNavigation } from '../src/client/CapabilityNavigation.tsx'
afterEach(() => { cleanup(); sessionStorage.clear() })
it('opens the linked inventory without preventing a later manual tab selection', () => {
  sessionStorage.setItem('workbench-capability-link', JSON.stringify({ section: 'plugins', moduleName: 'test' }))
  function Section() { const [active, set] = useState('configurable'); return <><button role="tab" id="sdk-tab-all" onClick={() => set('all')}>插件列表</button><button onClick={() => set('configurable')}>配置</button><p data-testid="active">{active}</p></> }
  const Wrapped = withCapabilityNavigation(Section); render(<Wrapped/>)
  expect(screen.getByTestId('active').textContent).toBe('all')
  fireEvent.click(screen.getByText('配置')); expect(screen.getByTestId('active').textContent).toBe('configurable')
})
