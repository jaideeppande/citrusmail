<script setup lang="ts">
import { isSameDay } from 'date-fns'

// One event in the agenda: its times, its calendar's colour, the title and
// the first line of its notes. Pressing it opens the same form the grids do
const props = defineProps<{
  event: CalendarEvent
  // The day it is listed under, which a multi-day event shares with others
  day: Date
  // The first day it is listed on owns the form, the way a block running
  // past midnight hangs it off the segment holding its start
  anchored: boolean
}>()

const { calendars } = useCalendarEvents()
const { second, local } = useCalendarZones()

const calendar = computed(() => calendars.value.find(calendar => calendar.id === props.event.calendarId))
const color = computed(() => calendar.value?.color ?? 'primary')

const start = computed(() => new Date(props.event.start))
const end = computed(() => new Date(props.event.end))

// A timed event that began before this day, or runs on past it, says so
// rather than showing a clock it does not keep here
const times = computed(() => {
  if (props.event.allDay) return { from: 'All day', to: '' }

  const startsHere = isSameDay(start.value, props.day)
  const endsHere = isSameDay(end.value, props.day) || (end.value.getHours() === 0 && end.value.getMinutes() === 0 && end.value.getTime() - props.day.getTime() <= 86_400_000)

  return {
    from: startsHere ? formatTime(start.value) : 'Continues',
    to: endsHere ? formatTime(end.value) : 'Runs on'
  }
})

const secondWhen = computed(() => second.value && !props.event.allDay
  ? calZoneSecondRange(start.value, end.value, local, second.value)
  : '')

const note = computed(() => agendaNote(props.event.description))

const label = computed(() => [
  eventLabel(props.event, calendar.value?.name),
  secondWhen.value && `in ${calZoneCity(second.value)} ${secondWhen.value.replace(/^\S+ /, '')}`,
  note.value
].filter(Boolean).join(', '))
</script>

<template>
  <CalendarEventPopover
    v-slot="{ open }"
    :event="event"
    :anchored="anchored"
    side="bottom"
  >
    <button
      type="button"
      data-event
      data-agenda-item
      :data-event-id="event.id"
      :data-active="open || undefined"
      :aria-label="label"
      class="lb-press lb-focus group flex w-full items-start gap-3 rounded-md px-2 py-1.5 text-start hover:bg-elevated/70 data-active:bg-elevated"
      @click.stop
    >
      <span class="flex w-24 shrink-0 gap-1 pt-px text-xs tabular-nums">
        <span class="text-highlighted">{{ times.from }}</span>
        <template v-if="times.to">
          <span
            class="text-muted"
            aria-hidden="true"
          >–</span>
          <span class="text-muted">{{ times.to }}</span>
        </template>
      </span>

      <span
        aria-hidden="true"
        class="mt-1 size-2 shrink-0 rounded-full"
        :class="calendarDotClasses[color]"
      />

      <span class="flex-1 min-w-0">
        <span class="flex items-baseline gap-2 min-w-0">
          <span class="truncate text-sm font-medium text-highlighted">{{ event.title }}</span>
          <UIcon
            v-if="event.recurring"
            name="i-lucide-repeat"
            class="size-3 shrink-0 self-center text-muted"
            aria-hidden="true"
          />
        </span>
        <span
          v-if="note"
          class="block truncate text-xs text-muted"
        >{{ note }}</span>
      </span>

      <span
        v-if="secondWhen"
        class="shrink-0 pt-px text-[11px] text-muted tabular-nums"
      >{{ secondWhen }}</span>
    </button>
  </CalendarEventPopover>
</template>
