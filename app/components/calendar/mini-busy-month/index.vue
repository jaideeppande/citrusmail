<script setup lang="ts">
import type { CalendarDate } from '@internationalized/date'

// Apart from its frame so nothing of the calendar is set up, and nothing is
// fetched, until the month is open and the mailbox has a calendar at all
function onSelect(day: CalendarDate) {
  navigateTo(calendarPath(day, 'week'))
}
</script>

<template>
  <CalendarMiniMonth
    :selected="null"
    @select="onSelect"
  />
</template>
