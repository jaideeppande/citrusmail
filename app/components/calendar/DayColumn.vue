<script setup lang="ts">
import { differenceInMinutes, isSameDay, isToday, isWeekend, startOfDay } from 'date-fns'

// Placeholder blocks shown while a range loads, as [start hour, hours]
const SKELETONS = [[9, 1.5], [13, 1], [16, 2]] as const

const props = defineProps<{
  day: Date
  events: PositionedEvent[]
  // The leftmost column on screen, which is where a block arriving from a day
  // the grid does not show has to take its form
  first?: boolean
  loading?: boolean
}>()

const { onGridPointerdown, onGridDblclick } = useEventDraft()
const findTime = useFindTime()

// Finding a time, the grid marks free slots instead of drawing events
function onPointerdown(event: PointerEvent) {
  if (findTime.active.value) {
    findTime.onPointerdown(event, props.day)
  } else {
    onGridPointerdown(event, { kind: 'timed', day: props.day })
  }
}

function onDblclick(event: MouseEvent) {
  if (!findTime.active.value) {
    onGridDblclick(event, { kind: 'timed', day: props.day })
  }
}

const dayStart = computed(() => startOfDay(props.day))

function slotStyle(slot: FreeSlot) {
  const from = Math.max(0, differenceInMinutes(slot.start, dayStart.value))
  const to = Math.min(DAY_MINUTES, differenceInMinutes(slot.end, dayStart.value))

  return {
    top: `${from * PX_PER_MINUTE + 1}px`,
    height: `${Math.max(to - from, SNAP_MINUTES) * PX_PER_MINUTE - 2}px`
  }
}

const freeSlots = computed(() => findTime.active.value ? findTime.slotsForDay(props.day) : [])

const cursorTop = computed(() => {
  const cursor = findTime.cursor.value
  return findTime.active.value && cursor?.day === isoDate(props.day) ? cursor.minutes * PX_PER_MINUTE : null
})

const spoken = computed(() => formatSpokenDate(props.day))

// A block running past midnight is drawn in both days, and the form goes to
// the one holding its start so it does not open twice
function anchored(event: CalendarEvent): boolean {
  const start = new Date(event.start)

  return isSameDay(start, props.day) || (!!props.first && start < props.day)
}
</script>

<template>
  <!-- The column start is the scroller's snap point for midnight, the hour
    lines cover the rest of the day. Its top is midnight for the gestures too,
    which read a time straight off the pointer -->
  <div
    data-day-column
    :data-date="isoDate(day)"
    :data-drop-target="dropTargetDate === isoDate(day) || undefined"
    class="lb-drop-day relative border-s border-default snap-start"
    :class="[isWeekend(day) && 'bg-(--weekend-bg)', findTime.active.value && 'cursor-crosshair outline-none focus-visible:bg-primary/5']"
    :style="{ height: `${24 * HOUR_HEIGHT}px` }"
    :tabindex="findTime.active.value ? 0 : undefined"
    :role="findTime.active.value ? 'group' : undefined"
    :aria-label="findTime.active.value ? `${spoken}. Up and down choose a half hour, Enter marks or clears it` : undefined"
    @pointerdown="onPointerdown"
    @dblclick="onDblclick"
    @keydown="findTime.active.value && findTime.onColumnKeydown($event, day)"
    @focus="findTime.active.value && findTime.onColumnFocus(day)"
  >
    <div
      v-for="hour in 23"
      :key="hour"
      class="absolute inset-x-0 border-t border-default pointer-events-none snap-start"
      :style="{ top: `${hour * HOUR_HEIGHT}px` }"
    />

    <USkeleton
      v-for="[hour, hours] in loading ? SKELETONS : []"
      :key="hour"
      class="absolute inset-x-1 rounded-xs"
      :style="{ top: `${hour * HOUR_HEIGHT}px`, height: `${hours * HOUR_HEIGHT}px` }"
    />

    <template
      v-for="positioned in events"
      :key="positioned.event.id"
    >
      <!-- The draft rode through the same layout, so it takes its slot and
        the day has already made room for it -->
      <CalendarEventDraft
        v-if="positioned.event.id === DRAFT_EVENT_ID"
        variant="block"
        anchored
        :style="eventBlockStyle(positioned)"
      />
      <CalendarEventBlock
        v-else
        :positioned="positioned"
        :anchored="anchored(positioned.event)"
      />
    </template>

    <!-- Marked while finding a time: dashed, so never mistaken for an event -->
    <div
      v-for="slot in freeSlots"
      :key="slot.start.getTime()"
      aria-hidden="true"
      class="lb-free-slot absolute inset-x-1 z-6 rounded-sm pointer-events-none flex items-start px-1.5 py-0.5 text-[11px] font-medium text-highlighted tabular-nums"
      :style="slotStyle(slot)"
    >
      {{ formatTime(slot.start) }} – {{ formatTime(slot.end) }}
    </div>

    <div
      v-if="cursorTop !== null"
      aria-hidden="true"
      class="lb-free-cursor absolute inset-x-1 z-7 rounded-sm pointer-events-none"
      :style="{ top: `${cursorTop}px`, height: `${30 * PX_PER_MINUTE}px` }"
    />

    <ClientOnly>
      <CalendarNowIndicator v-if="isToday(day)" />
    </ClientOnly>
  </div>
</template>
