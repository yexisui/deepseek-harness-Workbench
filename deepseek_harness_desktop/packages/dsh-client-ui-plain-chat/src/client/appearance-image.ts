export const maximumRoleIconBytes = 2 * 1024 * 1024
export const roleIconSize = 256
export type ImageAdjustment = { scale: number; x: number; y: number }
export const centeredImage: ImageAdjustment = { scale: 1, x: 0, y: 0 }

export function validateRoleIconFile(file: Pick<File, 'size' | 'type' | 'name'>): void {
  if (!file.size) throw new Error('图片为空，请重新选择 PNG。')
  if (file.size > maximumRoleIconBytes) throw new Error('PNG 图片不能超过 2 MB。')
  if (file.type !== 'image/png' && !(file.type === '' && /\.png$/i.test(file.name))) throw new Error('请选择 PNG 格式的图片。')
}

export async function loadRoleIconFile(file: File): Promise<HTMLImageElement> {
  validateRoleIconFile(file)
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('图片读取失败，请重新选择。'))
    reader.onabort = () => reject(new Error('图片读取已取消。'))
    reader.readAsDataURL(file)
  })
  const bytes = atob(dataUrl.slice(dataUrl.indexOf(',') + 1))
  if (![137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes.charCodeAt(index) === byte)) throw new Error('图片内容不是有效的 PNG，请重新选择。')
  // Inspect the header before browser decoding to avoid loading an oversized bitmap.
  if (bytes.length < 24) throw new Error('PNG 文件不完整。')
  const view = new DataView(new Uint8Array([...bytes.slice(0, 24)].map(char => char.charCodeAt(0))).buffer)
  if (view.getUint32(8) !== 13 || bytes.slice(12, 16) !== 'IHDR') throw new Error('PNG 图片头无效。')
  validateDimensions(view.getUint32(16), view.getUint32(20))
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      try { validateDimensions(image.naturalWidth, image.naturalHeight); resolve(image) }
      catch (error) { reject(error) }
    }
    image.onerror = () => reject(new Error('无法打开这张 PNG，请选择其他图片。'))
    image.src = dataUrl
  })
}

export async function loadSavedRoleIcon(assetId: string): Promise<HTMLImageElement> {
  if (!/^[a-f0-9]{64}$/.test(assetId)) throw new Error('当前图片引用无效，请重新选择 PNG。')
  const response = await fetch(`/api/capabilities/icons/${assetId}`, { credentials: 'same-origin' })
  if (!response.ok) throw new Error('当前图片无法读取，请重新选择 PNG。')
  const blob = await response.blob()
  return loadRoleIconFile(new File([blob], 'role-icon.png', { type: 'image/png' }))
}

function validateDimensions(width: number, height: number): void {
  if (!width || !height || width > 4096 || height > 4096) throw new Error('图片尺寸需在 1 到 4096 像素之间。')
}

/** Contain at 100%; transformations are measured against the final square, not source pixels. */
export function imageDrawRect(width: number, height: number, adjustment: ImageAdjustment, size = roleIconSize) {
  if (width <= 0 || height <= 0 || !Number.isFinite(width + height)) throw new Error('图片尺寸无效。')
  const scale = Math.min(size / width, size / height) * Math.max(.5, Math.min(2, adjustment.scale))
  const w = width * scale, h = height * scale
  return { x: (size - w) / 2 + Math.max(-50, Math.min(50, adjustment.x)) / 100 * size,
    y: (size - h) / 2 + Math.max(-50, Math.min(50, adjustment.y)) / 100 * size, width: w, height: h }
}

export function renderRoleIcon(image: HTMLImageElement, adjustment: ImageAdjustment): string {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = roleIconSize
  const context = canvas.getContext('2d')
  if (!context) throw new Error('当前环境无法处理图片，请使用推荐图标。')
  const rect = imageDrawRect(image.naturalWidth, image.naturalHeight, adjustment)
  context.clearRect(0, 0, roleIconSize, roleIconSize)
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(image, rect.x, rect.y, rect.width, rect.height)
  return canvas.toDataURL('image/png')
}
