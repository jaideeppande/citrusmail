<script setup lang="ts">
import { format } from 'date-fns'

const { isOpen, close } = useTodayPanel()

const now = useNow({ interval: 30_000 })
const { second } = useCalendarZones()

// With a second time zone set, what the clock says there too
const date = computed(() => {
  const day = format(now.value, 'EEEE d MMMM')
  if (!second.value) return day

  const shift = calZoneDayShift(now.value, calLocalZone(), second.value)
  const there = `${calZoneCity(second.value)} ${calZoneTime(now.value, second.value)}${shift ? `, ${calZoneDay(now.value, second.value)}` : ''}`

  return `${day} · ${there}`
})

// It slides over the page without taking it away: the mail behind stays
// live, so a click out there is work going on rather than a way of closing
// this. Escape, the button and the shortcut close it
const content = {
  onInteractOutside: (event: Event) => event.preventDefault()
}
</script>

<template>
  <USlideover
    v-model:open="isOpen"
    side="right"
    title="Today"
    :description="date"
    :modal="false"
    :overlay="false"
    :content="content"
    :ui="{
      content: 'sm:max-w-sm',
      body: 'flex flex-col gap-4 p-4 sm:p-4'
    }"
  >
    <template #body>
      <TodayPanelAgenda @navigate="close" />
    </template>
  </USlideover>
</template>
