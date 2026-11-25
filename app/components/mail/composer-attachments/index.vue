<script setup lang="ts">
// Files going with the message: pictures as small previews, everything else
// as a chip. The original's files on a reply or forward come first; they are
// only named in the draft and attached by the server (see Draft.carry)
const { draft, detach, detachCarried } = useComposer()

const isPicture = (file: { contentType: string }) => /^image\/(png|jpe?g|gif|webp)$/.test(file.contentType)

interface Chip {
  key: string
  filename: string
  contentType: string
  size: number
  /** A picture's preview */
  src?: string
  remove: () => void
}

const chips = computed<Chip[]>(() => {
  const { carry, attachments } = draft.value
  const carried = (carry?.files ?? []).map((file): Chip => ({
    key: `carried-${file.index}`,
    filename: file.filename,
    contentType: file.contentType,
    size: file.size,
    src: isPicture(file) ? `/api/messages/${encodeURIComponent(carry!.id)}/attachments/${file.index}?folder=${encodeURIComponent(carry!.folder)}` : undefined,
    remove: () => detachCarried(file.index)
  }))
  const added = attachments.map((file, index): Chip => ({
    key: `${file.filename}-${index}`,
    filename: file.filename,
    contentType: file.contentType,
    size: file.content.length * 0.75,
    src: isPicture(file) ? `data:${file.contentType};base64,${file.content}` : undefined,
    remove: () => detach(index)
  }))
  return [...carried, ...added]
})
</script>

<template>
  <TransitionGroup
    v-if="chips.length"
    tag="ul"
    name="lb-pop"
    class="flex flex-wrap gap-2 px-5 pb-3"
    aria-label="Attachments"
  >
    <li
      v-for="file in chips"
      :key="file.key"
      class="group relative flex items-center gap-2 h-12 rounded-lg ring ring-default bg-default ps-1.5 pe-2 max-w-64"
    >
      <img
        v-if="file.src"
        :src="file.src"
        alt=""
        class="size-9 rounded-md object-cover shrink-0 bg-elevated"
      >
      <span
        v-else
        class="size-9 rounded-md bg-elevated grid place-items-center shrink-0"
      >
        <UIcon
          :name="attachmentIcon(file.contentType)"
          class="size-4.5 text-muted"
        />
      </span>
      <span class="min-w-0 flex flex-col leading-tight">
        <span class="truncate text-sm font-medium text-highlighted">{{ file.filename }}</span>
        <span class="text-xs text-muted tabular-nums">{{ formatSize(file.size) }}</span>
      </span>
      <UButton
        icon="i-lucide-x"
        color="neutral"
        variant="solid"
        size="xs"
        :aria-label="`Remove ${file.filename}`"
        class="absolute -top-2 -end-2 rounded-full size-5 p-0 justify-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100 transition-opacity"
        @click="file.remove()"
      />
    </li>
  </TransitionGroup>
</template>
