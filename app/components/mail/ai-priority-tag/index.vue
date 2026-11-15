<script setup lang="ts">
// The priority inbox's mark on a row: what the message asks of you, in
// words with an icon, quiet grey so it never competes with unread. The
// reason is in the tooltip, and read out with the row
const props = defineProps<{
  message: MessageSummary
  /** The one-line list: the short word only */
  compact?: boolean
}>()

const { rowTag } = useAiPriority()
const tag = computed(() => rowTag(props.message))
const info = computed(() => tag.value && PRIORITY_INFO[tag.value.kind])
const tip = computed(() => tag.value && (tag.value.corrected ? `${info.value!.label}: you set this` : `${info.value!.label}${tag.value.reason ? `: ${tag.value.reason}` : ''} (sorted by AI)`))
</script>

<template>
  <UTooltip
    v-if="tag && info"
    :text="tip"
  >
    <span
      class="inline-flex shrink-0 items-center gap-1 rounded-sm px-1 text-xs font-medium text-toned lb-in"
      :class="tag.kind === 'urgent' && 'text-highlighted'"
    >
      <UIcon
        :name="info.icon"
        class="size-3.5 shrink-0"
        aria-hidden="true"
      />
      <span aria-hidden="true">{{ compact ? info.short : info.label }}</span>
      <span class="sr-only">{{ tip }}</span>
    </span>
  </UTooltip>
</template>
