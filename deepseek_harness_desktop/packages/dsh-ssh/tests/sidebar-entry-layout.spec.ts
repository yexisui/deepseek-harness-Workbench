import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('../src/client/panel/panel.module.css', import.meta.url), 'utf8')
const source = readFileSync(new URL('../src/client/sidebar-entry.ts', import.meta.url), 'utf8')

// The three sidebar entry rows of this repository (ssh, task board, skill explorer) must
// share one geometry baseline; the board and the skill explorer use gap: 8px (#1535).
const siblingEntryGaps = [
  new URL('../../dsh-task-board/src/client/board.module.css', import.meta.url),
  new URL('../../dsh-skill-explorer/src/client/skill-panel.module.css', import.meta.url),
].map((url) => ({
  path: url.pathname.split('/packages/')[1] ?? url.pathname,
  gap: readFileSync(url, 'utf8').match(/\.entry\s*\{([^}]*)\}/s)?.[1]?.match(/gap:\s*([^;]+);/)?.[1],
}))

describe('SSH sidebar entry layout (#872)', () => {
  it('uses an explicit navigation icon box and visible 18px glyph', () => {
    expect(source).toContain('width="18" height="18"')
    expect(css).toMatch(/\.entryIcon\s*\{[^}]*width:\s*24px;[^}]*height:\s*24px;/s)
    expect(css).toMatch(/\.entryIcon svg\s*\{[^}]*width:\s*18px;[^}]*height:\s*18px;/s)
    expect(css).toMatch(/\.entry:hover\s*\{[^}]*var\(--dsw-alias-interactive-bg-hover\)/s)
    expect(css).toMatch(/\.entry\[data-active\]\s*\{[^}]*var\(--dsw-alias-interactive-bg-active\)/s)
  })

  it('shares the 8px icon-to-label gap of the sibling entry rows (#1535)', () => {
    expect(css).toMatch(/\.entry\s*\{[^}]*gap:\s*8px;/s)
    for (const sibling of siblingEntryGaps) {
      expect(sibling.gap, sibling.path).toBe('8px')
    }
  })

  it('centers a fixed-size target in the collapsed sidebar rail', () => {
    expect(css).toContain(':global([data-sidebar-collapsed]) .entry')
    expect(css).toContain(':global([data-dsh-frame][data-sidebar-collapsed]) .entry')
    const collapsed = css.match(/:global\([^)]*\[data-sidebar-collapsed\][^)]*\) \.entry\s*\{([^}]*)\}/s)?.[1] ?? ''
    expect(collapsed).toContain('width: 36px')
    expect(collapsed).toContain('min-height: 36px')
    expect(collapsed).toContain('margin: 0 auto 12px')
    expect(collapsed).toContain('border-radius: 50%')
  })
})
