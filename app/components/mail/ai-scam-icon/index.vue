<script setup lang="ts">
// A row's warning that its message may be a scam: a shield whose shape,
// not only its colour, says how sure the check is, named for screen readers
const props = defineProps<{
  message: MessageSummary
}>()

const { rowWarning } = useAiScam()
const warning = computed(() => rowWarning(props.message))
const look = computed(() => warning.value && scamLook(warning.value.verdict))
const tip = computed(() => warning.value && `${look.value!.label}${warning.value.reasons.length ? `: ${warning.value.reasons.join(' ')}` : ''}`)
</script>

<template>
  <UTooltip
    v-if="warning && look"
    :text="tip"
  >
    <UIcon
      :name="look.icon"
      class="size-3.5 shrink-0 lb-mark-pop"
      :class="look.color === 'error' ? 'text-error' : 'text-warning'"
      role="img"
      :aria-label="tip"
    />
  </UTooltip>
</template>
