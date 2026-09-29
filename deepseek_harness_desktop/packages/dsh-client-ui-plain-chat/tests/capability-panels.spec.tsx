// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CapabilityWorkbench } from '../src/client/CapabilityWorkbench.tsx'
import { zh, type ChatKey } from '../src/client/locales.ts'

describe('capability layout interactions', () => {
  let container: HTMLDivElement
  let root: Root
  let animate: ReturnType<typeof vi.fn>
  const t = (key: ChatKey) => zh[key]
  beforeEach(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div'); document.body.append(container)
    root = createRoot(container)
    animate = vi.fn(() => ({ cancel: vi.fn() }))
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    Element.prototype.animate = animate as any
    Element.prototype.setPointerCapture = vi.fn()
    Element.prototype.releasePointerCapture = vi.fn()
  })
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); delete (Element.prototype as any).animate })
  const find = <T extends HTMLElement>(selector: string) => container.querySelector<T>(selector)!
  const click = async (selector: string) => act(async () => find(selector).click())
  const type = async (selector: string, value: string) => act(async () => {
    const element = find<HTMLInputElement | HTMLTextAreaElement>(selector)
    const prototype = element.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(element, value)
    element.dispatchEvent(new Event('input', { bubbles: true }))
  })
  const render = async () => act(async () => root.render(<CapabilityWorkbench t={t} onOpenRole={() => {}} mode="create" name="Test" form={<input aria-label="Role draft" defaultValue="Keep this" />} preview={<p>Preview</p>} />))

  it('keeps side panels mounted, preserves their state, and does not reopen settings on addition', async () => {
    await render()
    const inspector = find<HTMLElement>('aside')
    expect(inspector.hidden).toBe(true)
    await click('button[aria-label="添加：浏览器操作"]')
    expect(inspector.hidden).toBe(true)
    expect(animate).toHaveBeenCalledTimes(1)
    await click('button[aria-label="配件设置：浏览器操作"]')
    expect(inspector.hidden).toBe(false)
    await type('textarea', 'example.com')
    await type('input[aria-label="搜索配件"]', 'doc')
    const search = find<HTMLInputElement>('input[aria-label="搜索配件"]')
    const site = find<HTMLTextAreaElement>('textarea')
    await click('button[aria-label="收起配件设置"]')
    await click('button[aria-label="添加：文档处理"]')
    expect(inspector.hidden).toBe(true)
    await click('button[aria-label="收起能力库"]')
    expect(document.activeElement?.getAttribute('aria-label')).toBe('展开能力库')
    expect(find<HTMLInputElement>('input[aria-label="Role draft"]').value).toBe('Keep this')
    await click('[role="separator"][aria-label="展开能力库"]')
    expect(find('input[aria-label="搜索配件"]')).toBe(search)
    expect(search.value).toBe('doc')
    await click('button[aria-label="配件设置：浏览器操作"]')
    expect(find<HTMLTextAreaElement>('textarea').value).toBe('example.com')
    const currentSite = find('textarea')
    await click('button[aria-label="收起配件设置"]')
    await click('[role="separator"][aria-label="展开配件设置"]')
    expect(find('textarea')).toBe(currentSite)
    expect(site.value).toBe('example.com')
  })

  it('restores a dragged panel, limits expansion, and rolls back cancelled resizing', async () => {
    await render()
    const rail = find<HTMLElement>('[role="separator"][aria-label="收起能力库"]')
    const pointer = async (name: string, x: number) => act(async () => {
      const event = new Event(name, { bubbles: true, cancelable: true })
      Object.assign(event, { clientX: x, pointerId: 1, button: 0 })
      rail.dispatchEvent(event)
    })
    await pointer('pointerdown', 260); await pointer('pointermove', 80); await pointer('pointerup', 80)
    expect(rail.getAttribute('aria-valuenow')).toBe('0')
    await pointer('pointerdown', 15); await pointer('pointermove', 75); await pointer('pointerup', 75)
    expect(rail.getAttribute('aria-valuenow')).toBe('280')
    await pointer('pointerdown', 280); await pointer('pointermove', 1200)
    expect(Number(rail.getAttribute('aria-valuenow'))).toBeLessThanOrEqual(360)
    await pointer('pointercancel', 1200)
    expect(rail.getAttribute('aria-valuenow')).toBe('280')
    await act(async () => { rail.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true })) })
    expect(rail.getAttribute('aria-valuenow')).toBe('0')
    await act(async () => { rail.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })) })
    expect(rail.getAttribute('aria-valuenow')).toBe('280')
  })

  it('highlights duplicate drops and avoids motion when reduced motion is requested', async () => {
    await render()
    await click('button[aria-label="添加：浏览器操作"]')
    const drop = async (id: string) => act(async () => {
      const event = new Event('drop', { bubbles: true, cancelable: true })
      Object.defineProperty(event, 'dataTransfer', { value: { getData: () => id } })
      find('[aria-label="将配件拖到这里"]').dispatchEvent(event)
    })
    await drop('browser')
    expect(container.querySelectorAll('[data-attached-capability]')).toHaveLength(1)
    expect(animate.mock.calls.at(-1)![0].every((frame: Keyframe) => !frame.transform)).toBe(true)
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    await drop('documents')
    expect(animate.mock.calls.at(-1)![0].every((frame: Keyframe) => !frame.transform)).toBe(true)
    await drop('unknown')
    expect(container.querySelectorAll('[data-attached-capability]')).toHaveLength(2)
  })

  it('adds by pointer drag without opening details and ignores outside, duplicate and cancelled drops', async () => {
    await render()
    const card = find<HTMLElement>('[data-capability="browser"]')
    const dropZone = find<HTMLElement>('[aria-label="将配件拖到这里"]')
    const hit = vi.fn((): Element => dropZone)
    const previousHit = Object.getOwnPropertyDescriptor(document, 'elementFromPoint')
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: hit })
    const pointer = async (target: EventTarget, name: string, x: number) => act(async () => {
      const event = new Event(name, { bubbles: true, cancelable: true })
      Object.assign(event, { pointerId: 1, clientX: x, clientY: 100, button: 0 })
      target.dispatchEvent(event)
    })
    try {
      await pointer(card, 'pointerdown', 30)
      await pointer(window, 'pointermove', 600)
      await pointer(window, 'pointerup', 600)
      await click('[aria-label="查看配件设置：浏览器操作"]')
      expect(find<HTMLElement>('aside').hidden).toBe(true)
      expect(container.querySelectorAll('[data-attached-capability]')).toHaveLength(1)
      expect(animate).toHaveBeenCalledTimes(1)
      await pointer(card, 'pointerdown', 30); await pointer(window, 'pointermove', 600); await pointer(window, 'pointerup', 600)
      expect(container.querySelectorAll('[data-attached-capability]')).toHaveLength(1)
      expect(animate).toHaveBeenCalledTimes(2)
      const documents = find<HTMLElement>('[data-capability="documents"]')
      hit.mockReturnValue(container)
      await pointer(documents, 'pointerdown', 30); await pointer(window, 'pointermove', 600); await pointer(window, 'pointerup', 600)
      expect(container.querySelectorAll('[data-attached-capability]')).toHaveLength(1)
      hit.mockReturnValue(dropZone)
      await pointer(documents, 'pointerdown', 30); await pointer(window, 'pointermove', 600)
      await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true })))
      await pointer(window, 'pointerup', 600)
      expect(container.querySelectorAll('[data-attached-capability]')).toHaveLength(1)
    } finally {
      if (previousHit) Object.defineProperty(document, 'elementFromPoint', previousHit)
      else delete (document as any).elementFromPoint
    }
  })
})
