<script setup lang="ts">
const props = defineProps<{
  id: string
  folder: string
  /** List view: the reader covers the list and offers a way back */
  back?: boolean
}>()

const toast = useToast()
const { reply, forward, open: composing } = useComposer()
const { ready } = useAi()
const { kbds } = useShortcutKeys()
const mailEvent = useMailEvent()
// Its palette command lives as long as the app; this makes sure it is there once mail is being read
useAttachmentGallery()

const showImages = ref(false)

// The copy on hand shows at once; otherwise the server is asked
const { message, status, offline, arrived, refresh, row } = useReaderMessage(() => ({ folder: props.folder, id: props.id }), showImages, { neighbours: true })

const summary = computed(() => row(props.id, props.folder))
const thread = useTemplateRef('thread')
const header = useTemplateRef('header')

/* How the message is set ("Aa") ------------------------------------- */

const type = useReaderType()

/* Printing, the calendar --------------------------------------------- */

async function print() {
  const parts = thread.value?.printable() ?? []
  if (!parts.length) return
  if (!await printMessages(parts)) toast.add({ title: 'Couldn’t open the print dialog', color: 'error', icon: 'i-lucide-circle-alert' })
}

function addToCalendar() {
  if (message.value) mailEvent.fromMessage(message.value)
}

/* Reading progress --------------------------------------------------- */

// A hairline under the header fills as the message scrolls by. Where the
// browser can tie an animation to the scroll position, CSS does it alone
// (reader.css); elsewhere the position is measured here. Either way it only
// shows when there is something to scroll
const scroller = useTemplateRef<HTMLElement>('scroller')
const scrolls = ref(false)
const read = ref(0)
const drivenByCss = import.meta.client && typeof CSS !== 'undefined' && CSS.supports('animation-timeline: scroll()')

function measure() {
  const el = scroller.value
  if (!el) return
  const room = el.scrollHeight - el.clientHeight
  scrolls.value = room > 48
  if (!drivenByCss) read.value = room > 0 ? Math.min(1, el.scrollTop / room) : 0
}
useResizeObserver(scroller, measure)
useResizeObserver(() => scroller.value?.firstElementChild as HTMLElement | null | undefined, measure)
useEventListener(scroller, 'scroll', () => !drivenByCss && measure(), { passive: true })
watch(() => [props.id, props.folder], () => (scrolls.value = false))

/* Keys and commands -------------------------------------------------- */

// Not over a message being written: it would be replaced without being saved
const free = () => !composing.value && !!message.value
defineAppShortcuts({
  'mail.reply': () => free() && reply(message.value!),
  'mail.replyAll': () => free() && reply(message.value!, true),
  'mail.forward': () => free() && forward(message.value!),
  'mail.print': () => message.value && print(),
  'mail.snooze': () => summary.value && header.value?.openSnooze()
})

useCommands(() => message.value
  ? [{
      id: 'reader',
      label: 'This message',
      items: [
        { label: 'Print or save as PDF', icon: 'i-lucide-printer', kbds: kbds('mail.print').map(value => ({ value, variant: 'soft' as const })), onSelect: print },
        ...(mailEvent.available.value ? [{ label: 'Add to calendar', icon: 'i-lucide-calendar-plus', onSelect: addToCalendar }] : []),
        ...(ready.value && thread.value?.isThread ? [{ label: 'Summarize conversation', icon: 'i-lucide-sparkles', onSelect: () => thread.value?.summarize() }] : [])
      ]
    }]
  : [])
</script>

<template>
  <article
    data-reader
    :data-reader-width="type.width"
    :data-reader-leading="type.leading"
    :data-reader-face="type.face"
    :data-reader-paper="type.sepia ? 'sepia' : 'plain'"
    class="lb-read-scope flex flex-col min-w-0 min-h-0 bg-default"
  >
    <MailReaderHeader
      ref="header"
      :summary="summary"
      :message="message ?? undefined"
      :back="back"
      :translation="thread?.translationState"
      :thread="thread?.isThread"
      @summarize="thread?.summarize()"
      @translate="thread?.translate()"
      @print="print"
      @event="addToCalendar"
    />

    <div class="relative shrink-0 h-0">
      <Transition name="lb-fade">
        <div
          v-show="scrolls && !!message"
          class="lb-read-progress"
          :style="drivenByCss ? undefined : { '--lb-read': read }"
          aria-hidden="true"
        />
      </Transition>
    </div>

    <div
      v-if="status === 'pending' && !message"
      class="flex-1 p-6 flex flex-col gap-4"
    >
      <USkeleton class="h-7 w-2/3" />
      <div class="flex items-center gap-3">
        <USkeleton class="size-10 rounded-full" />
        <div class="flex-1 flex flex-col gap-2">
          <USkeleton class="h-4 w-1/3" />
          <USkeleton class="h-3 w-1/4" />
        </div>
      </div>
      <USkeleton class="h-64 w-full rounded-xl" />
    </div>

    <UEmpty
      v-else-if="status === 'error'"
      icon="i-lucide-mail-x"
      title="Couldn’t open this message"
      description="It may have been moved or deleted from another device."
      :actions="[{ label: 'Try again', icon: 'i-lucide-rotate-cw', color: 'neutral', variant: 'subtle', onClick: () => refresh() }]"
      variant="naked"
      class="flex-1"
    />

    <div
      v-else-if="message"
      ref="scroller"
      class="lb-read-scroller flex-1 min-h-0 overflow-y-auto"
    >
      <!-- Fades in when it takes the skeleton's place; a message already on hand is simply there -->
      <MailThread
        ref="thread"
        v-model:show-images="showImages"
        :summary="summary"
        :message="message"
        :offline="offline"
        :class="arrived && 'lb-in'"
      />
    </div>
  </article>
</template>
