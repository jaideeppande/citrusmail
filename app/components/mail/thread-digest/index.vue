<script setup lang="ts">
// One digest of a conversation. There is no way to hand the model a whole
// thread at once, so it is built from the per-message summary: the newest
// message (which usually quotes the rest), or, when several of the recent
// messages say a lot of their own, each of the last few. The label says which
const props = defineProps<{
  entries: ThreadEntry[]
}>()

const emit = defineEmits<{
  close: []
}>()

interface Part {
  key: string
  name: string
  date: string
  text: string
  state: 'waiting' | 'writing' | 'done' | 'error'
}

/** The most messages summarised one by one */
const MOST = 4
/** Words of its own (not quoted) before a message counts as saying something new */
const LONG = 500

const { stream, providerLabel } = useAi()
const cache = useMessageCache()

const parts = ref<Part[]>([])
const state = ref<'reading' | 'writing' | 'done' | 'error'>('reading')
const error = ref('')
let controller: AbortController | undefined

async function run() {
  controller?.abort()
  const signal = (controller = new AbortController()).signal
  parts.value = []
  error.value = ''
  state.value = 'reading'

  const recent = props.entries.slice(-MOST)
  // Read without marking anything read: this is a look across the thread, not opening each message
  const details = await Promise.all(recent.map(entry => cache.peek(entry.summary.folder, entry.summary.id).then(found => found.message).catch(() => undefined)))
  if (signal.aborted) return
  const long = details.filter(detail => detail && writtenPart(messageText(detail)).trim().length > LONG).length
  const chosen = long >= 2 ? recent : recent.slice(-1)

  parts.value = chosen.map(entry => ({
    key: messageKey(entry.summary),
    name: entry.mine ? 'You' : personName(entry.summary.from),
    date: entry.summary.date,
    text: '',
    state: 'waiting'
  }))
  state.value = 'writing'

  // One after another, oldest first, so the card fills in reading order
  let failures = 0
  for (const [index, entry] of chosen.entries()) {
    const part = parts.value[index]!
    part.state = 'writing'
    try {
      await stream('/api/ai/summarize', { folder: entry.summary.folder, id: entry.summary.id }, sofar => (part.text = sofar), signal)
      part.state = 'done'
    } catch (failure) {
      if ((failure as Error).name === 'AbortError') return
      part.state = 'error'
      error.value = (failure as Error).message
      failures++
    }
  }
  state.value = failures === chosen.length ? 'error' : 'done'
}

onBeforeUnmount(() => controller?.abort())
defineExpose({ run })

const label = computed(() => {
  const total = props.entries.length
  if (state.value === 'reading') return 'Reading the conversation'
  const count = parts.value.length
  if (count === 1) return total > 1 ? `Summary of the latest of ${total} messages, which usually quotes the rest` : 'Summary of this message'
  return count === total ? `Summary of the last ${count} messages` : `Summary of the last ${count} of ${total} messages`
})

// A line starting with "!" is what the reader needs to do, in any language
function lines(text: string) {
  return text.split('\n')
    .map(line => line.replace(/^\s*[-•*]\s*/, '').trim())
    .filter(Boolean)
    .map(line => ({ text: line.replace(/^!\s*/, ''), action: line.startsWith('!') }))
}
</script>

<template>
  <section
    class="relative overflow-hidden rounded-lg bg-(--lb-ai-bg) ring ring-[color-mix(in_oklab,var(--lb-ai)_22%,transparent)] px-4 py-3"
    aria-label="Conversation summary"
    :aria-busy="state === 'reading' || state === 'writing'"
  >
    <div
      v-if="state === 'reading' || state === 'writing'"
      class="lb-ai-progress absolute inset-x-0 top-0 h-0.5"
    />
    <header class="flex items-center gap-2 mb-2">
      <UIcon
        name="i-lucide-sparkles"
        class="size-4 shrink-0 text-(--lb-ai)"
      />
      <h2 class="min-w-0 text-sm font-semibold text-highlighted">
        {{ label }}<span
          v-if="state === 'reading'"
          class="lb-ai-dots"
        />
      </h2>
      <span class="shrink-0 text-xs text-muted">{{ providerLabel }}</span>
      <UButton
        icon="i-lucide-x"
        color="neutral"
        variant="ghost"
        size="xs"
        aria-label="Close summary"
        class="ms-auto -me-2 shrink-0"
        @click="emit('close')"
      />
    </header>

    <p
      v-if="state === 'error'"
      class="text-sm text-error"
    >
      {{ error }}
    </p>

    <ol
      v-else
      class="flex flex-col gap-3"
    >
      <li
        v-for="(part, index) in parts"
        :key="part.key"
        class="lb-stagger"
        :style="{ '--lb-i': index }"
      >
        <p
          v-if="parts.length > 1"
          class="mb-1 flex items-baseline gap-2 text-xs"
        >
          <span class="font-semibold text-highlighted">{{ part.name }}</span>
          <time
            :datetime="part.date"
            class="text-muted tabular-nums"
          >{{ listDate(part.date) }}</time>
        </p>
        <p
          v-if="part.state === 'error'"
          class="text-sm text-muted"
        >
          Couldn’t summarize this one.
        </p>
        <p
          v-else-if="!part.text"
          class="text-sm text-muted"
        >
          {{ part.state === 'writing' ? 'Reading' : 'Waiting' }}<span
            v-if="part.state === 'writing'"
            class="lb-ai-dots"
          />
        </p>
        <ul
          v-else
          class="flex flex-col gap-1 text-sm text-default leading-relaxed"
        >
          <li
            v-for="(line, at) in lines(part.text)"
            :key="at"
            class="flex gap-2"
            :class="line.action && 'font-medium text-highlighted'"
          >
            <UIcon
              v-if="line.action"
              name="i-lucide-circle-arrow-right"
              class="mt-1 size-3.5 text-(--lb-ai) shrink-0"
            />
            <span
              v-else
              class="mt-2 size-1 rounded-full bg-(--lb-ai) shrink-0"
            />
            <span>{{ line.text }}</span>
          </li>
        </ul>
      </li>
    </ol>
  </section>
</template>
