// How well two colors read against each other, by the WCAG 2 formula. Used
// by the theme editor to warn about text that would be hard to read, and by
// the tests that hold the high-contrast mode to its promise

/** Red, green and blue from 0 to 255, and alpha from 0 to 1 */
export type Rgba = [red: number, green: number, blue: number, alpha: number]

/** Text smaller than a heading needs this much against its background (WCAG AA) */
export const CONTRAST_AA = 4.5
/** What the high-contrast mode holds itself to (WCAG AAA) */
export const CONTRAST_AAA = 7

const NAMED: Record<string, Rgba> = {
  transparent: [0, 0, 0, 0],
  white: [255, 255, 255, 1],
  black: [0, 0, 0, 1]
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** A number or percentage as CSS writes it; `none` counts as zero */
function component(token: string | undefined, whole: number) {
  if (!token || token === 'none') return 0
  return token.endsWith('%') ? Number.parseFloat(token) / 100 * whole : Number.parseFloat(token)
}

/** The parts between the brackets, and the alpha after a slash or as a fourth part */
function parts(body: string) {
  const [colors = '', slash] = body.split('/')
  const tokens = colors.trim().split(/[\s,]+/).filter(Boolean)
  const alpha = slash !== undefined ? slash.trim() : tokens.length > 3 ? tokens.pop() : undefined
  return { tokens, alpha: alpha === undefined ? 1 : clamp(component(alpha, 1), 0, 1) }
}

const encode = (linear: number) => {
  const value = clamp(linear, 0, 1)
  return (value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055) * 255
}

/** Oklab to sRGB, clipped to what a screen can show */
function fromOklab(lightness: number, a: number, b: number, alpha: number): Rgba {
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (lightness - 0.0894841775 * a - 1.2914855480 * b) ** 3
  return [
    encode(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    encode(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    encode(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s),
    alpha
  ]
}

/**
 * Reads a color written as hex, `rgb()`, `color(srgb …)`, `oklab()` or
 * `oklch()`: the forms a browser gives back for a computed color. Anything
 * else (a `var()`, a `color-mix()`, most names) is `undefined` and has to be
 * resolved by the browser first: see `resolveColor`
 */
export function parseColor(value: string | undefined): Rgba | undefined {
  const text = value?.trim().toLowerCase()
  if (!text) return undefined
  if (NAMED[text]) return NAMED[text]

  const hex = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(text)?.[1]
  if (hex) {
    const full = hex.length <= 4 ? [...hex].map(digit => digit + digit).join('') : hex
    const byte = (at: number) => Number.parseInt(full.slice(at, at + 2), 16)
    return [byte(0), byte(2), byte(4), full.length === 8 ? byte(6) / 255 : 1]
  }

  const call = /^([a-z]+)\((.*)\)$/.exec(text)
  if (!call) return undefined
  const [, name, body = ''] = call
  if (/[a-z-]+\(/.test(body)) return undefined
  const { tokens, alpha } = parts(name === 'color' ? body.replace(/^\s*srgb\s+/, '') : body)
  if (tokens.length !== 3 || tokens.some(token => token !== 'none' && Number.isNaN(Number.parseFloat(token)))) return undefined

  if (name === 'rgb' || name === 'rgba') return [...tokens.map(token => clamp(component(token, 255), 0, 255)), alpha] as Rgba
  if (name === 'color' && /^\s*srgb\s/.test(body)) return [...tokens.map(token => clamp(component(token, 1), 0, 1) * 255), alpha] as Rgba
  if (name === 'oklab') return fromOklab(component(tokens[0], 1), component(tokens[1], 0.4), component(tokens[2], 0.4), alpha)
  if (name === 'oklch') {
    const chroma = component(tokens[1], 0.4)
    const hue = Number.parseFloat(tokens[2] === 'none' ? '0' : tokens[2]!) * Math.PI / 180
    return fromOklab(component(tokens[0], 1), chroma * Math.cos(hue), chroma * Math.sin(hue), alpha)
  }
  return undefined
}

/** `top` painted over `under`, as the screen would show it */
export function over(top: Rgba, under: Rgba): Rgba {
  const alpha = top[3] + under[3] * (1 - top[3])
  if (!alpha) return [0, 0, 0, 0]
  const channel = (at: 0 | 1 | 2) => (top[at] * top[3] + under[at] * under[3] * (1 - top[3])) / alpha
  return [channel(0), channel(1), channel(2), alpha]
}

export function toHex(color: Rgba): string {
  return `#${color.slice(0, 3).map(value => Math.round(value).toString(16).padStart(2, '0')).join('')}`
}

/** Relative luminance, 0 for black to 1 for white */
export function luminance(color: Rgba): number {
  const [red, green, blue] = color.slice(0, 3).map((value) => {
    const channel = value / 255
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

/** What the browser makes of a CSS color where `context` is, e.g. `color-mix(…)` or `var(--ui-text)` */
function computedColor(value: string, context?: Element | null): string | undefined {
  if (typeof document === 'undefined') return undefined
  const probe = document.createElement('span')
  probe.style.display = 'none'
  probe.style.color = value
  // The browser drops a value it can't read as a color
  if (!probe.style.color) return undefined
  ;(context ?? document.body).appendChild(probe)
  const computed = getComputedStyle(probe).color
  probe.remove()
  return computed
}

/** The last resort, for color spaces `parseColor` doesn't know: paint a pixel and read it back */
function paintedColor(value: string): Rgba | undefined {
  const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  if (!ctx) return undefined
  ctx.fillStyle = value
  ctx.fillRect(0, 0, 1, 1)
  const [red = 0, green = 0, blue = 0, alpha = 0] = ctx.getImageData(0, 0, 1, 1).data
  return [red, green, blue, alpha / 255]
}

/**
 * Any CSS color as numbers. Hex and the like are read directly; the rest goes
 * through a hidden element so the browser resolves variables and mixes, as
 * they stand where `context` is in the page
 */
export function resolveColor(value: string | undefined, context?: Element | null): Rgba | undefined {
  const direct = parseColor(value)
  if (direct || !value) return direct
  const computed = computedColor(value, context)
  if (!computed) return undefined
  return parseColor(computed) ?? paintedColor(computed)
}

/**
 * The WCAG contrast ratio of `text` on `background`, from 1 (the same color)
 * to 21 (black on white). A see-through background is taken as lying on
 * `behind` (white unless given), and see-through text as lying on the
 * background. `NaN` when either color can't be read
 */
export function contrastRatio(text: string, background: string, context?: Element | null, behind = '#ffffff'): number {
  const top = resolveColor(text, context)
  const under = resolveColor(background, context)
  if (!top || !under) return Number.NaN
  const base = under[3] < 1 ? over(under, resolveColor(behind, context) ?? [255, 255, 255, 1]) : under
  const [lighter, darker] = [luminance(over(top, base)), luminance(base)].sort((a, b) => b - a) as [number, number]
  return (lighter + 0.05) / (darker + 0.05)
}

/** "4.52:1", the way WCAG writes it; never rounded up past a threshold it didn't reach */
export function formatContrast(ratio: number): string {
  return Number.isFinite(ratio) ? `${(Math.floor(ratio * 100) / 100).toFixed(2)}:1` : '–'
}
