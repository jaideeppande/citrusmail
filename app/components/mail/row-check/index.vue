<script setup lang="ts">
// The tick that takes the avatar's place on a row, for the pointer. The
// keyboard ticks rows with its own shortcut (x) instead
defineProps<{
  checked: boolean
}>()
</script>

<template>
  <!-- Hidden from assistive technology: it sits inside the row's button, and
    a control can't be inside another. The row says "selected" itself -->
  <span
    aria-hidden="true"
    data-check
    class="lb-row-check"
    :data-checked="checked"
  >
    <UIcon
      name="i-lucide-check"
      class="size-3.5"
    />
  </span>
</template>
