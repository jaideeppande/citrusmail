<script setup lang="ts">
const props = defineProps<{
  message: MessageDetail
}>()

// Pictures and text open in a quick look over the message, where the arrow
// keys step through them; anything else opens in its own tab or downloads
const items = computed<AttachmentItem[]>(() => props.message.attachments.map(file => ({ message: props.message, file, url: attachmentUrl(props.message, file.index) })))
const looking = ref<number>()
watch(() => [props.message.id, props.message.folder], () => (looking.value = undefined))
</script>

<template>
  <section>
    <h2 class="text-sm font-medium text-muted mb-2">
      {{ message.attachments.length === 1 ? '1 attachment' : `${message.attachments.length} attachments` }}
    </h2>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <template
        v-for="(item, index) in items"
        :key="item.file.index"
      >
        <UButton
          v-if="previewKind(item.file)"
          color="neutral"
          variant="outline"
          class="justify-start gap-3 p-3 rounded-lg lb-press"
          :class="previewKind(item.file) === 'image' && 'ps-2.5'"
          :icon="previewKind(item.file) === 'image' ? undefined : attachmentIcon(item.file.contentType)"
          :ui="{ leadingIcon: 'size-6 text-muted' }"
          :aria-label="`Look at ${item.file.filename}`"
          @click="looking = index"
        >
          <img
            v-if="previewKind(item.file) === 'image'"
            :src="item.url"
            alt=""
            loading="lazy"
            decoding="async"
            class="size-9 shrink-0 rounded-sm object-cover bg-elevated"
          >
          <span class="flex-1 min-w-0 text-start">
            <span class="block truncate text-sm font-medium text-highlighted">{{ item.file.filename }}</span>
            <span class="block text-xs text-muted">{{ formatSize(item.file.size) }}</span>
          </span>
          <UIcon
            name="i-lucide-eye"
            class="size-4 text-muted"
          />
        </UButton>
        <UButton
          v-else
          :to="item.url"
          target="_blank"
          external
          color="neutral"
          variant="outline"
          :icon="attachmentIcon(item.file.contentType)"
          class="justify-start gap-3 p-3 rounded-lg lb-press"
          :ui="{ leadingIcon: 'size-6 text-muted' }"
        >
          <span class="flex-1 min-w-0 text-start">
            <span class="block truncate text-sm font-medium text-highlighted">{{ item.file.filename }}</span>
            <span class="block text-xs text-muted">{{ formatSize(item.file.size) }}</span>
          </span>
          <UIcon
            name="i-lucide-download"
            class="size-4 text-muted"
          />
        </UButton>
      </template>
    </div>

    <MailQuickLook
      v-model:index="looking"
      :items="items"
    />
  </section>
</template>
