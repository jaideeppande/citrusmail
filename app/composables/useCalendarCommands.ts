import type { CommandPaletteGroup, CommandPaletteItem } from '@nuxt/ui'

/**
 * The calendar's part of the palette: its views, calendars and the events
 * already on hand. Called by the calendar page, so it is only there with it
 */
export function useCalendarCommands() {
  const { view, date, pathFor } = useCalendar()
  const { createAtAnchor } = useEventDraft()
  const { events, calendars, hiddenCalendars, toggleCalendar } = useCalendarEvents()

  const views = [
    { label: 'Day', value: 'day', icon: 'i-lucide-calendar-range', kbd: 'd' },
    { label: 'Week', value: 'week', icon: 'i-lucide-calendar-days', kbd: 'w' },
    { label: 'Month', value: 'month', icon: 'i-lucide-calendar', kbd: 'm' },
    { label: 'Year', value: 'year', icon: 'i-lucide-calendar-fold', kbd: 'y' }
  ] as const

  useCommands((): CommandPaletteGroup<CommandPaletteItem>[] => [{
    id: 'calendar-actions',
    label: 'Calendar',
    items: [{
      label: 'New event',
      icon: 'i-lucide-plus',
      kbds: [{ value: 'n', variant: 'soft' }],
      onSelect: () => createAtAnchor()
    }, {
      label: 'Go to today',
      icon: 'i-lucide-calendar-check',
      kbds: [{ value: 't', variant: 'soft' }],
      to: pathFor(todayDate())
    }]
  }, {
    id: 'views',
    label: 'Views',
    items: views.map(item => ({
      label: item.label,
      icon: item.icon,
      kbds: [{ value: item.kbd, variant: 'soft' }],
      active: view.value === item.value,
      to: pathFor(date.value, item.value)
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
      onSelect: () => navigateTo(pathFor(toCalendarDate(new Date(event.start)), view.value === 'year' ? 'day' : view.value))
    }))
  }])
}
