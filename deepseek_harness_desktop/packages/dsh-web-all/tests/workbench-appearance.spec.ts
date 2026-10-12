/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from 'vitest'
import { BLANK_ICON, installWorkbenchAppearance, workbenchTitle } from '../src/client/workbench-appearance.ts'

let dispose: (() => void) | undefined
afterEach(() => { dispose?.(); dispose = undefined; document.head.innerHTML = ''; document.body.innerHTML = '' })
const settle = async () => { await new Promise(resolve => setTimeout(resolve, 0)) }

describe('workbench presentation', () => {
  it('keeps conversation and skin names while removing product suffixes', () => {
    expect(workbenchTitle('会议纪要 — DeepSeek Harness')).toBe('会议纪要')
    expect(workbenchTitle('深海女仆工坊 · DeepSeek Harness')).toBe('深海女仆工坊')
    expect(workbenchTitle('Windows XP · DeepSeek 在线')).toBe('Windows XP')
    expect(workbenchTitle('ORCA LINK · DSH')).toBe('ORCA LINK')
    expect(workbenchTitle('DeepSeek Harness')).toBe('工作台')
    expect(workbenchTitle('我的 DeepSeek 模型配置')).toBe('我的 DeepSeek 模型配置')
  })

  it('handles later session titles, inserted skin icons, and skin cleanup', async () => {
    document.title = 'DeepSeek Harness'
    const originalIcon = document.createElement('link')
    originalIcon.rel = 'icon'; originalIcon.href = '/favicon.svg'; document.head.append(originalIcon)
    dispose = installWorkbenchAppearance()
    expect(document.title).toBe('工作台')
    expect(originalIcon.getAttribute('href')).toBe(BLANK_ICON)
    document.title = '办公用品流程 — DeepSeek Harness'
    const skinIcon = document.createElement('link')
    skinIcon.rel = 'icon'; skinIcon.href = '/skins/whale-icon.png'; document.head.append(skinIcon)
    await settle()
    expect(document.title).toBe('办公用品流程')
    expect(skinIcon.getAttribute('href')).toBe(BLANK_ICON)
    skinIcon.remove(); document.title = 'DeepSeek Harness'; await settle()
    expect(document.title).toBe('工作台')
    dispose(); dispose = undefined
    expect(originalIcon.getAttribute('href')).toBe('/favicon.svg')
    expect(document.querySelector('[data-dsh-compat="appearance"]')).toBeNull()
  })
})
