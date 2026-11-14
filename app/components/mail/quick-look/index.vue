<script setup lang="ts">
// A look at an attachment without leaving the message: pictures and text
// show in place, anything else offers to open or download. The arrow keys
// step through the files it was opened among
const props = defineProps<{
  items: AttachmentItem[]
  /** Offers a way to the message a file came with (the gallery; the reader is already on it) */
  showMessage?: boolean
}>()

const emit = defineEmits<{
  message: [item: AttachmentItem]
}>()

/** Which file is shown; nothing when closed */
const index = defineModel<number | undefined>('index')

const item = computed(() => index.value === undefined ? undefined : props.items[index.value])
const kind = computed(() => item.value && previewKind(item.value.file))
const isPdf = computed(() => item.value?.file.contentType === 'application/pdf')

function step(offset: number) {
  if (index.value === undefined || !props.items.length) return
  index.value = (index.value + offset + props.items.length) % props.items.length
}

// The list behind went away (a folder change): nothing left to look at
watch(() => props.items.length, (length) => {
  if (index.value !== undefined && index.value >= length) index.value = length ? length - 1 : undefined
})

useEventListener('keydown', (event: KeyboardEvent) => {
  if (!item.value || event.metaKey || event.ctrlKey || event.altKey) return
  if (event.key === 'ArrowRight') step(1)
  else if (event.key === 'ArrowLeft') step(-1)
  else return
  event.preventDefault()
  event.stopPropagation()
}, { capture: true })

/** Text files are read up to here; a log of megabytes is for downloading */
const TEXT_LIMIT = 300_000
const text = ref<string>()
const textState = ref<'idle' | 'loading' | 'error'>('idle')

watch(item, async (current) => {
  text.value = undefined
  textState.value = 'idle'
  if (!current || previewKind(current.file) !== 'text') return
  textState.value = 'loading'
  try {
    const content = await $fetch<string>(current.url, { responseType: 'text' })
    if (item.value !== current) return
    text.value = content.length > TEXT_LIMIT ? `${content.slice(0, TEXT_LIMIT)}\n…` : content
    textState.value = 'idle'
  } catch {
    if (item.value === current) textState.value = 'error'
  }
}, { immediate: true })

const imageFailed = ref(false)
watch(item, () => (imageFailed.value = false))
</script>

<template>
  <UModal
    :open="!!item"
    :title="item?.file.filename || 'Attachment'"
    :description="item ? `${formatSize(item.file.size)} · from ${personName(item.message.from)}` : undefined"
    :ui="{ content: 'sm:max-w-4xl', body: 'p-0 sm:p-0', footer: 'gap-2' }"
    @update:open="(open: boolean) => !open && (index = undefined)"
  >
    <template #body>
      <div
        v-if="item"
        class="relative flex items-center justify-center min-h-72 max-h-[70vh] overflow-auto bg-elevated/50"
      >
        <img
          v-if="kind === 'image' && !imageFailed"
          :key="item.url"
          :src="item.url"
          :alt="item.file.filename"
          class="block max-w-full max-h-[70vh] object-contain lb-in"
          @error="imageFailed = true"
        >

        <template v-else-if="kind === 'text'">
          <div
            v-if="textState === 'loading'"
            class="w-full self-start p-5 flex flex-col gap-2"
          >
            <USkeleton class="h-4 w-2/3" />
            <USkeleton class="h-4 w-1/2" />
            <USkeleton class="h-4 w-3/5" />
          </div>
          <pre
            v-else-if="text !== undefined"
            :key="item.url"
            class="w-full self-start p-5 text-[13px] leading-relaxed text-default whitespace-pre-wrap wrap-anywhere font-mono lb-in"
          >{{ text || 'This file is empty.' }}</pre>
        </template>

        <div
          v-if="(kind === 'image' && imageFailed) || (kind === 'text' && textState === 'error') || !kind"
          :key="item.url"
          class="flex flex-col items-center gap-3 px-6 py-12 text-center lb-in"
        >
          <UIcon
            :name="attachmentIcon(item.file.contentType)"
            class="size-12 text-dimmed"
          />
          <p class="text-sm text-muted max-w-sm text-pretty">
            {{ kind ? 'Couldn’t show this file.' : isPdf ? 'PDFs open in a tab of their own.' : 'There’s no preview for this kind of file.' }}
          </p>
          <UButton
            :to="item.url"
            target="_blank"
            external
            :label="isPdf ? 'Open PDF' : 'Open'"
            icon="i-lucide-external-link"
            color="neutral"
            variant="outline"
            size="sm"
            class="lb-press"
          />
        </div>
      </div>
    </template>

    <template #footer>
      <template v-if="items.length > 1">
        <UTooltip
          text="Previous"
          :kbds="['arrowleft']"
        >
          <UButton
            icon="i-lucide-chevron-left"
            color="neutral"
            variant="ghost"
            aria-label="Previous file"
            class="lb-press"
            @click="step(-1)"
          />
        </UTooltip>
        <span class="text-xs text-muted tabular-nums">{{ (index ?? 0) + 1 }} of {{ items.length }}</span>
        <UTooltip
          text="Next"
          :kbds="['arrowright']"
        >
          <UButton
            icon="i-lucide-chevron-right"
            color="neutral"
            variant="ghost"
            aria-label="Next file"
            class="lb-press"
            @click="step(1)"
          />
        </UTooltip>
      </template>

      <div class="ms-auto flex items-center gap-2">
        <UButton
          v-if="showMessage && item"
          label="Open message"
          icon="i-lucide-mail-open"
          color="neutral"
          variant="ghost"
          class="lb-press"
          @click="emit('message', item)"
        />
        <UButton
          v-if="item"
          :to="item.url"
          :download="item.file.filename"
          external
          label="Download"
          icon="i-lucide-download"
          color="neutral"
          variant="outline"
          class="lb-press"
        />
      </div>
    </template>
  </UModal>
</template>
