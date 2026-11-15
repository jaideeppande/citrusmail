<script setup lang="ts">
// What every skeleton sits in: one status for the whole block, so a screen
// reader hears "Loading" once rather than once per row, and the rows arrive
// one after another
withDefaults(defineProps<{
  count?: number
  /** What is loading, for screen readers: "Loading messages" */
  label?: string
}>(), {
  count: 1,
  label: 'Loading'
})
</script>

<template>
  <div
    role="status"
    aria-busy="true"
  >
    <span class="sr-only">{{ label }}</span>
    <div
      v-for="index in count"
      :key="index"
      class="lb-stagger"
      :style="{ '--lb-i': index - 1 }"
    >
      <slot :index="index - 1" />
    </div>
  </div>
</template>
