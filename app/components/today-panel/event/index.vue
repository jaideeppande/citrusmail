<script setup lang="ts">
// One line of the Today panel's agenda
const props = defineProps<{
  item: AgendaItem
}>()

const emit = defineEmits<{
  open: []
}>()

const { calendars } = useCalendarEvents()

const calendar = computed(() => calendars.value.find(calendar => calendar.id === props.item.event.calendarId))
const color = computed(() => calendar.value?.color ?? 'primary')

// The state the row shows with weight and a badge, said as words too
const label = computed(() => [
  props.item.state === 'now' ? 'Now' : props.item.state === 'next' ? 'Next' : props.item.state === 'past' ? 'Earlier' : '',
  eventLabel(props.item.event, calendar.value?.name),
  props.item.note
].filter(Boolean).join(', '))
</script>

<template>
  <button
    type="button"
    class="lb-press lb-focus group flex w-full items-stretch gap-3 rounded-md px-2 py-1.5 text-start hover:bg-elevated/60"
    :class="[
      item.state === 'now' && 'bg-primary/5 hover:bg-primary/10',
      item.state === 'past' && 'opacity-70'
    ]"
    :aria-label="label"
    @click="emit('open')"
  >
    <span class="flex w-11 shrink-0 flex-col justify-center text-xs tabular-nums">
      <template v-if="item.event.allDay">
        <span class="text-muted">All day</span>
      </template>
      <template v-else>
        <span class="text-highlighted">{{ formatTime(item.start) }}</span>
        <span class="text-muted">{{ formatTime(item.end) }}</span>
      </template>
    </span>

    <span
      aria-hidden="true"
      class="w-1 shrink-0 rounded-full"
      :class="calendarDotClasses[color]"
    />

    <span class="flex-1 min-w-0 py-0.5">
      <span
        class="block truncate text-sm text-highlighted"
        :class="item.state === 'now' || item.state === 'next' ? 'font-semibold' : 'font-medium'"
      >{{ item.event.title }}</span>
      <span class="flex items-center gap-1.5 min-w-0 text-xs text-muted">
        <UBadge
          v-if="item.state === 'now' || item.state === 'next'"
          :label="item.state === 'now' ? 'Now' : 'Next'"
          :color="item.state === 'now' ? 'primary' : 'neutral'"
          :variant="item.state === 'now' ? 'solid' : 'subtle'"
          size="sm"
          class="shrink-0"
        />
        <span class="truncate">{{ item.note ?? calendar?.name }}</span>
      </span>
    </span>
  </button>
</template>
