<script setup lang="ts">
import { addDays, addMinutes } from 'date-fns'

// `anchored` is the segment the form hangs off, for a block running past
// midnight and drawn in both days. Defaulted, or an omitted boolean prop would
// read as `false`
const props = withDefaults(defineProps<{
  positioned: PositionedEvent
  anchored?: boolean
}>(), { anchored: true })

const { calendars, updateEvent } = useCalendarEvents()

const event = computed(() => props.positioned.event)
const calendar = computed(() => calendars.value.find(calendar => calendar.id === event.value.calendarId))
const color = computed(() => calendar.value?.color ?? 'primary')

const {
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
} = useEventDrag(event, {
  onCommit(start, end) {
    updateEvent({ ...event.value, start: toLocalISO(start), end: toLocalISO(end) })
  }
})

const moving = computed(() => dragging.value && mode.value === 'move')

const style = computed(() => {
  const height = dragging.value && mode.value === 'resize'
    ? Math.max(props.positioned.height + deltaMinutes.value * PX_PER_MINUTE, MIN_EVENT_MINUTES * PX_PER_MINUTE)
    : props.positioned.height

  return {
    ...eventBlockStyle(props.positioned, height),
    // In hand it stands a touch proud of the grid
    transform: moving.value
      ? `translate(${deltaX.value}px, ${deltaMinutes.value * PX_PER_MINUTE}px) scale(1.01)`
      : undefined
  }
})

// The times ride along outside the block, where its own clipping and a short
// event's single line cannot hide them: above it for a move, and under the
// edge being pulled for a resize
const labelStyle = computed(() => {
  const { top, insetInlineStart } = eventBlockStyle(props.positioned)

  if (mode.value === 'resize') {
    const height = Math.max(props.positioned.height + deltaMinutes.value * PX_PER_MINUTE, MIN_EVENT_MINUTES * PX_PER_MINUTE)

    return { top: `${props.positioned.top + height + 2}px`, insetInlineStart }
  }

  return {
    top,
    insetInlineStart,
    transform: `translate(${deltaX.value}px, calc(${deltaMinutes.value * PX_PER_MINUTE}px - 100% - 4px))`
  }
})

// Carried to another day, the label says which
const previewDay = computed(() => deltaDays.value ? formatDay(addDays(new Date(event.value.start), deltaDays.value)) : '')

const button = useTemplateRef('button')

// Letting go eases the block from where the pointer left it into the place
// the layout gives it, which a drop into a busy day can put some way off (a
// narrower slot beside its new neighbours) and a cancelled drag puts back
// where it began. First, last, invert, play: the block is already in its
// place, drawn where it was, and the transition carries it over
function settleFrom(from: DOMRect) {
  const element = button.value
  if (!element) {
    return
  }

  const to = element.getBoundingClientRect()
  const dx = from.left - to.left
  const dy = from.top - to.top
  // Only the lift is scaled back down. A block that changes size on landing
  // (a slot shared with its new neighbours) would stretch its text on the way
  const lift = to.width ? from.width / to.width : 1
  const scale = Math.abs(lift - 1) < 0.03 ? lift : 1

  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(scale - 1) < 0.005) {
    return
  }

  element.style.transition = 'none'
  element.style.transformOrigin = 'top left'
  element.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`
  element.style.boxShadow = 'var(--lb-event-lift-shadow)'
  // Read back so the starting point is committed before the transition is set
  void element.offsetWidth
  element.style.transition = 'transform var(--lb-dur-2) var(--lb-ease-out), box-shadow var(--lb-dur-2) ease'
  element.style.transform = ''
  element.style.boxShadow = ''

  const done = () => {
    element.style.transition = ''
    element.style.transformOrigin = ''
    element.removeEventListener('transitionend', done)
    element.removeEventListener('transitioncancel', done)
  }

  element.addEventListener('transitionend', done)
  element.addEventListener('transitioncancel', done)
}

// Synchronous, so it reads the block while it is still drawn in hand: by the
// next flush a move to another day has already unmounted it, watcher and all
watch(dragging, async (isDragging) => {
  if (isDragging || !button.value) {
    return
  }

  markReleased(event.value.id, button.value.getBoundingClientRect())

  await nextTick()

  // Still this block's to settle unless a new one, mounted in the column it
  // was dropped on, has taken it already
  const from = takeReleased(event.value.id)
  if (from) {
    settleFrom(from)
  }
}, { flush: 'sync' })

onMounted(() => {
  const from = takeReleased(event.value.id)
  if (from) {
    settleFrom(from)
  }
})

// While dragging, show the previewed times instead of the stored ones
const previewTimes = computed(() => {
  const shift = dragging.value && mode.value === 'move' ? deltaMinutes.value : 0
  const start = addMinutes(new Date(event.value.start), shift)
  const end = addMinutes(new Date(event.value.end), dragging.value ? (mode.value === 'resize' ? deltaMinutes.value : shift) : 0)

  return `${formatTime(start)} – ${formatTime(end > start ? end : addMinutes(start, SNAP_MINUTES))}`
})

const compact = computed(() => props.positioned.height < 40)
</script>

<template>
  <!-- What it leaves behind while it is carried: its own outline, faint, at
    the place it was picked up from -->
  <div
    v-if="moving"
    aria-hidden="true"
    class="lb-event-ghost absolute z-4 rounded-xs"
    :class="eventBlockClasses[color]"
    :style="eventBlockStyle(positioned)"
  />

  <div
    v-if="dragging"
    aria-hidden="true"
    class="lb-drag-label absolute z-30 pointer-events-none whitespace-nowrap rounded-sm bg-inverted px-1.5 py-0.5 text-[11px] font-medium text-inverted tabular-nums shadow-sm"
    :style="labelStyle"
  >
    <template v-if="previewDay">
      {{ previewDay }} ·
    </template>
    {{ previewTimes }}
  </div>

  <CalendarEventPopover
    :event="event"
    :disabled="suppressed"
    :anchored="anchored"
  >
    <button
      ref="button"
      type="button"
      data-event
      :data-event-id="event.id"
      class="absolute flex flex-col items-start overflow-hidden rounded-xs px-3 py-1 text-xs text-start select-none touch-none focus-visible:outline-3"
      :class="[
        eventBlockClasses[color],
        eventOutlineClasses[color],
        dragging ? 'lb-event-lifted z-20' : 'transition-colors z-5'
      ]"
      :style="style"
      :aria-label="`${event.title}, ${previewTimes}`"
      @click.stop
      @pointerdown="onPointerdown"
      @pointermove="onPointermove"
      @pointerup="onPointerup"
      @pointercancel="onPointercancel"
    >
      <span
        class="absolute inset-s-1 inset-y-1 w-1 rounded-full"
        :class="calendarDotClasses[color]"
      />

      <span class="w-full font-medium truncate">{{ event.title }}</span>
      <span
        v-if="!compact || dragging"
        class="w-full truncate opacity-80 tabular-nums"
      >
        {{ previewTimes }}
      </span>

      <span
        data-resize-handle
        class="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize"
      />
    </button>
  </CalendarEventPopover>
</template>
