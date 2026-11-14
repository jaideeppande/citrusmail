<script setup lang="ts">
// A message of the conversation other than the one that was opened: fetched
// when its card first opens, and marked read like any message you open
const props = defineProps<{
  entry: ThreadEntry
}>()

const emit = defineEmits<{
  /** It's here, and whether its remote images are showing (for printing) */
  loaded: [message: MessageDetail, remote: boolean]
}>()

const showImages = ref(false)
const { message, status, offline, refresh } = useReaderMessage(() => props.entry.summary, showImages)

watch([message, showImages], ([detail, images]) => {
  if (detail) emit('loaded', detail, images || !!detail.remoteShown)
}, { immediate: true })
</script>

<template>
  <div
    v-if="status === 'pending' && !message"
    class="py-3 flex flex-col gap-3"
  >
    <USkeleton class="h-3.5 w-1/3" />
    <USkeleton class="h-24 w-full rounded-lg" />
  </div>

  <div
    v-else-if="status === 'error'"
    class="py-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted"
  >
    <UIcon
      name="i-lucide-mail-x"
      class="size-4 shrink-0"
    />
    Couldn’t open this message. It may have been moved or deleted.
    <UButton
      label="Try again"
      icon="i-lucide-rotate-cw"
      color="neutral"
      variant="link"
      size="sm"
      class="p-0"
      @click="refresh()"
    />
  </div>

  <MailReaderContent
    v-else-if="message"
    v-model:show-images="showImages"
    :message="message"
    :offline="offline"
    nested
    class="lb-in"
  />
</template>
