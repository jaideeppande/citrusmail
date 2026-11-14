<script setup lang="ts">
// The keys of one shortcut, drawn: a chord's keys side by side, a sequence
// with “then” between its presses, alternatives with “or” between them
defineProps<{
  keys: string[]
}>()

/** `g-i` is two presses; `meta_k` is one */
const presses = (key: string) => key.length > 1 && key.includes('-') && !key.includes('_') ? key.split('-').filter(Boolean) : [key]
</script>

<template>
  <span class="flex flex-wrap items-center justify-end gap-1">
    <span
      v-if="!keys.length"
      class="text-sm text-dimmed"
    >No key</span>
    <template
      v-for="(key, index) in keys"
      :key="key"
    >
      <span
        v-if="index"
        class="text-xs text-dimmed"
      >or</span>
      <template
        v-for="(press, step) in presses(key)"
        :key="step"
      >
        <span
          v-if="step"
          class="text-xs text-dimmed"
        >then</span>
        <span class="flex items-center gap-0.5">
          <UKbd
            v-for="part in shortcutParts(press)"
            :key="part"
            :value="part"
            variant="soft"
          />
        </span>
      </template>
    </template>
  </span>
</template>
