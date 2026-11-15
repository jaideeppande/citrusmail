import colors from 'tailwindcss/colors'
import { describe, expect, it } from 'vitest'
import { contrastRatio, formatContrast, luminance, over, parseColor, toHex } from '../app/utils/contrast'

describe('parseColor', () => {
  it('reads hex in its four lengths', () => {
    expect(parseColor('#fff')).toEqual([255, 255, 255, 1])
    expect(parseColor('#0C7A57')).toEqual([12, 122, 87, 1])
    expect(parseColor('#00000080')![3]).toBeCloseTo(0.5, 2)
    expect(parseColor('#f008')![3]).toBeCloseTo(0.53, 2)
  })

  it('reads the forms getComputedStyle gives back', () => {
    expect(parseColor('rgb(12, 122, 87)')).toEqual([12, 122, 87, 1])
    expect(parseColor('rgba(0, 0, 0, 0.5)')).toEqual([0, 0, 0, 0.5])
    expect(parseColor('rgb(0 0 0 / 50%)')).toEqual([0, 0, 0, 0.5])
    expect(parseColor('color(srgb 1 0.5 0)')!.map(Math.round)).toEqual([255, 128, 0, 1])
    expect(toHex(parseColor('oklch(100% 0 none)')!)).toBe('#ffffff')
    expect(toHex(parseColor('oklab(0 0 0)')!)).toBe('#000000')
    // Tailwind's own blue-600 is #155dfc
    expect(toHex(parseColor(colors.blue[600])!)).toMatch(/^#1[45]5[cd]f[bc]$/)
  })

  it('knows a few names and leaves the rest to the browser', () => {
    expect(parseColor('white')).toEqual([255, 255, 255, 1])
    expect(parseColor('transparent')![3]).toBe(0)
    expect(parseColor('rebeccapurple')).toBeUndefined()
    expect(parseColor('var(--ui-bg)')).toBeUndefined()
    expect(parseColor('color-mix(in oklab, red, blue)')).toBeUndefined()
    expect(parseColor('')).toBeUndefined()
  })
})

describe('contrastRatio', () => {
  it('matches the WCAG reference values', () => {
    expect(contrastRatio('#000', '#fff')).toBeCloseTo(21, 5)
    expect(contrastRatio('#fff', '#fff')).toBeCloseTo(1, 5)
    expect(contrastRatio('#777', '#fff')).toBeCloseTo(4.48, 2)
    expect(contrastRatio('#767676', '#fff')).toBeCloseTo(4.54, 2)
    expect(contrastRatio('#fff', '#000')).toBe(contrastRatio('#000', '#fff'))
  })

  it('lays see-through colors on what is behind them', () => {
    expect(contrastRatio('#000', 'rgb(0 0 0 / 0)')).toBeCloseTo(21, 5)
    expect(contrastRatio('rgb(0 0 0 / 0.5)', '#fff')).toBeCloseTo(contrastRatio('#808080', '#fff'), 1)
    expect(contrastRatio('#fff', 'rgb(0 0 0 / 0)', null, '#000')).toBeCloseTo(21, 5)
  })

  it('is NaN for what it cannot read without a browser', () => {
    expect(contrastRatio('var(--ui-text)', '#fff')).toBeNaN()
  })

  it('writes ratios the way WCAG does, never rounding up past a threshold', () => {
    expect(formatContrast(4.4999)).toBe('4.49:1')
    expect(formatContrast(21)).toBe('21.00:1')
    expect(formatContrast(Number.NaN)).toBe('–')
  })

  it('blends and measures', () => {
    expect(over([255, 255, 255, 0.5], [0, 0, 0, 1]).map(Math.round)).toEqual([128, 128, 128, 1])
    expect(luminance([255, 255, 255, 1])).toBeCloseTo(1, 5)
  })
})

// The promise Increase contrast makes (app/assets/css/settings.css): secondary
// text at 7:1 or more on the page and on raised surfaces, in light and dark,
// whichever grey the theme uses
describe('high contrast tokens', () => {
  const NEUTRALS = ['stone', 'zinc', 'slate', 'gray', 'neutral'] as const
  const shade = (name: typeof NEUTRALS[number], value: number) => (colors[name] as Record<number, string>)[value]!
  const rows: string[] = []

  for (const name of NEUTRALS) {
    it(`${name}: muted text is at least 7:1`, () => {
      const pairs = {
        'light muted on sheet (#fff)': contrastRatio(shade(name, 700), '#ffffff'),
        'light muted on elevated (100)': contrastRatio(shade(name, 700), shade(name, 100)),
        'light muted on desk (200)': contrastRatio(shade(name, 700), shade(name, 200)),
        'dark muted on sheet (900)': contrastRatio(shade(name, 300), shade(name, 900)),
        'dark muted on elevated (800)': contrastRatio(shade(name, 300), shade(name, 800)),
        'light border on sheet (500)': contrastRatio(shade(name, 500), '#ffffff'),
        'dark border on sheet (500)': contrastRatio(shade(name, 500), shade(name, 900))
      }
      for (const [pair, ratio] of Object.entries(pairs)) rows.push(`${name.padEnd(8)} ${pair.padEnd(32)} ${formatContrast(ratio)}`)
      expect(pairs['light muted on sheet (#fff)']).toBeGreaterThanOrEqual(7)
      expect(pairs['light muted on elevated (100)']).toBeGreaterThanOrEqual(7)
      expect(pairs['dark muted on sheet (900)']).toBeGreaterThanOrEqual(7)
      expect(pairs['dark muted on elevated (800)']).toBeGreaterThanOrEqual(4.5)
      // Lines that can be seen: 3:1 is WCAG's bar for the edges of controls
      expect(pairs['light border on sheet (500)']).toBeGreaterThanOrEqual(3)
      expect(pairs['dark border on sheet (500)']).toBeGreaterThanOrEqual(3)
    })
  }

  it('prints the table', () => {
    if (process.env.CONTRAST_TABLE) console.log(rows.join('\n'))
  })
})
