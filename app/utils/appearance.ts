// The choices in Settings → Appearance
export const APPEARANCE_MODES = [
  { label: 'System', value: 'system', icon: 'i-lucide-monitor' },
  { label: 'Light', value: 'light', icon: 'i-lucide-sun' },
  { label: 'Dark', value: 'dark', icon: 'i-lucide-moon' }
]
export const APPEARANCE_SIZES = [
  { label: 'Small', value: '15px' },
  { label: 'Default', value: '16px' },
  { label: 'Large', value: '17px' }
]
export const APPEARANCE_CORNERS = [
  { label: 'Square', value: '0rem' },
  { label: 'Soft', value: '0.375rem' },
  { label: 'Round', value: '0.75rem' }
]
export const APPEARANCE_MOTION = [
  { label: 'System', value: 'system' },
  { label: 'Full', value: 'full' },
  { label: 'Reduced', value: 'reduced' },
  { label: 'Off', value: 'off' }
]
export const APPEARANCE_DENSITY = [
  { label: 'Comfortable', value: 'comfortable', icon: 'i-lucide-rows-2' },
  { label: 'Cozy', value: 'cozy', icon: 'i-lucide-rows-3' },
  { label: 'Compact', value: 'compact', icon: 'i-lucide-rows-4' }
]

export const DEFAULT_THEME_SCHEDULE: ThemeSchedule = { on: false, light: '07:00', dark: '19:00' }

/** Light or dark for this time of day: light from its time until dark's, across midnight too */
export function scheduledMode(schedule: Pick<ThemeSchedule, 'light' | 'dark'>, now = new Date()): 'light' | 'dark' {
  const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3))
  const current = now.getHours() * 60 + now.getMinutes()
  const light = minutes(schedule.light)
  const dark = minutes(schedule.dark)
  if (Number.isNaN(light) || Number.isNaN(dark) || light === dark) return 'light'
  const isLight = light < dark ? current >= light && current < dark : current >= light || current < dark
  return isLight ? 'light' : 'dark'
}
