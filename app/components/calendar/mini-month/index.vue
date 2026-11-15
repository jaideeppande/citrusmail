<script setup lang="ts">
import type { CalendarDate } from '@internationalized/date'
import { parseDate } from '@internationalized/date'

// A small month grid with a dot under every day that has something on it,
// and the titles of the first few when a day is pointed at or focused. The
// calendar's own sidebar and the mail sidebar both show it. The grid is
// Reka's: `role="grid"`, arrows, Home and End, Page Up and Down for months
const props = defineProps<{
  // The day shown as chosen, if any
  selected?: CalendarDate | null
}>()

const emit = defineEmits<{
  select: [day: CalendarDate]
  // The day under the pointer, for a caller that warms what a click opens
  hover: [day: CalendarDate]
}>()

const { eventsForDay, ensureDays } = useCalendarEvents()

const placeholder = shallowRef<CalendarDate>(props.selected ?? todayDate())

// A chosen day in another month brings that month into view
watch(() => props.selected?.toString(), () => {
  const day = props.selected
  if (day && (day.year !== placeholder.value.year || day.month !== placeholder.value.month)) {
    placeholder.value = day
  }
})

// The six weeks the grid shows, in the shared blocks so the calendar's own
// views and this one never ask twice for the same days
watch(placeholder, month => ensureDays(monthRange(month)), { immediate: true })

const model = computed({
  get: () => props.selected ?? undefined,
  set(value: CalendarDate | null | undefined) {
    if (value) emit('select', value)
  }
})

function eventsOn(day: { year: number, month: number, day: number }): CalendarEvent[] {
  return eventsForDay(new Date(day.year, day.month - 1, day.day))
}

const root = useTemplateRef('root')
const tooltipId = useId()

// The day whose titles are showing, and where to stand the card
const shown = shallowRef<{ day: CalendarDate, titles: string[], more: number, top: number, left: number } | null>(null)
let described: HTMLElement | null = null

function show(target: EventTarget | null) {
  const cell = (target as HTMLElement | null)?.closest<HTMLElement>('[data-value]')
  const value = cell?.dataset.value
  if (!cell || !value || !root.value) return hide()

  let day: CalendarDate
  try {
    day = parseDate(value)
  } catch {
    return hide()
  }

  emit('hover', day)

  const events = eventsOn(day)
  if (!events.length) return hide()

  const box = root.value.getBoundingClientRect()
  const rect = cell.getBoundingClientRect()

  hide()
  shown.value = {
    day,
    titles: [...events].sort(agendaOrder).slice(0, 3).map(event => event.allDay ? event.title : `${formatTime(new Date(event.start))} ${event.title}`),
    more: Math.max(0, events.length - 3),
    top: rect.bottom - box.top + 4,
    left: Math.min(Math.max(0, rect.left - box.left + rect.width / 2), box.width)
  }

  // Read with the date the cell already announces
  described = cell
  cell.setAttribute('aria-describedby', tooltipId)
}

function hide() {
  described?.removeAttribute('aria-describedby')
  described = null
  shown.value = null
}

// The grid's keys stay with the grid: the mail list's own arrows and the
// calendar's week stepping would otherwise hear them too
function onKeydown(event: KeyboardEvent) {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) {
    event.stopPropagation()
  }
  if (event.key === 'Escape' && shown.value) {
    event.stopPropagation()
    hide()
  }
}
</script>

<template>
  <div
    ref="root"
    class="relative"
    @pointerover="show($event.target)"
    @pointerleave="hide"
    @focusin="show($event.target)"
    @focusout="hide"
    @keydown="onKeydown"
  >
    <UCalendar
      v-model="model"
      v-model:placeholder="placeholder"
      :week-starts-on="1"
      :year-controls="false"
      size="xs"
      fixed-weeks
      :prev-month="{ class: 'max-lg:pointer-coarse:p-2', ui: { leadingIcon: 'max-lg:pointer-coarse:size-5' } }"
      :next-month="{ class: 'max-lg:pointer-coarse:p-2', ui: { leadingIcon: 'max-lg:pointer-coarse:size-5' } }"
      :ui="{
        heading: 'text-sm font-semibold text-highlighted',
        headCell: 'text-[11px] font-medium text-muted max-lg:pointer-coarse:text-xs',
        cell: 'max-lg:pointer-coarse:text-sm',
        cellTrigger: 'tabular-nums max-lg:pointer-coarse:size-9'
      }"
    >
      <template #day="{ day }">
        <span class="relative inline-flex items-center justify-center">
          {{ day.day }}
          <span
            v-if="eventsOn(day).length"
            aria-hidden="true"
            class="absolute -bottom-1 start-1/2 size-1 -translate-x-1/2 rounded-full bg-current opacity-70"
          />
        </span>
      </template>
    </UCalendar>

    <Transition name="lb-fade">
      <div
        v-if="shown"
        :id="tooltipId"
        role="tooltip"
        class="pointer-events-none absolute z-50 w-48 -translate-x-1/2 rounded-md bg-default px-2.5 py-2 text-xs shadow-(--lb-shadow) ring ring-default"
        :style="{ top: `${shown.top}px`, left: `${shown.left}px` }"
      >
        <ul class="flex flex-col gap-0.5">
          <li
            v-for="(title, index) in shown.titles"
            :key="index"
            class="truncate text-highlighted"
          >
            {{ title }}
          </li>
        </ul>
        <p
          v-if="shown.more"
          class="mt-1 text-muted"
        >
          and {{ shown.more }} more
        </p>
      </div>
    </Transition>
  </div>
</template>
