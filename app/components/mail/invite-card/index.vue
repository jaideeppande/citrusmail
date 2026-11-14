<script setup lang="ts">
import { addDays, startOfDay } from 'date-fns'

// A meeting invitation (a calendar file on the message), set out as a card:
// what, when, where, who asked, and whether you're free
const props = defineProps<{
  message: MessageDetail
}>()

const { account } = useShell()
const mailEvent = useMailEvent()
const { events, loadRange } = useCalendarEvents()

const file = computed(() => props.message.attachments.find(isInvite))
const invite = shallowRef<InviteDetails>()

watch(() => [props.message.id, props.message.folder, file.value?.index] as const, async ([id, folder, index]) => {
  invite.value = undefined
  if (index === undefined) return
  try {
    const ics = await $fetch<string>(attachmentUrl({ id, folder }, index), { responseType: 'text' })
    const parsed = await parseInvite(ics)
    if (props.message.id !== id || props.message.folder !== folder) return
    invite.value = parsed
    // That day's events, to say whether this one clashes with any
    if (parsed && account.value?.hasCalendar) {
      const day = startOfDay(parsed.start)
      loadRange({ start: day, end: addDays(startOfDay(parsed.end), 1) })
    }
  } catch {
    // The file stays in the attachments below, to open by hand
  }
}, { immediate: true })

const when = computed(() => {
  const event = invite.value
  if (!event) return ''
  if (event.allDay) {
    const last = addDays(event.end, -1)
    return last > event.start ? `${formatFullDate(event.start)} – ${formatFullDate(last)}` : `${formatFullDate(event.start)}, all day`
  }
  const sameDay = startOfDay(event.start).getTime() === startOfDay(event.end).getTime()
  return sameDay
    ? `${formatFullDate(event.start)}, ${formatTime(event.start)} – ${formatTime(event.end)}`
    : `${formatFullDate(event.start)}, ${formatTime(event.start)} – ${formatFullDate(event.end)}, ${formatTime(event.end)}`
})

// What's already on the calendar in that time. All-day events don't count:
// a birthday doesn't make you busy
const clashes = computed(() => {
  const event = invite.value
  if (!event || !account.value?.hasCalendar) return []
  return events.value.filter(other => !other.allDay
    && new Date(other.start) < event.end && new Date(other.end) > event.start
    // Already added from this very invitation
    && !(other.title === event.title && new Date(other.start).getTime() === event.start.getTime()))
})

const added = computed(() => {
  const event = invite.value
  return !!event && events.value.some(other => other.title === event.title && new Date(other.start).getTime() === event.start.getTime())
})

function add() {
  const event = invite.value
  if (!event) return
  const notes = [event.location && `Where: ${event.location}`, event.organiser && `Organiser: ${event.organiser}`, event.description].filter(Boolean).join('\n')
  mailEvent.open({ title: event.title.slice(0, 100), description: notes, start: event.start, end: event.end, allDay: event.allDay })
}
</script>

<template>
  <Transition name="lb-summary">
    <section
      v-if="invite"
      class="flex gap-4 rounded-lg ring ring-default bg-elevated/40 px-4 py-3"
      aria-label="Invitation"
    >
      <div class="shrink-0 flex flex-col items-center justify-center w-12 h-14 rounded-md bg-default ring ring-default leading-none">
        <span class="text-[10px] font-semibold tracking-wide uppercase text-primary">{{ formatShortMonth(invite.start) }}</span>
        <span class="mt-1 text-xl font-semibold text-highlighted tabular-nums">{{ invite.start.getDate() }}</span>
      </div>

      <div class="flex-1 min-w-0 flex flex-col gap-1">
        <h2 class="text-sm font-semibold text-highlighted wrap-anywhere">
          {{ invite.title }}
        </h2>
        <p class="text-sm text-toned">
          {{ when }}
        </p>
        <p
          v-if="invite.location"
          class="flex items-start gap-1.5 text-sm text-muted wrap-anywhere"
        >
          <UIcon
            name="i-lucide-map-pin"
            class="mt-0.5 size-3.5 shrink-0"
          />
          {{ invite.location }}
        </p>
        <p
          v-if="invite.organiser"
          class="flex items-start gap-1.5 text-sm text-muted wrap-anywhere"
        >
          <UIcon
            name="i-lucide-user-round"
            class="mt-0.5 size-3.5 shrink-0"
          />
          Organised by {{ invite.organiser }}
        </p>

        <div
          v-if="mailEvent.available.value"
          class="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-2"
        >
          <UButton
            :label="added ? 'On your calendar' : 'Add to calendar'"
            :icon="added ? 'i-lucide-calendar-check' : 'i-lucide-calendar-plus'"
            color="neutral"
            variant="outline"
            size="sm"
            class="lb-press"
            :disabled="added"
            @click="add"
          />
          <span
            v-if="!added"
            class="inline-flex items-center gap-1.5 text-xs"
            :class="clashes.length ? 'text-warning' : 'text-muted'"
          >
            <UIcon
              :name="clashes.length ? 'i-lucide-calendar-x-2' : 'i-lucide-circle-check'"
              class="size-3.5 shrink-0"
            />
            <span class="wrap-anywhere">{{ clashes.length ? `Overlaps with: ${clashes.slice(0, 2).map(event => event.title).join(', ')}${clashes.length > 2 ? ` and ${clashes.length - 2} more` : ''}` : 'Free' }}</span>
          </span>
        </div>
      </div>
    </section>
  </Transition>
</template>
