<script setup lang="ts">
import { addDays, format, isSameDay } from 'date-fns'

// The card an event shows when the pointer rests on it: enough to tell what
// it is without opening it. It takes no pointer events, so it can never get
// between the pointer and the event it describes
const WIDTH = 256
const GAP = 8
// Past this far down the window the card hangs from its bottom edge instead
const ROOM_BELOW = 200

const { peek, hide } = useEventPeek()
const { calendars } = useCalendarEvents()
const { editingId } = useEventEditor()
const { draft } = useEventDraft()
const route = useRoute()
const { second, local } = useCalendarZones()

// The same span on the second zone's clock, for a timed event
const secondWhen = computed(() => {
  const event = peek.value?.event
  if (!event || event.allDay || !second.value) return ''

  return calZoneSecondRange(new Date(event.start), new Date(event.end), local, second.value)
})

const calendar = computed(() => calendars.value.find(calendar => calendar.id === peek.value?.event.calendarId))

const when = computed(() => {
  const event = peek.value?.event
  if (!event) return ''

  const start = new Date(event.start)
  const end = new Date(event.end)
  const day = (date: Date) => format(date, 'EEE d MMM')

  if (event.allDay) {
    // The end is the first day it no longer covers
    const last = addDays(end, -1)
    return last > start ? `${day(start)} – ${day(last)}` : `${day(start)} · All day`
  }

  return isSameDay(start, end)
    ? `${day(start)} · ${formatTime(start)} – ${formatTime(end)}`
    : `${day(start)}, ${formatTime(start)} – ${day(end)}, ${formatTime(end)}`
})

// A whole invite can sit in a description: the first few lines say enough
const description = computed(() => peek.value?.event.description?.trim().split(/\n+/).slice(0, 4).join('\n'))

// Beside the event, on whichever side has the room, and under it when
// neither does (a day view column is the width of the grid)
const style = computed(() => {
  const rect = peek.value?.rect
  if (!rect) return undefined

  const fitsRight = rect.right + GAP + WIDTH <= window.innerWidth - GAP
  const fitsLeft = rect.left - GAP - WIDTH >= GAP
  const beside = fitsRight || fitsLeft

  const left = fitsRight
    ? rect.right + GAP
    : fitsLeft ? rect.left - GAP - WIDTH : Math.min(Math.max(GAP, rect.left), window.innerWidth - WIDTH - GAP)

  const anchorTop = beside ? rect.top : rect.bottom + GAP
  const hangs = anchorTop > window.innerHeight - ROOM_BELOW

  return {
    width: `${WIDTH}px`,
    left: `${left}px`,
    ...(hangs
      ? { bottom: `${Math.max(GAP, window.innerHeight - (beside ? rect.bottom : rect.top - GAP))}px` }
      : { top: `${Math.max(GAP, anchorTop)}px` }),
    transformOrigin: `${hangs ? 'bottom' : 'top'} ${fitsRight ? 'left' : fitsLeft ? 'right' : 'center'}`
  }
})

// Anything that moves the event out from under the card, or puts something
// more deliberate on screen, takes the card down
useEventListener('scroll', hide, { capture: true, passive: true })
useEventListener('pointerdown', hide, { capture: true })
useEventListener('keydown', hide, { capture: true })
useEventListener('blur', hide)
watch([editingId, draft, () => route.fullPath], hide)
onUnmounted(hide)
</script>

<template>
  <Teleport to="body">
    <Transition name="lb-pop">
      <div
        v-if="peek"
        :key="peek.event.id"
        role="tooltip"
        class="fixed z-50 pointer-events-none flex flex-col gap-1 rounded-md bg-default px-3 py-2.5 text-xs shadow-(--lb-shadow) ring ring-default"
        :style="style"
      >
        <p class="text-sm font-semibold text-highlighted break-words line-clamp-2">
          {{ peek.event.title }}
        </p>
        <p class="flex items-center gap-1.5 text-toned tabular-nums">
          <UIcon
            :name="peek.event.recurring ? 'i-lucide-repeat' : 'i-lucide-clock'"
            class="size-3.5 shrink-0 text-dimmed"
          />
          {{ when }}
        </p>
        <p
          v-if="secondWhen"
          class="flex items-center gap-1.5 text-muted tabular-nums"
        >
          <UIcon
            name="i-lucide-globe"
            class="size-3.5 shrink-0 text-dimmed"
          />
          {{ secondWhen }}
        </p>
        <p
          v-if="calendar"
          class="flex items-center gap-1.5 text-muted"
        >
          <span class="flex items-center justify-center size-3.5 shrink-0">
            <span
              class="size-2 rounded-full"
              :class="calendarDotClasses[calendar.color]"
            />
          </span>
          <span class="truncate">{{ calendar.name }}</span>
        </p>
        <p
          v-if="description"
          class="pt-1 text-muted whitespace-pre-line break-words line-clamp-4"
        >
          {{ description }}
        </p>
      </div>
    </Transition>
  </Teleport>
</template>
