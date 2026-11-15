import { parseDate, type CalendarDate } from '@internationalized/date'
import { breakpointsTailwind } from '@vueuse/core'

const _useCalendar = () => {
  const route = useRoute()

  const view = computed<CalendarViewName>(() => {
    return ['day', 'month', 'year', 'agenda'].includes(route.params.view as string) ? route.params.view as CalendarViewName : 'week'
  })

  const date = computed<CalendarDate>(() => {
    try {
      return parseDate(route.params.date as string)
    } catch {
      return todayDate()
    }
  })

  // Below `lg` the week view is three days from the date: stepped, titled and
  // fetched as three, or a step of a week would skip the four it never shows
  const isSmallScreen = useBreakpoints(breakpointsTailwind).smaller('lg')
  const narrow = computed(() => view.value === 'week' && isSmallScreen.value)
  function rangeOf(target: CalendarDate): DateRange {
    return narrow.value ? weekRange(target, 3) : rangeFor(view.value, target)
  }

  const range = computed<DateRange>(() => rangeOf(date.value))

  // The month docked at the top of the month view scroll viewport, kept in
  // sync live while scrolling so the header title follows along
  const visibleMonth = shallowRef<CalendarDate | null>(null)

  // While it scrolls, the month view slides its own copies of the header
  // title over the grid, the docked one landing right on top of the h1. The
  // header hands the title over to them for as long as they are up, or the
  // one leaving the dock and the h1 would drift apart in plain sight
  const monthLabelsVisible = refAutoReset(false, 600)

  const title = computed<RangeTitle>(() => {
    // The agenda scrolls on past its first week: the month is what it's in
    if (view.value === 'agenda') {
      return { months: formatMonth(toDate(date.value)), year: String(date.value.year) }
    }

    if (view.value === 'year') {
      return { months: String(date.value.year), year: '' }
    }

    if (view.value === 'month') {
      const focus = visibleMonth.value ?? date.value

      return {
        months: formatMonth(toDate(focus)),
        year: String(focus.year)
      }
    }

    return formatRangeTitle(range.value)
  })

  // The event form stands beside the event it belongs to. The day view has a
  // single column the width of the grid, as does the agenda's list, so there is no beside to stand in
  const formSide = computed<'bottom' | 'right'>(() => view.value === 'day' || view.value === 'agenda' ? 'bottom' : 'right')

  const step = computed(() => {
    switch (view.value) {
      case 'year': return { years: 1 }
      case 'month': return { months: 1 }
      case 'week': return { days: narrow.value ? 3 : 7 }
      case 'agenda': return { days: 7 }
      default: return { days: 1 }
    }
  })

  const prevDate = computed(() => date.value.subtract(step.value))
  const nextDate = computed(() => date.value.add(step.value))

  function pathFor(target: CalendarDate, targetView: CalendarViewName = view.value): string {
    return calendarPath(target, targetView)
  }

  // Drives the slide direction of the view transition, cleared once it finishes
  function setDirection(direction: 'left' | 'right') {
    if (import.meta.client) {
      document.documentElement.dataset.navDirection = direction
    }
  }

  // One step back or forward with the slide that goes with it, for the arrow
  // keys and a swipe alike
  function go(direction: 'left' | 'right') {
    setDirection(direction)
    navigateTo(pathFor(direction === 'left' ? prevDate.value : nextDate.value))
  }

  const nuxtApp = useNuxtApp()
  nuxtApp.hook('page:view-transition:start', (transition) => {
    // An aborted transition (hidden tab, rapid navigation) rejects `finished`
    transition.finished.catch(() => {}).then(() => {
      delete document.documentElement.dataset.navDirection
    })
  })

  // One model for the two states the sidebar keeps: expanded on desktop, the
  // slideover menu below `lg`. It starts open so the server renders the
  // expanded sidebar, the component closes it itself on mount once it knows
  // the viewport is a small one
  const { isSidebarOpen } = useShell()

  // Search is the app's one palette (Ctrl/Cmd+K), which lists the calendar's
  // views, calendars and events while the calendar is on screen
  const { isOpen: isSearchOpen } = useCommandPalette()

  // The form popover holds the focus on a switch, a select or a date segment
  // as readily as on an input, and `defineShortcuts` only stands down for the
  // inputs. A key that navigates from there takes the grid out from under
  // whatever is being written, a draft on the grid and an event alike
  // The composable outlives the calendar page (it is app-wide), so its keys
  // only act while the calendar is the page on screen
  const onCalendar = () => route.path.startsWith('/calendar')

  function unlessEditing(handler: () => void) {
    return () => {
      // Arrows also move focus inside the mini calendar, the view tabs and menus,
      // and `defineShortcuts` hears them on the document all the same
      const widget = document.activeElement?.closest('[role="grid"], [role="tablist"], [role="menu"], [role="listbox"]')
      if (onCalendar() && !widget && !useEventDraft().draft.value && !useEventEditor().editingId.value) {
        handler()
      }
    }
  }

  defineAppShortcuts({
    'calendar.today': unlessEditing(() => navigateTo(pathFor(todayDate()))),
    'calendar.day': unlessEditing(() => navigateTo(pathFor(date.value, 'day'))),
    'calendar.agenda': unlessEditing(() => navigateTo(pathFor(date.value, 'agenda'))),
    'calendar.week': unlessEditing(() => navigateTo(pathFor(date.value, 'week'))),
    'calendar.month': unlessEditing(() => navigateTo(pathFor(date.value, 'month'))),
    'calendar.year': unlessEditing(() => navigateTo(pathFor(date.value, 'year'))),
    // The draft composable reads this one, so it is resolved inside the
    // handler rather than at setup, where the two would wait on each other
    'calendar.newEvent': unlessEditing(() => useEventDraft().createAtAnchor()),
    'calendar.prev': unlessEditing(() => go('left')),
    'calendar.next': unlessEditing(() => go('right'))
  })

  return {
    view,
    date,
    range,
    rangeOf,
    title,
    visibleMonth,
    monthLabelsVisible,
    formSide,
    prevDate,
    nextDate,
    pathFor,
    setDirection,
    go,
    isSidebarOpen,
    isSearchOpen
  }
}

export const useCalendar = createAppComposable(_useCalendar)
