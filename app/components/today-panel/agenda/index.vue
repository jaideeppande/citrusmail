<script setup lang="ts">
import { addDays, addMinutes, format, startOfDay } from 'date-fns'

// What the Today panel shows. Its own component so none of it runs, and
// nothing is fetched, until the panel is first opened
const emit = defineEmits<{
  navigate: []
}>()

const { account } = useShell()
const { calendars, eventsForDay, ensureRange, isRangePending, addEvent } = useCalendarEvents()
const { defaultCalendarId } = useEventDraft()
const { revealEvent } = useEventEditor()
const { birthdays } = useBirthdays()
const toast = useToast()

const hasCalendar = computed(() => !!account.value?.hasCalendar)

// Half a minute is as fine as a countdown in minutes needs
const now = useNow({ interval: 30_000 })
const dayStamp = computed(() => isoDate(now.value))
const today = computed(() => dateFromISO(dayStamp.value))
const tomorrow = computed(() => addDays(today.value, 1))
const range = computed(() => ({ start: today.value, end: addDays(today.value, 2) }))

// Asked for again when the day turns over with the panel left open
watch(dayStamp, () => {
  if (hasCalendar.value) ensureRange(range.value)
}, { immediate: true })

const loading = computed(() => isRangePending(range.value))

// “25 min”, “2 h 5 min”, and whole hours once it is far enough off that the
// minutes stop mattering
function span(from: Date, to: Date): string {
  const minutes = Math.max(1, Math.round((to.getTime() - from.getTime()) / 60_000))
  if (minutes < 60) return `${minutes} min`

  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60

  return hours >= 6 || !rest ? `${hours} h` : `${hours} h ${rest} min`
}

// All-day events lead the day, the rest follow the clock
function byTime(a: CalendarEvent, b: CalendarEvent): number {
  return Number(!!b.allDay) - Number(!!a.allDay) || a.start.localeCompare(b.start)
}

const days = computed(() => {
  const current = now.value
  const lists = [today.value, tomorrow.value].map(day => [...eventsForDay(day)].sort(byTime))

  // The first timed event still to start, on either day. One running past
  // midnight is listed under both, so it is told by its id
  const next = lists.flat().find(event => !event.allDay && new Date(event.start) > current)

  return lists.map((events, index) => events.map((event): AgendaItem => {
    const start = new Date(event.start)
    const end = new Date(event.end)

    if (event.allDay) {
      return { event, start, end, state: 'later' }
    }
    if (end <= current) {
      return { event, start, end, state: 'past' }
    }
    if (start <= current) {
      return { event, start, end, state: 'now', note: `Ends in ${span(current, end)}` }
    }
    // Emphasised once, on the day it starts
    if (event.id === next?.id && isoDate(start) === isoDate(index ? tomorrow.value : today.value)) {
      return { event, start, end, state: 'next', note: `In ${span(current, start)}` }
    }

    return { event, start, end, state: 'later' }
  }))
})

const sections = computed(() => [
  { key: 'today', label: 'Today', empty: 'Nothing on today.', items: days.value[0]! },
  { key: 'tomorrow', label: `Tomorrow, ${format(tomorrow.value, 'EEE d MMM')}`, empty: 'Nothing on tomorrow.', items: days.value[1]! }
])

const calendarPath = computed(() => `/calendar/week/${toCalendarDate(today.value).toString()}`)

async function openEvent(event: CalendarEvent) {
  emit('navigate')
  // One that began on an earlier day is opened on today's page, where it runs
  const start = new Date(event.start)
  await navigateTo(`/calendar/day/${toCalendarDate(start < today.value ? today.value : start).toString()}`)
  revealEvent(event.id)
}

async function openContact(contact: Contact) {
  emit('navigate')
  await navigateTo({ path: '/contacts', query: { c: contact.id } })
}

const text = ref('')
const adding = ref(false)

// The same reading of a phrase the calendar's quick event gives, saved
// straight away rather than drawn on a grid: the panel is over some other
// page, and the toast says what was understood and where to change it
async function onQuickAdd() {
  const phrase = text.value.trim()
  if (!phrase || adding.value || !calendars.value.length) {
    return
  }

  adding.value = true

  try {
    const quick = await parseQuickEvent(phrase)

    // No time in the phrase: the next full hour, as the `+` button would
    const hour = Math.min(23, new Date().getHours() + 1)
    const start = quick?.start ?? addMinutes(startOfDay(new Date()), hour * 60)
    const end = quick?.end ?? addMinutes(start, 60)

    const event: CalendarEvent = {
      id: crypto.randomUUID(),
      calendarId: defaultCalendarId(),
      // The server takes a hundred characters, which a phrase can outrun
      title: (quick?.title || phrase).slice(0, 100),
      start: toLocalISO(start),
      end: toLocalISO(end),
      allDay: quick?.allDay || undefined
    }

    addEvent(event)
    text.value = ''

    toast.add({
      title: `Added “${event.title}”`,
      description: quick?.allDay ? format(start, 'EEEE d MMMM') : `${format(start, 'EEEE d MMMM')}, ${formatTime(start)} – ${formatTime(end)}`,
      icon: 'i-lucide-calendar-check',
      actions: [{ label: 'Open', color: 'neutral', variant: 'outline', onClick: () => openEvent(event) }]
    })
  } finally {
    adding.value = false
  }
}
</script>

<template>
  <UEmpty
    v-if="!hasCalendar"
    icon="i-lucide-calendar-off"
    title="No calendar here yet"
    description="Once this mailbox has a calendar, your day shows up here."
    :actions="[{ label: 'Open calendar', icon: 'i-lucide-calendar', color: 'neutral', variant: 'subtle', to: calendarPath, onClick: () => emit('navigate') }]"
    variant="naked"
    class="lb-in py-8"
  />

  <template v-else>
    <form
      class="lb-stagger"
      :style="{ '--lb-i': 0 }"
      @submit.prevent="onQuickAdd"
    >
      <UInput
        v-model="text"
        icon="i-lucide-plus"
        placeholder="Lunch with Ana at 1pm"
        aria-label="Add an event"
        variant="soft"
        :loading="adding"
        :disabled="!calendars.length"
        :maxlength="100"
        autofocus
        class="w-full"
        :ui="{ base: 'bg-(--control-bg)' }"
      />
    </form>

    <section
      v-for="(section, sectionIndex) in sections"
      :key="section.key"
      class="lb-stagger flex flex-col gap-0.5"
      :style="{ '--lb-i': sectionIndex + 1 }"
      :aria-label="section.label"
    >
      <h3 class="px-2 pb-1 text-xs font-semibold text-muted">
        {{ section.label }}
      </h3>

      <template v-if="loading && !section.items.length">
        <div
          v-for="n in 2"
          :key="n"
          class="flex items-center gap-3 px-2 py-1.5"
        >
          <USkeleton class="h-8 w-11 shrink-0" />
          <USkeleton class="h-8 w-1 shrink-0 rounded-full" />
          <div class="flex-1 flex flex-col gap-1.5">
            <USkeleton
              class="h-3.5"
              :style="{ width: `${75 - n * 15}%` }"
            />
            <USkeleton class="h-3 w-1/3" />
          </div>
        </div>
      </template>

      <p
        v-else-if="!section.items.length"
        class="px-2 py-1.5 text-sm text-dimmed"
      >
        {{ section.empty }}
      </p>

      <TransitionGroup
        v-else
        name="lb-list"
        tag="div"
        class="relative flex flex-col gap-0.5"
      >
        <TodayPanelEvent
          v-for="item in section.items"
          :key="item.event.id"
          :item="item"
          @open="openEvent(item.event)"
        />
      </TransitionGroup>
    </section>
  </template>

  <section
    v-if="birthdays.length"
    class="lb-stagger flex flex-col gap-0.5"
    :style="{ '--lb-i': 3 }"
    aria-label="Birthdays"
  >
    <h3 class="px-2 pb-1 text-xs font-semibold text-muted">
      Birthdays
    </h3>
    <button
      v-for="birthday in birthdays.slice(0, 5)"
      :key="birthday.contact.id"
      type="button"
      class="lb-press lb-focus flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-start hover:bg-elevated/60"
      @click="openContact(birthday.contact)"
    >
      <span class="flex w-11 shrink-0 justify-center">
        <UIcon
          name="i-lucide-cake"
          class="size-4"
          :class="birthday.inDays === 0 ? 'text-primary' : 'text-dimmed'"
        />
      </span>
      <span class="flex-1 min-w-0 truncate text-sm">
        <span class="font-medium text-highlighted">{{ birthday.contact.name }}</span>
        <span class="text-muted"> · {{ birthdayLabel(birthday) }}</span>
      </span>
    </button>
  </section>

  <UButton
    v-if="hasCalendar"
    label="Open calendar"
    icon="i-lucide-calendar"
    trailing-icon="i-lucide-arrow-right"
    color="neutral"
    variant="ghost"
    :to="calendarPath"
    class="lb-stagger mt-auto self-start"
    :style="{ '--lb-i': 4 }"
    :ui="{ trailingIcon: 'ms-auto' }"
    @click="emit('navigate')"
  />
</template>
