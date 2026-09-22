// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { appearancePalette, hexToHsl, hslToHex, normalizeHex, swatchInk } from '../src/client/appearance-color.ts'
import { centeredImage, imageDrawRect, loadRoleIconFile, maximumRoleIconBytes, renderRoleIcon, validateRoleIconFile } from '../src/client/appearance-image.ts'

afterEach(() => vi.restoreAllMocks())

describe('appearance colors', () => {
  it('accepts arbitrary short and full HEX without accepting CSS or incomplete input', () => {
    expect(normalizeHex(' #A3f ')).toBe('#aa33ff')
    expect(normalizeHex('012ABC')).toBe('#012abc')
    for (const value of ['red', '#1234', '#12345678', '#zzzzzz', 'url(x)']) expect(normalizeHex(value)).toBeUndefined()
    expect(appearancePalette.flat()).toHaveLength(37)
    expect(new Set(appearancePalette.flat()).size).toBe(37)
  })
  it('round-trips colors and keeps checkmarks readable for very light or dark swatches', () => {
    for (const hex of [...appearancePalette.flat(), '#ffffff', '#000000', '#ffff00']) {
      const { hue, saturation, lightness } = hexToHsl(hex)
      expect(hslToHex(hue, saturation, lightness)).toBe(hex)
    }
    expect(swatchInk('#ffffff')).toBe('#172236')
    expect(swatchInk('#000000')).toBe('#ffffff')
  })
})

describe('PNG preparation', () => {
  it('rejects empty, oversized and other file formats before decoding', () => {
    expect(() => validateRoleIconFile({ name: 'a.png', type: 'image/png', size: 0 })).toThrow('图片为空')
    expect(() => validateRoleIconFile({ name: 'a.png', type: 'image/png', size: maximumRoleIconBytes + 1 })).toThrow('2 MB')
    expect(() => validateRoleIconFile({ name: 'a.png', type: 'image/jpeg', size: 128 })).toThrow('PNG 格式')
    expect(() => validateRoleIconFile({ name: 'A.PNG', type: '', size: 128 })).not.toThrow()
  })
  it('checks the PNG signature and dimensions before invoking the image decoder', async () => {
    await expect(loadRoleIconFile(new File(['not a PNG'], 'fake.png', { type: 'image/png' }))).rejects.toThrow('不是有效的 PNG')
    const bytes = new Uint8Array(24)
    bytes.set([137, 80, 78, 71, 13, 10, 26, 10])
    bytes.set([73, 72, 68, 82], 12)
    const view = new DataView(bytes.buffer); view.setUint32(8, 13); view.setUint32(16, 20000); view.setUint32(20, 1)
    const image = vi.spyOn(globalThis, 'Image')
    await expect(loadRoleIconFile(new File([bytes], 'huge.png', { type: 'image/png' }))).rejects.toThrow('4096')
    expect(image).not.toHaveBeenCalled()
  })
  it('contains the entire image by default and applies relative scaling and offsets', () => {
    expect(imageDrawRect(1024, 512, centeredImage)).toEqual({ x: 0, y: 64, width: 256, height: 128 })
    expect(imageDrawRect(512, 1024, centeredImage)).toEqual({ x: 64, y: 0, width: 128, height: 256 })
    expect(imageDrawRect(256, 256, { scale: .5, x: 25, y: -25 })).toEqual({ x: 128, y: 0, width: 128, height: 128 })
  })
  it('exports a transparent 256px PNG without applying a theme tint', () => {
    const context = { clearRect: vi.fn(), drawImage: vi.fn(), imageSmoothingEnabled: false, imageSmoothingQuality: 'low' }
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as any)
    const toDataURL = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,prepared')
    const image = { naturalWidth: 512, naturalHeight: 256 } as HTMLImageElement
    expect(renderRoleIcon(image, centeredImage)).toBe('data:image/png;base64,prepared')
    expect(context.clearRect).toHaveBeenCalledWith(0, 0, 256, 256)
    expect(context.drawImage).toHaveBeenCalledWith(image, 0, 64, 256, 128)
    expect(toDataURL).toHaveBeenCalledWith('image/png')
    expect(toDataURL.mock.instances[0]).toMatchObject({ width: 256, height: 256 })
  })
})
