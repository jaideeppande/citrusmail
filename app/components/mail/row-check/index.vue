<script setup lang="ts">
// The tick that takes the avatar's place on a row. Not a real checkbox: the
// row around it is a button, and a control can't sit inside another. The
// keyboard ticks rows with its own shortcut instead
defineProps<{
  checked: boolean
}>()
</script>

<template>
  <span
    role="checkbox"
    :aria-checked="checked"
    aria-label="Select"
    class="lb-row-check"
    :data-checked="checked"
  >
    <UIcon
      name="i-lucide-check"
      class="size-3.5"
    />
  </span>
</template>
