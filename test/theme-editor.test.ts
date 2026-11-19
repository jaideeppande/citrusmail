import { describe, expect, it } from 'vitest'
import { cleanThemeOverride, normalTheme, parseThemeJson, sameTheme, splitTheme, themeJson, unsafeThemeValue } from '../app/utils/theme-editor'
import { matchingPreset, presetFromSaved, THEME_PRESETS } from '../app/utils/theme-presets'
import { contrastRatio } from '../app/utils/contrast'
import { mergeTheme } from '../app/utils/theme'

describe('unsafeThemeValue', () => {
  it('lets plain CSS values through', () => {
    for (const value of ['#2563EB', 'color-mix(in oklab, var(--ui-color-neutral-100), white 20%)', '0 12px 32px -16px rgb(0 0 0 / 0.3)', '\'Inter\', ui-sans-serif, sans-serif', '0.75rem']) {
      expect(unsafeThemeValue(value)).toBeUndefined()
    }
  })

  it('turns away anything that could leave its declaration or fetch something', () => {
    for (const value of ['red; } body { display: none', 'red}', '{', '</style><script>', 'url(https://x.test/a.png)', 'URL ( x )', '@import "x"', 'red /* a */', 'a\\62']) {
      expect(unsafeThemeValue(value)).toBeDefined()
    }
    expect(unsafeThemeValue('x'.repeat(201))).toMatch(/longer/)
    expect(unsafeThemeValue(12)).toBe('is not text')
  })
})

describe('parseThemeJson', () => {
  it('takes a valid theme', () => {
    const { theme, errors } = parseThemeJson('{"primary":"#0f766e","neutral":"slate","dark":{"desk":"#000"}}')
    expect(errors).toEqual([])
    expect(theme).toEqual({ primary: '#0f766e', neutral: 'slate', dark: { desk: '#000' } })
  })

  it('names every unknown key and unsafe value, and takes nothing', () => {
    const { theme, errors } = parseThemeJson('{"primary":"red;","colour":"x","light":{"sheet":"url(a)","glow":"x"},"dark":3}')
    expect(theme).toBeUndefined()
    expect(errors).toHaveLength(5)
    expect(errors.join(' ')).toContain('“colour”')
    expect(errors.join(' ')).toContain('“light.sheet”')
    expect(errors.join(' ')).toContain('“light.glow”')
  })

  it('says what is wrong with something that is not a theme', () => {
    expect(parseThemeJson('nope').errors[0]).toMatch(/JSON/)
    expect(parseThemeJson('[1]').errors[0]).toMatch(/object/)
    expect(parseThemeJson('{}').errors[0]).toMatch(/nothing/)
  })
})

describe('splitting and comparing themes', () => {
  it('keeps what the server accepts with the account and the rest here', () => {
    const { synced, local } = splitTheme({ primary: '#2563EB', radius: '0.5rem', fontSize: '15px', neutral: 'zinc', light: { sheet: '#fff' } })
    expect(synced).toEqual({ primary: '#2563EB', radius: '0.5rem', fontSize: '15px' })
    expect(local).toEqual({ neutral: 'zinc', light: { sheet: '#fff' } })
  })

  it('keeps a synced key here when the server would refuse its value', () => {
    expect(splitTheme({ primary: 'color-mix(in oklab, red, blue)' }).local).toEqual({ primary: 'color-mix(in oklab, red, blue)' })
  })

  it('cleans what was stored by hand', () => {
    expect(cleanThemeOverride({ primary: '#fff', evil: 'x', light: { sheet: 'red;}', text: '#000' }, dark: 'x' })).toEqual({ primary: '#fff', light: { text: '#000' } })
    expect(cleanThemeOverride(null)).toEqual({})
  })

  it('compares themes whatever order and empty parts they have', () => {
    expect(sameTheme({ neutral: 'zinc', primary: '#000', light: {} }, { primary: '#000', neutral: 'zinc' })).toBe(true)
    expect(sameTheme(undefined, {})).toBe(true)
    expect(sameTheme({ dark: { desk: '#000' } }, {})).toBe(false)
    expect(normalTheme({ dark: {}, primary: '' })).toEqual({})
    expect(JSON.parse(themeJson({ light: { text: '#111' }, primary: '#222' }))).toEqual({ primary: '#222', light: { text: '#111' } })
  })
})

describe('presets', () => {
  const defaults = { font: 'F', radius: 'R' }

  it('has about sixteen, with dark and high-contrast looks', () => {
    expect(THEME_PRESETS.length).toBeGreaterThanOrEqual(16)
    expect(THEME_PRESETS.filter(preset => preset.scheme === 'dark' && !preset.contrast).length).toBeGreaterThanOrEqual(4)
    expect(THEME_PRESETS.filter(preset => preset.contrast).map(preset => preset.scheme).sort()).toEqual(['dark', 'light'])
    expect(new Set(THEME_PRESETS.map(preset => preset.id)).size).toBe(THEME_PRESETS.length)
  })

  it('only uses safe, known values', () => {
    for (const preset of THEME_PRESETS) expect(cleanThemeOverride(preset.extras ?? {})).toEqual(preset.extras ?? {})
  })

  it('finds the preset the current choices amount to, surfaces included', () => {
    const graphite = THEME_PRESETS.find(preset => preset.id === 'graphite')!
    const appearance = { primary: graphite.primary, font: graphite.font, radius: graphite.radius }
    expect(matchingPreset(appearance, defaults, graphite.extras)?.id).toBe('graphite')
    expect(matchingPreset(appearance, defaults, {})).toBeUndefined()
    expect(matchingPreset({}, defaults)?.id).toBe('citrusmail')
  })

  it('turns a saved look into a card', () => {
    const card = presetFromSaved({ id: 'custom-1', label: 'Mine', theme: { primary: '#123456', neutral: 'zinc', dark: { desk: '#000' } } })
    expect(card).toMatchObject({ custom: true, primary: '#123456', extras: { neutral: 'zinc', dark: { desk: '#000' } } })
  })

  // Every text color a preset sets is checked against the surfaces it sits on
  it('keeps its text readable', () => {
    for (const preset of THEME_PRESETS) {
      for (const mode of ['light', 'dark'] as const) {
        const colors = preset.extras?.[mode]
        if (!colors?.sheet) continue
        const need = preset.contrast ? 7 : 4.5
        for (const surface of ['sheet', 'desk', 'elevated'] as const) {
          for (const text of ['text', 'textHighlighted', 'textMuted'] as const) {
            const ratio = contrastRatio(colors[text]!, colors[surface]!)
            expect(ratio, `${preset.id} ${mode} ${text} on ${surface}`).toBeGreaterThanOrEqual(need)
          }
        }
        expect(mergeTheme({ light: {}, dark: {} } as never, preset.extras)[mode].sheet).toBe(colors.sheet)
      }
    }
  })
})
