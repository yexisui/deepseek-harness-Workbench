// @vitest-environment jsdom
import React, { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { useCompositionSort } from '../src/client/useCompositionSort.ts'

let container: HTMLDivElement, root: Root
const moves = vi.fn(), clicks = vi.fn()
function Fixture() {
  const [enabled, setEnabled] = useState(false)
  const sort = useCompositionSort(moves, ['a', 'b'])
  return <div ref={sort.root}>{['a', 'b'].map(id => <div key={id} data-composition-row={id} tabIndex={0} onPointerDown={e => sort.start(id, e)} onClickCapture={sort.click} onKeyDown={e => sort.key(id, e)}>
    <button onClick={clicks}>{id}</button><input aria-label={id} type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)}/><input aria-label={`text-${id}`}/>
  </div>)}<output>{sort.sorting?.target ?? 'idle'}</output></div>
}
beforeEach(async () => {
  ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
  moves.mockClear(); clicks.mockClear(); container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  await act(async () => root.render(<Fixture/>))
  Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => container.querySelector('[data-composition-row="b"]') })
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks() })
const pointer = async (target: EventTarget, type: string, x: number) => act(async () => {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: x })
  Object.defineProperty(event, 'pointerId', { value: 1 }); target.dispatchEvent(event)
})
it('allows a normal switch click but suppresses its click after dragging from the switch', async () => {
  const checkbox = container.querySelector<HTMLInputElement>('[aria-label="a"]')!
  await pointer(checkbox, 'pointerdown', 0); await pointer(window, 'pointermove', 2); await pointer(window, 'pointerup', 2)
  await act(async () => checkbox.click()); expect(checkbox.checked).toBe(true); expect(moves).not.toHaveBeenCalled()
  await pointer(checkbox, 'pointerdown', 0); await pointer(window, 'pointermove', 30); await pointer(window, 'pointerup', 30)
  await act(async () => checkbox.click()); expect(checkbox.checked).toBe(true); expect(moves).toHaveBeenCalledExactlyOnceWith('a', 'b')
})
it('protects text entry and cancels pointer or keyboard sorting with Escape without committing', async () => {
  const input = container.querySelector<HTMLInputElement>('[aria-label="text-a"]')!, button = container.querySelector('button')!, row = button.parentElement!
  await pointer(input, 'pointerdown', 0); await pointer(window, 'pointermove', 30); await pointer(window, 'pointerup', 30)
  expect(moves).not.toHaveBeenCalled()
  await pointer(button, 'pointerdown', 0); await pointer(window, 'pointermove', 30)
  await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  await pointer(window, 'pointerup', 30); await act(async () => button.click())
  expect(moves).not.toHaveBeenCalled(); expect(clicks).not.toHaveBeenCalled()
  for (const key of [' ', 'ArrowDown', 'Escape']) await act(async () => row.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })))
  expect(moves).not.toHaveBeenCalled(); expect(container.querySelector('output')!.textContent).toBe('idle')
})
