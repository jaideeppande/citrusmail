/**
 * CitrusMail's look, as data. Every value is a CSS value (a color, a length, a
 * shadow, a font stack), so anything CSS can do is allowed. Defaults live in
 * `app/app.config.ts`; `NUXT_PUBLIC_CITRUSMAIL_THEME` (JSON) overrides them
 * without a rebuild; each person's Appearance settings go on top of both.
 * See THEMING.md.
 */
export interface ThemeColors {
  /** The app behind the sheet: sidebar, sign-in panel */
  desk: string
  /** The page everything is read and written on */
  sheet: string
  /** Hover and raised surfaces: menus, pressed buttons, chips */
  elevated: string
  /** One step stronger than elevated: active nav items, tracks */
  accented: string
  /** Hairlines between rows, around fields and cards */
  border: string
  /** The edge of the sheet against the desk; 'transparent' for none */
  sheetBorder: string
  /** Body text, headings and secondary text */
  text: string
  textHighlighted: string
  textMuted: string
  /** A selected message or contact row */
  selected: string
  /** The 2px edge on the selected row; 'transparent' for none */
  selectedEdge: string
  /** Behind a dialog */
  overlay: string
}

export interface CitrusMailTheme {
  /** Accent: a hex color, or a Tailwind palette name such as 'violet' */
  primary: string
  /** Greys: a Tailwind palette name ('stone', 'zinc', 'slate', 'gray', 'neutral') */
  neutral: string
  /** The unread dot; defaults to the accent */
  unread: string
  /** Flags */
  flag: string
  /** Font stack for everything. Add the family to `fonts.families` in nuxt.config to self-host it */
  font: string
  /** The root size every rem scales from: '15px' is compact, '17px' roomy */
  fontSize: string
  /** Corners of buttons, fields, menus and dialogs */
  radius: string
  /** Space around the sheet on wide screens; '0' puts it edge to edge */
  sheetInset: string
  sheetRadius: string
  sheetShadow: string
  /** Under menus, popovers, dialogs and toasts */
  floatingShadow: string
  light: ThemeColors
  dark: ThemeColors
}

/** What a person can change for themselves in Settings → Appearance, saved with their account */
export interface Appearance {
  primary?: string
  font?: string
  fontSize?: string
  radius?: string
}

export type ThemeOverride = Partial<Omit<CitrusMailTheme, 'light' | 'dark'>> & {
  light?: Partial<ThemeColors>
  dark?: Partial<ThemeColors>
}

export const SURFACE_KEYS = ['desk', 'sheet', 'elevated', 'accented', 'border', 'sheetBorder', 'text', 'textHighlighted', 'textMuted', 'selected', 'selectedEdge', 'overlay'] as const satisfies readonly (keyof ThemeColors)[]

/** Tailwind's own palettes by name, each a shade to a color: what `tailwindcss/colors` exports */
export type Palettes = Record<string, Record<string, string> | string | undefined>

const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const

/** A hex accent is the shade buttons use (600); the rest are mixed from it */
const MIX: Record<(typeof SHADES)[number], string> = {
  50: 'white 93%', 100: 'white 86%', 200: 'white 72%', 300: 'white 52%', 400: 'white 30%', 500: 'white 14%',
  600: '', 700: 'black 18%', 800: 'black 34%', 900: 'black 48%', 950: 'black 66%'
}

export function isHexColor(value?: string): value is string {
  return !!value && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim())
}

export function mergeTheme(base: CitrusMailTheme, ...overrides: (ThemeOverride | undefined)[]): CitrusMailTheme {
  return overrides.reduce<CitrusMailTheme>((theme, override) => {
    if (!override || typeof override !== 'object') return theme
    const set = (values?: object) => Object.fromEntries(Object.entries(values ?? {}).filter(([, value]) => value !== undefined && value !== ''))
    return {
      ...theme,
      ...set(override),
      light: { ...theme.light, ...set(override.light) },
      dark: { ...theme.dark, ...set(override.dark) }
    }
  }, base)
}

function colorVars(colors: ThemeColors) {
  return {
    '--lb-desk': colors.desk,
    '--lb-desk-solid': colors.desk,
    '--ui-bg-muted': colors.desk,
    '--ui-bg': colors.sheet,
    '--ui-bg-elevated': colors.elevated,
    '--ui-bg-accented': colors.accented,
    '--ui-border': colors.border,
    '--ui-border-muted': colors.border,
    '--lb-sheet-border': colors.sheetBorder,
    '--ui-text': colors.text,
    '--ui-text-highlighted': colors.textHighlighted,
    '--ui-text-muted': colors.textMuted,
    '--lb-selected': colors.selected,
    '--lb-selected-edge': colors.selectedEdge,
    '--lb-overlay': colors.overlay
  }
}

const block = (selector: string, vars: Record<string, string | undefined>) =>
  `${selector} {\n${Object.entries(vars).filter(([, value]) => value).map(([name, value]) => `  ${name}: ${value};`).join('\n')}\n}`

const shades = (family: 'primary' | 'neutral', value: (shade: number) => string | undefined) =>
  Object.fromEntries(SHADES.map(shade => [`--ui-color-${family}-${shade}`, value(shade)]))

/** One shade of a hex accent */
export const accentShade = (primary: string, shade: (typeof SHADES)[number]) =>
  MIX[shade] ? `color-mix(in oklab, ${primary}, ${MIX[shade]})` : primary

// A hex is mixed into a scale; a palette of our own (declared with @theme in
// main.css, like 'post') is spelled out, since Nuxt UI only resolves
// Tailwind's built-in names, which it handles itself
const accentScale = (primary: string) => isHexColor(primary)
  ? shades('primary', shade => accentShade(primary, shade as (typeof SHADES)[number]))
  : shades('primary', shade => `var(--color-${primary}-${shade})`)

/**
 * One mode of a theme as custom properties for a single element, so a part of
 * the page (a preview) can wear a theme the rest of the app doesn't. Unlike
 * `themeCss` it spells out Tailwind's palettes too, from `palettes`, and the
 * few Nuxt UI tokens that differ between light and dark
 */
export function themeVars(theme: CitrusMailTheme, mode: 'light' | 'dark', palettes: Palettes = {}): Record<string, string> {
  const dark = mode === 'dark'
  const palette = (name: string) => typeof palettes[name] === 'object' ? palettes[name] : undefined
  const n = (shade: number) => `var(--ui-color-neutral-${shade})`
  const vars: Record<string, string | undefined> = {
    ...(isHexColor(theme.primary) || !palette(theme.primary) ? accentScale(theme.primary) : shades('primary', shade => palette(theme.primary)![shade])),
    ...(palette(theme.neutral) ? shades('neutral', shade => palette(theme.neutral)![shade]) : {}),
    '--font-sans': theme.font,
    '--ui-radius': theme.radius,
    '--lb-sheet-inset': theme.sheetInset,
    '--lb-sheet-radius': theme.sheetRadius,
    '--lb-sheet-shadow': theme.sheetShadow,
    '--lb-shadow': theme.floatingShadow,
    '--lb-flag': theme.flag,
    '--lb-unread': theme.unread || 'var(--ui-primary)',
    '--ui-primary': `var(--ui-color-primary-${dark ? 400 : 600})`,
    '--ui-text-dimmed': n(dark ? 500 : 400),
    '--ui-text-toned': n(dark ? 300 : 600),
    '--ui-text-inverted': dark ? n(900) : '#fff',
    '--ui-bg-inverted': dark ? '#fff' : n(900),
    '--ui-border-accented': n(dark ? 700 : 300),
    '--ui-border-inverted': dark ? '#fff' : n(900),
    ...colorVars(theme[mode])
  }
  return Object.fromEntries(Object.entries(vars).filter(([, value]) => value)) as Record<string, string>
}

/** The whole theme as CSS custom properties, light and dark */
export function themeCss(theme: CitrusMailTheme, builtInPalettes: Set<string>): string {
  const accent = isHexColor(theme.primary) || !builtInPalettes.has(theme.primary) ? accentScale(theme.primary) : {}

  // Plain :root and .dark, so brand/custom.css (loaded after) can override any of it
  return [
    block(':root', {
      ...accent,
      '--font-sans': theme.font,
      '--lb-font-size': theme.fontSize,
      '--ui-radius': theme.radius,
      '--lb-sheet-inset': theme.sheetInset,
      '--lb-sheet-radius': theme.sheetRadius,
      '--lb-sheet-shadow': theme.sheetShadow,
      '--lb-shadow': theme.floatingShadow,
      '--lb-flag': theme.flag,
      '--lb-unread': theme.unread || 'var(--ui-primary)',
      '--ui-primary': 'var(--ui-color-primary-600)',
      ...colorVars(theme.light)
    }),
    block('.dark', {
      '--ui-primary': 'var(--ui-color-primary-400)',
      ...colorVars(theme.dark)
    })
  ].join('\n')
}
