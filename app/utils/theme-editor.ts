import type { Appearance, CitrusMailTheme, ThemeColors, ThemeOverride } from './theme'
import { SURFACE_KEYS } from './theme'

// What the theme editor (Settings → Appearance → Customise) knows about a
// theme: which keys there are, what to call them, which of them the server
// keeps, and how to take a theme in from outside without letting it carry
// anything but values

export type ThemeKey = keyof Omit<CitrusMailTheme, 'light' | 'dark'>
export type SurfaceKey = keyof ThemeColors
export type ThemeMode = 'light' | 'dark'

export const THEME_KEYS = ['primary', 'neutral', 'unread', 'flag', 'font', 'fontSize', 'radius', 'sheetInset', 'sheetRadius', 'sheetShadow', 'floatingShadow'] as const satisfies readonly ThemeKey[]

/** The longest a single value may be: room for a font stack or a two-layer shadow, not for a stylesheet */
export const THEME_VALUE_MAX = 200

// The server keeps these four with the account, each held to a strict shape
// (server/api/settings.patch.ts). Everything else stays on this computer
export const SYNCED_SHAPES: Record<keyof Required<Appearance>, RegExp> = {
  primary: /^(#[0-9a-f]{3}|#[0-9a-f]{6}|[a-z]{3,20})$/i,
  font: /^[\w\s'",.-]{1,200}$/,
  fontSize: /^\d{2}px$/,
  radius: /^\d{1,2}(\.\d{1,3})?(rem|px)$/
}
export const SYNCED_KEYS = Object.keys(SYNCED_SHAPES) as (keyof Appearance)[]

/** The surface colors the editor shows, in the order THEMING.md lists them */
export const SURFACE_FIELDS: { key: SurfaceKey, label: string, hint: string }[] = [
  { key: 'desk', label: 'Desk', hint: 'Behind the page: the sidebar' },
  { key: 'sheet', label: 'Sheet', hint: 'The page you read and write on' },
  { key: 'elevated', label: 'Elevated', hint: 'Hover states, menus, chips' },
  { key: 'accented', label: 'Accented', hint: 'Active navigation items, switch tracks' },
  { key: 'border', label: 'Border', hint: 'Lines between rows and around fields' },
  { key: 'sheetBorder', label: 'Sheet border', hint: 'The page’s edge against the desk' },
  { key: 'text', label: 'Text', hint: 'Body text' },
  { key: 'textHighlighted', label: 'Highlighted text', hint: 'Headings, names, subjects' },
  { key: 'textMuted', label: 'Muted text', hint: 'Secondary text' },
  { key: 'selected', label: 'Selected', hint: 'The selected message or contact' },
  { key: 'selectedEdge', label: 'Selected edge', hint: 'The line on its left' }
]

export const THEME_NEUTRALS = [
  { label: 'Stone', value: 'stone', hint: 'Warm' },
  { label: 'Neutral', value: 'neutral', hint: 'Plain' },
  { label: 'Zinc', value: 'zinc', hint: 'Cool' },
  { label: 'Gray', value: 'gray', hint: 'Blue-grey' },
  { label: 'Slate', value: 'slate', hint: 'Blue' }
]

export const THEME_INSETS = [
  { label: 'None', value: '0' },
  { label: 'Narrow', value: '0.25rem' },
  { label: 'Default', value: '0.5rem' },
  { label: 'Wide', value: '0.75rem' }
]
export const THEME_SHEET_RADII = [
  { label: 'Square', value: '0' },
  { label: 'Soft', value: '0.5rem' },
  { label: 'Default', value: '0.75rem' },
  { label: 'Round', value: '1rem' }
]
export const THEME_SHEET_SHADOWS = [
  { label: 'None', value: 'none' },
  { label: 'Soft', value: '0 1px 2px rgb(0 0 0 / 0.06), 0 8px 24px -12px rgb(0 0 0 / 0.18)' },
  { label: 'Lifted', value: '0 2px 4px rgb(0 0 0 / 0.08), 0 20px 40px -16px rgb(0 0 0 / 0.32)' }
]

/** The parts of the editor that can each be put back by themselves */
export const THEME_SECTIONS = {
  accent: { label: 'Accent', keys: ['primary'], modes: [] },
  greys: { label: 'Greys', keys: ['neutral'], modes: [] },
  light: { label: 'Light surfaces', keys: [], modes: ['light'] },
  dark: { label: 'Dark surfaces', keys: [], modes: ['dark'] },
  shape: { label: 'Corners and sheet', keys: ['radius', 'sheetInset', 'sheetRadius', 'sheetShadow'], modes: [] },
  type: { label: 'Type', keys: ['font', 'fontSize'], modes: [] }
} as const satisfies Record<string, { label: string, keys: readonly ThemeKey[], modes: readonly ThemeMode[] }>
export type ThemeSection = keyof typeof THEME_SECTIONS

/**
 * Why a value can't go into a theme, or `undefined` when it can. A theme's
 * values are written into a stylesheet as they are, so anything that could
 * end a declaration, open a block, close the style tag or fetch something is
 * turned away
 */
export function unsafeThemeValue(value: unknown): string | undefined {
  if (typeof value !== 'string') return 'is not text'
  if (value.length > THEME_VALUE_MAX) return `is longer than ${THEME_VALUE_MAX} characters`
  const found = [';', '{', '}', '<', '\\', '/*'].find(mark => value.includes(mark))
    ?? ['url(', '@import', 'expression('].find(mark => value.toLowerCase().replace(/\s+/g, '').includes(mark))
  return found ? `contains “${found}”` : undefined
}

/** Only the known keys with safe values; anything else is quietly left out. For what was stored on this computer */
export function cleanThemeOverride(value: unknown): ThemeOverride {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const source = value as Record<string, unknown>
  const pick = (from: unknown, keys: readonly string[]) => Object.fromEntries(keys.flatMap((key) => {
    const item = (from as Record<string, unknown> | undefined)?.[key]
    return typeof item === 'string' && item && !unsafeThemeValue(item) ? [[key, item]] : []
  }))
  const theme: ThemeOverride = pick(source, THEME_KEYS)
  for (const mode of ['light', 'dark'] as const) {
    const colors = source[mode] && typeof source[mode] === 'object' ? pick(source[mode], SURFACE_KEYS) : {}
    if (Object.keys(colors).length) theme[mode] = colors
  }
  return theme
}

/**
 * Reads a theme someone pasted. Stricter than `cleanThemeOverride`: an
 * unknown key or an unsafe value is an error with the key's name in it, and
 * nothing is taken, so a theme never arrives half applied
 */
export function parseThemeJson(text: string): { theme?: ThemeOverride, errors: string[] } {
  let source: unknown
  try {
    source = JSON.parse(text)
  } catch {
    return { errors: ['That isn’t valid JSON.'] }
  }
  if (!source || typeof source !== 'object' || Array.isArray(source)) return { errors: ['A theme is an object: { "primary": "#2563EB", … }.'] }

  const errors: string[] = []
  const check = (from: Record<string, unknown>, keys: readonly string[], prefix = '') => {
    for (const [key, value] of Object.entries(from)) {
      const name = `${prefix}${key}`
      if (!prefix && (key === 'light' || key === 'dark')) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) errors.push(`“${name}” should be an object of surface colors.`)
        else check(value as Record<string, unknown>, SURFACE_KEYS, `${key}.`)
      } else if (!keys.includes(key)) {
        errors.push(`“${name}” isn’t a theme key.`)
      } else {
        const reason = unsafeThemeValue(value)
        if (reason) errors.push(`“${name}” ${reason}.`)
      }
    }
  }
  check(source as Record<string, unknown>, THEME_KEYS)
  if (errors.length) return { errors }

  const theme = cleanThemeOverride(source)
  return Object.keys(theme).length ? { theme, errors } : { errors: ['There’s nothing in that theme.'] }
}

/**
 * A theme in two parts: what the server will keep with the account, and the
 * rest, which stays on this computer. A synced key whose value the server
 * wouldn't accept (a font it has no shape for, say) stays local as well
 */
export function splitTheme(theme: ThemeOverride): { synced: Appearance, local: ThemeOverride } {
  const synced: Appearance = {}
  for (const key of SYNCED_KEYS) {
    const value = theme[key]
    if (value && SYNCED_SHAPES[key].test(value)) synced[key] = value
  }
  const local = Object.fromEntries(Object.entries(theme).filter(([key]) => !(key in synced))) as ThemeOverride
  return { synced, local }
}

/** Keys in a fixed order and no empty parts, so two themes that look the same compare the same */
export function normalTheme(theme: ThemeOverride | undefined): ThemeOverride {
  const clean = cleanThemeOverride(theme ?? {})
  const ordered: ThemeOverride = {}
  for (const key of THEME_KEYS) if (clean[key]) ordered[key] = clean[key]
  for (const mode of ['light', 'dark'] as const) {
    const colors = clean[mode]
    if (colors) ordered[mode] = Object.fromEntries(SURFACE_KEYS.flatMap(key => colors[key] ? [[key, colors[key]]] : []))
  }
  return ordered
}

export function sameTheme(a: ThemeOverride | undefined, b: ThemeOverride | undefined): boolean {
  return JSON.stringify(normalTheme(a)) === JSON.stringify(normalTheme(b))
}

/** The override as it goes into `citrusmail.theme` in app.config.ts or NUXT_PUBLIC_CITRUSMAIL_THEME */
export function themeJson(theme: ThemeOverride): string {
  return JSON.stringify(normalTheme(theme), null, 2)
}
