<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { CalendarDate, Time } from '@internationalized/date'

// Snooze the open message: it leaves the list and comes back at the time picked
const props = defineProps<{
  summary?: MessageSummary
}>()

/** The menu, so the Snooze shortcut can open it */
const open = defineModel<boolean>('open', { default: false })
/** The day and time picker, which the More menu's "Pick a time" opens too */
const picking = defineModel<boolean>('picking', { default: false })

const { snooze } = useMail()
const { kbds } = useShortcutKeys()

function until(at: Date) {
  if (props.summary) snooze([props.summary], at)
}

const items = computed<DropdownMenuItem[][]>(() => {
  // Read so the times are worked out again each time the menu opens: "Tomorrow morning" is another day by then
  const _opened = open.value
  return presetItems()
})
const presetItems = (): DropdownMenuItem[][] => [
  snoozePresets().map(preset => ({
    label: preset.label,
    icon: preset.icon,
    // When it comes back, in the words the list uses
    description: snoozeLabel(preset.date),
    onSelect: () => until(preset.date)
  })),
  [{ label: 'Pick a time…', icon: 'i-lucide-calendar-clock', onSelect: () => (picking.value = true) }]
]

const day = shallowRef<CalendarDate>()
const time = shallowRef<Time>()
watch(picking, (value) => {
  if (!value) return
  // Tomorrow morning is always among them
  const start = snoozePresets().find(preset => preset.label === 'Tomorrow morning')?.date ?? inAnHour()
  day.value = toCalendarDate(start)
  time.value = toTime(start)
})

const when = computed(() => day.value && time.value ? toDateTime(day.value, time.value) : undefined)
const valid = computed(() => !!when.value && when.value.getTime() > Date.now() + 60_000)

function confirm() {
  if (!valid.value) return
  until(when.value!)
  picking.value = false
}
</script>

<template>
  <UDropdownMenu
    v-model:open="open"
    :items="items"
    :content="{ align: 'end' }"
  >
    <UTooltip
      text="Snooze"
      :kbds="kbds('mail.snooze')"
    >
      <UButton
        icon="i-lucide-alarm-clock"
        color="neutral"
        variant="ghost"
        aria-label="Snooze"
        class="lb-press"
        :disabled="!summary"
      />
    </UTooltip>
  </UDropdownMenu>

  <UModal
    v-model:open="picking"
    title="Snooze until"
    description="The message leaves the list and comes back at this time."
    :ui="{ content: 'sm:max-w-sm', footer: 'justify-end' }"
  >
    <template #body>
      <form
        class="flex flex-col items-center gap-4"
        @submit.prevent="confirm"
      >
        <UCalendar
          v-model="day"
          :min-value="todayDate()"
          :week-starts-on="1"
          size="sm"
        />
        <div class="flex items-center gap-3 w-full">
          <UInputTime
            v-model="time"
            :hour-cycle="24"
            aria-label="Time"
            class="flex-1"
          />
          <span class="text-sm text-muted text-end flex-1">
            {{ valid ? snoozeLabel(when!) : 'Pick a later time' }}
          </span>
        </div>
      </form>
    </template>
    <template #footer>
      <UButton
        label="Cancel"
        color="neutral"
        variant="ghost"
        @click="picking = false"
      />
      <UButton
        label="Snooze"
        icon="i-lucide-alarm-clock"
        :disabled="!valid"
        class="lb-press"
        @click="confirm"
      />
    </template>
  </UModal>
</template>
