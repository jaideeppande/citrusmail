<script setup lang="ts">
import { addDays, addMinutes, isSameDay, isToday, startOfDay } from 'date-fns'

// The agenda: the days from the route's date on, as a list. Busy days list
// their events, a run of free ones folds into a single quiet line, and more
// days load as the list nears its end
const MAX_DAYS = 730

const { date } = useCalendar()
const { eventsForDay, ensureDays, isDaysPending } = useCalendarEvents()
const { draftEvent, createDraft, registerHost } = useEventDraft()
const { keysOf } = useShortcutKeys()

// A list the `+` button and `n` can draw a draft on without leaving it
registerHost()

const length = ref(AGENDA_DAYS)
watch(() => date.value.toString(), () => {
  length.value = AGENDA_DAYS
})

const range = computed(() => {
  const start = toDate(date.value)

  return { start, end: addDays(start, length.value) }
})

watch(range, value => ensureDays(value), { immediate: true })

const loading = computed(() => isDaysPending(range.value))

// The draft, once it is on one of these days, rides along as an event of
// that day so its ghost (and the form hanging off it) has a row to stand in
const draftDay = computed(() => draftEvent.value ? startOfDay(new Date(draftEvent.value.start)) : null)

function eventsOf(day: Date): CalendarEvent[] {
  const events = eventsForDay(day)
  const draft = draftEvent.value

  return draft && draftDay.value && isSameDay(draftDay.value, day) ? [...events, draft] : events
}

const blocks = computed(() => agendaBlocks(
  eachDay(range.value),
  eventsOf,
  day => isToday(day) || (!!draftDay.value && isSameDay(draftDay.value, day))
))

const empty = computed(() => blocks.value.every(block => block.kind === 'free' || !block.events.length))

const scroller = useTemplateRef('scroller')

useInfiniteScroll(scroller, () => {
  length.value = Math.min(MAX_DAYS, length.value + AGENDA_DAYS)
}, {
  distance: 600,
  canLoadMore: () => length.value < MAX_DAYS && !loading.value
})

// A new event on a day: the next hour on today, nine in the morning on any other
function createOn(day: Date) {
  const hour = isToday(day) ? Math.min(23, new Date().getHours() + 1) : 9
  const start = addMinutes(startOfDay(day), hour * 60)

  createDraft({ start, end: addMinutes(start, 60), scroll: true })
}

// Up and down walk the events in order, Home and End go to the first and
// last loaded, and the new event key creates on the day the focus is in
function onKeydown(event: KeyboardEvent) {
  const target = event.target as HTMLElement
  const items = [...(scroller.value?.querySelectorAll<HTMLElement>('[data-agenda-item]') ?? [])]
  const index = items.findIndex(item => item === target.closest('[data-agenda-item]'))

  const move = (to: number) => {
    const item = items[Math.max(0, Math.min(items.length - 1, to))]
    if (!item) return

    event.preventDefault()
    item.scrollIntoView({ block: 'nearest' })
    item.focus()
  }

  if (event.key === 'ArrowDown' && !event.altKey) {
    move(index === -1 ? 0 : index + 1)
  } else if (event.key === 'ArrowUp' && !event.altKey) {
    move(index === -1 ? 0 : index - 1)
  } else if (event.key === 'Home' && index !== -1) {
    move(0)
  } else if (event.key === 'End' && index !== -1) {
    move(items.length - 1)
  } else if (!event.metaKey && !event.ctrlKey && !event.altKey && keysOf('calendar.newEvent').includes(event.key.toLowerCase())) {
    const iso = target.closest<HTMLElement>('[data-agenda-day]')?.dataset.agendaDay
    if (!iso) return

    // Ahead of the calendar's own shortcut, which draws on the route's date
    event.preventDefault()
    event.stopPropagation()
    createOn(dateFromISO(iso))
  }
}
</script>

<template>
  <div
    ref="scroller"
    class="flex-1 overflow-y-auto [scrollbar-gutter:stable] [view-transition-name:calendar] scroll-pt-[calc(var(--ui-header-height)+1rem)]"
    @keydown="onKeydown"
  >
    <div class="mx-auto w-full max-w-3xl px-4 lg:px-6 pt-[calc(var(--ui-header-height)+1rem)] pb-24 lg:pb-10">
      <h2 class="sr-only">
        Agenda from {{ formatSpokenDate(range.start) }}
      </h2>

      <div
        v-if="loading && empty"
        class="flex flex-col gap-4"
        aria-busy="true"
      >
        <div
          v-for="n in 4"
          :key="n"
          class="grid grid-cols-[4rem_1fr] gap-3"
        >
          <USkeleton class="h-8 w-10" />
          <div class="flex flex-col gap-2">
            <USkeleton
              class="h-4"
              :style="{ width: `${80 - n * 12}%` }"
            />
            <USkeleton class="h-3 w-1/3" />
          </div>
        </div>
      </div>

      <template v-else>
        <template
          v-for="(block, index) in blocks"
          :key="block.kind === 'day' ? `day-${block.day.getTime()}` : `free-${block.from.getTime()}`"
        >
          <section
            v-if="block.kind === 'day'"
            :data-agenda-day="isoDate(block.day)"
            :aria-labelledby="`agenda-${isoDate(block.day)}`"
            class="lb-stagger grid grid-cols-[4rem_1fr] gap-x-3 py-2 border-t border-default first:border-t-0"
            :style="{ '--lb-i': index }"
          >
            <!-- The date stays in view while its day scrolls past -->
            <div class="sticky top-[calc(var(--ui-header-height)+1rem)] self-start flex flex-col items-start pt-1">
              <h3
                :id="`agenda-${isoDate(block.day)}`"
                class="flex flex-col leading-none"
              >
                <span
                  class="text-[11px] font-medium uppercase tracking-wide"
                  :class="isToday(block.day) ? 'text-primary' : 'text-muted'"
                >
                  {{ formatWeekday(block.day) }}
                </span>
                <span
                  class="mt-1 flex items-center justify-center size-7 -ms-1 rounded-full text-lg font-semibold tabular-nums"
                  :class="isToday(block.day) ? 'bg-primary text-inverted' : 'text-highlighted'"
                >
                  {{ block.day.getDate() }}
                </span>
                <span class="sr-only">{{ formatSpokenDate(block.day) }}{{ isToday(block.day) ? ', today' : '' }}</span>
              </h3>
            </div>

            <div class="flex flex-col min-w-0">
              <div class="flex items-center justify-between h-6 ps-2">
                <span class="text-xs text-muted">
                  {{ formatShortMonth(block.day) }}<template v-if="isToday(block.day)"> · Today</template>
                </span>
                <UTooltip text="New event on this day">
                  <UButton
                    icon="i-lucide-plus"
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    :aria-label="`New event on ${formatSpokenDate(block.day)}`"
                    @click="createOn(block.day)"
                  />
                </UTooltip>
              </div>

              <ul
                v-if="block.events.length"
                class="flex flex-col"
                :aria-label="`Events on ${formatSpokenDate(block.day)}`"
              >
                <li
                  v-for="event in block.events"
                  :key="event.id"
                >
                  <CalendarEventDraft
                    v-if="event.id === DRAFT_EVENT_ID"
                    variant="chip"
                    anchored
                    side="bottom"
                    class="mx-2 my-1 py-1"
                  />
                  <CalendarAgendaRow
                    v-else
                    :event="event"
                    :day="block.day"
                    :anchored="isSameDay(new Date(event.start), block.day) || (isSameDay(block.day, range.start) && new Date(event.start) < block.day)"
                  />
                </li>
              </ul>

              <p
                v-else
                class="px-2 py-1 text-sm text-muted"
              >
                Nothing planned
              </p>
            </div>
          </section>

          <p
            v-else
            class="lb-stagger grid grid-cols-[4rem_1fr] gap-x-3 py-2 border-t border-default text-sm text-muted first:border-t-0"
            :style="{ '--lb-i': index }"
          >
            <UIcon
              name="i-lucide-moon"
              class="size-3.5 justify-self-start mt-0.5 text-dimmed"
              aria-hidden="true"
            />
            <span class="ps-2">{{ agendaFreeLabel(block.from, block.to) }}</span>
          </p>
        </template>
      </template>

      <div
        v-if="loading && !empty"
        class="flex items-center gap-2 py-4 text-sm text-muted"
        role="status"
      >
        <UIcon
          name="i-lucide-loader-circle"
          class="size-4 animate-spin"
          aria-hidden="true"
        />
        Loading more days
      </div>
    </div>
  </div>
</template>
