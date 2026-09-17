import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Skin settings layer and composer demotion regression (Issue #1368)', () => {
  const skinsDir = resolve(__dirname, '../skins')

  it('maid-atelier demotes composer seat and card when settings open', () => {
    const css = readFileSync(resolve(skinsDir, 'maid-atelier/patches.css'), 'utf-8')

    expect(css).toMatch(/body\[data-maid-settings-open\]\s+:is\(\[data-pane="sidebar"\],\s*\[class\*="sidebarCol"\]\)\s*>\s*div\s*>\s*:has\(\[data-slot="sidebar\.settings"\]\s+:is\(button,\s*\[role="button"\]\)\[aria-expanded="true"\]\)/)

    expect(css).toMatch(/body\[data-maid-settings-open\]\s+:is\(\[data-composer-seat\],\s*\[data-slot="conversation\.composer"\],\s*\[data-composer-card\]\)\s*\{\s*z-index:\s*0\s*!important;/)
  })

  it('phoebe-atelier releases footer stacking context and demotes composer seat when settings open', () => {
    const css = readFileSync(resolve(skinsDir, 'phoebe-atelier/skin.css'), 'utf-8')

    expect(css).toMatch(/body\[data-phoebe-settings-open\]\s+\[data-phoebe-sidebar-footer\][\s\S]*?z-index:\s*auto\s*!important;/)

    expect(css).toMatch(/body\[data-phoebe-settings-open\]\s+:is\(\[data-composer-seat\],\s*\[data-slot='conversation\.composer'\],\s*\[data-composer-card\]\)\s*\{\s*z-index:\s*0\s*!important;/)
  })
})
