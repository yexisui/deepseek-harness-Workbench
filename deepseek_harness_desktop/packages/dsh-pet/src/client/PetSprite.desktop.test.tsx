// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PetSprite, type PetSpriteProps } from './PetSprite.tsx'
import { t } from './locales.ts'
import type { PetDefinition } from '../registry.ts'

const definition = { id: 'test', displayName: '测试宠物', renderer: 'sprite2d', cell: { width: 160, height: 160 },
  columns: 1, rows: [1], tracks: { idle: { frames: [0], durations: [400], loop: true } }, atlasUrl: '/atlas.webp' } as PetDefinition
const props = (detached = false): PetSpriteProps => ({ definition, display: { visible: true, size: 160, right: 24, bottom: 20, bubbleScale: 1 },
  snapshot: null, feedback: null, onPet: vi.fn(), onDragEnd: vi.fn(), onOpenSession: vi.fn(), onFeedbackDone: vi.fn(), t,
  desktopSurface: { detached, error: '', detach: vi.fn(), attach: vi.fn(), dragStart: vi.fn(), dragEnd: vi.fn(), resize: vi.fn() },
})
beforeEach(() => {
  document.documentElement.lang = 'zh'
  vi.stubGlobal('PointerEvent', MouseEvent)
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ roles: [] }) })))
  vi.stubGlobal('matchMedia', () => ({ matches: true }))
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('desktop pet gestures', () => {
  it('detaches after release beyond the app edge without overwriting the app position or petting', () => {
    const p = props(); render(<PetSprite {...p} />)
    const sprite = screen.getByRole('button', { name: '测试宠物' })
    fireEvent.pointerDown(sprite, { button: 0, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(sprite, { clientX: -20, clientY: 100 })
    fireEvent.pointerUp(sprite, { clientX: -20, clientY: 100 })
    fireEvent.click(sprite)
    expect(p.desktopSurface!.detach).toHaveBeenCalledWith(160, 160, true)
    expect(p.onDragEnd).not.toHaveBeenCalled(); expect(p.onPet).not.toHaveBeenCalled()
  })
  it('moves the native window using screen movement and suppresses its trailing click', () => {
    const p = props(true); render(<PetSprite {...p} />)
    const sprite = screen.getByRole('button', { name: '测试宠物' })
    fireEvent.pointerDown(sprite, { button: 0, clientX: 40, clientY: 50, screenX: 200, screenY: 200 })
    // The window follows the pointer, so client coordinates may stay constant.
    fireEvent.pointerMove(sprite, { clientX: 40, clientY: 50, screenX: 260, screenY: 220 })
    fireEvent.pointerUp(sprite); fireEvent.click(sprite)
    expect(p.desktopSurface!.dragStart).toHaveBeenCalled(); expect(p.desktopSurface!.dragEnd).toHaveBeenCalled()
    expect(p.onPet).not.toHaveBeenCalled(); expect(p.onDragEnd).not.toHaveBeenCalled()
  })
  it('offers returning to the app and cancels native dragging when capture is cancelled', () => {
    const p = props(true); render(<PetSprite {...p} />)
    const sprite = screen.getByRole('button', { name: '测试宠物' })
    fireEvent.contextMenu(sprite); fireEvent.click(screen.getByText('返回应用'))
    expect(p.desktopSurface!.attach).toHaveBeenCalledOnce()
    fireEvent.pointerDown(sprite, { button: 0 }); fireEvent.pointerCancel(sprite)
    expect(p.desktopSurface!.dragEnd).toHaveBeenCalled(); expect(p.onDragEnd).not.toHaveBeenCalled()
  })
  it('keeps the browser panel unchanged when there is no desktop bridge', () => {
    const p = props(); delete p.desktopSurface; render(<PetSprite {...p} />)
    fireEvent.contextMenu(screen.getByRole('button', { name: '测试宠物' }))
    expect(screen.queryByText('放到桌面')).toBeNull(); expect(screen.queryByText('返回应用')).toBeNull()
  })
})
