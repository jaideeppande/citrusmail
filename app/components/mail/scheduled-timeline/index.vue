<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

// The week ahead at a glance: a track for the next seven days with a marker
// for each message waiting to go out. A marker opens the same actions as its
// row in the list underneath. Arrow keys move from marker to marker
const props = defineProps<{
  items: ScheduledMessage[]
}>()

const emit = defineEmits<{
  'edit': [item: ScheduledMessage]
  'reschedule': [item: ScheduledMessage]
  'reschedule-to': [item: ScheduledMessage, date: Date]
  'cancel': [item: ScheduledMessage]
}>()

const SPAN = 7 * 86_400_000
const now = useNow({ interval: 60_000 })
const start = computed(() => now.value.getTime())

const at = (time: number) => `${Math.min(100, Math.max(0, ((time - start.value) / SPAN) * 100))}%`

/** Midnight of each coming day, with its name, where the track crosses it */
const days = computed(() => Array.from({ length: 7 }, (_, index) => {
  const day = new Date(start.value)
  day.setHours(0, 0, 0, 0)
  day.setDate(day.getDate() + index + 1)
  return { key: day.getTime(), left: at(day.getTime()), label: day.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' }) }
}).filter(day => day.key < start.value + SPAN))

const inWeek = computed(() => props.items.filter(item => new Date(item.sendAt).getTime() < start.value + SPAN))
const later = computed(() => props.items.length - inWeek.value.length)

function describe(item: ScheduledMessage) {
  const to = item.to.map(personName).join(', ') || 'no recipients'
  const when = item.status === 'failed' ? 'not sent' : scheduleLabel(item.sendAt)
  return `${item.subject || '(No subject)'}, to ${to}, ${when}`
}

function menu(item: ScheduledMessage): DropdownMenuItem[][] {
  return [
    [{ type: 'label', label: item.subject || '(No subject)' }],
    sendLaterPresets().map(preset => ({ label: preset.label, description: scheduleLabel(preset.date.toISOString()), icon: preset.icon, onSelect: () => emit('reschedule-to', item, preset.date) })),
    [
      { label: 'Custom time…', icon: 'i-lucide-calendar-clock', onSelect: () => emit('reschedule', item) },
      { label: 'Edit', icon: 'i-lucide-pen-line', onSelect: () => emit('edit', item) },
      { label: 'Don’t send', icon: 'i-lucide-trash-2', onSelect: () => emit('cancel', item) }
    ]
  ]
}

const list = useTemplateRef('list')
useRovingFocus(list)
</script>

<template>
  <div
    v-if="inWeek.length"
    class="px-4 pt-2 pb-1"
  >
    <div class="lb-timeline-track">
      <!-- The days and the line for now: drawn for the eye, the list carries the meaning -->
      <div
        aria-hidden="true"
        class="absolute inset-x-0 top-6 h-px bg-(--ui-border-accented)"
      />
      <div
        aria-hidden="true"
        class="absolute top-1 bottom-0 start-0 w-0.5 rounded-full bg-primary"
      />
      <span
        aria-hidden="true"
        class="absolute top-0 start-1.5 text-[11px] font-semibold text-primary"
      >Now</span>
      <template
        v-for="day in days"
        :key="day.key"
      >
        <div
          aria-hidden="true"
          class="absolute top-4 bottom-1 w-px bg-(--ui-border)"
          :style="{ left: day.left }"
        />
        <span
          aria-hidden="true"
          class="absolute top-0 ps-1 text-[11px] whitespace-nowrap text-muted"
          :style="{ left: day.left }"
        >{{ day.label }}</span>
      </template>

      <ul
        ref="list"
        aria-label="Scheduled in the next 7 days"
        class="absolute inset-0"
      >
        <li
          v-for="item in inWeek"
          :key="item.id"
          class="lb-timeline-marker"
          :style="{ left: at(new Date(item.sendAt).getTime()) }"
        >
          <UDropdownMenu
            :items="menu(item)"
            :content="{ align: 'center', side: 'bottom' }"
            :ui="{ content: 'min-w-60' }"
          >
            <UTooltip :text="describe(item)">
              <button
                type="button"
                class="lb-focus grid size-3.5 place-items-center rounded-full ring-2 ring-default"
                :class="item.status === 'failed' ? 'bg-default text-error' : 'bg-primary'"
                :aria-label="describe(item)"
              >
                <UIcon
                  v-if="item.status === 'failed'"
                  name="i-lucide-x"
                  class="size-2.5"
                />
              </button>
            </UTooltip>
          </UDropdownMenu>
        </li>
      </ul>
    </div>
    <p
      v-if="later"
      class="pt-0.5 text-end text-xs text-muted"
    >
      and {{ later }} later
    </p>
  </div>
</template>
