/** A fixed honeycomb keeps familiar choices in the same position while HEX remains unrestricted. */
export const appearancePalette = [
  ['#dd5376', '#e58a32', '#d9aa3c', '#91ac43'],
  ['#b74f82', '#ea6e78', '#eea668', '#d4bf65', '#5baf69'],
  ['#9a62d8', '#c77ebb', '#e7a1b1', '#dfc196', '#a8c587', '#22a58b'],
  ['#704cbd', '#a297d8', '#a8b6df', '#78869f', '#85bbb8', '#57b7a8', '#238e89'],
  ['#576bc4', '#7298de', '#a6c8e5', '#c3d9df', '#68b5c9', '#2597b3'],
  ['#4263ba', '#4f73e8', '#528ebc', '#467d93', '#4c697f'],
  ['#344575', '#344052', '#72808f', '#b3bac4'],
] as const

export function normalizeHex(input: string): string | undefined {
  const value = input.trim().replace(/^#/, '')
  if (/^[\da-f]{3}$/i.test(value)) return `#${[...value].map(char => char + char).join('').toLowerCase()}`
  if (/^[\da-f]{6}$/i.test(value)) return `#${value.toLowerCase()}`
  return undefined
}

export function hexToHsl(hex: string): { hue: number; saturation: number; lightness: number } {
  const value = normalizeHex(hex) ?? '#78869f'
  const [r, g, b] = [1, 3, 5].map(index => parseInt(value.slice(index, index + 2), 16) / 255)
  const max = Math.max(r!, g!, b!), min = Math.min(r!, g!, b!), delta = max - min
  const lightness = (max + min) / 2
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1))
  let hue = delta === 0 ? 0 : max === r ? ((g! - b!) / delta) % 6 : max === g ? (b! - r!) / delta + 2 : (r! - g!) / delta + 4
  hue = (hue * 60 + 360) % 360
  return { hue, saturation: saturation * 100, lightness: lightness * 100 }
}

export function hslToHex(hue: number, saturation: number, lightness: number): string {
  const l = Math.max(0, Math.min(100, lightness)) / 100, s = Math.max(0, Math.min(100, saturation)) / 100
  const c = (1 - Math.abs(2 * l - 1)) * s, h = ((hue % 360) + 360) % 360 / 60
  const x = c * (1 - Math.abs(h % 2 - 1)), m = l - c / 2
  const channels = h < 1 ? [c, x, 0] : h < 2 ? [x, c, 0] : h < 3 ? [0, c, x] : h < 4 ? [0, x, c] : h < 5 ? [x, 0, c] : [c, 0, x]
  return `#${channels.map(channel => Math.round((channel + m) * 255).toString(16).padStart(2, '0')).join('')}`
}

export function swatchInk(hex: string): string {
  const value = normalizeHex(hex) ?? '#78869f'
  const channels = [1, 3, 5].map(index => parseInt(value.slice(index, index + 2), 16) / 255)
  const linear = channels.map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
  return linear[0]! * .2126 + linear[1]! * .7152 + linear[2]! * .0722 > .179 ? '#172236' : '#ffffff'
}
