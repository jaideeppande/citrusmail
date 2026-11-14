// The gallery in Settings → Appearance. Each preset is only an accent, a font
// and corners: the same three choices you can make one by one below it, so a
// preset is saved, synced and reset exactly like them. Fonts are the stacks
// listed in app.config.ts (`citrusmail.fonts`), which are the ones self-hosted

const GROTESK = '\'Schibsted Grotesk\', ui-sans-serif, system-ui, sans-serif'
const INTER = '\'Inter\', ui-sans-serif, system-ui, sans-serif'
const PLEX = '\'IBM Plex Sans\', ui-sans-serif, system-ui, sans-serif'
const SERIF = '\'Source Serif 4\', ui-serif, Georgia, serif'

const SQUARE = '0rem'
const SOFT = '0.375rem'
const ROUND = '0.75rem'

export const THEME_PRESETS: ThemePreset[] = [
  // Nothing set: whatever this instance ships with
  { id: 'citrusmail', label: 'CitrusMail' },
  { id: 'harbor', label: 'Harbor', primary: '#2563EB', font: INTER, radius: SOFT },
  { id: 'plum', label: 'Plum', primary: '#7C3AED', font: GROTESK, radius: ROUND },
  { id: 'ember', label: 'Ember', primary: '#EA580C', font: GROTESK, radius: ROUND },
  { id: 'rosewood', label: 'Rosewood', primary: '#E11D48', font: SERIF, radius: SOFT },
  { id: 'lagoon', label: 'Lagoon', primary: '#0F766E', font: PLEX, radius: SOFT },
  { id: 'ledger', label: 'Ledger', primary: '#3F3F46', font: SERIF, radius: SQUARE },
  { id: 'ink', label: 'Ink', primary: '#3F3F46', font: INTER, radius: SQUARE }
]

/** The preset the current choices amount to, if any. `defaults` fills in what a preset leaves to the instance */
export function matchingPreset(appearance: Appearance, defaults: { font: string, radius: string }): ThemePreset | undefined {
  return THEME_PRESETS.find(preset => (preset.primary ?? '') === (appearance.primary ?? '')
    && (preset.font ?? defaults.font) === (appearance.font ?? defaults.font)
    && (preset.radius ?? defaults.radius) === (appearance.radius ?? defaults.radius))
}
