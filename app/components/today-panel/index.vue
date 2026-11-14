<script setup lang="ts">
import { format } from 'date-fns'

const { isOpen, close } = useTodayPanel()

const now = useNow({ interval: 60_000 })
const date = computed(() => format(now.value, 'EEEE d MMMM'))

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
      body: 'flex flex-col gap-5 p-4 sm:p-4'
    }"
  >
    <template #body>
      <TodayPanelAgenda @navigate="close" />
    </template>
  </USlideover>
</template>
