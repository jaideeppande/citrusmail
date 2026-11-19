<script setup lang="ts">
import { addDays } from 'date-fns'

// On a reply to a message that seems to ask to meet: "Offer times" writes
// the reply with three of your free times in the next five working days.
// Only the free times go to the AI, never what your events are
const client = useAiClient()
const toast = useToast()
const { draft } = useComposer()
const { calendars, events, ensureRange } = useCalendarEvents()
const writing = useAiWriting()
const cache = useMessageCache()

const original = shallowRef<MessageDetail>()
watch(() => draft.value.replyingTo, async (source) => {
  original.value = undefined
  if (!source) return
  const entry = await cache.peek(source.folder, source.id).catch(() => undefined)
  if (draft.value.replyingTo === source) original.value = entry?.message
}, { immediate: true })

const asksToMeet = computed(() => {
  const message = original.value
  if (!message) return false
  const text = message.text || (message.html ? new DOMParser().parseFromString(message.html, 'text/html').body.textContent ?? '' : '')
  // The start is where the asking happens; a long thread below it is history
  return looksLikeMeetingAsk(`${message.subject}\n${text.slice(0, 4000)}`)
})

const finding = ref(false)
// Hidden while the reply with times is on screen, and while anything is being written
const idle = computed(() => writing.landed.value !== 'meeting' && !writing.busy.value)
const shown = computed(() => client.enabled('meeting-reply') && calendars.value.length > 0 && asksToMeet.value && idle.value)

async function offer() {
  const message = original.value
  if (!message || finding.value) return
  finding.value = true
  announce('Finding your free times…')
  try {
    const now = new Date()
    // Five working days fit in nine calendar days, weekends included
    await ensureRange({ start: now, end: addDays(now, 10) })
    const slots = freeSlotsAhead(events.value, now)
    if (!slots.length) {
      toast.add({ title: 'No free time in the next five working days', description: 'Between 9:00 and 17:30, your calendar is full.', icon: 'i-lucide-calendar-x' })
      announce('No free time in the next five working days')
      return
    }
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
    finding.value = false
    await writing.writeMeetingReply(message, freeSlotPromptLines(slots, zone), zone)
  } finally {
    finding.value = false
  }
}
</script>

<template>
  <Transition name="lb-collapse">
    <div v-if="shown">
      <div class="flex min-h-10 items-center gap-2 border-b border-default ps-5 pe-2">
        <UIcon
          name="i-lucide-calendar-clock"
          class="size-4 shrink-0 text-(--lb-ai)"
        />
        <p class="min-w-0 flex-1 truncate text-sm text-toned">
          They seem to be asking to meet
        </p>
        <UTooltip text="Writes a reply offering three of your free times. Only free times are sent to AI, not your events">
          <UButton
            label="Offer times"
            icon="i-lucide-sparkles"
            color="neutral"
            variant="subtle"
            size="xs"
            :loading="finding"
            class="shrink-0 rounded-full"
            @click="offer"
          />
        </UTooltip>
      </div>
    </div>
  </Transition>
</template>
