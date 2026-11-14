<script setup lang="ts">
// One number with what it counts above it
defineProps<{
  label: string
  value: string | number
  /** A few words under the number, when it needs them */
  note?: string
}>()
</script>

<template>
  <div class="flex flex-col gap-1 rounded-lg p-4 ring ring-default">
    <p class="text-xs font-medium text-muted">
      {{ label }}
    </p>
    <p class="text-2xl font-semibold leading-tight tracking-tight text-highlighted">
      {{ typeof value === 'number' ? value.toLocaleString() : value }}
    </p>
    <p
      v-if="note"
      class="text-xs text-dimmed"
    >
      {{ note }}
    </p>
  </div>
</template>
