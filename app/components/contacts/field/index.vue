<script setup lang="ts">
// One line of a contact’s details: a label in the margin and the value,
// with a copy button that shows on hover or focus. Sits inside a <dl>
const props = defineProps<{
  label: string
  value: string
  to?: string
  /** Renders the value as a button that emits open */
  action?: boolean
  /** Said by the open button to a screen reader, e.g. “Write to ana@example.com” */
  actionLabel?: string
}>()

const emit = defineEmits<{
  open: []
}>()

const { copy, copied } = useClipboard({ copiedDuring: 1500, legacy: true })

async function onCopy() {
  await copy(props.value)
  if (copied.value) announce(`${props.label} copied`)
}
</script>

<template>
  <div class="group grid grid-cols-[7rem_1fr_auto] items-start gap-3 py-1.5">
    <dt class="pt-px text-sm text-muted">
      {{ label }}
    </dt>
    <dd class="min-w-0">
      <NuxtLink
        v-if="to"
        :to="to"
        external
        class="lb-focus block truncate rounded-sm text-sm text-highlighted underline-offset-2 hover:underline"
      >{{ value }}</NuxtLink>
      <button
        v-else-if="action"
        type="button"
        :aria-label="actionLabel"
        class="lb-focus block max-w-full truncate rounded-sm text-start text-sm text-highlighted underline-offset-2 hover:underline"
        @click="emit('open')"
      >
        {{ value }}
      </button>
      <p
        v-else
        class="text-sm break-words whitespace-pre-wrap text-highlighted"
      >
        {{ value }}
      </p>
    </dd>
    <UTooltip :text="copied ? 'Copied' : 'Copy'">
      <UButton
        :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
        color="neutral"
        variant="ghost"
        size="xs"
        :aria-label="`Copy ${label.toLowerCase()} ${value}`"
        class="-my-0.5 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
        @click="onCopy"
      />
    </UTooltip>
  </div>
</template>
