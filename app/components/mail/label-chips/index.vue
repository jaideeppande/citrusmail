<script setup lang="ts">
// A message's labels: a dot of the label's colour and its name. The name is
// always there, so nothing depends on telling colours apart
const props = defineProps<{
  message: MessageSummary
  /** Dots only, with the names read out and in a tooltip: for the one-line list */
  compact?: boolean
}>()

const { labelsOf } = useLabels()
const labels = computed(() => labelsOf(props.message))
</script>

<template>
  <span
    v-if="labels.length"
    class="inline-flex items-center"
    :class="compact ? 'gap-1' : 'flex-wrap gap-x-2.5 gap-y-1'"
  >
    <template v-if="compact">
      <UTooltip
        v-for="label in labels"
        :key="label.id"
        :text="label.name"
      >
        <span
          class="size-2 rounded-full lb-mark-pop"
          :style="{ background: labelVar(label.color) }"
          role="img"
          :aria-label="`Label: ${label.name}`"
        />
      </UTooltip>
    </template>
    <span
      v-for="label in labels"
      v-else
      :key="label.id"
      class="inline-flex items-center gap-1 text-xs text-toned"
    >
      <span
        class="size-2 rounded-full"
        :style="{ background: labelVar(label.color) }"
        aria-hidden="true"
      />{{ label.name }}
    </span>
  </span>
</template>
