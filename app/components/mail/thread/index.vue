<script setup lang="ts">
// What the reader shows under its header. A message on its own reads as it
// always did. One that belongs to a conversation shows the subject once and
// every message as a card, oldest first: the open one and the newest are
// expanded, the others a one-line header that opens on a click
const props = defineProps<{
  /** The open message's row in the list, when it is on it */
  summary?: MessageSummary
  /** The open message itself */
  message: MessageDetail
  /** It is the copy saved on this computer: the server couldn't be reached */
  offline?: boolean
}>()

const showImages = defineModel<boolean>('showImages', { required: true })

const { folders } = useMail()
const { ready } = useAi()

// Loaded mail the open message isn't among (a window that opened straight on it) still threads by itself
const { entries, isThread } = useThread(() => props.summary ?? props.message)
const anchorKey = computed(() => messageKey(props.message))
const isAnchor = (entry: ThreadEntry) => messageKey(entry.summary) === anchorKey.value

// The open message and the newest one from someone else start expanded;
// a click on any header then decides for that card
const toggled = ref(new Map<string, boolean>())
const newestKey = computed(() => {
  const newest = entries.value.findLast(entry => !entry.mine) ?? entries.value.at(-1)
  return newest && messageKey(newest.summary)
})

function isOpen(entry: ThreadEntry) {
  const key = messageKey(entry.summary)
  return toggled.value.get(key) ?? (key === anchorKey.value || key === newestKey.value)
}

function toggle(entry: ThreadEntry) {
  toggled.value = new Map(toggled.value).set(messageKey(entry.summary), !isOpen(entry))
}

// A card keeps its message once it has been opened, so closing and opening it again is instant
const opened = ref(new Set<string>())
watchEffect(() => {
  const missing = entries.value.filter(entry => isOpen(entry) && !opened.value.has(messageKey(entry.summary)))
  if (missing.length) opened.value = new Set([...opened.value, ...missing.map(entry => messageKey(entry.summary))])
})

// The messages the other cards fetched, for reading time, printing and the quick reply
const details = shallowRef(new Map<string, PrintPart>())
function onLoaded(entry: ThreadEntry, message: MessageDetail, remote: boolean) {
  details.value = new Map(details.value).set(messageKey(entry.summary), { message, remote })
}
const anchorPart = computed<PrintPart>(() => ({ message: props.message, remote: showImages.value || !!props.message.remoteShown }))
const partOf = (entry: ThreadEntry) => isAnchor(entry) ? anchorPart.value : details.value.get(messageKey(entry.summary))

function minutes(entry: ThreadEntry) {
  const part = partOf(entry)
  return part ? readingMinutes(messageText(part.message)) : 0
}

/** What Print prints: the open message, or the expanded messages of the conversation in order */
function printable(): PrintPart[] {
  if (!isThread.value) return [anchorPart.value]
  const parts = entries.value.filter(isOpen).map(partOf).filter(part => part !== undefined)
  return parts.length ? parts : [anchorPart.value]
}

/* Summaries --------------------------------------------------------- */

const content = useTemplateRef<{ summarize: () => void, translate: () => void, translationState: 'idle' | 'translating' | 'translated' | 'original' | 'error' }[]>('content')
const anchorContent = computed(() => content.value?.[0])

const digestEl = useTemplateRef('digestEl')
const digestOpen = ref(false)

/** A conversation gets one digest of the whole of it; a single message its own summary */
async function summarize() {
  if (!isThread.value) return anchorContent.value?.summarize()
  digestOpen.value = true
  await nextTick()
  digestEl.value?.run()
  digestEl.value?.$el?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
}
watch(anchorKey, () => (digestOpen.value = false))

/* Quick reply ------------------------------------------------------- */

// Under the last card: an answer goes to the newest message that isn't your own
const isDraft = computed(() => folders.value.find(item => item.path === props.message.folder)?.role === 'drafts')
const replyTo = computed(() => {
  const loaded = entries.value.filter(entry => !entry.mine).map(partOf).filter(part => part !== undefined)
  return loaded.at(-1)?.message ?? props.message
})

defineExpose({
  summarize,
  translate: () => anchorContent.value?.translate(),
  translationState: computed(() => anchorContent.value?.translationState ?? 'idle'),
  printable,
  isThread,
  entries
})
</script>

<template>
  <div class="lb-reader-column mx-auto w-full px-4 sm:px-8 py-6 flex flex-col gap-3">
    <header
      v-if="isThread"
      class="flex items-start gap-3 pb-2 lb-in"
    >
      <h1 class="flex-1 min-w-0 text-2xl font-bold tracking-tight text-highlighted text-pretty wrap-anywhere">
        {{ message.subject || '(No subject)' }}
      </h1>
      <span class="shrink-0 mt-2 text-sm text-muted tabular-nums">{{ entries.length }} messages</span>
      <UTooltip
        v-if="ready"
        text="Summarize conversation"
      >
        <UButton
          icon="i-lucide-sparkles"
          color="neutral"
          variant="ghost"
          size="sm"
          aria-label="Summarize conversation"
          class="shrink-0 mt-1 lb-press"
          :ui="{ leadingIcon: 'text-(--lb-ai)' }"
          @click="summarize"
        />
      </UTooltip>
    </header>

    <Transition name="lb-summary">
      <MailThreadDigest
        v-if="digestOpen && isThread"
        ref="digestEl"
        :entries="entries"
        @close="digestOpen = false"
      />
    </Transition>

    <MailThreadItem
      v-for="entry in entries"
      :key="messageKey(entry.summary)"
      :entry="entry"
      :open="isOpen(entry)"
      :bare="!isThread"
      :minutes="minutes(entry)"
      @toggle="toggle(entry)"
    >
      <MailReaderContent
        v-if="isAnchor(entry)"
        ref="content"
        v-model:show-images="showImages"
        :message="message"
        :offline="offline"
        :nested="isThread"
      />
      <MailThreadMessage
        v-else-if="opened.has(messageKey(entry.summary))"
        :entry="entry"
        @loaded="(detail: MessageDetail, remote: boolean) => onLoaded(entry, detail, remote)"
      />
    </MailThreadItem>

    <MailQuickReply
      v-if="!isDraft"
      :message="replyTo"
      class="mt-2 mb-6"
    />
  </div>
</template>
