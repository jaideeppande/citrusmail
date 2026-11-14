import { addDays, addMinutes } from 'date-fns'

// The day a block being moved would land on, as the `data-date` of its
// column, so the column can light up under it. One for the app: only one
// block is ever in hand
export const dropTargetDate = ref<string | null>(null)

// Where a block was on screen the moment it was let go, by event id. The
// block that draws the event next (the same one, or a new one in another
// day's column) picks it up and eases from there into its place
const released = new Map<string, DOMRect>()

export function markReleased(id: string, rect: DOMRect) {
  released.set(id, rect)
  // Nobody came for it: the drop put the event somewhere no block draws it
  setTimeout(() => released.delete(id), 200)
}

export function takeReleased(id: string): DOMRect | undefined {
  const rect = released.get(id)
  released.delete(id)

  return rect
}

// Pointer-capture drag to move (across days) or resize (bottom handle) an
// event block, snapped to 15-minute increments. The block itself is
// translated as a ghost preview, the real update only happens on drop.
export function useEventDrag(
  event: MaybeRefOrGetter<CalendarEvent>,
  options: { onCommit: (start: Date, end: Date) => void }
) {
  const dragging = ref(false)
  // Keeps the popover from opening on the click that ends a drag
  const suppressed = ref(false)
  const mode = ref<'move' | 'resize'>('move')
  const deltaMinutes = ref(0)
  const deltaDays = ref(0)
  const deltaX = ref(0)

  let active = false
  let startX = 0
  let startY = 0
  let columnRects: DOMRect[] = []
  let columnDates: (string | undefined)[] = []
  let columnIndex = -1

  function reset() {
    active = false
    dragging.value = false
    deltaMinutes.value = 0
    deltaDays.value = 0
    deltaX.value = 0
    dropTargetDate.value = null
  }

  function onPointerdown(pointerEvent: PointerEvent) {
    if (pointerEvent.button !== 0) {
      return
    }

    const target = pointerEvent.currentTarget as HTMLElement

    mode.value = (pointerEvent.target as HTMLElement).closest('[data-resize-handle]') ? 'resize' : 'move'
    startX = pointerEvent.clientX
    startY = pointerEvent.clientY

    // Measure the day columns once per drag, they are the geometry source
    const grid = target.closest('[data-week-grid]')
    const columns = grid ? [...grid.querySelectorAll<HTMLElement>('[data-day-column]')] : []
    columnRects = columns.map(column => column.getBoundingClientRect())
    columnDates = columns.map(column => column.dataset.date)
    columnIndex = columnRects.findIndex(rect => pointerEvent.clientX >= rect.left && pointerEvent.clientX < rect.right)

    target.setPointerCapture(pointerEvent.pointerId)
    active = true
  }

  function onPointermove(pointerEvent: PointerEvent) {
    if (!active) {
      return
    }

    const dx = pointerEvent.clientX - startX
    const dy = pointerEvent.clientY - startY

    if (!dragging.value) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) {
        return
      }

      dragging.value = true
      suppressed.value = true
    }

    deltaMinutes.value = snapMinutes(minutesFromOffset(dy))

    if (mode.value === 'move' && columnIndex !== -1) {
      const targetIndex = columnRects.findIndex(rect => pointerEvent.clientX >= rect.left && pointerEvent.clientX < rect.right)

      if (targetIndex !== -1) {
        deltaDays.value = targetIndex - columnIndex
        deltaX.value = columnRects[targetIndex]!.left - columnRects[columnIndex]!.left
      }

      // Keeps the last column it was over once the pointer leaves the grid,
      // the same as the block itself does
      dropTargetDate.value = columnDates[columnIndex + deltaDays.value] ?? null
    }
  }

  // Let the trailing click event pass before re-enabling the popover
  function release() {
    setTimeout(() => {
      suppressed.value = false
    })
  }

  function onPointerup() {
    if (active) {
      if (dragging.value && (deltaMinutes.value !== 0 || deltaDays.value !== 0)) {
        const source = toValue(event)
        const start = new Date(source.start)
        const end = new Date(source.end)

        if (mode.value === 'move') {
          // `addDays` for the column step so the wall clock survives DST,
          // only the vertical part of the drag is real minutes
          const shift = (date: Date) => addMinutes(addDays(date, deltaDays.value), deltaMinutes.value)

          options.onCommit(shift(start), shift(end))
        } else {
          const resized = addMinutes(end, deltaMinutes.value)
          options.onCommit(start, resized > addMinutes(start, SNAP_MINUTES) ? resized : addMinutes(start, SNAP_MINUTES))
        }
      }

      reset()
    }

    // Runs even after an Escape cancel dropped `active`, it is what clears
    // the suppression once the pointer really lifts
    release()
  }

  function onPointercancel() {
    reset()
    release()
  }

  useEventListener('keydown', (keyboardEvent: KeyboardEvent) => {
    // Cancels the drag but keeps the popover suppressed: the pointer is
    // still down and the click its release fires should not open it
    if (keyboardEvent.key === 'Escape' && dragging.value) {
      reset()
    }
  })

  // A gesture can end without a pointer event: releasing the mouse outside
  // the window after switching apps fires neither pointerup nor
  // pointercancel, which would leave the popover suppressed for good
  useEventListener('blur', () => {
    if (active || suppressed.value) {
      reset()
      release()
    }
  })

  return {
    dragging,
    suppressed,
    mode,
    deltaMinutes,
    deltaDays,
    deltaX,
    onPointerdown,
    onPointermove,
    onPointerup,
    onPointercancel
  }
}
