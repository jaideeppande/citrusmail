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
const aiQuick = useAiQuickEvent()
const mailEvent = useMailEvent()
// The phrase the preview was read from: Enter again on the same words creates it
const readText = ref('')

function added(event: CalendarEvent) {
  const start = new Date(event.start)
  const end = new Date(event.end)
  toast.add({
    title: `Added “${event.title}”`,
    description: event.allDay ? format(start, 'EEEE d MMMM') : `${format(start, 'EEEE d MMMM')}, ${formatTime(start)} – ${formatTime(end)}`,
    icon: 'i-lucide-calendar-check',
    actions: [{ label: 'Open', color: 'neutral', variant: 'outline', onClick: () => openEvent(event) }]
  })
}

function onAiCreate() {
  aiQuick.cancel()
  const event = aiQuick.toEvent()
  if (!event) return
  addEvent(event)
  tellWindows({ type: 'events:changed' })
  announce(`${event.title} added`)
  text.value = ''
  readText.value = ''
  aiQuick.reset()
  added(event)
}

// The event form, with what was read filled in, over the panel
function onAiEdit() {
  aiQuick.cancel()
  const plan = aiQuick.plan.value
  if (!plan) return
  const filled = aiQuick.state.value === 'ai'
  mailEvent.open({ title: plan.title, description: plan.description, start: plan.start, end: plan.end, allDay: plan.allDay }, { calendarId: plan.calendarId ?? defaultCalendarId(), filled })
  text.value = ''
  readText.value = ''
  aiQuick.reset()
}

function onAiDismiss() {
  aiQuick.reset()
  readText.value = ''
}

// Typing something else takes the old preview away
watch(text, (value) => {
  if (aiQuick.plan.value && value.trim() !== readText.value) onAiDismiss()
})

/* Meeting prep ------------------------------------------------------- */

const ai = useAiClient()
const prepFor = ref<string>()
const prepAvailable = computed(() => ai.enabled('meeting-prep'))
const canPrep = (item: AgendaItem) => prepAvailable.value && item.state !== 'past' && canPrepare(item.event)

// Closing the brief puts the focus back on its button
async function closePrep(id: string) {
  prepFor.value = undefined
  await nextTick()
  document.querySelector<HTMLElement>(`[data-prep-id="${CSS.escape(id)}"]`)?.focus()
}

// The same reading of a phrase the calendar's quick event gives, saved
// straight away rather than drawn on a grid: the panel is over some other
// page, and the toast says what was understood and where to change it
async function onQuickAdd() {
  const phrase = text.value.trim()
  if (!phrase || adding.value || !calendars.value.length) {
    return
  }

  // With AI on, a preview first, then Create or Edit
  if (aiQuick.on.value) {
    if (aiQuick.plan.value && readText.value === phrase && aiQuick.state.value !== 'reading') {
      onAiCreate()
      return
    }
    readText.value = phrase
    await aiQuick.read(phrase)
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
    added(event)
  } finally {
    adding.value = false
  }
}
</script>

<template>
  <TodayPanelBriefing @navigate="emit('navigate')" />

  <AppEmpty
    v-if="!hasCalendar"
    illustration="no-calendar"
    size="sm"
    title="No calendar here yet"
    description="Once this mailbox has a calendar, your day shows up here."
    :actions="[{ label: 'Open calendar', icon: 'i-lucide-calendar', color: 'neutral', variant: 'subtle', to: calendarPath, onClick: () => emit('navigate') }]"
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
        :icon="aiQuick.on.value ? 'i-lucide-sparkles' : 'i-lucide-plus'"
        placeholder="Lunch with Ana at 1pm"
        :aria-label="aiQuick.on.value ? 'Add an event, read with AI when you press Enter' : 'Add an event'"
        variant="soft"
        :loading="adding || aiQuick.state.value === 'reading'"
        :disabled="!calendars.length"
        :maxlength="aiQuick.on.value ? 300 : 100"
        autofocus
        class="w-full"
        :ui="{ base: 'bg-(--control-bg)', leadingIcon: aiQuick.on.value ? 'text-(--lb-ai)' : undefined }"
      />
      <Transition name="lb-fade">
        <CalendarAiQuickPreview
          v-if="aiQuick.plan.value"
          :preview="aiQuick.preview.value"
          :state="aiQuick.state.value"
          :note="aiQuick.note.value"
          :reminder="aiQuick.plan.value.reminder"
          class="mt-1.5"
          @create="onAiCreate"
          @edit="onAiEdit"
          @dismiss="onAiDismiss"
        />
      </Transition>
    </form>

    <section
      v-for="(section, sectionIndex) in sections"
      :key="section.key"
      class="lb-stagger flex flex-col gap-0.5"
      :style="{ '--lb-i': sectionIndex + 1 }"
      :aria-label="section.label"
    >
      <h3 class="px-2 pb-0.5 text-xs font-semibold text-muted">
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
        class="px-2 py-1.5 text-sm text-muted"
      >
        {{ section.empty }}
      </p>

      <TransitionGroup
        v-else
        name="lb-list"
        tag="div"
        class="relative flex flex-col gap-0.5"
      >
        <div
          v-for="item in section.items"
          :key="item.event.id"
          class="group/row flex flex-col gap-1"
        >
          <div class="relative">
            <TodayPanelEvent
              :item="item"
              @open="openEvent(item.event)"
            />
            <UButton
              v-if="canPrep(item) && prepFor !== item.event.id"
              label="Prep"
              icon="i-lucide-sparkles"
              color="neutral"
              variant="soft"
              size="xs"
              :data-prep-id="item.event.id"
              :aria-label="`Prepare for ${item.event.title}`"
              class="pointer-events-none absolute end-1.5 top-1/2 -translate-y-1/2 opacity-0 transition-opacity duration-(--lb-dur-1) group-hover/row:pointer-events-auto group-hover/row:opacity-100 focus-visible:opacity-100"
              :ui="{ leadingIcon: 'text-(--lb-ai)' }"
              @click="prepFor = item.event.id"
            />
          </div>
          <div
            v-if="prepFor === item.event.id"
            class="ms-2"
          >
            <CalendarMeetingPrep
              :event="item.event"
              immediate
              @navigate="emit('navigate')"
              @close="closePrep(item.event.id)"
            />
          </div>
        </div>
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
          :class="birthday.inDays === 0 ? 'text-primary' : 'text-muted'"
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
