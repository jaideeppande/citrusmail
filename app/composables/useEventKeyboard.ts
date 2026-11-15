// Moving around the events on a grid from the keyboard, and moving them.
// Tab already walks them in time order, day by day; on a focused event the
// arrows go to the nearest one in that direction, Alt with an arrow moves it
// (a slot up or down, a day across; a week up or down on the month grid) and
// Alt+Shift with up or down makes it end a slot earlier or later. Bound on
// the view's root, so it hears every event inside it and nothing outside

type Direction = 'up' | 'down' | 'left' | 'right'

const DIRECTIONS: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right'
}

// The event on screen nearest to `from` in a direction: ahead of it along
// that axis, the drift across the other axis costing double so a column or a
// row is followed before anything diagonal
function nearest(from: HTMLElement, all: HTMLElement[], direction: Direction): HTMLElement | undefined {
  const a = from.getBoundingClientRect()
  const ax = a.left + a.width / 2
  const ay = a.top + a.height / 2

  let best: HTMLElement | undefined
  let bestScore = Infinity

  for (const element of all) {
    if (element === from) continue

    const b = element.getBoundingClientRect()
    const dx = b.left + b.width / 2 - ax
    const dy = b.top + b.height / 2 - ay

    const ahead = direction === 'up' ? dy < -1 : direction === 'down' ? dy > 1 : direction === 'left' ? dx < -1 : dx > 1
    if (!ahead) continue

    const vertical = direction === 'up' || direction === 'down'
    const score = vertical ? Math.abs(dy) + 2 * Math.abs(dx) : Math.abs(dx) + 2 * Math.abs(dy)

    if (score < bestScore) {
      best = element
      bestScore = score
    }
  }

  return best
}

export function useEventKeyboard(options: { grid: 'time' | 'month' }) {
  const { events } = useCalendarEvents()
  const { moveBy } = useEventMove()

  // A moved event is drawn again, often by a new element in another column,
  // and the focus follows it there
  function refocus(id: string) {
    nextTick(() => {
      requestAnimationFrame(() => {
        document.querySelector<HTMLElement>(`[data-event-id="${CSS.escape(id)}"]`)?.focus()
      })
    })
  }

  function onKeydown(keyboardEvent: KeyboardEvent) {
    const direction = DIRECTIONS[keyboardEvent.key]
    const target = (keyboardEvent.target as HTMLElement | null)?.closest<HTMLElement>('[data-event][data-event-id]')
    if (!direction || !target || keyboardEvent.metaKey || keyboardEvent.ctrlKey) {
      return
    }

    const root = keyboardEvent.currentTarget as HTMLElement

    if (keyboardEvent.altKey) {
      const event = events.value.find(item => item.id === target.dataset.eventId)
      if (!event) {
        return
      }

      keyboardEvent.preventDefault()
      keyboardEvent.stopPropagation()

      const vertical = direction === 'up' || direction === 'down'
      const sign = direction === 'up' || direction === 'left' ? -1 : 1

      if (keyboardEvent.shiftKey) {
        if (vertical && !event.allDay && options.grid === 'time') {
          moveBy(event, { minutes: sign * SNAP_MINUTES, resize: true })
        }
      } else if (!vertical) {
        moveBy(event, { days: sign })
      } else if (options.grid === 'month' || event.allDay) {
        moveBy(event, { days: sign * 7 })
      } else {
        moveBy(event, { minutes: sign * SNAP_MINUTES })
      }

      refocus(event.id)

      return
    }

    if (keyboardEvent.shiftKey) {
      return
    }

    const all = [...root.querySelectorAll<HTMLElement>('[data-event][data-event-id]')]
    const next = nearest(target, all, direction)

    // Handled either way: the calendar's own arrows step to another week,
    // which would take the grid out from under the focus
    keyboardEvent.preventDefault()
    keyboardEvent.stopPropagation()

    if (next) {
      next.scrollIntoView({ block: 'nearest' })
      next.focus()
    }
  }

  return { onKeydown }
}
