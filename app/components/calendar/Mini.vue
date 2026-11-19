<script setup lang="ts">
import type { CalendarDate } from '@internationalized/date'

// The calendar sidebar's month: picking a day opens it in the view on screen
const { date, pathFor, rangeOf } = useCalendar()
const { warmRange } = useCalendarEvents()

function onSelect(day: CalendarDate) {
  navigateTo(pathFor(day))
}

// Warm the range a click would open while the pointer rests on a day
function onHover(day: CalendarDate) {
  warmRange(rangeOf(day))
}
</script>

<template>
  <CalendarMiniMonth
    :selected="date"
    @select="onSelect"
    @hover="onHover"
  />
</template>
