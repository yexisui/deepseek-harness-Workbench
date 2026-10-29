// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AssistantToolbar } from '../src/client/AssistantToolbar.tsx'

let container: HTMLDivElement, root: Root
const modes = Array.from({ length: 9 }, (_, index) => ({ mode: `module-${index}`, label: `功能模块 ${index}` }))
const select = vi.fn()
const resizeCallbacks: (() => void)[] = []
beforeEach(() => {
  ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  select.mockClear(); resizeCallbacks.length = 0
  vi.stubGlobal('ResizeObserver', class { constructor(callback: () => void) { resizeCallbacks.push(callback) } observe() {} disconnect() {} })
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals() })
async function render(scopeKey = 'current', activeMode = 'module-0', items = modes) {
  await act(async () => root.render(<AssistantToolbar scopeKey={scopeKey} activeMode={activeMode} modes={items} onModeChange={select}><button data-current-assistant>助手</button></AssistantToolbar>))
}
function geometry(width = 230, contentWidth = 900) {
  const viewport = container.querySelector<HTMLDivElement>('[data-assistant-module-viewport]')!
  Object.defineProperties(viewport, { clientWidth: { configurable: true, value: width }, scrollWidth: { configurable: true, value: contentWidth } })
  return viewport
}
function pointer(node: Element, type: string, x: number, y = 10) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y })
  Object.defineProperty(event, 'pointerId', { value: 1 })
  node.dispatchEvent(event)
}
it('scrolls on drag without activating a module, then permits a normal click', async () => {
  await render(); const viewport = geometry(), button = viewport.querySelector('button')!
  await act(async () => { pointer(button, 'pointerdown', 180); pointer(viewport, 'pointermove', 80); pointer(viewport, 'pointerup', 80); button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 })) })
  expect(viewport.scrollLeft).toBe(100); expect(select).not.toHaveBeenCalled()
  await act(async () => { pointer(button, 'pointerdown', 80); pointer(button, 'pointerup', 80); button.click() })
  expect(select).toHaveBeenCalledExactlyOnceWith('module-0')
})
it('keeps vertical touch gestures and small pointer movement from becoming a drag', async () => {
  await render(); const viewport = geometry()
  await act(async () => { pointer(viewport, 'pointerdown', 100, 10); pointer(viewport, 'pointermove', 103, 30); pointer(viewport, 'pointercancel', 103, 30) })
  expect(viewport.scrollLeft).toBe(0); expect(select).not.toHaveBeenCalled()
})
it('supports wheel, arrows and the range without changing the selected business module', async () => {
  await render(); const viewport = geometry()
  await act(async () => resizeCallbacks.forEach(callback => callback()))
  const wheel = new WheelEvent('wheel', { deltaY: 70, bubbles: true, cancelable: true })
  await act(async () => viewport.dispatchEvent(wheel))
  expect(wheel.defaultPrevented).toBe(true); expect(viewport.scrollLeft).toBe(70)
  await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="向右查看功能模块"]')!.click())
  expect(viewport.scrollLeft).toBe(231)
  const range = container.querySelector<HTMLInputElement>('input[type="range"]')!
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(range, '500'); range.dispatchEvent(new Event('input', { bubbles: true })) })
  expect(viewport.scrollLeft).toBe(500); expect(select).not.toHaveBeenCalled()
})
it('reveals a selected module and focuses with the keyboard without starting a new task', async () => {
  await render(); const viewport = geometry()
  viewport.getBoundingClientRect = () => ({ left: 0, right: 230 } as DOMRect)
  const buttons = Array.from(viewport.querySelectorAll('button'))
  buttons.forEach((button, index) => { button.getBoundingClientRect = () => ({ left: index * 100 - viewport.scrollLeft, right: index * 100 + 90 - viewport.scrollLeft } as DOMRect) })
  await render('current', 'module-7')
  expect(viewport.scrollLeft).toBe(563)
  await act(async () => { buttons[7]!.focus(); buttons[7]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true })) })
  expect(document.activeElement).toBe(buttons[0]); expect(select).not.toHaveBeenCalled()
})
it('handles a future role and a shrinking list without inheriting the previous scroll position', async () => {
  await render(); const viewport = geometry(); viewport.scrollLeft = 400
  await render('future-role', 'module-0')
  expect(viewport.scrollLeft).toBe(0)
  geometry(230, 120)
  await render('future-role', 'module-0', modes.slice(0, 1))
  expect(container.querySelector<HTMLInputElement>('input')!.disabled).toBe(true)
  expect(container.querySelectorAll('[aria-pressed]')).toHaveLength(1)
  const wheel = new WheelEvent('wheel', { deltaY: 50, bubbles: true, cancelable: true })
  viewport.dispatchEvent(wheel)
  expect(wheel.defaultPrevented).toBe(false)
})
it('leaves pinch zoom and picker-only free chat intact', async () => {
  await render(); const viewport = geometry()
  const zoom = new WheelEvent('wheel', { ctrlKey: true, deltaY: 50, bubbles: true, cancelable: true })
  viewport.dispatchEvent(zoom); expect(zoom.defaultPrevented).toBe(false); expect(viewport.scrollLeft).toBe(0)
  await render('chat', 'chat', [])
  expect(container.querySelector('nav')).toBeNull(); expect(container.querySelector('[data-current-assistant]')).not.toBeNull()
})
