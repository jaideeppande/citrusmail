// The calendar's second time zone, kept on this computer. One for the app:
// the grids, the event cards, the agenda and the Today panel all read it
const _useCalendarZones = () => {
  const prefs = useLocalPref<CalendarZonePrefs>('calendar-zones', { second: '' })

  // The zone this computer is set to, read once: the grid works in it
  const local = calLocalZone()

  // Empty when none is set, when it is the zone this computer is already in,
  // and when the browser no longer knows the saved name
  const second = computed(() => {
    const zone = prefs.value.second

    return calZoneValid(zone) && zone !== local ? zone : ''
  })

  function setSecond(zone: string) {
    prefs.value = { ...prefs.value, second: zone }
    announce(zone ? `Second time zone set to ${calZoneCity(zone)}` : 'Second time zone removed')
  }

  // Opened from the calendar header and the palette
  const pickerOpen = ref(false)

  return { prefs, local, second, setSecond, pickerOpen }
}

export const useCalendarZones = createAppComposable(_useCalendarZones)
