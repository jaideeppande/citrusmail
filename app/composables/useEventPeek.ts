export interface EventPeek {
  event: CalendarEvent
  /** Where the event sits on screen, to stand the card beside it */
  rect: DOMRect
}

// How long the pointer has to rest on an event before its card shows: long
// enough that sweeping across a busy week raises nothing
const REST = 350

// The small card that shows when the pointer rests on an event. One for the
// whole calendar rather than one per event: the month view draws a few
// hundred of them, and only one can be under the pointer
const _useEventPeek = () => {
  const peek = shallowRef<EventPeek | null>(null)

  let timer: ReturnType<typeof setTimeout> | undefined

  function hide() {
    clearTimeout(timer)
    timer = undefined
    peek.value = null
  }

  // `find` rather than the element itself: an event swaps its element for a
  // wrapped copy the first time it is pointed at, and the one the pointer
  // came in on may be gone by the time the wait is over
  function rest(event: CalendarEvent, find: () => Element | null | undefined) {
    clearTimeout(timer)

    timer = setTimeout(() => {
      const element = find()
      // A form or a draft on screen has the attention already
      if (!element?.isConnected || useEventEditor().editingId.value || useEventDraft().draft.value) {
        return
      }

      peek.value = { event, rect: element.getBoundingClientRect() }
    }, REST)
  }

  return { peek, rest, hide }
}

export const useEventPeek = createAppComposable(_useEventPeek)
