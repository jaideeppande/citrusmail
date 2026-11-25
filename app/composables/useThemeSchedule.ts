// Settings → Appearance → Follow the time of day. Kept on this computer: the
// sun sets at a different hour on each of them
const _useThemeSchedule = () => {
  const schedule = useLocalPref<ThemeSchedule>('theme-schedule', DEFAULT_THEME_SCHEDULE)
  const colorMode = useColorMode()

  /** Puts on the theme this time of day calls for. Does nothing while the schedule is off */
  function apply() {
    if (!schedule.value.on) return
    const mode = scheduledMode(schedule.value)
    if (colorMode.preference !== mode) colorMode.preference = mode
  }

  function turnOn() {
    schedule.value = { ...schedule.value, on: true, before: colorMode.preference }
    apply()
  }

  /** Back to what was chosen before, or to `preference` when a theme is picked by hand */
  function turnOff(preference?: string) {
    const before = preference ?? schedule.value.before ?? 'light'
    schedule.value = { on: false, light: schedule.value.light, dark: schedule.value.dark }
    colorMode.preference = before
  }

  function setTimes(patch: Partial<Pick<ThemeSchedule, 'light' | 'dark'>>) {
    schedule.value = { ...schedule.value, ...patch }
    apply()
  }

  return { schedule, apply, turnOn, turnOff, setTimes }
}

export const useThemeSchedule = createAppComposable(_useThemeSchedule)
