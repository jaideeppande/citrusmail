<script setup lang="ts">
import { format, isSameDay } from 'date-fns'

const props = defineProps<{
  contact: Contact
}>()

const { messages, events, loading } = useContactTimeline(() => props.contact)
const { calendars } = useCalendarEvents()

const firstName = computed(() => props.contact.name.trim().split(/\s+/)[0] || 'them')
const empty = computed(() => !loading.value && !messages.value.length && !events.value.length)

function messageLink({ message }: TimelineMessage) {
  return { path: folderLink(message.folder), query: { m: message.id } }
}

function eventLink(event: CalendarEvent) {
  return `/calendar/day/${toCalendarDate(new Date(event.start)).toString()}`
}

function eventColor(event: CalendarEvent): Calendar['color'] {
  return calendars.value.find(calendar => calendar.id === event.calendarId)?.color ?? 'primary'
}

function eventWhen(event: CalendarEvent): string {
  const start = new Date(event.start)
  const day = format(start, isSameDay(start, new Date()) ? '\'Today\'' : 'EEE d MMM')
  return event.allDay ? day : `${day}, ${formatTime(start)}`
}

const isPast = (event: CalendarEvent) => new Date(event.end).getTime() < Date.now()
</script>

<template>
  <section
    class="w-full"
    aria-labelledby="contact-recent"
  >
    <h2
      id="contact-recent"
      class="px-1 pb-2 text-xs font-semibold text-muted"
    >
      Recent
    </h2>

    <UCard :ui="{ body: 'p-0 sm:p-0 divide-y divide-default' }">
      <NuxtLink
        v-for="(event, index) in events"
        :key="`event-${event.id}`"
        :to="eventLink(event)"
        class="lb-stagger lb-focus flex items-center gap-3 px-4 py-2.5 transition-colors duration-(--lb-dur-1) hover:bg-elevated/60"
        :class="isPast(event) && 'opacity-70'"
        :style="{ '--lb-i': index }"
      >
        <span class="flex items-center justify-center size-4 shrink-0">
          <span
            class="size-2 rounded-full"
            :class="calendarDotClasses[eventColor(event)]"
          />
        </span>
        <span class="flex-1 min-w-0">
          <span class="block truncate text-sm text-highlighted">{{ event.title }}</span>
          <span class="block truncate text-xs text-muted">{{ isPast(event) ? 'Event' : 'Coming up' }}</span>
        </span>
        <span class="shrink-0 text-xs text-muted tabular-nums">{{ eventWhen(event) }}</span>
      </NuxtLink>

      <template v-if="loading && !messages.length">
        <div
          v-for="n in 3"
          :key="`skeleton-${n}`"
          class="flex items-center gap-3 px-4 py-3"
        >
          <USkeleton class="size-4 shrink-0 rounded-full" />
          <div class="flex-1 flex flex-col gap-1.5">
            <USkeleton
              class="h-3.5"
              :style="{ width: `${70 - n * 12}%` }"
            />
            <USkeleton
              class="h-3"
              :style="{ width: `${90 - n * 9}%` }"
            />
          </div>
          <USkeleton class="h-3 w-10 shrink-0" />
        </div>
      </template>

      <NuxtLink
        v-for="(item, index) in messages"
        :key="`${item.message.folder}-${item.message.id}`"
        :to="messageLink(item)"
        class="lb-stagger lb-focus flex items-start gap-3 px-4 py-2.5 transition-colors duration-(--lb-dur-1) hover:bg-elevated/60"
        :style="{ '--lb-i': events.length + index }"
      >
        <UTooltip :text="item.direction === 'sent' ? 'You wrote' : `${firstName} wrote`">
          <UIcon
            :name="item.direction === 'sent' ? 'i-lucide-arrow-up-right' : 'i-lucide-arrow-down-left'"
            class="mt-0.5 size-4 shrink-0"
            :class="item.direction === 'sent' ? 'text-dimmed' : 'text-primary'"
          />
        </UTooltip>
        <span class="flex-1 min-w-0">
          <span
            class="block truncate text-sm text-highlighted"
            :class="item.message.unread && 'font-semibold'"
          >{{ item.message.subject || '(No subject)' }}</span>
          <span
            v-if="item.message.preview"
            class="block truncate text-xs text-muted"
          >{{ item.message.preview }}</span>
        </span>
        <span class="shrink-0 text-xs text-muted tabular-nums">{{ listDate(item.message.date) }}</span>
      </NuxtLink>

      <p
        v-if="empty"
        class="lb-in px-4 py-5 text-sm text-muted text-center"
      >
        {{ contact.emails.length ? `No recent mail or events with ${firstName}.` : `Add an email address to see your mail with ${firstName} here.` }}
      </p>
    </UCard>
  </section>
</template>
