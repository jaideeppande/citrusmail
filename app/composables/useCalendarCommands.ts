import type { CommandPaletteGroup, CommandPaletteItem } from '@nuxt/ui'
import type { ShortcutId } from '~/utils/shortcuts'

/**
 * The calendar's part of the palette: its views, calendars and the events
 * already on hand. Called by the calendar page, so it is only there with it
 */
export function useCalendarCommands() {
  const { view, date } = useCalendar()
  const { createAtAnchor } = useEventDraft()
  const { events, calendars, hiddenCalendars, toggleCalendar } = useCalendarEvents()
  const findTime = useFindTime()
  const { second, pickerOpen } = useCalendarZones()
  const { kbds } = useShortcutKeys()
  const route = useRoute()

  const keys = (id: ShortcutId) => kbds(id).map(value => ({ value, variant: 'soft' as const }))

  const views = [
    { label: 'Day', value: 'day', icon: 'i-lucide-calendar-range', shortcut: 'calendar.day' },
    { label: 'Week', value: 'week', icon: 'i-lucide-calendar-days', shortcut: 'calendar.week' },
    { label: 'Month', value: 'month', icon: 'i-lucide-calendar', shortcut: 'calendar.month' },
    { label: 'Year', value: 'year', icon: 'i-lucide-calendar-fold', shortcut: 'calendar.year' },
    { label: 'Agenda', value: 'agenda', icon: 'i-lucide-list', shortcut: 'calendar.agenda' }
  ] as const

  // The agenda is read off the route, the shared view only knows the grids
  const current = computed<CalendarViewName>(() => route.params.view === 'agenda' ? 'agenda' : view.value)

  useCommands((): CommandPaletteGroup<CommandPaletteItem>[] => [{
    id: 'calendar-actions',
    label: 'Calendar',
    items: [{
      label: 'New event',
      icon: 'i-lucide-plus',
      kbds: keys('calendar.newEvent'),
      onSelect: () => createAtAnchor()
    }, {
      label: 'Go to today',
      icon: 'i-lucide-calendar-check',
      kbds: keys('calendar.today'),
      to: calendarPath(todayDate(), current.value)
    }, {
      label: findTime.active.value ? 'Stop finding a time' : 'Find a time',
      suffix: 'Mark free slots to send',
      icon: 'i-lucide-calendar-search',
      onSelect: () => findTime.active.value ? findTime.stop() : findTime.start()
    }, {
      label: 'Time zones…',
      suffix: second.value ? `Second zone: ${calZoneCity(second.value)}` : 'Show a second time zone',
      icon: 'i-lucide-globe',
      onSelect: () => {
        pickerOpen.value = true
      }
    }]
  }, {
    id: 'views',
    label: 'Views',
    items: views.map(item => ({
      label: item.label,
      icon: item.icon,
      kbds: keys(item.shortcut),
      active: current.value === item.value,
      to: calendarPath(date.value, item.value)
    }))
  }, {
    id: 'calendars',
    label: 'Calendars',
    // The palette ticks whatever its listbox holds, and that selection is one
    // model shared by every group: `multiple` would tick the actions, the views
    // and the events along with these. They keep it open with `preventDefault`
    // and never reach the model anyway, so the group draws its own mark
    slot: 'calendar',
    items: calendars.value.map(calendar => ({
      label: calendar.name,
      chip: { color: calendar.color },
      checked: !hiddenCalendars.value.includes(calendar.id),
      onSelect: (event: Event) => {
        event.preventDefault()
        toggleCalendar(calendar.id)
      }
    }))
  }, {
    // Only the ranges already fetched, the views load more as you navigate
    id: 'events',
    label: 'Events',
    items: events.value.map(event => ({
      label: event.title,
      suffix: formatFullDate(new Date(event.start)),
      chip: { color: calendars.value.find(calendar => calendar.id === event.calendarId)?.color },
      // The year view draws no events, so one picked from there opens on its day
      onSelect: () => navigateTo(calendarPath(toCalendarDate(new Date(event.start)), current.value === 'year' ? 'day' : current.value))
    }))
  }])
}
