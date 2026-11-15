import type { Appearance, ThemeOverride } from './theme'
import { sameTheme, splitTheme } from './theme-editor'

// The gallery in Settings → Appearance. A preset's accent, font and corners
// are the same three choices you can make one by one below it, so they are
// saved, synced and reset exactly like them. Some presets go further and set
// greys and surface colors (`extras`), which stay on this computer the way
// the theme editor's do. Fonts are the stacks listed in app.config.ts
// (`citrusmail.fonts`), which are the ones self-hosted.
//
// Each is one accent on quiet surfaces: restrained, in the spirit of the
// rest of the app. Every text color here was checked against its surface
// (test/theme-presets.test.ts): 4.5:1 at least, 7:1 for the two
// high-contrast looks

const GROTESK = '\'Schibsted Grotesk\', ui-sans-serif, system-ui, sans-serif'
const INTER = '\'Inter\', ui-sans-serif, system-ui, sans-serif'
const PLEX = '\'IBM Plex Sans\', ui-sans-serif, system-ui, sans-serif'
const SERIF = '\'Source Serif 4\', ui-serif, Georgia, serif'

const SQUARE = '0rem'
const SOFT = '0.375rem'
const ROUND = '0.75rem'

const tint = (amount: number) => `color-mix(in oklab, var(--ui-primary), transparent ${100 - amount}%)`

export const THEME_PRESETS: ThemePreset[] = [
  // Nothing set: whatever this instance ships with
  { id: 'citrusmail', label: 'CitrusMail' },
  { id: 'harbor', label: 'Harbor', primary: '#2563EB', font: INTER, radius: SOFT },
  { id: 'plum', label: 'Plum', primary: '#7C3AED', font: GROTESK, radius: ROUND },
  { id: 'ember', label: 'Ember', primary: '#EA580C', font: GROTESK, radius: ROUND },
  { id: 'rosewood', label: 'Rosewood', primary: '#E11D48', font: SERIF, radius: SOFT },
  { id: 'lagoon', label: 'Lagoon', primary: '#0F766E', font: PLEX, radius: SOFT },
  { id: 'ledger', label: 'Ledger', primary: '#3F3F46', font: SERIF, radius: SQUARE },
  { id: 'ink', label: 'Ink', primary: '#3F3F46', font: INTER, radius: SQUARE },

  // Light looks with surfaces of their own
  {
    id: 'paper',
    label: 'Paper',
    primary: '#9A3412',
    font: SERIF,
    radius: SOFT,
    extras: {
      neutral: 'stone',
      light: { desk: '#F1ECE1', sheet: '#FFFDF8', elevated: '#F5F0E6', accented: '#E8E0D1', border: '#E6DFD0', text: '#44403C', textHighlighted: '#1C1917', textMuted: '#6B645C' }
    }
  },
  {
    id: 'fjord',
    label: 'Fjord',
    primary: '#0369A1',
    font: INTER,
    radius: SOFT,
    extras: {
      neutral: 'slate',
      light: { desk: '#EEF2F6', sheet: '#FFFFFF', elevated: '#F1F5F9', accented: '#E2E8F0', border: '#E2E8F0', text: '#334155', textHighlighted: '#0F172A', textMuted: '#5B6779' }
    }
  },

  // Drawn for the dark: choosing one switches to dark mode
  {
    id: 'graphite',
    label: 'Graphite',
    primary: '#5E6AD2',
    font: INTER,
    radius: SOFT,
    scheme: 'dark',
    extras: {
      neutral: 'zinc',
      dark: { desk: '#0E0E10', sheet: '#151517', elevated: '#1D1D20', accented: '#2A2A2E', border: '#232326', sheetBorder: '#232326', text: '#D4D4D8', textHighlighted: '#FAFAFA', textMuted: '#A1A1AA' }
    }
  },
  {
    id: 'midnight',
    label: 'Midnight',
    primary: '#4F6BED',
    font: INTER,
    radius: SOFT,
    scheme: 'dark',
    extras: {
      neutral: 'slate',
      dark: { desk: '#0B0F17', sheet: '#111723', elevated: '#1A2231', accented: '#263042', border: '#1E2736', sheetBorder: '#1E2736', text: '#CBD5E1', textHighlighted: '#F8FAFC', textMuted: '#94A3B8' }
    }
  },
  {
    id: 'dusk',
    label: 'Dusk',
    primary: '#8B5CF6',
    font: GROTESK,
    radius: ROUND,
    scheme: 'dark',
    extras: {
      neutral: 'zinc',
      dark: { desk: '#15131B', sheet: '#1B1924', elevated: '#24212F', accented: '#322E40', border: '#2A2735', sheetBorder: '#2A2735', text: '#D6D3E0', textHighlighted: '#F7F5FB', textMuted: '#A5A0B5' }
    }
  },
  {
    id: 'forest',
    label: 'Forest',
    primary: '#15803D',
    font: GROTESK,
    radius: ROUND,
    scheme: 'dark',
    extras: {
      neutral: 'stone',
      dark: { desk: '#0D1310', sheet: '#121A16', elevated: '#1A2520', accented: '#26342D', border: '#1E2A24', sheetBorder: '#1E2A24', text: '#CFD8D2', textHighlighted: '#F4F8F5', textMuted: '#94A39A' }
    }
  },
  {
    id: 'black',
    label: 'Black',
    primary: '#2563EB',
    font: INTER,
    radius: SOFT,
    scheme: 'dark',
    extras: {
      neutral: 'neutral',
      sheetInset: '0',
      dark: { desk: '#000000', sheet: '#0A0A0A', elevated: '#161616', accented: '#262626', border: '#1F1F1F', sheetBorder: '#1F1F1F', text: '#D4D4D4', textHighlighted: '#FFFFFF', textMuted: '#A3A3A3' }
    }
  },

  // High contrast: every text color at 7:1 or more, lines you can see
  {
    id: 'contrast-light',
    label: 'High contrast',
    primary: '#1E40AF',
    font: INTER,
    radius: SOFT,
    scheme: 'light',
    contrast: true,
    extras: {
      neutral: 'neutral',
      light: { desk: '#F2F2F2', sheet: '#FFFFFF', elevated: '#EBEBEB', accented: '#D4D4D4', border: '#737373', sheetBorder: '#404040', text: '#171717', textHighlighted: '#000000', textMuted: '#404040', selected: tint(14), selectedEdge: 'var(--ui-primary)' }
    }
  },
  {
    id: 'contrast-dark',
    label: 'High contrast dark',
    primary: '#3B82F6',
    font: INTER,
    radius: SOFT,
    scheme: 'dark',
    contrast: true,
    extras: {
      neutral: 'neutral',
      dark: { desk: '#000000', sheet: '#000000', elevated: '#1A1A1A', accented: '#333333', border: '#8C8C8C', sheetBorder: '#8C8C8C', text: '#F5F5F5', textHighlighted: '#FFFFFF', textMuted: '#D4D4D4', selected: tint(24), selectedEdge: 'var(--ui-primary)' }
    }
  }
]

/** A saved look as a gallery card */
export function presetFromSaved(saved: SavedTheme): ThemePreset {
  const { synced, local } = splitTheme(saved.theme)
  return { id: saved.id, label: saved.label, primary: synced.primary, font: synced.font, radius: synced.radius, extras: local, custom: true }
}

/** Everything a preset sets, as one override */
export function presetTheme(preset: ThemePreset): ThemeOverride {
  return {
    ...preset.extras,
    ...(preset.primary ? { primary: preset.primary } : {}),
    ...(preset.font ? { font: preset.font } : {}),
    ...(preset.radius ? { radius: preset.radius } : {})
  }
}

/**
 * The preset the current choices amount to, if any. `defaults` fills in what
 * a preset leaves to the instance; `local` is what the theme editor keeps on
 * this computer, which has to match the preset's extras
 */
export function matchingPreset(appearance: Appearance, defaults: { font: string, radius: string }, local: ThemeOverride = {}, presets: ThemePreset[] = THEME_PRESETS): ThemePreset | undefined {
  return presets.find(preset => (preset.primary ?? '') === (appearance.primary ?? '')
    && (preset.font ?? defaults.font) === (appearance.font ?? defaults.font)
    && (preset.radius ?? defaults.radius) === (appearance.radius ?? defaults.radius)
    && sameTheme(preset.extras, local))
}
