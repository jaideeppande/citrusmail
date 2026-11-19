<script setup lang="ts">
const props = defineProps<{
  message: MessageDetail
  /** One card of a conversation: the subject and the sender's name are already above it */
  nested?: boolean
  /** The copy saved on this computer, shown because the server couldn't be reached */
  offline?: boolean
}>()

const showImages = defineModel<boolean>('showImages', { required: true })

const summaryEl = useTemplateRef('summaryEl')
const summaryOpen = ref(false)

async function summarize() {
  summaryOpen.value = true
  await nextTick()
  summaryEl.value?.run()
}

const body = useTemplateRef('body')
const subject = useTemplateRef('subject')
const translation = useMessageTranslation(() => props.message, () => [subject.value, body.value?.root()])

defineExpose({ summarize, translate: translation.toggle, translationState: translation.state })

const hasRemote = computed(() => props.message.remoteContent && !showImages.value && !props.message.remoteShown)
const hasInvite = computed(() => props.message.attachments.some(isInvite))
</script>

<template>
  <div
    class="flex flex-col"
    :class="nested ? 'gap-4' : 'gap-5'"
  >
    <!-- Its text is set by hand, so translation can swap it like the body's -->
    <h1
      v-if="!nested"
      class="text-2xl font-bold tracking-tight text-highlighted text-pretty wrap-anywhere"
    >
      <span
        ref="subject"
        v-text="message.subject || '(No subject)'"
      />
    </h1>

    <MailSender
      :message="message"
      :compact="nested"
    >
      <UTooltip
        v-if="offline"
        text="The mail server couldn’t be reached. This is the copy saved on this computer when you last opened the message."
      >
        <UBadge
          label="Offline copy"
          icon="i-lucide-cloud-off"
          color="neutral"
          variant="subtle"
          size="sm"
          class="mt-2 self-start lb-in"
        />
      </UTooltip>
      <MailReceiptBadge
        v-if="message.receipt"
        :receipt="message.receipt"
        full
        class="self-start"
      />
      <MailRemoteImages
        v-if="hasRemote"
        :message="message"
        @show="showImages = true"
      />
    </MailSender>

    <MailLabelChips
      v-if="!nested"
      :message="message"
    />

    <!-- The one AI row above the body: it shows only when a message looks like a scam -->
    <MailAiScamBanner :message="message" />

    <MailActionChips :message="message" />

    <MailTranslateBar :translation="translation" />

    <Transition name="lb-summary">
      <MailAiSummary
        v-if="summaryOpen"
        ref="summaryEl"
        :message="message"
        @close="summaryOpen = false"
      />
    </Transition>

    <MailInviteCard
      v-if="hasInvite"
      :message="message"
    />

    <MailBody
      ref="body"
      :message="message"
      :remote="showImages || message.remoteShown"
      @rendered="translation.rendered()"
    />

    <MailAttachments
      v-if="message.attachments.length"
      :message="message"
    />

    <MailReaderActions
      :message="message"
      :class="nested && 'pb-3'"
    />
  </div>
</template>
