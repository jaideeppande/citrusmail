import { addDays, addMinutes, startOfDay } from 'date-fns'

// What a click with no drag marks while finding a time
const CLICK_MINUTES = 30
// How far the keyboard cursor steps up and down a day
const CURSOR_STEP = 30

// Find a time: the free slots one marks on the day and week grids to offer
// someone, then writes into a message. Marking draws nothing on the calendar
// itself and saves nothing: the slots live here until the mode is left
const _useFindTime = () => {
  const active = ref(false)
  const slots = shallowRef<FreeSlot[]>([])
  // The slot a drag is drawing, before it is let go
  const pending = shallowRef<FreeSlot | null>(null)
  // The keyboard's place on the grid: a day and a minute of it
  const cursor = shallowRef<{ day: string, minutes: number } | null>(null)

  const toast = useToast()
  const route = useRoute()
  const { second, local } = useCalendarZones()

  const count = computed(() => slots.value.length)

  // Marking needs a time axis, so from any other view it lands on the week
  async function start() {
    const view = route.params.view
    if (!route.path.startsWith('/calendar') || (view !== 'day' && view !== 'week')) {
      await navigateTo(calendarPath(useCalendar().date.value, 'week'))
    }

    active.value = true
    announce('Finding a time. Click or drag on the grid to mark free slots, or Tab to a day and press Enter. Escape leaves')
  }

  function stop() {
    if (!active.value) return

    active.value = false
    slots.value = []
    pending.value = null
    cursor.value = null
    endGesture()
    announce('Stopped finding a time')
  }

  function clear() {
    slots.value = []
    announce('Slots cleared')
  }

  function add(slot: FreeSlot) {
    slots.value = mergeFreeSlots([...slots.value, slot])
    announce(`${freeSlotLine(slot, local)} marked. ${freeSlotCount(slots.value.length)}`)
  }

  function remove(slot: FreeSlot) {
    slots.value = slots.value.filter(item => item !== slot)
    announce(`Slot removed. ${freeSlotCount(slots.value.length)}`)
  }

  // A click on a marked slot takes it away, anywhere else marks one
  function toggleAt(day: Date, minutes: number) {
    const moment = addMinutes(startOfDay(day), minutes)
    const hit = freeSlotAt(slots.value, moment)

    if (hit) {
      remove(hit)
    } else {
      add({ start: moment, end: addMinutes(moment, CLICK_MINUTES) })
    }
  }

  function slotsForDay(day: Date): FreeSlot[] {
    const from = startOfDay(day)
    const to = addDays(from, 1)

    return [...slots.value, ...(pending.value ? [pending.value] : [])]
      .filter(slot => slot.start < to && slot.end > from)
  }

  let gesture: { day: Date, rect: DOMRect, anchor: number, y: number, moved: boolean } | null = null

  function endGesture() {
    gesture = null
    document.removeEventListener('pointermove', onPointermove)
    document.removeEventListener('pointerup', onPointerup)
    document.removeEventListener('pointercancel', onPointercancel)
  }

  function onPointerdown(event: PointerEvent, day: Date) {
    if (event.button !== 0) return

    event.preventDefault()
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    gesture = { day, rect, anchor: minutesInColumn(event.clientY, rect, 'floor'), y: event.clientY, moved: false }

    document.addEventListener('pointermove', onPointermove)
    document.addEventListener('pointerup', onPointerup)
    document.addEventListener('pointercancel', onPointercancel)
  }

  function onPointermove(event: PointerEvent) {
    if (!gesture) return

    if (!gesture.moved && Math.abs(event.clientY - gesture.y) < DRAG_THRESHOLD) return
    gesture.moved = true

    const minutes = minutesInColumn(event.clientY, gesture.rect)
    const from = Math.min(gesture.anchor, minutes)
    const to = Math.max(Math.max(gesture.anchor, minutes), from + SNAP_MINUTES)
    const day = startOfDay(gesture.day)

    pending.value = { start: addMinutes(day, from), end: addMinutes(day, to) }
  }

  function onPointerup() {
    if (!gesture) return

    if (gesture.moved && pending.value) {
      add(pending.value)
    } else if (!gesture.moved) {
      toggleAt(gesture.day, gesture.anchor)
    }

    pending.value = null
    endGesture()
  }

  function onPointercancel() {
    pending.value = null
    endGesture()
  }

  // The keyboard path: Tab onto a day, up and down walk it in half hours,
  // Enter or Space marks or clears the half hour the cursor is on
  function onColumnKeydown(event: KeyboardEvent, day: Date) {
    const iso = isoDate(day)
    const at = cursor.value?.day === iso ? cursor.value.minutes : 9 * 60

    const say = (minutes: number) => {
      const moment = addMinutes(startOfDay(day), minutes)
      const marked = freeSlotAt(slots.value, moment)
      announce(`${formatTime(moment)}${marked ? ', marked' : ''}`)
    }

    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      const minutes = Math.min(DAY_MINUTES - CURSOR_STEP, Math.max(0, at + (event.key === 'ArrowUp' ? -CURSOR_STEP : CURSOR_STEP)))
      cursor.value = { day: iso, minutes }
      say(minutes)
    } else if (event.key === 'Enter' || event.key === ' ') {
      cursor.value = { day: iso, minutes: at }
      toggleAt(day, at)
    } else {
      return
    }

    event.preventDefault()
    event.stopPropagation()
  }

  function onColumnFocus(day: Date) {
    const iso = isoDate(day)
    if (cursor.value?.day !== iso) {
      cursor.value = { day: iso, minutes: cursor.value?.minutes ?? 9 * 60 }
    }
  }

  async function copy() {
    if (!slots.value.length) return

    try {
      await navigator.clipboard.writeText(freeSlotsText(slots.value, local, second.value || undefined))
      toast.add({ title: 'Times copied', icon: 'i-lucide-clipboard-check' })
      announce('Times copied')
    } catch {
      toast.add({ title: 'Could not copy the times', color: 'error' })
      announce('Could not copy the times', true)
    }
  }

  function insert() {
    if (!slots.value.length) return

    useComposer().start({ html: freeSlotsHtml(slots.value, local, second.value || undefined) })
    stop()
  }

  // Escape leaves, unless something on top of the grid has it first (a form,
  // a menu), which closes on its own Escape
  useEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !active.value || event.defaultPrevented) return
    if (document.activeElement?.closest('[role="dialog"],[role="menu"],[data-reka-popper-content-wrapper]')) return

    if (gesture) {
      pending.value = null
      endGesture()

      return
    }

    stop()
  })

  // The mode belongs to the calendar's day and week grids
  watch(() => [route.path.startsWith('/calendar'), route.params.view], ([onCalendar, view]) => {
    if (!onCalendar || (view !== 'day' && view !== 'week')) stop()
  })

  return {
    active,
    slots,
    pending,
    cursor,
    count,
    start,
    stop,
    clear,
    remove,
    slotsForDay,
    onPointerdown,
    onColumnKeydown,
    onColumnFocus,
    copy,
    insert
  }
}

export const useFindTime = createAppComposable(_useFindTime)
