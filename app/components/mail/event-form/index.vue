<script setup lang="ts">
import { addDays, subMilliseconds } from 'date-fns'
import type { CalendarDate, Time } from '@internationalized/date'

// "Add to calendar" from a message: what the message says is filled in, and
// everything can be put right before it is saved
const props = defineProps<{
  seed: MailEventSeed
}>()

const emit = defineEmits<{
  close: [saved: boolean]
}>()

const toast = useToast()
const { calendars, hiddenCalendars, addEvent } = useCalendarEvents()

const seedStart = props.seed.start ?? nextRoundHour()
const seedEnd = props.seed.end && props.seed.end > seedStart ? props.seed.end : new Date(seedStart.getTime() + 60 * 60_000)

const title = ref(props.seed.title.slice(0, 100))
const description = ref((props.seed.description ?? '').slice(0, 5000))
const allDay = ref(props.seed.allDay ?? false)
// Shallow: the date and time objects keep private fields a reactive proxy would break
const startDate = shallowRef<CalendarDate>(toCalendarDate(seedStart))
// An all-day range ends at the midnight after its last day
const endDate = shallowRef<CalendarDate>(toCalendarDate(allDay.value ? subMilliseconds(seedEnd, 1) : seedEnd))
const startTime = shallowRef<Time>(toTime(allDay.value ? nextRoundHour() : seedStart))
const endTime = shallowRef<Time>(toTime(allDay.value ? new Date(nextRoundHour().getTime() + 60 * 60_000) : seedEnd))

// A hidden calendar would make the event vanish the moment it is saved
const calendarId = ref('')
watch(calendars, (list) => {
  if (calendarId.value && list.some(calendar => calendar.id === calendarId.value)) return
  calendarId.value = (list.find(calendar => !hiddenCalendars.value.includes(calendar.id)) ?? list[0])?.id ?? ''
}, { immediate: true })

const calendarItems = computed(() => calendars.value.map(calendar => ({
  label: calendar.name,
  value: calendar.id,
  chip: { color: calendar.color, size: 'md' as const }
})))

// Moving the start takes the end with it, so the length stays what it was
watch(startDate, (now, before) => {
  if (!now || !before || !endDate.value) return
  const days = endDate.value.compare(before)
  endDate.value = now.add({ days: Math.max(0, days) })
})

const range = computed(() => {
  if (!startDate.value || !endDate.value) return undefined
  if (allDay.value) return { start: toDate(startDate.value), end: addDays(toDate(endDate.value), 1) }
  if (!startTime.value || !endTime.value) return undefined
  return { start: toDateTime(startDate.value, startTime.value), end: toDateTime(endDate.value, endTime.value) }
})

const problem = computed(() => {
  if (!title.value.trim()) return 'Give it a title'
  if (!calendarId.value) return 'Pick a calendar'
  if (!range.value) return 'Pick a date and time'
  if (range.value.end <= range.value.start) return 'It ends before it starts'
  return ''
})

function save() {
  if (problem.value || !range.value) return
  const { start, end } = range.value
  // The same way the calendar saves an event drawn on its grid: shown at once, sent to the server, queued when offline
  addEvent({
    id: crypto.randomUUID(),
    calendarId: calendarId.value,
    title: title.value.trim(),
    description: description.value.trim() || undefined,
    start: toLocalISO(start),
    end: toLocalISO(end),
    allDay: allDay.value || undefined
  })
  tellWindows({ type: 'events:changed' })
  toast.add({
    title: 'Added to your calendar',
    description: `${title.value.trim()} · ${formatDay(start)}${allDay.value ? '' : `, ${formatTime(start)}`}`,
    icon: 'i-lucide-calendar-check',
    actions: [{ label: 'Show', color: 'neutral', variant: 'outline', onClick: () => { navigateTo(`/calendar/week/${toCalendarDate(start).toString()}`) } }]
  })
  emit('close', true)
}
</script>

<template>
  <UModal
    title="Add to calendar"
    description="Filled in from the message. Change anything before you save."
    :ui="{ content: 'sm:max-w-md', footer: 'justify-end gap-2' }"
    @update:open="(open: boolean) => !open && emit('close', false)"
  >
    <template #body>
      <form
        class="flex flex-col gap-3"
        @submit.prevent="save"
      >
        <div class="flex items-center gap-2">
          <UInput
            v-model="title"
            placeholder="Title"
            aria-label="Title"
            autofocus
            :maxlength="100"
            class="flex-1 min-w-0"
          />
          <USelect
            v-model="calendarId"
            :items="calendarItems"
            aria-label="Calendar"
            placeholder="Calendar"
            class="w-36 shrink-0"
          />
        </div>

        <div class="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 text-sm">
          <span class="text-muted">Starts</span>
          <div class="flex items-center gap-2">
            <UInputDate
              v-model="startDate"
              aria-label="Start date"
            />
            <UInputTime
              v-if="!allDay"
              v-model="startTime"
              :hour-cycle="24"
              aria-label="Start time"
            />
          </div>

          <span class="text-muted">Ends</span>
          <div class="flex items-center gap-2">
            <UInputDate
              v-model="endDate"
              aria-label="End date"
            />
            <UInputTime
              v-if="!allDay"
              v-model="endTime"
              :hour-cycle="24"
              aria-label="End time"
            />
          </div>

          <span />
          <UCheckbox
            v-model="allDay"
            label="All day"
          />
        </div>

        <UTextarea
          v-model="description"
          placeholder="Notes"
          aria-label="Notes"
          :rows="4"
          autoresize
          :maxrows="8"
          :maxlength="5000"
          class="w-full"
        />
        <!-- Enter in a field saves, like the calendar's own form -->
        <button
          type="submit"
          class="hidden"
          tabindex="-1"
          aria-hidden="true"
        />
      </form>
    </template>

    <template #footer>
      <Transition name="lb-fade">
        <span
          v-if="problem"
          class="me-auto text-xs text-muted"
        >{{ problem }}</span>
      </Transition>
      <UButton
        label="Cancel"
        color="neutral"
        variant="ghost"
        @click="emit('close', false)"
      />
      <UButton
        label="Add event"
        icon="i-lucide-calendar-plus"
        :disabled="!!problem"
        class="lb-press"
        @click="save"
      />
    </template>
  </UModal>
</template>
