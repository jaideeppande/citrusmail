<script setup lang="ts">
const props = defineProps<{
  summary?: MessageSummary
  message?: MessageDetail
  /** Shows a way back to the list (list view, phones) */
  back?: boolean
  /** Where AI Translate is for this message */
  translation?: 'idle' | 'translating' | 'translated' | 'original' | 'error'
  /** A conversation is open: Summarize covers all of it */
  thread?: boolean
}>()

const emit = defineEmits<{
  summarize: []
  translate: []
  print: []
  event: []
}>()

const { selectedId, setUnread, toggleFlag } = useMail()
const { ready } = useAi()
const { kbds } = useShortcutKeys()

function act(handler: (message: MessageSummary) => void) {
  return () => props.summary && handler(props.summary)
}

// The flag and the envelope answer a click with a small pop. The class is
// taken off and put back, so a second click pops again
const popped = ref<'flag' | 'unread'>()
function pop(which: 'flag' | 'unread') {
  popped.value = undefined
  requestAnimationFrame(() => (popped.value = which))
}
watch(() => [props.summary?.id, props.summary?.folder], () => (popped.value = undefined))

const bar = useTemplateRef<HTMLElement>('bar')
useRovingFocus(bar)

const snoozeOpen = ref(false)
const snoozePicking = ref(false)

defineExpose({
  /** For the Snooze shortcut */
  openSnooze: () => (snoozeOpen.value = true)
})
</script>

<template>
  <!-- Scrolls sideways rather than pushing Flag and More off a narrow sheet -->
  <header
    ref="bar"
    role="toolbar"
    aria-label="Message actions"
    class="shrink-0 flex items-center gap-1 h-14 px-3 border-b border-default min-w-0 overflow-x-auto"
  >
    <UTooltip
      text="Back to the list"
      :kbds="['escape']"
    >
      <UButton
        icon="i-lucide-chevron-left"
        color="neutral"
        variant="ghost"
        aria-label="Back to the list"
        class="lb-press"
        :class="!back && 'lg:hidden'"
        @click="selectedId = undefined"
      />
    </UTooltip>

    <MailReaderMoveActions :summary="summary" />

    <div class="ms-auto flex items-center gap-1">
      <MailUnsubscribeButton
        v-if="message?.unsubscribe"
        :message="message"
      />
      <UTooltip
        v-if="ready"
        :text="translation === 'translated' ? 'Show original' : 'Translate'"
      >
        <UButton
          icon="i-lucide-languages"
          color="neutral"
          :variant="translation === 'translated' ? 'soft' : 'ghost'"
          :aria-label="translation === 'translated' ? 'Show the original' : 'Translate this message'"
          :aria-pressed="translation === 'translated'"
          :loading="translation === 'translating'"
          :disabled="!message"
          class="lb-press"
          @click="emit('translate')"
        />
      </UTooltip>
      <UTooltip
        v-if="ready"
        :text="thread ? 'Summarize conversation' : 'Summarize'"
      >
        <UButton
          icon="i-lucide-sparkles"
          color="neutral"
          variant="ghost"
          :aria-label="thread ? 'Summarize this conversation' : 'Summarize this message'"
          :disabled="!message"
          class="lb-press"
          @click="emit('summarize')"
        />
      </UTooltip>
      <MailReaderType />
      <MailReaderSnooze
        v-model:open="snoozeOpen"
        v-model:picking="snoozePicking"
        :summary="summary"
      />
      <UTooltip
        :text="summary?.unread ? 'Mark as read' : 'Mark as unread'"
        :kbds="kbds('mail.toggleRead')"
      >
        <UButton
          :icon="summary?.unread ? 'i-lucide-mail-open' : 'i-lucide-mail'"
          color="neutral"
          variant="ghost"
          :aria-label="summary?.unread ? 'Mark as read' : 'Mark as unread'"
          :disabled="!summary"
          class="lb-press"
          :ui="{ leadingIcon: popped === 'unread' ? 'lb-mark-pop' : '' }"
          @click="act(message => (pop('unread'), setUnread(message, !message.unread)))()"
        />
      </UTooltip>
      <UTooltip
        :text="summary?.flagged ? 'Remove flag' : 'Flag'"
        :kbds="kbds('mail.flag')"
      >
        <UButton
          :icon="summary?.flagged ? 'i-ph-flag-fill' : 'i-lucide-flag'"
          color="neutral"
          variant="ghost"
          :ui="{ leadingIcon: [summary?.flagged ? 'text-(--lb-flag)' : '', popped === 'flag' && 'lb-mark-pop'] }"
          :aria-label="summary?.flagged ? 'Remove flag' : 'Flag'"
          :disabled="!summary"
          class="lb-press"
          @click="act(message => (pop('flag'), toggleFlag(message)))()"
        />
      </UTooltip>
      <MailSenderMenu
        v-if="message"
        :message="message"
        :summary="summary"
        @print="emit('print')"
        @event="emit('event')"
        @pick-snooze="snoozePicking = true"
      />
    </div>
  </header>
</template>
